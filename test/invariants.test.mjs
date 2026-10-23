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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, fkPragmaOn } from '../src/db.js';
import { applyMigrations } from '../src/migrate.js';
// Importing the server module is side-effect-free: its boot guard only fires when
// src/server.js itself is process.argv[1], never under node:test.
import { start, resolvePinnedOwner, makeTrackerStatements } from '../src/server.js';

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

test('resolvePinnedOwner: multi-owner demands explicit pin; single auto-pins; empty resolves null', () => {
  delete process.env.OWNER_ID;
  assert.throws(() => resolvePinnedOwner(db), /multi-owner database.*u-a.*u-b/);
  const one = openDb(':memory:'); applyMigrations(one);
  one.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-s','S','human',0)`).run();
  assert.equal(resolvePinnedOwner(one).id, 'u-s');
  one.close();
  const none = openDb(':memory:'); applyMigrations(none);
  assert.equal(resolvePinnedOwner(none).id, null);
  none.close();
});

test('tracker projection via production statements: two-owner isolation', () => {
  // Shared db holds exactly u-a and u-b (seed owners; every earlier test rolled back).
  withRollback(() => {
    const row = (owner, tag) => {
      db.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
                  VALUES (?,?,'https://x.example/','T','C','board',0,0)`).run(`${tag}-p`, owner);
      db.prepare(`INSERT INTO submissions (id,owner_id,posting_id,status,whose_turn,approved_by,created_at)
                  VALUES (?,?,?,'waiting_on_human','human',NULL,0)`).run(`${tag}-s`, owner, `${tag}-p`);
    };
    row('u-a', 'a');
    row('u-b', 'b');
    db.prepare(`INSERT INTO gate_actions (id,submission_id,owner_id,kind,ask,opened_at)
                VALUES ('g-b','b-s','u-b','final_submit','Submit the application?',0)`).run();

    // Mismatched relationship — legal under migration 008: A's submission referencing B's posting.
    db.prepare(`INSERT INTO submissions (id,owner_id,posting_id,status,whose_turn,approved_by,created_at)
                VALUES ('x-s','u-a','b-p','waiting_on_human','human',NULL,0)`).run();

    const ta = makeTrackerStatements(db, resolvePinnedOwner(db, 'u-a'));
    assert.deepEqual(ta.postings().map((p) => p.id), ['a-p']);
    assert.equal(ta.submissions().length, 1); // x-s excluded by owner equality on the join
    assert.equal(ta.submissions()[0].id, 'a-s');
    assert.ok(ta.submissions().every((s) => s.posting_id !== 'b-p')); // B's title/company never reach A's tracker
    assert.deepEqual(ta.gates(), []);

    const tb = makeTrackerStatements(db, resolvePinnedOwner(db, 'u-b'));
    assert.deepEqual(tb.postings().map((p) => p.id), ['b-p']);
    assert.equal(tb.submissions()[0].id, 'b-s');
    assert.equal(tb.gates().length, 1);
    assert.equal(tb.gates()[0].submission_id, 'b-s');
  });
});

test('HTTP boundary: loopback bind, PORT=0 actual addr, ?owner_id cannot move the pin', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-http-'));
  const dbFile = path.join(dir, 't.sqlite');
  const seed = openDb(dbFile);
  applyMigrations(seed);
  seed.prepare(`INSERT INTO users (id,name,kind,peer_id,created_at)
                VALUES ('u-a','A','human',NULL,0),('u-b','B','citizen','p-b',0)`).run();
  seed.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
                VALUES ('a-p','u-a','https://x.example/','T','C','board',0,0),
                       ('b-p','u-b','https://y.example/','U','D','board',1,1)`).run();
  seed.close();
  process.env.PORT = '0';
  process.env.OWNER_ID = 'u-a';
  delete process.env.HOST;
  try {
    const h = await start({ dbFile });
    try {
      assert.equal(h.addr.address, '127.0.0.1'); // loopback by default, never all interfaces
      assert.ok(h.addr.port > 0); // PORT=0: actual ephemeral address reported, not the requested one
      const r = await fetch(`http://127.0.0.1:${h.addr.port}/api/tracker?owner_id=u-b`);
      assert.equal(r.status, 200);
      const body = await r.json();
      assert.deepEqual(body.postings.map((p) => p.id), ['a-p']); // pinned u-a at launch; ?owner_id ignored
    } finally {
      h.server.close();
      h.db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } finally {
    delete process.env.PORT;
    delete process.env.OWNER_ID;
  }
});
