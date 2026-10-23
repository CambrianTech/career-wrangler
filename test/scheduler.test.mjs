// test/scheduler.test.mjs — slice-3 acceptance for the job_runs lease mechanism:
//   * exactly-once catch-up of missed windows (downtime produces one make-up run per window);
//   * first observation anchors at the current window and never reaches into the past;
//   * lapsed-lease takeover by another runner for a killed holder — once, with the lease
//     re-stamped to the new owner;
//   * concurrent runners partition windows by INSERT race (the unique index is the arbiter);
//   * a failing body lands as status='failed', readable, and its window is never re-queued.
// All timing goes through createScheduler's injectable `now`, so every test is deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { applyMigrations } from '../src/migrate.js';
import { createScheduler } from '../src/scheduler.js';

const I = 60_000; // one-minute windows
// Aligned to minute boundaries: 1_792_800_000_000 / 60_000 === 29_880_000 exactly.
const T0 = 1_792_800_000_000;

function freshDb() {
  const db = openDb(':memory:');
  applyMigrations(db);
  return db;
}

function insertUsers(db, ...ids) {
  for (const id of ids)
    db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES (?, ?, 'human', 0)`).run(id, id.toUpperCase());
}

function rowsFor(db, jobKey) {
  return db.prepare('SELECT * FROM job_runs WHERE job_key = ? ORDER BY due_ms').all(jobKey);
}

test('first observation claims exactly the current window — no past catch-up', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a');
  let calls = 0;
  const sched = createScheduler(db, { owner: 'u-a', leaseTtlMs: 5_000, now: () => T0 });
  sched.register('scan.postings', { intervalMs: I, run: async () => { calls += 1; } });

  const out = await sched.tick('scan.postings'); // clock at T0 (an exact window boundary)
  assert.equal(out.length, 1, 'exactly one window claimed on first observation');
  assert.deepEqual({ dueMs: out[0].dueMs, status: out[0].status }, { dueMs: T0, status: 'done' });
  assert.equal(calls, 1);

  const rows = rowsFor(db, 'scan.postings');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].lease_owner, 'u-a');
  assert.ok(rows[0].lease_expires_at > T0, 'fresh lease stamped at claim time');
  assert.equal(rows[0].status, 'done');
  assert.equal(rows[0].finished_at, T0);

  // Same window again — nothing to do; the high-water mark already covers it.
  assert.deepEqual(await sched.tick('scan.postings'), []);
  assert.equal(calls, 1);
});

test('downtime: every missed window is caught up exactly once, in order', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a');
  let clock = T0;
  const seen = new Map(); // dueMs -> run count
  const sched = createScheduler(db, { owner: 'u-a', leaseTtlMs: 5_000, now: () => clock });
  sched.register('followups.due', {
    intervalMs: I,
    run: async ({ dueMs }) => { seen.set(dueMs, (seen.get(dueMs) ?? 0) + 1); },
  });

  await sched.tick('followups.due'); // runs window T0
  clock = T0 + 3 * I;               // process was down for three full windows
  const out = await sched.tick('followups.due');

  assert.deepEqual(
    out.map((r) => r.dueMs),
    [T0 + I, T0 + 2 * I, T0 + 3 * I],
    'make-up runs for each missed window, oldest first'
  );
  assert.ok(out.every((r) => r.status === 'done'));
  assert.equal(seen.get(T0), 1);
  assert.equal(seen.get(T0 + I), 1, 'each missed window ran exactly once');
  assert.equal(seen.get(T0 + 2 * I), 1);
  assert.equal(seen.get(T0 + 3 * I), 1);

  const rows = rowsFor(db, 'followups.due');
  assert.equal(rows.length, 4, 'one row per window — invariant 5: no duplicates possible');

  // Re-ticking at the same instant is a no-op; advancing one more boundary adds exactly one.
  assert.deepEqual(await sched.tick('followups.due'), []);
  clock = T0 + 4 * I;
  const out2 = await sched.tick('followups.due');
  assert.equal(out2.length, 1);
  assert.equal(out2[0].dueMs, T0 + 4 * I);
});

test('killed runner: its lapsed window is taken over exactly once by another owner', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a', 'u-b');
  let clock = T0;
  let runsByA = 0;
  let runsByB = 0;

  const mk = (owner) => createScheduler(db, { owner, leaseTtlMs: 5_000, now: () => clock });
  const bodyFor = (who) => async ({ dueMs }) => {
    if (who === 'A') runsByA += 1; else runsByB += 1;
    assert.ok(Number.isFinite(dueMs));
  };

  // Runner A claims window T0 and is killed before its body ever completes: the database keeps
  // exactly what a kill leaves behind — status='running', A's lease, an expiry that will pass.
  const schedA = mk('u-a');
  let callsForA = 0;
  schedA.register('scan.postings', { intervalMs: I, run: async () => { callsForA += 1; } });
  const runId = schedA.claimWindow('scan.postings', T0); // real claim path — INSERT under the unique index
  assert.ok(runId, 'A claims window T0');

  clock = T0 + I + 6_000; // A is gone; its lease (T0+5s) has lapsed; one further window came due
  const schedB = mk('u-b');
  schedB.register('scan.postings', { intervalMs: I, run: bodyFor('B') });
  const out = await schedB.tick('scan.postings');

  assert.equal(out.length, 2, 'takeover of the lapsed window + catch-up of the missed one');
  assert.deepEqual(
    out.map((r) => r.dueMs),
    [T0, T0 + I],
    'oldest first: make-up run before new windows'
  );
  assert.equal(runsByA, 0, 'the killed holder never ran its body');
  assert.equal(runsByB, 2, 'B ran the taken-over window once and the caught-up window once');

  const rows = rowsFor(db, 'scan.postings');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, 'done');
  assert.equal(rows[0].lease_owner, 'u-b', 'lease re-stamped to the new owner on takeover');
  assert.ok(rows[0].lease_expires_at > T0 + I + 6_000, 'fresh expiry stamped by B — lapses again only if B dies too');

  // A "comes back" (or a third runner ticks): the window is done, not lapsed — never re-run.
  const schedC = mk('u-a');
  schedC.register('scan.postings', { intervalMs: I, run: async () => { runsByA += 1; } });
  assert.deepEqual(await schedC.tick('scan.postings'), []);
  assert.equal(runsByB, 2, 'no double execution after takeover');

  // And if B had died mid-run too (row left running with its own lapsed lease), a third runner
  // takes over exactly once as well.
  db.prepare(`UPDATE job_runs SET status = 'running', finished_at = NULL, lease_expires_at = ? WHERE id = ?`)
    .run(T0 + I, rows[1].id); // simulate B killed while handling window T0+I
  const schedD = mk('u-b');
  let dRuns = 0;
  schedD.register('scan.postings', { intervalMs: I, run: async () => { dRuns += 1; } });
  clock = T0 + 2 * I;
  const outD = await schedD.tick('scan.postings');
  assert.equal(outD.length, 2); // takeover of T0+I plus the newly due T0+2I
  assert.equal(dRuns, 2);
});

test('a stale holder finishing late cannot write done over its replacement — fencing epoch refuses it', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a', 'u-b');
  let clock = T0;
  let releaseA, releaseB, ranByA = 0, ranByB = 0;

  const schedA = createScheduler(db, { owner: 'u-a', leaseTtlMs: 10, now: () => clock });
  const schedB = createScheduler(db, { owner: 'u-b', leaseTtlMs: 10, now: () => clock });
  schedA.register('scan.postings', {
    intervalMs: I,
    run: async () => { ranByA += 1; await new Promise((r) => (releaseA = r)); }, // body hangs past the TTL
  });
  schedB.register('scan.postings', {
    intervalMs: I,
    run: async () => { ranByB += 1; await new Promise((r) => (releaseB = r)); },
  });

  // A claims window T0 with its body in flight; the clock passes A's lease expiry. A is alive — slow.
  const pa = schedA.tick('scan.postings'); // not awaited: body pending
  clock = T0 + 11; // past A's expiry (T0 + 10)

  // B takes over while A still lives and its own body hangs too: expiry did not prove death.
  const pb = schedB.tick('scan.postings');
  let row = rowsFor(db, 'scan.postings')[0];
  assert.equal(row.status, 'running');
  assert.equal(row.lease_owner, 'u-b', 'the replacement holds the lease');
  assert.equal(row.lease_epoch, 2, 'takeover bumped the fencing epoch');

  // A's body completes late: its terminal write CASes against (owner u-a, epoch 1) — refused.
  releaseA();
  const outA = await pa;
  assert.equal(outA.length, 1);
  assert.equal(outA[0].status, 'superseded', 'the stale outcome comes back superseded, never recorded');
  row = rowsFor(db, 'scan.postings')[0];
  assert.equal(row.status, 'running', 'A finishing late did NOT mark the row done while B is in flight');
  assert.equal(row.lease_owner, 'u-b');

  // Only B's outcome is authoritative: it completes second and owns the done state.
  releaseB();
  const outB = await pb;
  assert.equal(outB.length, 1);
  assert.equal(outB[0].status, 'done');
  row = rowsFor(db, 'scan.postings')[0];
  assert.equal(row.status, 'done', "the replacement's outcome is the one recorded");
  assert.equal(row.lease_owner, 'u-b');

  // The honest guarantee: BOTH bodies ran — fencing fences STATE, not execution; effect dedup is act()'s job.
  assert.equal(ranByA, 1);
  assert.equal(ranByB, 1);
});

test('a stale holder failing late cannot write failed over its replacement — symmetric refusal', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a', 'u-b');
  let clock = T0;
  let rejectA;

  const schedA = createScheduler(db, { owner: 'u-a', leaseTtlMs: 10, now: () => clock });
  const schedB = createScheduler(db, { owner: 'u-b', leaseTtlMs: 10, now: () => clock });
  schedA.register('scan.postings', {
    intervalMs: I,
    run: async () => { await new Promise((_, rej) => (rejectA = rej)); }, // hangs, then throws late
  });
  schedB.register('scan.postings', { intervalMs: I, run: async () => {} }); // fast body

  const pa = schedA.tick('scan.postings'); // A's body in flight past the TTL
  clock = T0 + 11;
  const outB = await schedB.tick('scan.postings'); // B takes over and finishes cleanly first
  assert.equal(outB.length, 1);
  assert.equal(outB[0].status, 'done');

  // A then fails LATE: its terminal write must not record failed over the replacement's done.
  rejectA(new Error('late crash from a superseded holder'));
  const outA = await pa;
  assert.equal(outA.length, 1);
  assert.equal(outA[0].status, 'superseded');
  assert.match(outA[0].error, /late crash/, 'the stale error rides back for logging even though unrecorded');

  const row = rowsFor(db, 'scan.postings')[0];
  assert.equal(row.status, 'done', "B's outcome survived A's late failure");
  assert.equal(row.lease_owner, 'u-b');
});

test('concurrent runners partition windows by INSERT race — every window runs exactly once', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a', 'u-b');
  let clock = T0;
  const seen = new Map();
  const mk = (owner) => createScheduler(db, { owner, leaseTtlMs: 5_000, now: () => clock });

  const schedA = mk('u-a');
  const schedB = mk('u-b');
  for (const s of [schedA, schedB])
    s.register('scan.postings', { intervalMs: I, run: async ({ dueMs }) => seen.set(dueMs, (seen.get(dueMs) ?? 0) + 1) });

  // Both runners observe the same downtime and compute the identical candidate list; the unique
  // index hands each window to exactly one of them. Interleave ticks so neither wins outright.
  clock = T0;
  await schedA.tick('scan.postings');
  clock = T0 + I;
  const r1a = await schedA.tick('scan.postings');
  const r1b = await schedB.tick('scan.postings'); // same instant — the race
  assert.equal(r1a.length + r1b.length, 1, 'window T0+I claimed by exactly one runner');

  clock = T0 + 2 * I;
  await Promise.all([schedA.tick('scan.postings'), schedB.tick('scan.postings')]); // true concurrent race

  assert.equal(seen.get(T0), 1);
  assert.equal(seen.get(T0 + I), 1, 'no double execution under contention');
  assert.equal(seen.get(T0 + 2 * I), 1);
  const rows = rowsFor(db, 'scan.postings');
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.ok(r.lease_owner === 'u-a' || r.lease_owner === 'u-b', 'every row leased by a real user');
    assert.equal(r.status, 'done');
  }
});

test('a failing body lands as status=failed — readable, never re-queued', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a');
  let clock = T0;
  const sched = createScheduler(db, { owner: 'u-a', leaseTtlMs: 5_000, now: () => clock });
  let attempts = 0;
  sched.register('scan.postings', {
    intervalMs: I,
    run: async () => { attempts += 1; throw new Error('upstream 5xx'); },
  });

  const out = await sched.tick('scan.postings');
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'failed');
  assert.match(out[0].error, /upstream 5xx/);

  const row = rowsFor(db, 'scan.postings')[0];
  assert.equal(row.status, 'failed', 'the failure is recorded on the row — nowhere to lose it');
  assert.equal(row.finished_at, T0);

  // The window is capped at one run (invariant 5): later ticks must not retry it.
  clock = T0 + I;
  const out2 = await sched.tick('scan.postings');
  assert.equal(out2.length, 1);          // only the newly due window
  assert.equal(out2[0].dueMs, T0 + I);   // ...which also fails
  assert.equal(attempts, 2, 'the failed window was never re-queued');

  const rows = rowsFor(db, 'scan.postings');
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.status === 'failed'));
});

test('tickAll covers every registered job in registration order', async () => {
  const db = freshDb();
  insertUsers(db, 'u-a');
  let clock = T0;
  const ran = [];
  const sched = createScheduler(db, { owner: 'u-a', leaseTtlMs: 5_000, now: () => clock });
  sched.register('job.first', { intervalMs: I, run: async ({ jobKey }) => ran.push(jobKey) });
  sched.register('job.second', { intervalMs: 2 * I, run: async ({ jobKey }) => ran.push(jobKey) });

  const out = await sched.tickAll();
  assert.equal(out.length, 2);
  assert.deepEqual(ran, ['job.first', 'job.second']);

  clock = T0 + I; // only the one-minute job is due again
  const out2 = await sched.tickAll();
  assert.equal(out2.length, 1);
  assert.equal(out2[0].dueMs === T0 + I || out2[0].dueMs > T0, true);
});
