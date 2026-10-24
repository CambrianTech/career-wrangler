// test/api.test.mjs — slice 4: the human-gate queue at the HTTP boundary.
// Module behavior lives in gates.test.mjs; here the server itself is under test:
// decisions land through POST /api/gates/:id under the pinned owner's idempotency key
// (replay calm, fresh key against a closed gate refused 409), handler policy is data
// (GET/POST /api/handlers; an unregistered name refused at write time so 'human by
// default' stays safe), and an in_flight external-effect act opens a gate AT STARTUP —
// the kill-mid-flow path, exercised on real rows before any request arrives.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDb } from '../src/db.js';
import { applyMigrations } from '../src/migrate.js';
import { start, resolvePinnedOwner, makeTrackerStatements } from '../src/server.js';
import { registerGateHandler } from '../src/gates.js';

// Seed one pipeline (user + posting + submission) and optionally an open gate on it.
function seedPipeline(seed, { owner = 'u-a', status = 'waiting_on_human', kind = null, ask = 'Do the thing.' } = {}) {
  if (!seed.prepare('SELECT id FROM users WHERE id = ?').get(owner))
    seed.prepare(`INSERT INTO users (id,name,kind,created_at) VALUES (?, ?, 'human', 0)`).run(owner, owner);
  const pid = randomUUID();
  // postings is UNIQUE(owner_id, url) — one distinct url per seeded pipeline.
  seed.prepare(`INSERT INTO postings (id,owner_id,url,title,company,destination,found_at,created_at)
                VALUES (?, ?, ?, 'T', 'C', 'board', 0, 0)`).run(pid, owner, `https://x.example/${pid}`);
  const subId = randomUUID();
  seed.prepare(`INSERT INTO submissions (id,owner_id,posting_id,status,whose_turn,created_at)
                VALUES (?, ?, ?, ?, 'human', 0)`).run(subId, owner, pid, status);
  let gateId = null;
  if (kind) {
    gateId = randomUUID();
    seed.prepare(`INSERT INTO gate_actions (id,owner_id,submission_id,kind,ask,opened_at) VALUES (?, ?, ?, ?, ?, 0)`)
      .run(gateId, owner, subId, kind, ask);
  }
  return { subId, gateId };
}

// Boot the real server against a seeded on-disk DB; returns base URL + handles.
async function boot(t, seedFn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-api-'));
  const dbFile = path.join(dir, 't.sqlite');
  const seed = openDb(dbFile);
  applyMigrations(seed);
  seed.prepare(`INSERT INTO users (id,name,kind,peer_id,created_at)
                VALUES ('u-a','A','human',NULL,0),('u-b','B','citizen','p-b',0)`).run();
  if (seedFn) seedFn(seed);
  seed.close();
  process.env.PORT = '0'; // ephemeral port per boot: tests never collide
  process.env.OWNER_ID = 'u-a'; // pin the pipeline under test; ?owner_id cannot move it
  delete process.env.HOST;
  const h = await start({ dbFile });
  t.after(() => {
    try { h.server.close(); } catch {}
    try { h.db.close(); } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.PORT;
    delete process.env.OWNER_ID;
  });
  return `http://127.0.0.1:${h.addr.port}`;
}

