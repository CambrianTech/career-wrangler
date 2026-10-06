// src/outbox.js — transactional outbox: the act lands, then leaves.
//
// Three disciplines (docs/data-model.md invariants 2/3/4):
//   land     every effectful act is recorded in action_log; a successful
//            landing consumes its caller-chosen idempotency key (actor, request_id)
//   atomic   the outbox rows announcing an act are written in the SAME
//            TRANSACTION as the state change they announce — commit or vanish together
//   leave    the dispatcher drains at-least-once: deliver first, record second.
//            A row that was delivered but not yet recorded is re-delivered after a
//            crash, and receivers dedupe on (actor, request_id) so the duplicate
//            is harmless; a row whose delivery failed stays pending for the next drain

import { randomUUID } from 'node:crypto';

const UNIQUE_ACTION = /UNIQUE constraint failed/i;

function insertAction(db, actionId, actor, requestId, verb, targetJson, intentAt) {
  db.prepare(
    `INSERT INTO action_log (id, actor, request_id, verb, target, intent_at, outcome, outcome_at)
     VALUES (?, ?, ?, ?, ?, ?, 'in_flight', NULL)`
  ).run(actionId, actor, requestId, verb, targetJson, intentAt);
}

function findAction(db, { actionId = null, actor = null, requestId = null }) {
  if (actionId) return db.prepare('SELECT * FROM action_log WHERE id = ?').get(actionId);
  return db.prepare('SELECT * FROM action_log WHERE actor = ? AND request_id = ?').get(actor, requestId);
}

function insertOutbox(db, { destination, actionId, payload, now }) {
  const seq = Number(
    db.prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM outbox WHERE destination = ?')
      .get(destination).next
  );
  db.prepare(
    `INSERT INTO outbox (id, seq, destination, request_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), seq, destination, actionId, JSON.stringify(payload), now);
}

// Land an act: one BEGIN IMMEDIATE ... COMMIT that records the intent, applies
// the state change (mutate(db)) and writes every announcement — or rolls back
// all of it. On a duplicate key it does NOT re-execute anything and returns the
// already-recorded act (invariant 3). A failed attempt leaves NO row: the idempotency
// key is only consumed by success, so retrying with the same request_id is allowed.
export function act(db, { actor, requestId, verb, target, mutate = null, announce = [] }) {
  const actionId = randomUUID();
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = findAction(db, { actor, requestId });
    if (existing) {
      db.exec('COMMIT'); // read-only pass; release the write lock before returning
      return { duplicate: true, action: existing };
    }
    if (mutate) mutate(db);
    insertAction(db, actionId, actor, requestId, verb, JSON.stringify(target), now);
    for (const a of announce) {
      insertOutbox(db, { destination: a.destination, actionId, payload: a.payload ?? target, now });
    }
    db.prepare(`UPDATE action_log SET outcome = 'ok', outcome_at = ? WHERE id = ?`).run(now, actionId);
    db.exec('COMMIT');
    return { duplicate: false, action: findAction(db, { actionId }) };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* connection already unusable */ }
    throw err;
  }
}

// Write an outbox row inside the caller's OPEN transaction — for state-change
// modules that own their own BEGIN/COMMIT and must announce in-transaction.
export function announce(db, { destination, actionId, payload }) {
  insertOutbox(db, { destination, actionId, payload, now: Date.now() });
}

// Record a failed attempt explicitly (outcome 'error'). Consumes the key — use it
// when the failure is terminal and must not be retried under this request_id.
export function recordActError(db, { actor, requestId, verb, target, errorRef = null }) {
  const actionId = randomUUID();
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (findAction(db, { actor, requestId })) throw new Error(`request_id already recorded for actor ${actor}`);
    insertAction(db, actionId, actor, requestId, verb, JSON.stringify(target), now);
    db.prepare(`UPDATE action_log SET outcome = 'error', outcome_at = ?, error_ref = ? WHERE id = ?`)
      .run(now, errorRef, actionId);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* */ }
    throw err;
  }
  return findAction(db, { actionId });
}

// Drain one destination at-least-once: pending rows in seq order; deliver first,
// then record dispatched_at. A delivery that throws stops the drain (nothing after
// it is touched) and the failed row stays pending — the next drain re-delivers from
// there, so a delivered-but-unrecorded row may arrive twice by design. Receivers
// dedupe on request_id; the canonical receiver-side primitive is act() itself.
export function drainOutbox(db, { destination, deliver, limit = 100 }) {
  const rows = db.prepare(
    `SELECT * FROM outbox WHERE destination = ? AND dispatched_at IS NULL ORDER BY seq LIMIT ?`
  ).all(destination, limit);
  let delivered = 0;
  for (const row of rows) {
    deliver(row); // external effect — may throw; the record below never runs then
    db.exec('BEGIN IMMEDIATE');
    try {
      const res = db.prepare(
        'UPDATE outbox SET dispatched_at = ? WHERE id = ? AND dispatched_at IS NULL'
      ).run(Date.now(), row.id);
      if (Number(res.changes) !== 1) {
        // a concurrent drainer recorded this row first: its delivery is the one of record.
        db.exec('COMMIT');
        continue;
      }
      db.exec('COMMIT');
    } catch (err) {
      try { db.exec('ROLLBACK'); } catch { /* */ }
      throw err;
    }
    delivered += 1;
  }
  return { delivered, pending: rows.length - delivered };
}
