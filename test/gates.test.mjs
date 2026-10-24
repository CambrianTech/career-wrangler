// test/gates.test.mjs — slice 4: the human-gate queue, as behavior not claim.
// Proves against real rows on disk: one open gate per submission (redelivery calm),
// approve/resend/close land atomically with the state they imply (invariant 7 at the
// DB level for final_submit), in_flight external-effect acts OPEN A GATE and are never
// re-executed (invariant 3), and handler policy is data: 'human' by default, an
// unregistered name refused at write time so a typo can never silently unstaff a gate.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDb, fkPragmaOn } from '../src/db.js';
import { applyMigrations } from '../src/migrate.js';
import {
  openGate, completeGate, recoverInFlight, drainGateHandlers, GATE_HANDLER_DESTINATION,
  registerGateHandler, setGateHandler, resolveGateHandler, gateHandlerNames,
  NotFoundError, GateNotOpenError, CrossOwnerError, BadGateInputError,
} from '../src/gates.js';

// A fresh on-disk database per test: real rows under the composite FKs.
function freshDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gates-test-'));
  const file = path.join(dir, 'career.sqlite');
  const db = openDb(file);
  t.after(() => { try { db.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });
  assert.equal(fkPragmaOn(db), true, 'foreign_keys must be ON for the composite FKs to bite');
  applyMigrations(db);
  return db;
}

function seedSubmission(db, { id = randomUUID(), owner = 'u-a', status = 'waiting_on_human', whoseTurn = 'human' } = {}) {
  if (!db.prepare('SELECT id FROM users WHERE id = ?').get(owner))
    db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES (?, ?, 'human', 0)`).run(owner, owner);
  const pid = randomUUID();
  db.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
              VALUES (?, ?, ?, 'T', 'C', 'board', 0, 0)`).run(pid, owner, `https://x.example/${pid}`);
  db.prepare(`INSERT INTO submissions (id,owner_id,posting_id,status,whose_turn,created_at)
              VALUES (?, ?, ?, ?, ?, 0)`).run(id, owner, pid, status, whoseTurn);
  return id;
}

const openGates = (db, subId) => db.prepare(
  'SELECT * FROM gate_actions WHERE submission_id = ? AND closed_at IS NULL').all(subId);

test('openGate: exactly one open gate per submission; redelivery is a query, not an act', (t) => {
  const db = freshDb(t);
  seedSubmission(db, { owner: 'u-b' }); // u-b exists only as persona in other tests; here we are the owner
  const subId = db.prepare(`SELECT id FROM submissions ORDER BY created_at DESC LIMIT 1`).get().id;

  const r1 = openGate(db, { actor: 'u-b', requestId: 'open-1', submissionId: subId, kind: 'captcha', ask: 'Solve the puzzle on the site.' });
  assert.equal(r1.opened, true);
  assert.equal(r1.duplicate, false);
  assert.equal(openGates(db, subId).length, 1);

  // Redelivery with a DIFFERENT key: an open gate already sits there → existing row, no new act.
  const r2 = openGate(db, { actor: 'u-b', requestId: 'open-2', submissionId: subId, kind: 'login', ask: 'Log in.' });
  assert.equal(r2.opened, false);
  assert.equal(r2.duplicate, true);
  assert.equal(r2.gate.id, r1.gate.id);
  assert.equal(openGates(db, subId).length, 1);
  // Only the actual opening landed in action_log: one gate.open row.
  assert.equal(Number(db.prepare(`SELECT COUNT(*) c FROM action_log WHERE verb = 'gate.open'`).get().c), 1);

  // Redelivery with the SAME key is also calm — it never re-executes.
  const r3 = openGate(db, { actor: 'u-b', requestId: 'open-1', submissionId: subId, kind: 'captcha', ask: 'Solve the puzzle on the site.' });
  assert.equal(r3.opened, false);
  assert.equal(openGates(db, subId).length, 1);
});