const post = (base, urlPath, body) => fetch(`${base}${urlPath}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

test('GET /api/tracker projects open gates with their id (route wiring)', async (t) => {
  const base = await boot(t, (seed) => {
    const p = seedPipeline(seed, {});
    // A closed gate must NOT appear — only the open one.
    seed.prepare(`INSERT INTO gate_actions (id,owner_id,submission_id,kind,ask,opened_at,closed_at,closed_by)
                  VALUES (?, 'u-a', ?, 'captcha','old ask',0, 5, 'u-a')`).run(randomUUID(), p.subId);
    seedPipeline(seed, { kind: 'final_submit', ask: 'Press submit on the site.' });
  });
  const r = await fetch(`${base}/api/tracker`);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.gates.length, 1, 'exactly one open gate projected');
  assert.equal(typeof body.gates[0].id, 'string', 'gate id present — the UI needs it to decide');
  assert.equal(body.gates[0].kind, 'final_submit');
  assert.equal(body.gates[0].ask, 'Press submit on the site.');
  // The page itself still serves.
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
});

test('POST /api/gates/:id approve on final_submit lands invariant 7; replay calm; fresh key 409', async (t) => {
  const base = await boot(t, (seed) => { seedPipeline(seed, { kind: 'final_submit', ask: 'send it?' }); });

  // Find the gate through the API itself — no test-side db handle after boot.
  const list = await (await fetch(`${base}/api/tracker`)).json();
  const gateId = list.gates[0].id;

  const r1 = await post(base, `/api/gates/${gateId}`, { decision: 'approve', request_id: 'http-approve-1' });
  assert.equal(r1.status, 200);
  const b1 = await r1.json();
  assert.equal(b1.duplicate, false);
  assert.equal(b1.submission.status, 'submitted');
  assert.equal(b1.submission.approved_by, 'u-a', 'invariant 7 over HTTP: approved_by rides with the status');

  // Redelivered under the SAME key: calm duplicate, no second act.
  const r2 = await post(base, `/api/gates/${gateId}`, { decision: 'approve', request_id: 'http-approve-1' });
  assert.equal(r2.status, 200);
  assert.equal((await r2.json()).duplicate, true);

  // A FRESH key against the now-closed gate is refused — not a replay.
  const r3 = await post(base, `/api/gates/${gateId}`, { decision: 'approve', request_id: 'http-approve-2' });
  assert.equal(r3.status, 409);

  // Missing fields are a client error, not an act.
  const r4 = await post(base, `/api/gates/${randomUUID()}`, { decision: 'approve' });
  assert.equal(r4.status, 400);
});

test('POST /api/gates/:id resend returns the turn to the persona; close closes the submission', async (t) => {
  const base = await boot(t, (seed) => {
    seedPipeline(seed, { kind: 'final_submit' }); // for resend
    seedPipeline(seed, { kind: 'final_submit' }); // for close
  });
  const list = await (await fetch(`${base}/api/tracker`)).json();
  assert.equal(list.gates.length, 2);

  const rr = await post(base, `/api/gates/${list.gates[0].id}`, { decision: 'resend', request_id: 'http-resend-1' });
  assert.equal(rr.status, 200);
  const br = await rr.json();
  assert.equal(br.submission.whose_turn, 'persona');
  assert.notEqual(br.submission.status, 'submitted', 'resend never announces a send that may not have happened');

  const rc = await post(base, `/api/gates/${list.gates[1].id}`, { decision: 'close', request_id: 'http-close-1' });
  assert.equal(rc.status, 200);
  assert.equal((await rc.json()).submission.status, 'closed');

  // Both gates gone from the queue now.
  const after = await (await fetch(`${base}/api/tracker`)).json();
  assert.deepEqual(after.gates, []);
});

test('handlers: human by default; opt-in is data; unregistered name refused at write time', async (t) => {
  // Register a code-side handler in THIS process — the server shares the module instance.
  registerGateHandler('auto-captcha', async () => {});
  t.after(() => {}); // registration is process-global; harmless for later tests

  const base = await boot(t);
  // No rows yet: every kind resolves to human, and both names are selectable.
  let r = await fetch(`${base}/api/handlers`);
  assert.equal(r.status, 200);
  let b = await r.json();
  assert.ok(b.registered.includes('human') && b.registered.includes('auto-captcha'));
  for (const kind of ['captcha', 'login', '2fa', 'final_submit']) assert.equal(b.handlers[kind], 'human');

  // Opt in: the row selects a registered name → resolution follows the data.
  r = await post(base, '/api/handlers', { kind: 'captcha', handler: 'auto-captcha' });
  assert.equal(r.status, 200);
  b = await r.json();
  assert.equal(b.handlers.captcha, 'auto-captcha');
  assert.equal(b.handlers.login, 'human', 'kinds without a row stay human');

  // A typo can never silently unstaff a gate: refused at write time.
  r = await post(base, '/api/handlers', { kind: 'captcha', handler: 'auto-captch' });
  assert.equal(r.status, 400);
  b = await (await fetch(`${base}/api/handlers`)).json();
  assert.equal(b.handlers.captcha, 'auto-captcha', 'the refused write changed nothing');

  // Unknown kind is also a client error.
  r = await post(base, '/api/handlers', { kind: 'recovery', handler: 'human' });
  assert.equal(r.status, 400);
});

test('startup recovery: an in_flight external send opens a gate BEFORE any request (kill-mid-flow)', async (t) => {
  const base = await boot(t, (seed) => {
    const p = seedPipeline(seed, {}); // submission with no gate yet
    // The act that may have left the building: recorded in_flight by the pipeline.
    const actionId = randomUUID();
    seed.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,0,'in_flight')`)
      .run(actionId, 'u-a', `req-send-${actionId}`, 'submission.submit', JSON.stringify({ kind: 'submission', id: p.subId }));
    // A non-external in_flight verb must NOT open a gate.
    const action2 = randomUUID();
    seed.prepare(`INSERT INTO action_log (id,actor,request_id,verb,target,intent_at,outcome) VALUES (?,?,?,?,?,0,'in_flight')`)
      .run(action2, 'u-a', `req-x-${action2}`, 'posting.tracked', JSON.stringify({ postingId: 'p-x' }));
  });

  // Recovery ran inside start(), before this first request: the gate is already there.
  const body = await (await fetch(`${base}/api/tracker`)).json();
  assert.equal(body.gates.length, 1, 'exactly one gate opened by startup recovery');
  assert.equal(body.gates[0].kind, 'final_submit');
  assert.match(body.gates[0].ask, /confirm on the site/i);

  // And it is decidable through the API like any other gate.
  const r = await post(base, `/api/gates/${body.gates[0].id}`, { decision: 'approve', request_id: 'http-recover-1' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).submission.status, 'submitted');
});

test('cross-owner rows never reach the pinned pipeline (HTTP boundary)', async (t) => {
  const base = await boot(t, (seed) => {
    // B's own pipeline with an open gate — must stay invisible to A's server.
    seedPipeline(seed, { owner: 'u-b', kind: 'login', ask: "B's login" });
  });
  const body = await (await fetch(`${base}/api/tracker`)).json();
  assert.deepEqual(body.gates, [], "another owner's open gate never crosses the pin");
  // Deciding by raw id is refused too: the actor is always the pinned owner.
  const r = await post(base, '/api/gates/does-not-matter', { decision: 'approve', request_id: 'x' });
  assert.equal(r.status, 404);
});
