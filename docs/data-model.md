# Data model

The database of career-wrangler — the source of truth (README → Resilience). Everything the website shows is a projection of these rows; nothing lives only in memory or a browser tab. Conventions first, then the tables, then the invariants that make failure readable instead of silent.

## Conventions

- Every table has `id uuid PK` and `created_at timestamptz`.
- Personal rows are scoped by `owner_id`: every row carrying one user's data names whose it is, and no read path crosses owners without a role grant (README → Privacy).
- Large content (resumes, cover letters, form answers, evidence) is stored by reference: `*_ref` points at a content-addressed blob store (`blobs(owner_id + sha256 → bytes)`, keyed per owner — one row per (owner, file), so two owners sharing one file get two rows and deletion stays exact (invariant 6)), so "the exact package sent" stays reproducible byte-for-byte.

## Tables

### users
Accounts for both layers — humans and citizens log in like users (README → Personas are an independent layer).
`id`, `name`, `email` nullable — a partial unique index covers the humans (`WHERE kind = 'human'`); citizens authenticate by `peer_id`, which is unique when set, `kind` = human | citizen, `peer_id` nullable (the Continuum peer id when kind = citizen).

### user_roles
Which pipeline a user may act in, and how. One row per (user, owner) pair:
`user_id`, `owner_id` (the account whose doctrine this is), `role` = owner | collaborator.

### doctrine
Standing rules set once by an owner; every job honors them (README → Human-in-the-loop).
`owner_id`, `targets` (roles/companies to pursue — a structured list, not prose), `tone text`, `salary_stance jsonb`, `revision int` bumped on each save. A job reads the revision it started under and says so in its action log row.

### resume_sources
The one source of truth per user (README → Package model).
`owner_id`, `doc_key` (e.g. `resume-source`), `revision int`, `sha256`, `updated_at`. One active row per (owner, doc_key); superseded rows stay for lineage.

### flavors
Versioned role resumes derived from the source; the seed set ships as an example, not a requirement.
`id`, `owner_id`, `doc_key` (`resume-ai-architect`, …), `revision int`, `derived_from → resume_sources.id` (the revision it was built from), `status` = active | retired. A source change regenerates flavors as NEW revisions; old ones stay, so a package can always name what it was built from.

### postings
Roles found by the scanning jobs.
`id`, `owner_id`, `url text` normalized before store — scheme lowered, trailing slash and tracking params stripped; unique per owner after normalization, `title`, `company`, `destination` (board or ATS), `found_at`.

### submissions
The tracked unit end-to-end (README → Submission tracking).
`id`, `owner_id`, `posting_id FK`, `status` = found | package_ready | waiting_on_human | submitted | responded | interview | offer | closed, `whose_turn` = persona | human, `approved_by user_id nullable`, `approved_at nullable`, `submitted_at nullable`, `evidence_ref → blobs nullable`. The pair `(id, owner_id)` carries a unique index: it is the referenced target of the composite foreign keys children use to ride ownership down from here.

### packages
The exact thing sent — never reconstructed from memory. One row per attempt; a retry is a new row.
`id`, `owner_id`, composite FK `(submission_id, owner_id) → submissions(id, owner_id)` — ownership rides down by referential integrity (invariant 6), and there is NO unique on that pair: one row per attempt; a retry is a new row. `flavor_refs jsonb` (doc_key + revision used), `cover_letter_ref → blobs nullable`, `form_answers jsonb nullable`, `sha256`.

