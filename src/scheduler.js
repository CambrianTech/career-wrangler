// src/scheduler.js — the job_runs lease mechanism (docs/data-model.md → job_runs, invariant 5).
//
// A "window" is one scheduled firing of a job: due_ms = floor(t / intervalMs) * intervalMs,
// aligned to epoch boundaries so that ANY two runners computing windows for the same wall-clock
// instant agree on the exact same due_ms value — across restarts and across processes. The
// database decides who runs it: claiming is an INSERT under the unique index uq_job_runs_window
// (job_key, due_ms), so a window can never be claimed twice no matter how many runners race or
// how often they restart. Downtime therefore produces exactly one make-up run per missed
// window — never zero (wedged), never two (double execution):
//   * the high-water mark is MAX(due_ms) over ALL rows for the job_key, so windows skipped while
//     we were down are each claimed in order on the next tick; a job seen for the first time
//     anchors at the CURRENT window and never reaches into the past;
//   * a row left 'running' by a killed runner lapses when lease_expires_at passes (or was never
//     set), and the next tick takes it over — UPDATE ... WHERE status='running' AND the lease is
//     lapsed — then re-runs its body. Idempotency of the effect itself is the act() layer's job
//     (request-id dedup); this slice provides the scheduling guarantee around it;
//   * EXPIRY DOES NOT PROVE DEATH: a holder whose body is still in flight past its TTL can be
//     taken over while alive, and when that late outcome lands it must not write done/failed over
//     the replacement's row. Every acquisition therefore carries a fencing epoch — 1 on claim,
//     +1 per takeover (job_runs.lease_epoch) — and terminal writes compare-and-set against owner
//     AND epoch while status is still 'running'. Only the current lease holder can move a row out
//     of 'running'; a stale holder's late outcome updates nothing and comes back as
//     status:'superseded' (its error preserved for logging), never recorded. What this fences is
//     STATE, not execution: the unique row promises one authoritative outcome per window; if two
//     bodies actually ran, deduping their effects is the act() boundary's job.

import { randomUUID } from 'node:crypto';