test('openGate refuses cross-owner (invariant 6) and unknown submissions', (t) => {
  const db = freshDb(t);
  seedSubmission(db, { owner: 'u-a' });
  const subId = db.prepare(`SELECT id FROM submissions ORDER BY created_at DESC LIMIT 1`).get().id;

  if (!db.prepare('SELECT id FROM users WHERE id = ?').get('u-b'))
    db.prepare(`INSERT INTO users (id,name,kind,peer_id,created_at) VALUES ('u-b','B','citizen','p-b',0)`).run();
  assert.throws(() => openGate(db, { actor: 'u-b', requestId: 'x-1', submissionId: subId, kind: 'login', ask: 'Log in.' }), CrossOwnerError);

  assert.throws(() => openGate(db, { actor: 'u-a', requestId: 'x-2', submissionId: randomUUID(), kind: 'login', ask: 'Log in.' }), NotFoundError);
  assert.equal(openGates(db, subId).length, 0, 'a refused open leaves no gate behind');
});

test('completeGate approve on final_submit is invariant 7 itself: submitted + approved atomically', (t) => {
  const db = freshDb(t);
  seedSubmission(db, { owner: 'u-a', status: 'waiting_on_human' });
  const subId = db.prepare(`SELECT id FROM submissions ORDER BY created_at DESC LIMIT 1`).get().id;

  const g = openGate(db, { actor: 'u-a', requestId: 'g-1', submissionId: subId, kind: 'final_submit', ask: 'Press submit on the site.' });
  assert.equal(g.opened, true);

  const r = completeGate(db, { actor: 'u-a', requestId: 'dec-1', gateId: g.gate.id, decision: 'approve' });
  assert.equal(r.duplicate, false);
  assert.equal(r.gate.closed_at !== null, true);
  assert.equal(r.gate.closed_by, 'u-a');

  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
  assert.equal(sub.status, 'submitted');
  assert.equal(sub.approved_by, 'u-a', 'invariant 7: a submitted row carries its approval in the SAME transaction');
  assert.ok(sub.submitted_at !== null && sub.submitted_at !== undefined);

  // Redelivered approve under the same key: no re-execution, current state returned.
  const r2 = completeGate(db, { actor: 'u-a', requestId: 'dec-1', gateId: g.gate.id, decision: 'approve' });
  assert.equal(r2.duplicate, true);
  assert.equal(Number(db.prepare(`SELECT COUNT(*) c FROM action_log WHERE verb = 'gate.approve'`).get().c), 1);

  // A fresh key against the now-closed gate is refused — it is not a duplicate.
  assert.throws(() => completeGate(db, { actor: 'u-a', requestId: 'dec-2', gateId: g.gate.id, decision: 'approve' }), GateNotOpenError);
});

// --- completeGate: resend / close / non-final approve ---------------------------------

test('resend on final_submit closes the gate and returns the turn to the persona', (t) => {
  const db = freshDb(t);
  const subId = seedSubmission(db, {});
  const g = openGate(db, { actor: 'u-a', requestId: 'open-r1', submissionId: subId, kind: 'final_submit', ask: 'send it?' });
  assert.equal(g.opened, true);
  const r = completeGate(db, { actor: 'u-a', requestId: 'dec-resend', gateId: g.gate.id, decision: 'resend' });
  assert.equal(r.duplicate, false);
  assert.ok(r.gate.closed_at, 'the gate row is closed');
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
  assert.equal(sub.whose_turn, 'persona', 'turn returns to the persona for re-execution');
  assert.notEqual(sub.status, 'submitted', 'resend must not announce a send that never happened');
});

test('close on final_submit closes the submission itself', (t) => {
  const db = freshDb(t);
  const subId = seedSubmission(db, {});
  const g = openGate(db, { actor: 'u-a', requestId: 'open-r1', submissionId: subId, kind: 'final_submit', ask: 'send it?' });
  assert.equal(g.opened, true);
  const r = completeGate(db, { actor: 'u-a', requestId: 'dec-close', gateId: g.gate.id, decision: 'close' });
  assert.equal(r.duplicate, false);
  assert.ok(r.gate.closed_at);
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
  assert.equal(sub.status, 'closed');
});