### gate_actions
The queue the website puts front and center: one precise action at a time.
`id`, `owner_id`, composite FK `(submission_id, owner_id) → submissions(id, owner_id)` (invariant 6; no unique on that pair — closed gates stay in history and a new one opens after them; only invariant 1's partial index bounds the open ones), `kind` = captcha | login | 2fa | final_submit, `ask text` (the single precise thing to do), `opened_at`, `closed_at nullable`, `closed_by user_id nullable`, `verification_ref → blobs nullable`.

### contacts
People the owner talks to, optionally tied to a submission.
`id`, `owner_id`, composite FK `(submission_id, owner_id) → submissions(id, owner_id)` with submission_id nullable (a contact can exist before any submission; invariant 6), `name`, `email`, `title`, `notes text`.

### followups
Scheduled touches on a submission (thank-you note, nudge after N days).
`id`, `owner_id`, composite FK `(submission_id, owner_id) → submissions(id, owner_id)` (invariant 6 — same class of fix as packages and gate_actions), `due_at timestamptz`, `kind text`, `done_at nullable`. Due rows are picked up by the job runner; a missed window runs once on recovery (see job_runs), never twice.

### action_log
Intent before, outcome after — every effectful act of any actor, human or citizen, through the API.
`id`, `actor user_id`, `request_id text` (per-intent idempotency key chosen by the caller — fresh for each new attempt, reused on redelivery; UNIQUE on (actor, request_id) so no user's key can shadow another's → invariant 2), `verb text` (`submission.approve`, `gate.complete`, …), `target jsonb` (kind + id), `intent_at timestamptz`, `outcome_at nullable`, `outcome` = in_flight | ok | error, `error_ref nullable`. An `in_flight` row whose verb has an external effect is never re-executed on retry — it opens a gate (invariant 3).

### outbox
Durable messages to airc, written in the SAME TRANSACTION as the state change they announce.
`id`, `seq bigint` per destination, `destination text` (airc room/peer/topic), `request_id → action_log.id`, `payload jsonb`, `created_at`, `dispatched_at nullable`. A dispatcher drains it at-least-once; receivers dedupe on (actor, request_id), so delivery is effective-once.

### job_runs
The scheduler's memory — what ran when, and whether a missed window was already caught up.
`id`, `job_key text` (`scan.postings`, `followups.due`, …), `due_ms bigint`, `started_at`, `finished_at nullable`, `status` = running | done | failed, `lease_owner user_id nullable`, `lease_expires_at timestamptz nullable` (a lapsed lease lets another runner take over the window → invariant 5), `request_id → action_log.id`. The unique key on (job_key, due_ms) lives in the table itself, enforced by the database.

### outcome_events
Delayed, confounded signals from the world (README → Learning).
`id`, `submission_id FK`, `kind` = response | no_response_after_n_days | interview_call | offer | rejection, `at timestamptz`, `source_ref nullable → blobs` (the reply itself, when consented), `consented bool`.

### learning_links
The join for cohort analysis: which package version and adapter produced a submission.
`id`, `submission_id FK` (one per submission), `adapter_version text`, `reserved_for_synthesis bool` (unseen episodes are reserved before any synthesis). Cohort reports compare comparable postings across these rows — never single episodes — and read only consented outcome_events.

## Relations

```
users ─< user_roles >─ users(owner)
owner ─< doctrine · resume_sources ─< flavors
owner ─< postings ─< submissions ─┬─< packages ─> blobs (resumes, cover letters)
                          ├─< gate_actions      (≤1 open per submission)
                          ├─< followups
                          ├─< outcome_events
                          └─< learning_links
submissions — contacts (optional, shared within an owner)
action_log <— outbox (action_id) · action_log ← job_runs
```

## Invariants the schema enforces (not code goodwill)

1. **One open gate per submission.** Unique partial index on `gate_actions(submission_id) WHERE closed_at IS NULL`. The queue can never show two asks for one submission.
2. **Idempotent replay, per intent.** Each act attempt carries an idempotency key chosen by its caller — fresh for each new attempt, reused on redelivery — stored UNIQUE on (actor, request_id). A retried or redelivered act returns the original outcome instead of doing it twice; a genuinely repeated act arrives with a new key and is acted. No user's key can shadow another's.
3. **No blind re-execution past the world.** An `in_flight` act whose verb has an external effect (submit, post) is never retried after its window closes — we cannot know whether the outside received it. It opens a `gate_action`; a human decides resend or close. The kill-mid-flow test exercises this invariant first.
4. **Outbox in-transaction.** A state change and its outbox row commit together, or not at all — nothing announces a fact that never landed; no landing goes unannounced.
5. **Exactly-once catch-up, takeable by lease.** `job_runs` is unique per (job_key, due_ms) as a table constraint in the migration, so downtime produces one make-up run per missed window: each missed window runs once, not "latest wins". A running row holds a lease (`lease_owner`, `lease_expires_at`); when it lapses — runner killed — another may take over the same window instead of wedging it.
6. **Ownership on every personal row.** Every table carrying personal content has `owner_id`; crossing owners requires a `user_roles` grant. Blobs are owner-scoped rows: two owners sharing one file get two rows (one per owner), so deletion and privacy stay exact; the cost is a little duplicate storage.
7. **Submitted means approved.** CHECK constraint on `submissions`: state `submitted` requires `approved_by` set — no row announces an external send that nobody approved.
8. **Lineage over mutation.** Sources and flavors keep their old revisions; packages name the exact revisions they used, so "what was sent" is always answerable after the fact.

## Status of this document

This is the contract; nothing here is implemented yet. The first code slice (app skeleton + ORM migrations for these tables) lands against it, and the e2e test pinned in the README — kill a component mid-flow, assert nothing lost or duplicated — exercises invariants 1–4 directly on real rows.
