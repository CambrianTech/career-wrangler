# career-wrangler

`career-wrangler` is a minimal runnable prototype for an agentic career workflow that:

- builds a work portfolio from GitHub-style artifacts and other portfolio experience
- tailors resume bullets and cover letters to a target position in the candidate's voice
- stores applications and experiment outcomes through an ORM-like repository boundary
- prepares automated form submissions while keeping humans in the loop for approval and CAPTCHA handling
- tracks simple A/B/N analytics for callbacks and interviews

## What is implemented

The repository now contains a small Node-based reference implementation in `/home/runner/work/career-wrangler/career-wrangler/src/index.js`.

### Core workflow

1. **Portfolio ingestion** via `buildWorkPortfolio(...)`
2. **Application tailoring** via `tailorApplication(...)`
3. **Human-gated submission** via `createSubmissionWorkflow(...)` and `advanceSubmissionWorkflow(...)`
4. **Analytics and optimization** via `ApplicationAnalytics`

### Safety boundary

The submission workflow does **not** bypass CAPTCHAs. When a form requires CAPTCHA, the workflow pauses and requires a named human solver before submission can continue.

## Tests

Run the focused test suite with:

```bash
npm test
```
