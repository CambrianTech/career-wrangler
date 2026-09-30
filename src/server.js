// src/server.js — Career Wrangler app skeleton (slice 1).
//
// Zero-dependency node:http server that serves the tracker page and a small
// read-only JSON API over the migrated SQLite database. The human-gate write
// handlers (approve / resend / close) are slice 4; this slice only needs the
// site to boot, serve the page, and prove the schema is live behind it.
//
//   npm run dev            → http://localhost:3179/  (or $PORT)
//   GET /                  → public/tracker.html
//   GET /api/health        → { ok, foreign_keys, tables }
//   GET /api/tracker       → postings + submissions + open gates

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { openDb, fkPragmaOn } from './db.js';
import { applyMigrations } from './migrate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // .../src
const PUBLIC_DIR = path.join(HERE, '..', 'public');
// docs/data-model.md: the DB file lives in data/ unless DATABASE_URL says otherwise.
const DB_FILE = process.env.DATABASE_URL || path.join(HERE, '..', 'data', 'career.sqlite');

// Local-use owner boundary (review 3b39c978): the unauthenticated tracker serves exactly ONE
// pipeline per process. The pinned owner is a launch-time decision — explicit OWNER_ID on a
// multi-owner database, auto-pinned (and announced) when it holds a single user — never request
// input: in an unauthenticated skeleton any query parameter would be unchecked by construction.
export function resolvePinnedOwner(db, requested = process.env.OWNER_ID || null) {
  const users = db.prepare('SELECT id, name FROM users ORDER BY created_at').all();
  if (requested) {
    const hit = users.find((u) => u.id === requested);
    if (!hit) throw new Error(`owner ${JSON.stringify(requested)} not found in users; available: ${users.map((u) => u.id).join(', ') || '(none)'}`);
    return hit;
  }
  if (users.length === 1) return users[0];
  if (users.length > 1) throw new Error(`multi-owner database (${users.map((u) => `${u.id} (${u.name})`).join(', ')}): set OWNER_ID to pin one pipeline per process`);
  return { id: null, name: '(no users yet — nothing served until one exists)' };
}

// The three tracker projections, each filtered on the pinned owner. Exported so the isolation
// test exercises the exact queries the server runs.
export function makeTrackerStatements(db, owner) {
  const o = owner.id;
  return {
    postings: () => db.prepare('SELECT id, title, company, url, found_at FROM postings WHERE owner_id = ? ORDER BY found_at DESC').all(o),
    submissions: () => db.prepare(`
      SELECT s.id, s.posting_id, s.owner_id, s.status, s.approved_by, s.created_at,
             p.title AS posting_title, p.company AS posting_company
      FROM submissions s JOIN postings p ON p.id = s.posting_id AND p.owner_id = s.owner_id
      WHERE s.owner_id = ? ORDER BY s.created_at DESC`).all(o),
    // At most one OPEN gate per submission (invariant 1) — the partial unique index makes this a projection.
    // Field names are the v4 schema's own (kind/ask/opened_at); the page renders them as-is.
    gates: () => db.prepare(`
      SELECT ga.submission_id, ga.owner_id, ga.kind, ga.ask, ga.opened_at
      FROM gate_actions ga
      WHERE ga.closed_at IS NULL AND ga.owner_id = ?`).all(o),
  };
}

export function start({ dbFile = DB_FILE, autoMigrate = true } = {}) {
  const db = openDb(dbFile);
  if (autoMigrate) applyMigrations(db); // idempotent; migration_log guards re-runs
  const owner = resolvePinnedOwner(db); // throws with a named-owner error on an unpinned multi-owner DB
  const t = makeTrackerStatements(db, owner);

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') return sendJson(res, healthPayload(db));
      if (url.pathname === '/api/tracker')
        return sendJson(res, { postings: t.postings(), submissions: t.submissions(), gates: t.gates() });

      // Static: only under PUBLIC_DIR. / → tracker.html; anything else must exist there.
      const rel = url.pathname === '/' ? 'tracker.html' : url.pathname.replace(/^\/+/, '');
      const file = path.resolve(PUBLIC_DIR, rel);
      if (file !== path.join(PUBLIC_DIR, 'tracker.html') && !file.startsWith(PUBLIC_DIR + path.sep)) {
        return sendJson(res, { error: 'forbidden' }, 403);
      }
      if (!existsSync(file) || !existsSync(path.resolve(file))) {
        return sendJson(res, { error: 'not found' }, 404);
      }
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      res.end(body);
    } catch (err) {
      sendJson(res, { error: err.message }, 500);
    }
  });

  return new Promise((resolve) => {
    const port = Number(process.env.PORT || 3179);
    // Local-use boundary (review 3b39c978): the unauthenticated tracker binds loopback by
    // default. HOST is an explicit opt-out for container fronting — never a per-request input.
    const host = process.env.HOST || '127.0.0.1';
    // `server` is returned so callers (tests) can close the handle; unref-style cleanup
    // isn't a thing here — an open listener keeps the process alive until it's closed.
    server.listen(port, host, () => resolve({ addr: server.address(), db, server }));
  });
}

function healthPayload(db) {
  return {
    ok: true,
    foreign_keys: fkPragmaOn(db),
    tables: db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all().map((r) => r.name),
  };
}

function sendJson(res, obj, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj, null, 2));
}

// `npm run dev` — boot and stay up. Banner prints the ACTUAL bound address (server.address()),
// so PORT=0 or a host override is never misreported.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start().then(({ addr }) => {
    console.log(`career-wrangler: tracker on http://${addr.address}:${addr.port}/ (db ${DB_FILE})`);
  });
}
