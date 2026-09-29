// test/invariants.test.mjs — slice-1 schema checks against docs/data-model.md (v4).
// Coverage is exact, not aspirational: invariants 1, 2, 5, 6, 7 are enforced at the
// database level here (one migration per table; FKs / CHECKs / unique indexes do the
// enforcing) and each has a check below. Invariants 3, 4, 8 — no blind re-execution
// past the world, outbox-in-transaction discipline, lineage over mutation — are
// behavioral: PENDING with the act layer, not the schema; they are NOT claimed here.
// Each check opens a transaction on one shared in-memory DB and rolls back, so state
// never leaks between checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, fkPragmaOn } from '../src/db.js';
import { applyMigrations } from '../src/migrate.js';

const db = openDb(':memory:');

function withRollback(fn) {
  db.exec('BEGIN');
  try { fn(); } finally { db.exec('ROLLBACK'); }
}

test('foreign_keys pragma is live before any DDL', () => {
  // SQLite defaults it OFF per connection; cross-owner rejection (invariant 6)
  // only throws while the pragma is ON.
  assert.equal(fkPragmaOn(db), true, 'foreign_keys must be ON');
});

test('17 migrations land fresh; re-apply is a no-op', () => {
  const r = applyMigrations(db);
  assert.equal(r.applied, 17, `expected 17 migrations fresh, got ${r.applied}`);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM migration_log').get().c, 17);
  const r2 = applyMigrations(db);
  assert.equal(r2.applied, 0, 're-apply must be a no-op');
});

test('seed owners', () => {
  db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();
  db.prepare(`INSERT INTO users (id,name,kind,peer_id,created_at) VALUES ('u-b','B','citizen','p-b',0)`).run();
});

function insPosting(owner) {
  db.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
              VALUES ('p-1',?,'https://x.example/','T','C','board',0,0)`).run(owner);
}

function insSubmission(id, owner, status, approvedBy = null) {
  db.prepare(`INSERT INTO submissions (id,owner_id,posting_id,status,whose_turn,approved_by,created_at)
              VALUES (?,?,'p-1',?,'human',?,0)`).run(id, owner, status, approvedBy);
}

test('invariant 7: submitted requires approved_by', () => {
  withRollback(() => {
    insPosting('u-b');
    assert.throws(
      () => insSubmission('s-x', 'u-b', 'submitted'),
      /CHECK constraint failed/,
      'invariant 7 NOT enforced'
    );
  });
});

test('invariant 6: cross-owner package rejected (composite FK on submission_id, owner_id)', () => {
  withRollback(() => {
    insPosting('u-a');
    insSubmission('s-1', 'u-a', 'found');
    assert.throws(
      () => db.prepare(`INSERT INTO packages (id,owner_id,submission_id,flavor_refs,sha256,created_at) VALUES ('pkg-1','u-b','s-1','[]','z',0)`).run(),
      /FOREIGN KEY constraint failed/,
      'invariant 6 NOT enforced'
    );
  });
});

test('invariant 1: one open gate per submission (partial unique index)', () => {
  withRollback(() => {
    insPosting('u-a');
    insSubmission('s-2', 'u-a', 'waiting_on_human');
    db.prepare(`INSERT INTO gate_actions (id,owner_id,submission_id,kind,ask,opened_at) VALUES ('g-1','u-a','s-2','captcha','solve',0)`).run();
    assert.throws(
      () => db.prepare(`INSERT INTO gate_actions (id,owner_id,submission_id,kind,ask,opened_at) VALUES ('g-2','u-a','s-2','login','log in',0)`).run(),
      /UNIQUE constraint failed/,
      'invariant 1 NOT enforced'
    );
  });
});

test('invariant 5: exactly one run per (job_key, due_ms)', () => {
  withRollback(() => {
    db.prepare(`INSERT INTO job_runs (id,job_key,due_ms,started_at) VALUES ('jr-1','scan.postings',1000,0)`).run();
    assert.throws(
      () => db.prepare(`INSERT INTO job_runs (id,job_key,due_ms,started_at) VALUES ('jr-2','scan.postings',1000,0)`).run(),
      /UNIQUE constraint failed/,
      'invariant 5 NOT enforced'
    );
  });
});

test('invariant 2: per-actor idempotency keys — no cross-actor shadowing', () => {
  withRollback(() => {
    db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at) VALUES ('al-1','u-a','req-1','gate.complete','{"kind":"gate","id":"g-1"}',0)`).run();
    // Same key from a different actor: legal — keys are per owner.
    db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at) VALUES ('al-2','u-b','req-1','gate.close','{"kind":"gate","id":"g-1"}',0)`).run();
    assert.throws(
      () => db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at) VALUES ('al-3','u-a','req-1','gate.close','{"kind":"gate","id":"g-1"}',0)`).run(),
      /UNIQUE constraint failed/,
      'invariant 2 NOT enforced'
    );
  });
});

test('happy path: approved submission + same-owner package roundtrip', () => {
  withRollback(() => {
    insPosting('u-a');
    insSubmission('s-3', 'u-a', 'submitted', 'u-a');
    db.prepare(`INSERT INTO blobs (id,owner_id,sha256,bytes,created_at) VALUES ('b-1','u-a','abc',X'00',0)`).run();
    db.prepare(`INSERT INTO packages (id,owner_id,submission_id,flavor_refs,cover_letter_ref,sha256,created_at) VALUES ('pkg-9','u-a','s-3','[]','abc','z',0)`).run();
    assert.equal(db.prepare('SELECT COUNT(*) c FROM packages').get().c, 1);
  });
});

test('tracker projection: postings/submissions join on v4 columns', () => {
  withRollback(() => {
    insPosting('u-a');
    insSubmission('s-3', 'u-a', 'waiting_on_human');
    const rows = db.prepare(`
      SELECT s.id, s.posting_id, s.owner_id, s.status, s.approved_by, s.created_at,
             p.title AS posting_title, p.company AS posting_company
      FROM submissions s JOIN postings p ON p.id = s.posting_id`).all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].posting_title, 'T');
    const gates = db.prepare(`SELECT submission_id, owner_id, kind, ask, opened_at FROM gate_actions WHERE closed_at IS NULL`).all();
    assert.deepEqual(gates, []);
  });
});