test('approve on a non-final gate hands the turn back without touching submission status', (t) => {
  const db = freshDb(t);
  const subId = seedSubmission(db, {});
  const g = openGate(db, { actor: 'u-a', requestId: 'open-r1', submissionId: subId, kind: 'captcha', ask: 'solve this' });
  assert.equal(g.opened, true);
  const r = completeGate(db, { actor: 'u-a', requestId: 'dec-cap', gateId: g.gate.id, decision: 'approve' });
  assert.equal(r.duplicate, false);
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(subId);
  assert.equal(sub.whose_turn, 'persona');
  assert.equal(sub.status, 'waiting_on_human', "a non-final approve leaves status to the persona");
});

// --- recoverInFlight: in_flight external sends open gates; they are never re-executed ----

test('recoverInFlight opens a final_submit gate for an in_flight submission.submit and stays calm on rerun', (t) => {
  const db = freshDb(t);
  const subId = seedSubmission(db, {});
  // The act that may have left the building: recorded by the pipeline as still in_flight.
  const actionId = randomUUID();
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,0,'in_flight')`)
    .run(actionId, 'u-a', `req-send-${actionId}`, 'submission.submit', JSON.stringify({ kind: 'submission', id: subId }));

  const r1 = recoverInFlight(db);
  assert.equal(r1.checked, 1);
  assert.equal(r1.opened.length, 1);
  assert.equal(r1.opened[0].kind, 'final_submit');
  // The original row stays untouched — its in_flight outcome IS the record that this act
  // can never be blindly re-executed (invariant 3).
  const row = db.prepare('SELECT * FROM action_log WHERE id = ?').get(actionId);
  assert.equal(row.outcome, 'in_flight', 'recovery never rewrites the in_flight row');

  // Second run: the progress marker (the gate.open act under recover-<id>) excludes this
  // row at selection time → calm; nothing re-examined, no second act lands.
  const actsBefore = Number(db.prepare(`SELECT COUNT(*) c FROM action_log WHERE verb LIKE 'gate.%'`).get().c);
  const r2 = recoverInFlight(db);
  assert.equal(r2.checked, 0, 'marker excludes the row from the window — no re-examination');
  assert.equal(r2.opened.length, 0);
  assert.equal(Number(db.prepare(`SELECT COUNT(*) c FROM action_log WHERE verb LIKE 'gate.%'`).get().c), actsBefore, 'no new act on a calm rerun');
});

test('recoverInFlight ignores in_flight verbs with no external effect', (t) => {
  const db = freshDb(t);
  db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();
  const actionId = randomUUID();
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,0,'in_flight')`)
    .run(actionId, 'u-a', `req-x-${actionId}`, 'posting.tracked', JSON.stringify({ postingId: 'p-x' }));

  const r = recoverInFlight(db);
  // Non-external rows never enter the candidate window at all — they cannot starve it.
  assert.equal(r.checked, 0, 'filtered out of selection; not even examined');
  assert.equal(r.opened.length, 0, 'no external effect → nothing to gate');
});

