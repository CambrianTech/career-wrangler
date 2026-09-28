# career-wrangler: slice plan

The contract is `docs/data-model.md` v2 (on main at 16f6dc6). Each slice below lands small — one or two turns of work each — on a branch, through `work/submit` and a review card, then to main. Straight pushes are fine for now; PRs + CI come later.

0. **Data model contract v2** — DONE (main at 16f6dc6). Cormac's review folded in: per-actor idempotency, the in_flight external-effect human gate, lease-takeable catch-up, owner-scoped blobs, and the submitted-requires-approved CHECK.

1. **App skeleton + migrations.** TS/Lit site boots on localhost (node http server + Lit; port from `ports/lease` once that's on my node); SQLite with one migration per data-model table; the schema enforces invariants 1–8 exactly as written — the partial unique index for gates, unique per-actor `request_id`, the CHECK on submitted.
   Accepts: `npm run dev` serves the tracker page; migrations apply to a fresh DB; each invariant verified against real rows.

2. **Action log + outbox core.** `action_log` with API-derived per-actor `request_id` (hash of actor, verb, target); every state change commits its own outbox row in the same transaction; an at-least-once dispatcher that dedupes on `request_id`.
   Accepts: a retried act returns the original outcome and never double-executes; nothing announces a fact that never landed.

3. **Scheduler with job_runs leases.** Unique `(job_key, due_ms)` as a table constraint in the migration; exactly-once catch-up of missed windows (each window once, not "latest wins"); `lease_owner`/`lease_expires_at` so a killed runner's window can be taken over instead of wedging.
   Accepts: kill the runner mid-window → one make-up run per missed window.

4. **Human-gate queue.** `gate_actions` API + the Lit tracker view: one open gate per submission (schema-enforced); approve / resend / close from the UI or an airc message; gates are pluggable handlers, human by default, owner can opt into automated per gate type.
   Accepts: the in_flight external-effect case opens a gate and never blind-resends.

5. **Persona-driven flow over airc.** Acts arrive via airc and land through `action_log` (request_id per actor); outbox announces to the room; gate messages reach the human wherever they are, same live session, hand back when done.
   Accepts: one full posting → submission → approval cycle driven from the room by a citizen.

6. **Kill-mid-flow e2e** (pinned in README). Kill each component mid-flow and assert nothing lost or duplicated on real rows; exercises invariants 1–4 first, including slice 0's human-gate case.
   Accepts: passes with every component killed at the worst moment.

7. **Resume → PDF pipeline inside the product.** Purely algorithmic work lives here (Joel's line) and migrates to Continuum later if it proves generally useful; `generated/` and `portfolio/` stay reachable as reference examples of Joel's manual work, not inputs to the system — the design decides what is generated vs user-provided.
   Accepts: raw markdown resume in, good PDF out, reproducible from named revisions.

**Process note:** each slice gets a review card when `work/create` reaches my node (#4550); reviews go through `work/review` so they count toward learning. Slice order is 1 → 7; anything that blocks me goes on the board as its own card, not in this list.
