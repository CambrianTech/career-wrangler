// src/server.js — Career Wrangler app skeleton (slice 1) + human-gate queue (slice 4).
//
// Zero-dependency node:http server that serves the tracker page and a small JSON API
// over the migrated SQLite database. Slice 4 adds the gate write path: approve /
// resend / close land through completeGate under the pinned owner's idempotency key,
// handler policy is data (gate_handlers) with 'human' by default, and an in_flight
// external-effect act opens a gate at startup instead of being re-executed.
//
//   npm run dev            → http://localhost:3179/  (or $PORT)
//   GET  /                 → public/tracker.html
//   GET  /api/health       → { ok, foreign_keys, tables }
//   GET  /api/tracker      → postings + submissions + open gates (with gate id)
//   POST /api/gates/:id    → { decision: approve|resend|close, request_id } — one act
//   GET  /api/handlers     → registered handler names + resolved handler per kind
//   POST /api/handlers     → { kind, handler } — opt into a registered handler (data)
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { openDb, fkPragmaOn } from './db.js';
import { applyMigrations } from './migrate.js';
import {
  completeGate,
  recoverInFlight,
  drainGateHandlers,
  setGateHandler,
  resolveGateHandler,
  gateHandlerNames,
  GATE_KINDS,
  GateError,
} from './gates.js';

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
      SELECT ga.id, ga.submission_id, ga.owner_id, ga.kind, ga.ask, ga.opened_at
      FROM gate_actions ga
      WHERE ga.closed_at IS NULL AND ga.owner_id = ?`).all(o),
  };
}

export async function start({ dbFile = DB_FILE, autoMigrate = true, recover = true } = {}) {
  const db = openDb(dbFile);
  if (autoMigrate) applyMigrations(db); // idempotent; migration_log guards re-runs
  if (recover) {
    recoverInFlight(db); // slice 4: an in_flight external-effect act opens a gate, never blind-resends
    // Deliver the handler announcements recovery just landed. A rejecting handler stops THIS
    // drain and leaves its row pending for the next one — boot logs and continues instead of
    // crashing on it (slice-2 outbox discipline; the tracker page stays staffed either way).
    await drainGateHandlers(db).catch((err) => {
      console.error(`career-wrangler: gate-handler delivery stopped early (${err.message}); its row stays pending for the next drain`);
    });
  }
  const owner = resolvePinnedOwner(db); // throws with a named-owner error on an unpinned multi-owner DB
  const t = makeTrackerStatements(db, owner);

  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/health') return sendJson(res, healthPayload(db));
      if (url.pathname === '/api/tracker')
        return sendJson(res, { postings: t.postings(), submissions: t.submissions(), gates: t.gates() });

      // Slice 4 write path. The actor is always the pinned owner — this boundary takes no
      // ownership input per request (review 3b39c978); decisions land through completeGate's
      // idempotency key, and a replayed request_id returns the original outcome calmly.
      if (url.pathname === '/api/handlers' && req.method === 'GET') return sendJson(res, handlersPayload(db, owner));
      if (url.pathname === '/api/handlers' && req.method === 'POST') return handleSetHandler(req, res, db, owner);
      const gateMatch = /^\/api\/gates\/([^/]+)$/.exec(url.pathname);
      if (gateMatch && req.method === 'POST')
        return handleGateDecision(req, res, db, owner, decodeURIComponent(gateMatch[1]));

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

// --- slice 4 handlers ---------------------------------------------------------------

// Handler policy for the pinned owner: what code can register (the selectable names), plus
// which handler each gate kind resolves to — 'human' everywhere no row opts in, so a gate
// always lands with someone who can act on it (data-model §gate_handlers).
function handlersPayload(db, owner) {
  return {
    registered: gateHandlerNames(),
    handlers: Object.fromEntries(GATE_KINDS.map((kind) => [kind, resolveGateHandler(db, { ownerId: owner.id, kind })])),
  };
}

// POST /api/handlers — body { kind, handler }. Data only: the row selects from registered
// names; an unregistered name is refused at write time (BadGateInputError → 400), which is
// what keeps 'human by default' safe.
async function handleSetHandler(req, res, db, owner) {
  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJson(res, { error: 'body must be JSON' }, 400);
  }
  try {
    setGateHandler(db, { ownerId: owner.id, kind: body.kind, handler: body.handler });
  } catch (err) {
    if (err instanceof GateError) return sendJson(res, { error: err.message }, err.status);
    // An async handler's rejection cannot reach the outer synchronous catch — answer here:
    return sendJson(res, { error: err.message || 'internal error' }, 500);
  }
  return sendJson(res, handlersPayload(db, owner));
}

// POST /api/gates/:id — body { decision, request_id }. One act under the pinned owner's
// idempotency key; a replayed request_id returns the original outcome calmly (200 duplicate),
// and a fresh key against a closed gate is refused with 409.
async function handleGateDecision(req, res, db, owner, gateId) {
  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJson(res, { error: 'body must be JSON' }, 400);
  }
  if (!body.decision || !body.request_id) return sendJson(res, { error: 'decision and request_id are required' }, 400);
  try {
    const r = completeGate(db, { actor: owner.id, requestId: body.request_id, gateId, decision: body.decision });
    return sendJson(res, r);
  } catch (err) {
    if (err instanceof GateError) return sendJson(res, { error: err.message }, err.status);
    // An async handler's rejection cannot reach the outer synchronous catch — answer here:
    return sendJson(res, { error: err.message || 'internal error' }, 500);
  }
}

// Collect the request body as text. Small JSON payloads only — this is a local tool.
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
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
