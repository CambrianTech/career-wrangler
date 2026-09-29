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

export function start({ dbFile = DB_FILE, autoMigrate = true } = {}) {
  const db = openDb(dbFile);
  if (autoMigrate) applyMigrations(db); // idempotent; migration_log guards re-runs

  const statements = {
    health: () => ({
      ok: true,
      foreign_keys: fkPragmaOn(db),
      tables: db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all().map((r) => r.name),
    }),
    tracker() {
      const postings = db.prepare('SELECT id, title, company, url, found_at FROM postings ORDER BY found_at DESC').all();
      const submissions = db.prepare(`
        SELECT s.id, s.posting_id, s.owner_id, s.status, s.approved_by, s.created_at,
               p.title AS posting_title, p.company AS posting_company
        FROM submissions s JOIN postings p ON p.id = s.posting_id
        ORDER BY s.created_at DESC`).all();
      // At most one OPEN gate per submission (invariant 1) — the partial unique index makes this a projection.
      // Field names are the v4 schema's own (kind/ask/opened_at); the page renders them as-is.
      const gates = db.prepare(`
        SELECT ga.submission_id, ga.owner_id, ga.kind, ga.ask, ga.opened_at
        FROM gate_actions ga
        WHERE ga.closed_at IS NULL`).all();
      return { postings, submissions, gates };
    },
  };

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') return sendJson(res, statements.health());
      if (url.pathname === '/api/tracker') return sendJson(res, statements.tracker());

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
    server.listen(port, () => resolve({ port, db }));
  });
}

function sendJson(res, obj, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj, null, 2));
}

// `npm run dev` — boot and stay up.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  start().then(({ port }) => {
    console.log(`career-wrangler: tracker on http://localhost:${port}/ (db ${DB_FILE})`);
  });
}
