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

`career-wrangler` therefore acts as a career-domain recipe layer. It decides **what** work should happen and packages that work into AIRC commands for a Continuum persona, rather than implementing low-level browser automation directly.

Public integration types derive `ts-rs::TS` so TypeScript definitions can be generated from the Rust source when downstream consumers need them.

Generated TypeScript bindings are checked into `/home/runner/work/career-wrangler/career-wrangler/bindings`.

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
