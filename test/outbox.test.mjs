// test/outbox.test.mjs — slice 2: the transactional outbox, as behavior not claim.
// Slice 1 proved the schema (invariants 1/2/5/6/7 at the DB level); this file proves
// invariants 3 and 4 against REAL rows on disk: an act lands atomically (its key is
// consumed exactly once, its announcements commit or vanish with the state change),
// and a dispatcher that dies mid-drain leaves work re-deliverable — receivers dedupe
// on (actor, request_id) so the duplicate is harmless. The canonical receiver-side
// primitive is act() itself, which is what the receiving side below actually runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDb, fkPragmaOn } from '../src/db.js';
import { applyMigrations } from '../src/migrate.js';
import { act, announce, recordActError, drainOutbox } from '../src/outbox.js';

// A fresh on-disk database per test: real rows, and durable across the simulated
// process restart in the final test.
function freshDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-test-'));
  const file = path.join(dir, 'career.sqlite');
  const db = openDb(file);
  t.after(() => { try { db.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });
  assert.equal(fkPragmaOn(db), true, 'foreign_keys must be ON for the composite FKs to bite');
  applyMigrations(db);
  db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();
  db.prepare(`INSERT INTO users (id,name,kind,peer_id,created_at) VALUES ('u-b','B','citizen','p-b',0)`).run();
  return db;
}

const count = (db, sql) => Number(db.prepare(sql).get().c);

