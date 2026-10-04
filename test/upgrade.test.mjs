// Old-base upgrade — the regression behind failed verdict bdb4c62d: 5184f85 edited
// migrations/014_outbox.sql in place (request_id -> action_id), but migrate.js skips
// already-applied files by name, so a database that applied the SHIPPED 014 keeps the
// request_id column while src/outbox.js inserts action_id — every act() fails on any
// pre-existing base. The fix is forward migration 018 (ALTER ... RENAME COLUMN), which
// is uniform for old and fresh bases; this test proves an old base survives it: rows,
// the FK into action_log(id), the pending-row drain, and a live act() afterwards.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb, fkPragmaOn } from '../src/db.js';
import { applyMigrations, MIGRATIONS_DIR } from '../src/migrate.js';
import { act, drainOutbox } from '../src/outbox.js';

const count = (db, sql) => Number(db.prepare(sql).get().c);

// Copy the shipped migrations minus 018 into a temp dir: that is exactly what a base
// built before this fix would have applied. The migrationsDir seam in migrate.js makes
// that reproducible without touching product code paths.
function preBaseMigrationsDir(t) {
  const src = MIGRATIONS_DIR;
  assert.ok(fs.existsSync(path.join(src, '018_outbox_action_id.sql')),
    'the fix under test is forward migration 018 — it must exist');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pre-018-'));
  t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} });
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.sql') || f === '018_outbox_action_id.sql') continue;
    fs.copyFileSync(path.join(src, f), path.join(dir, f));
  }
  return dir;
}

test('a base DB that applied the shipped 014 upgrades through 018: rows, FK and act() all survive', (t) => {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upgrade-test-'));
  const file = path.join(dbDir, 'career.sqlite');
  t.after(() => { try { fs.rmSync(dbDir, { recursive: true, force: true }); } catch {} });

  // Process A (pre-fix build): the base gets migrations 001..017 — shipped 014 included.
  let db = openDb(file);
  assert.equal(fkPragmaOn(db), true, 'foreign_keys must be ON for the composite FKs to bite');
  applyMigrations(db, preBaseMigrationsDir(t));
  const colsBefore = db.prepare('PRAGMA table_info(outbox)').all().map((c) => c.name);
  assert.ok(colsBefore.includes('request_id') && !colsBefore.includes('action_id'),
    'the pre-018 base really has the old column shape');

  // One live act pending in the OLD shape: the receiver-side key is (actor, request_id),
  // and the outbox row points at action_log(id) through the then-named request_id column.
  db.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES ('u-a','A','human',0)`).run();
  db.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome,outcome_at)
              VALUES ('a-1','u-a','req-u1','posting.tracked','{"postingId":"p-u"}',0,'ok',0)`).run();
  db.prepare(`INSERT INTO outbox (id,seq,destination,request_id,payload,created_at)
              VALUES ('o-1',1,'room/tracker','a-1','{"postingId":"p-u"}',0)`).run();
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox WHERE dispatched_at IS NULL'), 1);
  db.close(); // process A dies; the base is durable on disk

  // Process B (post-fix build): fresh connection, full migration set. Exactly one new
  // file applies — 018 — over a base that already logged 001..017.
  db = openDb(file);
  const mig = applyMigrations(db);
  assert.equal(mig.applied, 1, 'only the forward rename is new to an old base');

  // The rename kept the data and rewrote the FK in place (SQLite RENAME COLUMN).
  const cols = db.prepare('PRAGMA table_info(outbox)').all().map((c) => c.name);
  assert.ok(cols.includes('action_id') && !cols.includes('request_id'), '018 renamed the column');
  assert.deepEqual(
    db.prepare('PRAGMA foreign_key_list(outbox)').all().map((f) => [f.table, f.to]),
    [['action_log', 'id']],
    'the FK into action_log(id) survived the rename');
  const row = db.prepare('SELECT id, seq, destination, action_id, payload FROM outbox').get();
  // node:sqlite rows are null-prototype objects; spread into a plain object so
  // deepStrictEqual compares values, not prototypes.
  assert.deepEqual({ ...row }, {
    id: 'o-1', seq: 1, destination: 'room/tracker', action_id: 'a-1', payload: '{"postingId":"p-u"}',
  }, 'the pending row survives the upgrade under its new column name');

  // The regression itself: act() on an upgraded base must land — it is what broke.
  const r = act(db, {
    actor: 'u-a', requestId: 'req-u2', verb: 'posting.tracked', target: { postingId: 'p-v' },
    mutate(d) {
      d.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
                VALUES ('p-v','u-a','https://v.example/','T','C','board',0,0)`).run();
    },
    announce: [{ destination: 'room/tracker' }],
  });
  assert.equal(r.action.outcome, 'ok');
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox'), 2);

  // The dispatcher drains the upgraded table in seq order; the pre-upgrade row arrives
  // carrying action_id — what receivers dedupe on.
  const got = [];
  const r2 = drainOutbox(db, { destination: 'room/tracker', deliver(row) { got.push([row.seq, row.action_id]); } });
  assert.deepEqual(r2, { delivered: 2, pending: 0 });
  assert.deepEqual(got, [[1, 'a-1'], [2, r.action.id]], 'old and new rows drain in per-destination seq order');
  assert.equal(count(db, 'SELECT COUNT(*) c FROM outbox WHERE dispatched_at IS NULL'), 0);

  db.close(); // release the handle before t.after removes the dir (Windows EPERM otherwise)
});
