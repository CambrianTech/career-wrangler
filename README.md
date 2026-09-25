# career-wrangler

`career-wrangler` is a Rust prototype for an agentic career workflow that:

- builds a work portfolio from GitHub-style artifacts and other portfolio experience
- tailors resume bullets and cover letters to a target position in the candidate's voice
- stores applications and experiment outcomes through an ORM-like repository boundary
- prepares AIRC commands for Continuum personas to run search, drafting, and submission work
- tracks simple A/B/N analytics for callbacks and interviews

## What is implemented

The repository now contains a Rust library implementation in `/home/runner/work/career-wrangler/career-wrangler/src/lib.rs`.

## Architecture

This repository is a **consumer** of:

- **AIRC** for transport and coordination
- **Continuum** for personas, commands, events, Playwright automation, and CAPTCHA handling

`career-wrangler` is still a normal Rust project whose code is the source of truth. The shared engine, schemas, scoring, and outputs live here like any other application. The Continuum/AIRC recipe layer exists to coordinate persona-driven execution for this repo's agentic workflow; it is not treated as the generator or owner of the project code.

That means two things can be true at once:

- the repo is a standalone codebase built directly in Rust
- the repo also emits Continuum/AIRC execution plans because this project depends on agent/persona workflows

If this were a non-agentic project, the shared engine could still exist without any Continuum recipe phase plan.

Public integration types derive `ts-rs::TS` so TypeScript definitions can be generated from the Rust source when downstream consumers need them.

Generated TypeScript bindings are checked into `/home/runner/work/career-wrangler/career-wrangler/bindings`.

## Fork-local source data

User-specific inputs live under `/home/runner/work/career-wrangler/career-wrangler/user-sources/`.

The checked-in `/home/runner/work/career-wrangler/career-wrangler/user-sources/template/` directory shows the intended fork pattern:

- `fork-config.json`
- `identity-profile.json`
- `work-history.json`
- `projects-and-github.json`
- `skills-and-domain-tags.json`
- `voice-examples.json`
- `job-preferences.json`
- `prior-applications.json`
- `approval-policy.json`

Forks should mostly replace those files rather than changing shared engine code.

### Core workflow

1. **Portfolio ingestion** via `buildWorkPortfolio(...)`
2. **Application tailoring** via `tailorApplication(...)`
3. **Continuum recipe generation** via `createContinuumRecipe(...)`
4. **Human-gated dispatch and result handling** via `createSubmissionWorkflow(...)` and `advanceSubmissionWorkflow(...)`
5. **Analytics and optimization** via `ApplicationAnalytics`

### Safety boundary

This repository does **not** implement direct CAPTCHA bypassing or low-level browser automation. Those concerns are delegated to Continuum personas and commands when such capabilities are available in the target environment.

## Tests

Run the focused test suite with:

```bash
cargo test
```

## CI

The basic CI workflow runs:

- `cargo fmt --check`
- `cargo test`
- `git diff --exit-code` after tests to confirm generated bindings stay in sync
