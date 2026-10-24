// src/gates.js — slice 4: the human-gate queue as behavior over action_log.
//
// A gate is "the single precise thing to do" (docs/data-model.md → gate_actions).
// This module owns the three behaviors the schema cannot express alone:
//   openGate        one open gate per submission; redelivery returns the existing row
//   completeGate    approve / resend / close, each landed as an act under the caller's
//                   idempotency key (invariant 2), atomically with the state it implies
//   recoverInFlight in_flight external-effect acts OPEN A GATE — they are never blindly
//                   re-executed (invariant 3); recovery is idempotent by construction and
//                   BOUNDED: every row it handles leaves a progress marker behind, so the
//                   window advances across restarts instead of re-selecting the same batch
// Handler policy: which handler serves each gate kind per owner. The opt-in is DATA
// (gate_handlers, migration 020), not code: 'human' is the default and always staffed;
// a row naming an unregistered handler is refused at write time so a typo can never
// silently unstaff a gate.
// Handler delivery: opening a gate announces it on the outbox (destination
// 'gate-handlers') in the SAME TRANSACTION as the open — deliver first, ack second,
// exactly like every other outbound effect. A selected non-human handler is invoked by
// drainGateHandlers; one that fails leaves its row pending and visible for the next
// drain, and a gate closed before delivery acks quietly (the person already acted).

import { randomUUID } from 'node:crypto';
import { act } from './outbox.js';

export const GATE_KINDS = ['captcha', 'login', '2fa', 'final_submit'];
// Verbs whose effect crosses the world boundary — an in_flight row with one of these
// can never be re-executed after its window, only gated (data-model invariant 3).
const EXTERNAL_EFFECT_VERBS = new Set(['submission.submit']);

export class GateError extends Error {
  constructor(message, status) { super(message); this.name = 'GateError'; this.status = status; }
}
export class NotFoundError extends GateError {
  constructor(what) { super(`${what} not found`, 404); this.name = 'NotFoundError'; }
}
export class GateNotOpenError extends GateError {
  constructor(id) { super(`gate ${id} is already closed`, 409); this.name = 'GateNotOpenError'; }
}
export class CrossOwnerError extends GateError {
  constructor(gateOwnerId, actor) { super(`gate belongs to owner ${gateOwnerId}, not actor ${actor}`, 403); this.name = 'CrossOwnerError'; }
}
export class BadGateInputError extends GateError {
  constructor(message) { super(message, 400); this.name = 'BadGateInputError'; }
}

// --- handler policy ---------------------------------------------------------------
// The code side: names a data row may select. 'human' is registered by default and is
// the fallback whenever an owner has no (or an unresolvable) row — a gate always lands
// with someone who can act on it.
const handlers = new Map([['human', async () => { /* the person at the tracker page */ }]]);

export function registerGateHandler(name, fn) {
  if (typeof name !== 'string' || !name) throw new BadGateInputError('handler name must be a non-empty string');
  if (typeof fn !== 'function') throw new BadGateInputError(`handler ${JSON.stringify(name)} must be a function`);
  handlers.set(name, fn);
}

export function gateHandlerNames() { return [...handlers.keys()].sort(); }

// The data side: an owner row picks the handler for one gate kind. Writing a name no
// code has registered is refused HERE — that is what makes 'human by default' safe.
export function setGateHandler(db, { ownerId, kind, handler }) {
  if (!GATE_KINDS.includes(kind)) throw new BadGateInputError(`unknown gate kind ${JSON.stringify(kind)}`);
  if (!handlers.has(handler)) throw new BadGateInputError(`handler ${JSON.stringify(handler)} is not registered; one of: ${gateHandlerNames().join(', ')}`);
  db.prepare(
    `INSERT INTO gate_handlers (owner_id, kind, handler, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_id, kind) DO UPDATE SET handler = excluded.handler, updated_at = excluded.updated_at`
  ).run(ownerId, kind, handler, Date.now());
}

export function resolveGateHandler(db, { ownerId, kind }) {
  const row = db.prepare('SELECT handler FROM gate_handlers WHERE owner_id = ? AND kind = ?').get(ownerId, kind);
  // A missing row means "no opt-in" → human. (An unregistered name cannot exist — the
  // write is refused above — but resolveGateHandler stays defensive: data outlives code.)
  return (row && handlers.has(row.handler)) ? row.handler : 'human';
}

// --- opening gates ------------------------------------------------------------------

function openGateOn(db, submissionId) {
  return db.prepare('SELECT * FROM gate_actions WHERE submission_id = ? AND closed_at IS NULL').get(submissionId);
}