test('recoverInFlight traverses a backlog larger than one window across restarts (no starvation)', (t) => {
  const db = freshDb(t);
  // 51 distinct submissions, each with one in_flight external send — one past the default
  // window of 50. Under the old selection this tail row starved forever: every startup
  // re-examined the same first 50 (already gated) and never reached it.
  const subIds = [];
  for (let i = 0; i < 51; i++) {
    const subId = seedSubmission(db, {});
    subIds.push(subId);
    db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,?,'in_flight')`)
      .run(randomUUID(), 'u-a', `req-send-${i}`, 'submission.submit',
        JSON.stringify({ kind: 'submission', id: subId }), i);
  }

  const r1 = recoverInFlight(db); // startup #1
  assert.equal(r1.checked, 50, 'first window covers exactly the limit');
  assert.equal(r1.opened.length, 50);

  const r2 = recoverInFlight(db); // restart: the starved tail is now reachable
  assert.equal(r2.checked, 1, 'only the previously-starved row remains a candidate');
  assert.equal(r2.opened.length, 1);

  const r3 = recoverInFlight(db); // and then calm — nothing re-examined ever again
  assert.equal(r3.checked, 0);
  assert.equal(r3.opened.length, 0);

  // Every submission ended with exactly one gate; none got two (no duplicate sends).
  let openGates = 0;
  for (const id of subIds) openGates += db.prepare(
    'SELECT COUNT(*) c FROM gate_actions WHERE submission_id = ? AND closed_at IS NULL').get(id).c;
  assert.equal(openGates, 51);
  const totalGateActs = Number(db.prepare(
    `SELECT COUNT(*) c FROM action_log WHERE verb = 'gate.open' AND request_id LIKE 'recover-%'`).get().c);
  assert.equal(totalGateActs, 51, 'one gate.open act per recovered send — no duplicates');
  const untouched = Number(db.prepare(`SELECT COUNT(*) c FROM action_log
    WHERE outcome = 'in_flight' AND verb = 'submission.submit'`).get().c);
  assert.equal(untouched, 51, 'original in_flight rows stay untouched forever (invariant 3)');
});

test('recoverInFlight lands a recovery.checked marker when another path already gates the send', (t) => {
  const db = freshDb(t);
  const subId = seedSubmission(db, {});
  // Two in_flight external rows for ONE submission: A first by intent_at, B behind it.
  const aId = randomUUID();
  const bId = randomUUID();
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,?,'in_flight')`)
    .run(aId, 'u-a', `req-sa-${aId}`, 'submission.submit', JSON.stringify({ kind: 'submission', id: subId }), 0);
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,?,'in_flight')`)
    .run(bId, 'u-a', `req-sb-${bId}`, 'submission.submit', JSON.stringify({ kind: 'submission', id: subId }), 1);

  const r1 = recoverInFlight(db);
  assert.equal(r1.checked, 2);
  assert.equal(r1.opened.length, 1, 'A opens the gate');
  assert.ok(r1.skipped.some((s) => s.actionId === bId && s.reason === 'gate already open'));

  // B's marker landed: a recovery.checked act under its stable key — honest log, no re-nag.
  const m = db.prepare(`SELECT * FROM action_log WHERE request_id = ?`).get('recover-' + bId);
  assert.equal(m.verb, 'recovery.checked', 'defensive path leaves an explicit progress marker');

  // Next startup: both rows excluded at selection time — calm, nothing re-examined.
  const r2 = recoverInFlight(db);
  assert.equal(r2.checked, 0);
  assert.equal(r2.opened.length, 0);
});

// --- handler delivery: the resolved handler is invoked, not merely reported (send-back finding 2) ----

test('opening a gate announces it on the outbox; drain invokes the selected handler exactly once', async (t) => {
  const db = freshDb(t);
  seedSubmission(db, {}); // owner u-a
  const subId = db.prepare(`SELECT id FROM submissions ORDER BY created_at DESC LIMIT 1`).get().id;

  let calls = [];
  registerGateHandler('spy-deliver', async ({ gate }) => { calls.push(gate); });
  setGateHandler(db, { ownerId: 'u-a', kind: 'captcha', handler: 'spy-deliver' });

  const r1 = openGate(db, { actor: 'u-a', requestId: 'open-spy-1', submissionId: subId, kind: 'captcha', ask: 'Solve it.' });
  assert.equal(r1.opened, true);

  // The announcement landed atomically with the open — one pending row carrying what a drainer needs.
  const rows = db.prepare(`SELECT * FROM outbox WHERE destination = ? AND dispatched_at IS NULL`).all(GATE_HANDLER_DESTINATION);
  assert.equal(rows.length, 1);
  const payload = JSON.parse(rows[0].payload);
  assert.equal(payload.gateId, r1.gate.id);
  assert.equal(payload.submissionId, subId);
  assert.equal(payload.ownerId, 'u-a');
  assert.equal(payload.kind, 'captcha');

  const d1 = await drainGateHandlers(db);
  assert.equal(d1.delivered, 1);
  assert.equal(calls.length, 1, 'the selected handler was INVOKED — resolution alone was the old hole');
  assert.equal(calls[0].id, r1.gate.id);
  assert.equal(calls[0].kind, 'captcha');

  // Redelivery with a fresh key: an open gate already sits there → no second announcement.
  const r2 = openGate(db, { actor: 'u-a', requestId: 'open-spy-2', submissionId: subId, kind: 'login', ask: 'Log in.' });
  assert.equal(r2.duplicate, true);
  const total = db.prepare(`SELECT COUNT(*) c FROM outbox WHERE destination = ? AND payload LIKE '%' || ? || '%'`)
    .get(GATE_HANDLER_DESTINATION, r1.gate.id).c;
  assert.equal(total, 1, 'spent exactly once by success — the duplicate announces nothing');
});

test('a rejecting handler leaves its delivery pending; re-drain invokes exactly once more', async (t) => {
  const db = freshDb(t);
  seedSubmission(db, {});
  const subId = db.prepare(`SELECT id FROM submissions ORDER BY created_at DESC LIMIT 1`).get().id;

  let calls = 0;
  registerGateHandler('flaky-deliver', async () => { calls += 1; throw new Error('handler exploded'); });
  setGateHandler(db, { ownerId: 'u-a', kind: 'captcha', handler: 'flaky-deliver' });

  const r1 = openGate(db, { actor: 'u-a', requestId: 'open-flaky-1', submissionId: subId, kind: 'captcha', ask: 'Solve it.' });
  assert.equal(r1.opened, true);

  await assert.rejects(() => drainGateHandlers(db), /handler exploded/);
  assert.equal(calls, 1, 'first attempt invoked and rejected');
  const pending = db.prepare(`SELECT COUNT(*) c FROM outbox WHERE destination = ? AND dispatched_at IS NULL`)
    .get(GATE_HANDLER_DESTINATION).c;
  assert.equal(pending, 1, 'rejection stops the drain — row stays pending for next time (slice-2 semantics)');

  // Recovered: re-register a working handler under the same name and drain again.
  registerGateHandler('flaky-deliver', async () => { calls += 1; });
  const d2 = await drainGateHandlers(db);
  assert.equal(d2.delivered, 1);
  assert.equal(calls, 2, 're-drain invokes exactly once more — no lost delivery, no double effect');
});

test('a gate closed before delivery acks quietly without invoking its handler', async (t) => {
  const db = freshDb(t);
  seedSubmission(db, {});
  const subId = db.prepare(`SELECT id FROM submissions ORDER BY created_at DESC LIMIT 1`).get().id;

  let calls = 0;
  registerGateHandler('quiet-deliver', async () => { calls += 1; });
  setGateHandler(db, { ownerId: 'u-a', kind: 'captcha', handler: 'quiet-deliver' });

  const r1 = openGate(db, { actor: 'u-a', requestId: 'open-quiet-1', submissionId: subId, kind: 'captcha', ask: 'Solve it.' });
  assert.equal(r1.opened, true);

  // The person acts before the drainer runs — or a crash window closes over the announcement.
  const c = completeGate(db, { actor: 'u-a', requestId: 'dec-quiet-1', gateId: r1.gate.id, decision: 'approve' });
  assert.equal(c.duplicate, false);

  const d1 = await drainGateHandlers(db);
  assert.equal(d1.delivered, 1, 'the announcement still leaves — acked');
  assert.equal(calls, 0, 'but the handler is never invoked: someone already acted on it');
  const pending = db.prepare(`SELECT COUNT(*) c FROM outbox WHERE destination = ? AND dispatched_at IS NULL`)
    .get(GATE_HANDLER_DESTINATION).c;
  assert.equal(pending, 0);
});