test('act() lands atomically: one action row (ok) + exactly one outbox row per destination', (t) => {
  const db = freshDb(t);
  let mutated = 0;
  const r = act(db, {
    actor: 'u-a', requestId: 'req-1', verb: 'posting.tracked', target: { postingId: 'p-1' },
    mutate(d) {
      d.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
                VALUES ('p-1','u-a','https://x.example/','T','C','board',0,0)`).run();
      mutated += 1;
    },
    announce: [
      { destination: 'room/tracker' }, // no payload → falls back to target
      { destination: 'peer/b', payload: { actor: 'u-a', request_id: 'req-1', verb: 'posting.tracked' } },
    ],
  });
  assert.equal(r.duplicate, false);
  assert.equal(r.action.outcome, 'ok');
  assert.equal(mutated, 1);
  assert.equal(count(db, 'SELECT COUNT(*) c FROM action_log'), 1);
  const rows = db.prepare('SELECT destination, seq, payload FROM outbox ORDER BY destination').all();
  assert.equal(rows.length, 2, 'exactly one announcement per destination');
  // seq is a line PER destination: both lines start at 1.
  assert.deepEqual(rows.map((x) => [x.destination, x.seq]), [['peer/b', 1], ['room/tracker', 1]]);
  assert.deepEqual(JSON.parse(rows.find((x) => x.destination === 'room/tracker').payload), { postingId: 'p-1' });
});

test('act() rolls everything back when mutate throws: no action row, no outbox rows', (t) => {
  const db = freshDb(t);
  assert.throws(() => act(db, {
    actor: 'u-a', requestId: 'req-2', verb: 'posting.tracked', target: {},
    mutate() { throw new Error('boom'); },
    announce: [{ destination: 'room/tracker' }],
  }), /boom/);
  assert.equal(count(db, 'SELECT COUNT(*) c FROM action_log'), 0, 'intent must not survive a failed act');
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox'), 0, 'the announcement vanishes with the state change');
});

test('state change + announce() in one caller-owned transaction: rollback → no row; commit → exactly one', (t) => {
  const db = freshDb(t);

  // The attempt that does not land.
  db.exec('BEGIN IMMEDIATE');
  db.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
              VALUES ('p-2','u-a','https://y.example/','T2','C','board',0,0)`).run();
  const failedActionId = randomUUID();
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome,outcome_at)
              VALUES (?, 'u-a', 'req-3', 'posting.tracked', '{}', 0, 'in_flight', NULL)`).run(failedActionId);
  announce(db, { destination: 'room/tracker', actionId: failedActionId });
  db.exec('ROLLBACK'); // the act does not land
  assert.equal(count(db, 'SELECT COUNT(*) c FROM postings'), 0);
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox'), 0, 'rollback must take the announcement with it');

  // The attempt that lands.
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
                VALUES ('p-3','u-a','https://z.example/','T3','C','board',0,0)`).run();
    const actionId = randomUUID();
    db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome,outcome_at)
                VALUES (?, 'u-a', 'req-4', 'posting.tracked', '{}', 0, 'ok', 0)`).run(actionId);
    announce(db, { destination: 'room/tracker', actionId });
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    throw err;
  }
  assert.equal(count(db, 'SELECT COUNT(*) c FROM postings'), 1);
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox'), 1, 'commit must leave exactly one announcement');
});

test('replaying the same (actor, request_id) does not re-execute: returns the recorded act', (t) => {
  const db = freshDb(t);
  let runs = 0;
  const first = act(db, { actor: 'u-a', requestId: 'req-5', verb: 'posting.tracked', target: {}, mutate() { runs += 1; } });
  assert.equal(first.duplicate, false);
  const second = act(db, { actor: 'u-a', requestId: 'req-5', verb: 'posting.tracked', target: {}, mutate() { runs += 1; } });
  assert.equal(second.duplicate, true, 'invariant 3: no blind re-execution past the world');
  assert.equal(runs, 1, 'mutate must run exactly once across the replay');
  assert.equal(count(db, 'SELECT COUNT(*) c FROM action_log'), 1);
  assert.equal(second.action.id, first.action.id);
});

test('UNIQUE(actor, request_id): another owner may reuse the same key', (t) => {
  const db = freshDb(t);
  const a = act(db, { actor: 'u-a', requestId: 'req-x', verb: 'posting.tracked', target: {} });
  const b = act(db, { actor: 'u-b', requestId: 'req-x', verb: 'posting.tracked', target: {} });
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, false, "a user's key never shadows another owner's (invariant 2)");
  assert.notEqual(a.action.id, b.action.id);
});

test('a failed attempt consumes nothing: the same request_id may be retried', (t) => {
  const db = freshDb(t);
  assert.throws(() => act(db, { actor: 'u-a', requestId: 'req-6', verb: 'v', target: {}, mutate() { throw new Error('transient'); } }), /transient/);
  const retry = act(db, { actor: 'u-a', requestId: 'req-6', verb: 'v', target: {} });
  assert.equal(retry.duplicate, false, 'the key is only consumed by success, so the retry lands');
  assert.equal(count(db, 'SELECT COUNT(*) c FROM action_log'), 1);
});

test('recordActError() records a terminal failure and consumes the key', (t) => {
  const db = freshDb(t);
  const rec = recordActError(db, { actor: 'u-a', requestId: 'req-7', verb: 'v', target: {}, errorRef: 'blob-1' });
  assert.equal(rec.outcome, 'error');
  assert.throws(() => recordActError(db, { actor: 'u-a', requestId: 'req-7', verb: 'v', target: {} }), /already recorded/);
  const replay = act(db, { actor: 'u-a', requestId: 'req-7', verb: 'v', target: {} });
  assert.equal(replay.duplicate, true, 'a terminal failure still consumes the key');
});

test('dispatcher leaves at-least-once: kill mid-drain → restart re-delivers; receiver dedupes to exactly once', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-drain-'));
  const file = path.join(dir, 'career.sqlite');
  let db = openDb(file);
  t.after(() => { try { db.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });

  // Process A (sender side): three acts land, each announcing to the same destination.
  applyMigrations(db);
  db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();
  for (const n of [1, 2, 3]) {
    act(db, {
      actor: 'u-a', requestId: `req-d${n}`, verb: 'posting.tracked', target: { n },
      announce: [{ destination: 'room/tracker', payload: { actor: 'u-a', request_id: `req-d${n}`, verb: 'posting.tracked' } }],
    });
  }

  // The receiving side: its OWN durable store, deduping via act() — the canonical primitive.
  const recvFile = path.join(dir, 'receiver.sqlite');
  let recvDb = openDb(recvFile);
  applyMigrations(recvDb);
  recvDb.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();

  const deliveries = []; // every row received, duplicates included
  function applyEffect(row) {
    const p = JSON.parse(row.payload);
    deliveries.push(`${p.actor}|${p.request_id}`);
    act(recvDb, { actor: p.actor, requestId: p.request_id, verb: 'outbox.apply', target: { n: p.n }, mutate(d) {
      d.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
                VALUES ('p-d' || ?,'u-a','https://x.example/','T','C','board',0,0)`).run(p.n);
    } });
  }

  // Drain attempt 1: the dispatcher dies AFTER applying row 1's effect but BEFORE
  // recording dispatched_at — exactly the window that makes re-delivery necessary.
  let crash = null;
  try {
    drainOutbox(db, { destination: 'room/tracker', deliver(row) { applyEffect(row); throw new Error('SIGKILL mid-drain'); } });
  } catch (err) { crash = err; }
  assert.match(crash.message, /SIGKILL/, 'a failed delivery stops the drain');
  db.close(); recvDb.close(); // process A and its receiver both die

  // Restart: fresh connections over the SAME durable files.
  db = openDb(file);
  recvDb = openDb(recvFile);
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox WHERE dispatched_at IS NULL'), 3,
    'the delivered-but-unrecorded row stays pending — that is the at-least-once contract');

  // Drain attempt 2: clean. Row 1 arrives a second time; act() on the receiver sees its
  // key already recorded and does not re-run the effect.
  const seqs = [];
  const r2 = drainOutbox(db, { destination: 'room/tracker', deliver(row) { seqs.push(row.seq); applyEffect(row); } });
  assert.deepEqual(r2, { delivered: 3, pending: 0 });
  assert.deepEqual(seqs, [1, 2, 3], 'pending rows drain in per-destination seq order');

  // Exactly-once EFFECTS despite at-least-once delivery.
  assert.equal(count(recvDb, 'SELECT COUNT(*) c FROM postings'), 3, 'three effects for three acts — no duplicates');
  assert.equal(count(recvDb, "SELECT COUNT(*) c FROM action_log WHERE outcome = 'ok'"), 3);
  assert.equal(deliveries.filter((k) => k === 'u-a|req-d1').length, 2, 'row 1 was delivered twice…');
  assert.ok(deliveries.every((k) => deliveries.filter((x) => x === k).length <= 2));
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox WHERE dispatched_at IS NULL'), 0);
});
