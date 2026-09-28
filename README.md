# career-wrangler

An agentic, always-on career pipeline for one user: find roles → tailor the package from a versioned source of truth → track every submission through its status → hand the human exactly one precise action at each gate → learn from what happens next.

A product built and driven by citizens over airc — an always-on TS/Lit website, full ORM + database behind it, scheduled jobs keeping the pipeline moving while its owner sleeps. Localhost first; AWS later.

## What this is (and isn't)

**Is:** a system whose owner sets standing doctrine once — roles, companies, tone, salary stance — and then gets exactly one precise action in a queue whenever only they can act: login, 2FA, captcha, final submit. Everything else (scanning, tailoring, packaging, verification, follow-ups, cohort analysis) is done by the persona.

**Isn't:** an autopilot for applications. Nothing goes out without per-submission human approval, and a captcha is never solved or bypassed by software — it exists to require a person, and bypassing it breaks boards' terms of service and risks real accounts. The point of the system is that the owner's attention lands exactly where only they can act, and nowhere else.

## Package model

- **One source of truth.** `portfolio/resume-source.md` — the canonical document: experience, projects, skills. Everything downstream derives from it.
- **Five versioned role flavors** derived from that source (`resume-ai-architect`, `resume-ml`, `resume-perception`, `resume-security`, `resume-software-systems`). They are regenerated when the source changes — one source edit updates every flavor.
- **Per-posting tailoring is light.** Pick the right flavor(s), adjust emphasis and summary, write the cover letter. Never a new resume from scratch per posting.

`portfolio/` also holds the LinkedIn profile facts (`linked-in-details.md`) so what goes out stays consistent with what's on the profile, plus a reference cover letter (`cover-letter-perception.md`). `generated/{resumes,cover_letters}/` is where finished packages land.

## Submission tracking (the database)

Every submission lives in the ORM-managed DB end to end: company, role, posting URL, destination (board or ATS), the exact package sent, status, whose turn it is (persona or human), contacts, dates and follow-ups.

`found → package ready → WAITING ON HUMAN (gate named) → submitted (with evidence) → responded → interview → offer | closed`

The website's main surface is this pipeline: one card per submission, current state visible at a glance, the queue of actions waiting on the human front and center.

## Human-in-the-loop doctrine

1. The persona does everything up to each gate (captcha, login, 2FA, final submit), then hands the human ONE precise action in the website's queue.
2. The human completes it; the persona verifies and records — evidence attached to the submission, not vibes.
3. Every submission is approved by the user before it goes out.
4. Standing doctrine (roles, companies, tone, salary stance) is a config surface on the website, owned by the user, honored by every job.

## Learning

Employer responses are valuable but **delayed and confounded** outcomes — role, employer, timing, market and human edits all move together. So learning:

- links each consented submission to its package version and adapter, then to later outcomes;
- compares comparable cohorts rather than single episodes;
- also captures immediate signals that need no waiting: factual accuracy of the package, role fit, and human correction burden (how much the owner had to fix before approving).

Unseen episodes are reserved before any synthesis. The genome for this activity lives in this repo; personal data never enters a published gene.

## Privacy constraints (hard)

- The owner's personal data stays in their own installation and is **never published** — not here, not in the website, not in genomes or cohort reports.
- Nothing hardcodes the owner: identity, accounts and doctrine come from local config; the repo must be runnable by any user.
- Credentials and secrets never enter the repo or the database that ships with it.

## How it runs (target shape)

Localhost first: TS/Lit website on a local port, full ORM + database behind it (real schema, migrations — no hand-rolled SQL), scheduled jobs (scanning, follow-ups, cohort comparison) driven by citizens over airc. AWS deployment comes after the loop is proven locally.

_Today this repo holds the seed material (`portfolio/`, `generated/`) and this design; the app, ORM schema and job runners land in follow-up PRs against it._

## Contributors

- **Kimi** (Continuum citizen `e2f0e022`) — product README; first draft of this design.
- **Joel** — owner: standing doctrine, human at the gates.

_Citizen commits carry `Co-authored-by: <citizen> (Continuum citizen <peer id>)`; citizen-authored PR text is footed with her identity (#4530). Pushes go out under Joel's GitHub account._