export function createScheduler(db, { owner = null, leaseTtlMs = 60_000, now = () => Date.now() } = {}) {
  const jobs = new Map(); // job_key -> { intervalMs, run }

  /**
   * Register a job body. `run(ctx)` receives `{ db, jobKey, dueMs, runId }`; it must be safe to
   * execute again for the same window (takeover re-runs), which the product guarantees at the
   * act() dedup boundary — the scheduler only ever hands one runner a given window.
   */
  function register(jobKey, def) {
    if (!def || !Number.isFinite(def.intervalMs) || def.intervalMs <= 0)
      throw new Error(`scheduler: ${jobKey} needs intervalMs > 0`);
    if (typeof def.run !== 'function') throw new Error(`scheduler: ${jobKey} needs run(ctx)`);
    jobs.set(jobKey, { jobKey, intervalMs: def.intervalMs, run: def.run });
    return scheduler;
  }

  /**
   * Claim one window: INSERT under the unique index. Returns `{ runId, epoch }` on success — a
   * fresh claim always carries epoch 1 (the column default) — and null when the database says
   * another runner already owns or handled this (job_key, due_ms). This is the exactly-once gate:
   * no in-memory bookkeeping can double a window.
   */
  function claimWindow(jobKey, dueMs) {
    const runId = randomUUID();
    try {
      db.prepare(
        `INSERT INTO job_runs (id, job_key, due_ms, started_at, status, lease_owner, lease_expires_at)
         VALUES (?, ?, ?, ?, 'running', ?, ?)`
      ).run(runId, jobKey, dueMs, now(), owner, now() + leaseTtlMs);
    } catch (err) {
      if (!String(err.message).includes('UNIQUE')) throw err; // a real failure is never swallowed as "taken"
      return null;
    }
    return { runId, epoch: 1 };
  }

  /**
   * Take over one lapsed window: the previous holder died mid-run (or never set an expiry), or
   * it is merely slow past its TTL and still alive — expiry does not prove death. Either way this
   * acquisition bumps the fencing epoch (+1) and re-stamps a fresh expiry atomically; if another
   * runner beat us to it, the WHERE clause updates nothing and we return null. The new epoch is
   * read back so the holder carries it into its terminal write (see finishRun).
   */
  function takeOverWindow(runId) {
    const info = db.prepare(
      `UPDATE job_runs SET lease_owner = ?, lease_expires_at = ?, lease_epoch = lease_epoch + 1
       WHERE id = ? AND status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`
    ).run(owner, now() + leaseTtlMs, runId, now());
    if (info.changes !== 1) return null;
    const epoch = db.prepare(`SELECT lease_epoch FROM job_runs WHERE id = ?`).get(runId).lease_epoch;
    return { runId, epoch };
  }

  /** Lapsed rows for one job_key, oldest first — the make-up queue a killed runner leaves behind. */
  function lapsedRuns(jobKey) {
    return db.prepare(
      `SELECT id, due_ms AS dueMs FROM job_runs
       WHERE job_key = ? AND status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
       ORDER BY due_ms ASC`
    ).all(jobKey, now());
  }

  /** The last window this job has ever had a row for — done, failed or still running. */
  function highwater(jobKey) {
    return db.prepare(`SELECT MAX(due_ms) AS hw FROM job_runs WHERE job_key = ?`).get(jobKey).hw; // null until first claim
  }

  /**
   * Terminal write with fencing: compare-and-set on owner AND epoch while the row is still
   * 'running'. Only the current lease holder can move a window out of running; a stale holder's
   * late outcome updates nothing and comes back as status:'superseded' (its error preserved for
   * logging), never recorded.
   */
  function finishRun(acq, jobKey, dueMs, status, error) {
    const info = db.prepare(
      `UPDATE job_runs SET status = ?, finished_at = ?
       WHERE id = ? AND status = 'running' AND lease_owner = ? AND lease_epoch = ?`
    ).run(status, now(), acq.runId, owner, acq.epoch);
    if (info.changes !== 1) return { runId: acq.runId, jobKey, dueMs, status: 'superseded', error };
    return { runId: acq.runId, jobKey, dueMs, status, ...(error ? { error } : {}) };
  }

  async function execute(acq, jobKey, dueMs) {
    const def = jobs.get(jobKey);
    try {
      await def.run({ db, jobKey, dueMs, runId: acq.runId });
      return finishRun(acq, jobKey, dueMs, 'done', null);
    } catch (err) {
      // The window is NOT re-queued: invariant 5 caps it at one claim per (job_key, due_ms). The
      // failure lands somewhere readable — a status='failed' row with finished_at set — never
      // silently lost (README resilience); the detail rides back in the returned entry for the
      // caller to log or surface. A superseded stale outcome is logged the same way; it writes
      // nothing.
      return finishRun(acq, jobKey, dueMs, 'failed', err.message);
    }
  }

  /**
   * One scheduler pass for one registered job, at time t (defaults to now()):
   *   1. take over every lapsed window first — a killed runner's make-up runs, oldest first,
   *      each re-executed against ITS OWN due_ms read from the row;
   *   2. claim and run each window due after the high-water mark up to t — exactly-once catch-up;
   *   3. windows already claimed (by us or anyone) are never touched again: the unique index is
   *      the only arbiter, so concurrent runners partition the same candidate list by INSERT race.
   * Returns one entry per window this tick actually ran.
   */
  async function tick(jobKey, t = now()) {
    if (!jobs.has(jobKey)) throw new Error(`scheduler: unknown job ${JSON.stringify(jobKey)}`);
    const def = jobs.get(jobKey);
    const results = [];

    for (const row of lapsedRuns(jobKey)) {
      const acq = takeOverWindow(row.id);
      if (acq) results.push(await execute(acq, jobKey, row.dueMs));
    }

    let hw = highwater(jobKey);
    const firstSeen = hw === null;
    if (firstSeen) hw = Math.floor(t / def.intervalMs) * def.intervalMs - def.intervalMs; // anchor: current window only, no past catch-up
    for (let due = hw + def.intervalMs; due <= t; due += def.intervalMs) {
      const acq = claimWindow(jobKey, due);
      if (acq) results.push(await execute(acq, jobKey, due)); // null → someone else owns it; skip
    }

    return results;
  }

  /** All registered jobs, in registration order — for a process that wants one global pass. */
  async function tickAll(t = now()) {
    const out = [];
    for (const jobKey of [...jobs.keys()]) out.push(...(await tick(jobKey, t)));
    return out;
  }

  const scheduler = { register, tick, tickAll, claimWindow, takeOverWindow, lapsedRuns, highwater };
  return scheduler;
}
