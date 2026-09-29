// scratch-verify-slice1.mjs — invariants 1–8 against docs/data-model.md (v4), on a fresh :memory: DB.
//
// Every check runs inside its own BEGIN/ROLLBACK pair so failed INSERTs and any
// partial rows from the preceding inserts never leak into later checks (autocommit
// mode would commit each statement individually, which is what poisoned inv6 last run).
import { openDb } from './src/db.js';
import { applyMigrations } from './src/migrate.js';
import assert from 'node:assert/strict';

const db = openDb(':memory:');
console.log('fkPragmaOn:', JSON.stringify(db.prepare('PRAGMA foreign_keys;').get()));
const r = applyMigrations(db);
assert.equal(r.applied, 17, `expected 17 migrations fresh, got ${r.applied}`);
assert.equal(db.prepare('SELECT COUNT(*) c FROM migration_log').get().c, 17);

// Each check: BEGIN; do the inserts that should be legal (or not); ROLLBACK to undo.
function withCheck(name, fn) {
  db.exec('BEGIN');
  try {
    fn();
  } finally {
    db.exec('ROLLBACK');
  }
  console.log(`${name} ok`);
}

db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();
db.prepare(`INSERT INTO users (id,name,kind,peer_id,created_at) VALUES ('u-b','B','citizen','p-b',0)`).run();

function insPosting(owner) { db.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at) VALUES ('p-1',?,'https://x.example/','T','C','board',0,0)`).run(owner); }
function insSubmission(id, owner, status, approvedBy = null) { db.prepare(`INSERT INTO submissions (id,owner_id,posting_id,status,whose_turn,approved_by,created_at) VALUES (?,?,'p-1',?,'human',?,0)`).run(id, owner, status, approvedBy); }

// Invariant 7: submitted without approved_by must fail.
withCheck('inv7 (submitted requires approved_by)', () => {
  insPosting('u-b');
  assert.throws(
    () => insSubmission('s-x', 'u-b', 'submitted'),
    /CHECK constraint failed/,
    'invariant 7 NOT enforced'
  );
});

// Invariant 6: cross-owner package against owner A's submission must fail (composite FK).
withCheck('inv6 (cross-owner package rejected)', () => {
  insPosting('u-a');
  insSubmission('s-1', 'u-a', 'found');
  assert.throws(
    () => db.prepare(`INSERT INTO packages (id,owner_id,submission_id,flavor_refs,sha256,created_at) VALUES ('pkg-1','u-b','s-1','[]','z',0)`).run(),
    /FOREIGN KEY constraint failed/,
    'invariant 6 NOT enforced'
  );
});

// Invariant 1: a second OPEN gate on the same submission must fail.
withCheck('inv1 (one open gate per submission)', () => {
  insPosting('u-a');
  insSubmission('s-2', 'u-a', 'waiting_on_human');
  db.prepare(`INSERT INTO gate_actions (id,owner_id,submission_id,kind,ask,opened_at) VALUES ('g-1','u-a','s-2','captcha','solve',0)`).run();
  assert.throws(
    () => db.prepare(`INSERT INTO gate_actions (id,owner_id,submission_id,kind,ask,opened_at) VALUES ('g-2','u-a','s-2','login','log in',0)`).run(),
    /UNIQUE constraint failed/,
    'invariant 1 NOT enforced'
  );
});

// Invariant 5: duplicate (job_key, due_ms) must fail.
withCheck('inv5 (unique job_key+due_ms)', () => {
  db.prepare(`INSERT INTO job_runs (id,job_key,due_ms,started_at) VALUES ('jr-1','scan.postings',1000,0)`).run();
  assert.throws(
    () => db.prepare(`INSERT INTO job_runs (id,job_key,due_ms,started_at) VALUES ('jr-2','scan.postings',1000,0)`).run(),
    /UNIQUE constraint failed/,
    'invariant 5 NOT enforced'
  );
});

// Invariant 2: same request_id by a DIFFERENT actor is allowed; same actor+key rejected.
withCheck('inv2 (per-actor idempotency keys)', () => {
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at) VALUES ('al-1','u-a','req-1','gate.complete','{"kind":"gate","id":"g-1"}',0)`).run();
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at) VALUES ('al-2','u-b','req-1','gate.close','{"kind":"gate","id":"g-1"}',0)`).run(); // cross-actor same key: legal
  assert.throws(
    () => db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at) VALUES ('al-3','u-a','req-1','gate.close','{"kind":"gate","id":"g-1"}',0)`).run(),
    /UNIQUE constraint failed/,
    'invariant 2 NOT enforced'
  );
});

// Happy path: approved submission + package (matching owner) roundtrip, committed for real.
withCheck('happy path (approved + same-owner package)', () => {
  insPosting('u-a');
  insSubmission('s-3', 'u-a', 'submitted', 'u-a');
  db.prepare(`INSERT INTO blobs (id,owner_id,sha256,bytes,created_at) VALUES ('b-1','u-a','abc',X'00',0)`).run();
  db.prepare(`INSERT INTO packages (id,owner_id,submission_id,flavor_refs,cover_letter_ref,sha256,created_at) VALUES ('pkg-9','u-a','s-3','[]','abc','z',0)`).run();
  assert.equal(db.prepare('SELECT COUNT(*) c FROM packages').get().c, 1);
});

// Re-run migrations on the same DB: idempotent no-op.
const r2 = applyMigrations(db);
assert.equal(r2.applied, 0, 're-apply must be a no-op');
console.log('re-apply ok:', JSON.stringify(r2));
db.close();
console.log('ALL INVARIANT CHECKS PASSED');
