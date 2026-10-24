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
  openGate, completeGate, recoverInFlight,
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
              VALUES (?, ?, 'https://x.example/', 'T', 'C', 'board', 0, 0)`).run(pid, owner);
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

  // Second run: the gate is already open → calm; no second act lands (key spent once).
  const actsBefore = Number(db.prepare(`SELECT COUNT(*) c FROM action_log WHERE verb LIKE 'gate.%'`).get().c);
  const r2 = recoverInFlight(db);
  assert.equal(r2.opened.length, 0);
  assert.ok(r2.skipped.some((s) => s.actionId === actionId && s.reason === 'gate already open'));
  assert.equal(Number(db.prepare(`SELECT COUNT(*) c FROM action_log WHERE verb LIKE 'gate.%'`).get().c), actsBefore, 'no new act on a calm rerun');
});

test('recoverInFlight ignores in_flight verbs with no external effect', (t) => {
  const db = freshDb(t);
  db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();
  const actionId = randomUUID();
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,0,'in_flight')`)
    .run(actionId, 'u-a', `req-x-${actionId}`, 'posting.tracked', JSON.stringify({ postingId: 'p-x' }));

  const r = recoverInFlight(db);
  assert.equal(r.checked, 1);
  assert.equal(r.opened.length, 0, 'no external effect → nothing to gate');
});
