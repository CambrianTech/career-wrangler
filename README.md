# career-wrangler

An agentic, always-on career pipeline for job seekers: find roles → tailor the package from a versioned source of truth → track every submission through its status → hand the human exactly one precise action at each gate → learn from what happens next. Any user installs their own instance with their own data; the product is multi-user from day one — several people can run their own pipelines and doctrine under one installation.

A product built and driven by citizens over airc: an always-on TS/Lit website, full ORM + database behind it, scheduled jobs keeping the pipeline moving while its owners sleep. Localhost first; AWS later.

## What this is (and isn't)

**Is:** a system whose user sets standing doctrine once — roles, companies, tone, salary stance — and then gets exactly one precise action in a queue whenever only they can act: login, 2FA, captcha, final submit. Everything else (scanning, tailoring, packaging, verification, follow-ups, cohort analysis) is done by the persona.

**Isn't:** an autopilot for applications. Nothing goes out without per-submission human approval, and a captcha is never solved or bypassed by software — it exists to require a person, and bypassing it breaks boards' terms of service and risks real accounts. The point of the system is that each user's attention lands exactly where only they can act, and nowhere else.

## Package model (per user)

- **One source of truth per user.** `portfolio/resume-source.md` — the canonical document: experience, projects, skills. Everything downstream derives from it.
- **Versioned role flavors** derived from that source — e.g. AI architect, ML, perception, security and software/systems in the seed portfolio below. A new user defines their own set; nothing here is hardcoded to one owner's roles. Flavors are regenerated when the source changes — one source edit updates every flavor.
- **Per-posting tailoring is light.** Pick the right flavor(s), adjust emphasis and summary, write the cover letter. Never a new resume from scratch per posting.

The shipped `portfolio/` (LinkedIn facts, reference cover letters) is seed data for one owner — an example of what a user's source looks like, not a requirement. `generated/{resumes,cover_letters}/` is where finished packages land.

## Submission tracking (the database)

Every submission lives in the ORM-managed DB end to end: company, role, posting URL, destination (board or ATS), the exact package sent, status, whose turn it is (persona or human), contacts, dates and follow-ups.

`found → package ready → WAITING ON HUMAN (gate named) → submitted (with evidence) → responded → interview → offer | closed`

The website's main surface is this pipeline: one card per submission, current state visible at a glance, the queue of actions waiting on each human front and center.

## Resilience — anything can go down

- **The database is the source of truth.** No state lives only in memory or a browser tab; every screen is a projection of the DB.
- **Intent before, outcome after.** Every action is recorded as intent *before* it runs and its outcome *after*; a failure lands somewhere readable, never silently lost.
- **Idempotent actions.** Request ids make retries safe: redelivery (airc or otherwise) cannot double an effect.
- **Durable outbox for airc.** Messages to citizens are written in the same transaction as their state change and dispatched from there; nothing depends on a live connection at write time.
- **Missed schedules catch up exactly once.** A job that was due while down runs when it comes back — not zero times, not twice.
- **The site works while citizens are offline.** Humans can browse, approve and act without any citizen connected; persona-driven jobs queue until one is.

## Personas are an independent layer

Citizens log in like users: their own accounts and roles through the same authenticated API as any human — no back door, no privileged path that bypasses auth or the data model. A persona's actions carry the same gates and leave the same audit trail as a person's.

## Human-in-the-loop doctrine

1. The persona does everything up to each gate (captcha, login, 2FA, final submit), then hands the human ONE precise action in the website's queue.
2. The human completes it; the persona verifies and records — evidence attached to the submission, not vibes.
3. Every submission is approved by its owner before it goes out.
4. Standing doctrine (roles, companies, tone, salary stance) is a config surface on the website, owned by each user, honored by every job.

## Learning

Employer responses are valuable but **delayed and confounded** outcomes — role, employer, timing, market and human edits all move together. So learning:

- links each consented submission to its package version and adapter, then to later outcomes;
- compares comparable cohorts rather than single episodes;
- also captures immediate signals that need no waiting: factual accuracy of the package, role fit, and human correction burden (how much the owner had to fix before approving).

Unseen episodes are reserved before any synthesis. The genome for this activity lives in this repo; personal data never enters a published gene.

## Privacy constraints (hard)

- A user's personal data stays in their own installation and is **never published** — not here, not in the website, not in genomes or cohort reports.
- Nothing hardcodes one owner: identity, accounts and doctrine come from local config; the repo must be runnable by any user.
- Credentials and secrets never enter the repo or the database that ships with it.

## How it runs (pinned before code)

- **One-command local run.** A single command installs and starts everything — website, database (with migrations), job runner — on localhost.
- **Always-on supervised service.** The process runs under a supervisor that restarts it on crash; the install keeps the pipeline alive across reboots.
- **First slice, e2e-tested from day one.** Before feature code: an end-to-end test drives the real UI and database through one submission at its WAITING ON HUMAN gate, then kills a component mid-flow (server or job runner) and asserts nothing was lost or duplicated.

_Today this repo holds the seed material (`portfolio/`, `generated/`) and this design; the app, ORM schema and job runners land in follow-up PRs against it._

## Contributors

- **Kimi** (Continuum citizen `e2f0e022`) — product README; first draft of this design.
- **Joel** — owner: standing doctrine, human at the gates.

_Citizen commits carry `Co-authored-by: <citizen> (Continuum citizen <peer id>)`; citizen-authored PR text is footed with her identity (#4530). Pushes go out under Joel's GitHub account._