// Open exactly one gate for a submission (invariant 1 is the schema's; this function
// makes redelivery calm). A redelivered open — same or different request_id, an open
// gate already there — returns the EXISTING row and consumes no idempotency key: it is
// a query, not an act. Only the actual opening lands in action_log (verb gate.open), so
// the key is spent exactly once, by success, as with every act.
export function openGate(db, { actor, requestId, submissionId, kind, ask }) {
  if (!GATE_KINDS.includes(kind)) throw new BadGateInputError(`unknown gate kind ${JSON.stringify(kind)}`);
  const sub = db.prepare('SELECT id, owner_id FROM submissions WHERE id = ?').get(submissionId);
  if (!sub) throw new NotFoundError(`submission ${submissionId}`);
  if (actor !== sub.owner_id) throw new CrossOwnerError(sub.owner_id, actor); // invariant 6: ownership rides down from the submission

  const existing = openGateOn(db, submissionId);
  if (existing) return { opened: false, duplicate: true, gate: existing };

  let gateId;
  const r = act(db, {
    actor, requestId, verb: 'gate.open', target: { kind: 'submission', id: submissionId },
    mutate(d) {
      gateId = randomUUID();
      d.prepare(`INSERT INTO gate_actions (id, owner_id, submission_id, kind, ask, opened_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(gateId, sub.owner_id, submissionId, kind, ask, Date.now());
    },
  });
  if (r.duplicate) { // same key already landed: hand back what the world holds now
    return { opened: false, duplicate: true, gate: openGateOn(db, submissionId) ?? null };
  }
  return { opened: true, duplicate: false, gate: db.prepare('SELECT * FROM gate_actions WHERE id = ?').get(gateId) };
}

// --- completing gates -----------------------------------------------------------------
// approve: the human did (or confirms) the thing. On final_submit this IS the approval
//   that invariant 7 requires — status 'submitted' and approved_by land in ONE
//   transaction, so no row ever announces an external send nobody approved.
// resend : the outside world may not have received it; hand the turn back to the persona,
//          which re-executes with a FRESH request_id (the old in_flight key is never reused).
// close  : dismiss the ask — for final_submit this closes the submission itself; there is
//          no state where a submitted-and-unapproved attempt quietly lingers.

const DECISIONS = ['approve', 'resend', 'close'];

export function completeGate(db, { actor, requestId, gateId, decision }) {
  if (!DECISIONS.includes(decision)) throw new BadGateInputError(`unknown decision ${JSON.stringify(decision)}; one of: ${DECISIONS.join(', ')}`);
  const gate = db.prepare('SELECT * FROM gate_actions WHERE id = ?').get(gateId);
  if (!gate) throw new NotFoundError(`gate ${gateId}`);
  if (actor !== gate.owner_id) throw new CrossOwnerError(gate.owner_id, actor); // invariant 6
  if (gate.closed_at !== null && gate.closed_at !== undefined) {
    // A redelivered decision under an already-consumed key is a query about current state,
    // not a new act: the receiver dedupes on (actor, request_id), so the duplicate stays calm.
    const replay = db.prepare('SELECT id FROM action_log WHERE actor = ? AND request_id = ?').get(actor, requestId);
    if (replay) {
      return { duplicate: true, decision, gate, submission: db.prepare('SELECT * FROM submissions WHERE id = ?').get(gate.submission_id) };
    }
    throw new GateNotOpenError(gateId); // a fresh key against a closed gate is refused — not a replay
  }

  const r = act(db, {
    actor, requestId, verb: `gate.${decision}`, target: { kind: 'gate', id: gateId },
    mutate(d) {
      const now = Date.now();
      // Re-check inside the transaction: a decision that races a close rolls back whole and
      // consumes no key (a failed attempt leaves no row), so a fresh decision may still land.
      const c = d.prepare('UPDATE gate_actions SET closed_at = ?, closed_by = ? WHERE id = ? AND closed_at IS NULL').run(now, actor, gateId);
      if (Number(c.changes) !== 1) throw new GateNotOpenError(gateId);
      if (decision === 'approve' && gate.kind === 'final_submit') {
        // invariant 7: status 'submitted' and approved_by land in this one transaction —
        // no row ever announces an external send that nobody approved.
        d.prepare(`UPDATE submissions SET status = 'submitted', approved_by = ?, approved_at = ?, submitted_at = ?, whose_turn = 'persona' WHERE id = ? AND owner_id = ?`)
          .run(actor, now, now, gate.submission_id, actor);
      } else if (decision === 'resend') {
        // the outside world may not have received it; the turn goes back to the persona,
        // which re-executes with a FRESH request_id (the old in_flight key is never reused).
        d.prepare(`UPDATE submissions SET whose_turn = 'persona' WHERE id = ? AND owner_id = ?`).run(gate.submission_id, actor);
      } else if (decision === 'close' && gate.kind === 'final_submit') {
        // closing a final_submit closes the submission itself: there is no state where an
        // unapproved sent attempt quietly lingers.
        d.prepare(`UPDATE submissions SET status = 'closed', whose_turn = 'persona' WHERE id = ? AND owner_id = ?`).run(gate.submission_id, actor);
      } else {
        // approve (or close) on a non-final gate: the turn goes back to the persona; the
        // submission's own status is the persona's to manage.
        d.prepare(`UPDATE submissions SET whose_turn = 'persona' WHERE id = ? AND owner_id = ?`).run(gate.submission_id, actor);
      }
    },
  });
  const gate2 = db.prepare('SELECT * FROM gate_actions WHERE id = ?').get(gateId);
  const sub2 = db.prepare('SELECT * FROM submissions WHERE id = ? AND owner_id = ?').get(gate.submission_id, actor);
  return { duplicate: Boolean(r.duplicate), decision, gate: gate2, submission: sub2 };
}

// --- in_flight recovery ------------------------------------------------------------
// An act whose effect crosses the world boundary (verb in EXTERNAL_EFFECT_VERBS) and
// whose outcome is still 'in_flight' may already have left the building — we cannot
// know, and blind re-execution is forbidden (data-model invariant 3). Recovery therefore
// never re-runs it: it opens a final_submit gate asking the person to verify on the site.
// The original action_log row stays untouched forever; its 'in_flight' outcome IS the
// record that this act can never be blindly re-executed. Idempotent by construction:
// the request key is stable per action row, and openGate already returns any existing
// open gate without consuming a key (invariant 1).
export function recoverInFlight(db, { limit = 50 } = {}) {
  // Bounded traversal with progress. The window admits only rows that still need a
  // gate: an external-effect verb with a resolvable submission target, on a submission
// that has not already been decided (submitted/closed), with no open gate covering the
// send and no recovery marker under this row's stable key. Every row handled below
// leaves such a marker behind — the gate.open act itself carries request_id
// recover-<action_id>, and a row whose send another path already gates gets an explicit
// 'recovery.checked' — so each pass advances the window: a backlog larger than one limit
// is fully traversed across successive startups instead of starving its tail forever.
  const verbs = [...EXTERNAL_EFFECT_VERBS];
  // json_extract on malformed JSON throws in SQLite, so extraction happens only behind
  // json_valid (the CASE guards the join key; rows that reach WHERE already matched it,
  // hence their target is valid by construction).
  const rows = db.prepare(
    `SELECT al.* FROM action_log al
     JOIN submissions s ON s.id = CASE WHEN json_valid(al.target) THEN json_extract(al.target, '$.id') END
     WHERE al.outcome = 'in_flight'
       AND al.verb IN (${verbs.map(() => '?').join(', ')})
       AND json_valid(al.target)
       AND json_extract(al.target, '$.kind') = 'submission'
       AND s.status NOT IN ('submitted', 'closed')
       AND NOT EXISTS (SELECT 1 FROM action_log r WHERE r.request_id = 'recover-' || al.id)
       AND NOT EXISTS (SELECT 1 FROM gate_actions g WHERE g.submission_id = s.id AND g.closed_at IS NULL)
     ORDER BY al.intent_at ASC, al.id ASC
     LIMIT ?`
  ).all(...verbs, limit);
  const opened = [];
  const skipped = [];
  for (const row of rows) {
    let t; try { t = JSON.parse(row.target); } catch { continue; } // SQL validated this; defense in depth
    if (!t || typeof t.id !== 'string') { skipped.push({ actionId: row.id, reason: 'unrecognized target' }); continue; }
    const sub = db.prepare('SELECT id, owner_id FROM submissions WHERE id = ?').get(t.id);
    if (!sub) { skipped.push({ actionId: row.id, reason: 'submission missing' }); continue; } // JOIN guarantees it; data outlives code
    // actor is the pinned owner — the person at the tracker page (human by default).
    const r = openGate(db, {
      actor: sub.owner_id,
      requestId: `recover-${row.id}`,
      submissionId: sub.id,
      kind: 'final_submit',
      ask: 'An external send may have left the building — confirm on the site, then resend or close.',
    });
    if (r.opened) {
      // The gate.open act above IS this row's progress marker (key recover-<action_id>).
      opened.push(r.gate);
    } else {
      // A gate already covers this send through another path: land an explicit marker so
      // the row stops re-entering the window every startup and starving rows behind it.
      act(db, { actor: sub.owner_id, requestId: `recover-${row.id}`, verb: 'recovery.checked', target: { kind: 'action_log', id: row.id } });
      skipped.push({ actionId: row.id, reason: 'gate already open' });
    }
  }
  return { checked: rows.length, opened, skipped };
}
