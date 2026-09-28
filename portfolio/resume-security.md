# Joel Teply

**Sr Engineer, Cybersecurity — SOC Process & AI Enablement**
Overland Park / Kansas City Metro · joel@cambriantech.com · github.com/CambrianTech

---

## Profile

I build the layer this role governs: AI and automation doing consequential work, with the
evaluation, telemetry, and audit trail that make it trustworthy enough to keep.

For the last two years that has been a production multi-agent system where LLM agents hold
real work, execute tools against real systems, and are measured on outcomes — with adoption
gates, structured telemetry, deduplication of overlapping automation, and signed provenance
on everything produced. Before that, a decade in security engineering: three years at a cybersecurity company
building cryptographic authentication, and four years on presentation-attack detection with
three patents to show for it. Twenty years of shipping systems
where a wrong automated decision has a cost.

---

## What Maps To This Role

**Governing AI adoption — use case review, de-duplication, strategic alignment**
Every automated capability in my platform passes an evaluation gate before adoption; a
candidate that does not measurably improve outcomes is rejected and the rejection is
recorded. Overlapping implementations are treated as defects on principle — one logical
decision lives in exactly one place, because copies drift and drift is how automation
silently rots. That is use case review and deduplication, run continuously rather than as
a cleanup project.

**Applying modern LLMs to operational workflows** *(the posting's "Claude and other large
language models")*
I do not use LLMs as a chat surface. I run a fleet of Claude-based agents that hold
assigned work items, act through a governed tool surface, review each other's changes, and
report with evidence. Building it required solving the problems that decide whether AI in
operations works: which tasks should be automated at all, how to bound what an agent may
touch, how to make its reasoning inspectable afterward, and how to keep it from reporting
success it cannot substantiate.

**Data, reporting, and visibility that drive decisions**
Every load-bearing decision in the system emits a typed, queryable telemetry event with its
inputs and outcome — not a log line. Post-incident analysis is a query. One rule does more
work than the rest combined: **a check that could not run returns "could not measure,"
never a zero and never an empty list.** Roughly a dozen production defects traced back to
violating it — monitors reporting healthy because they could not see. In a SOC, that is the
difference between an all-clear and an unanswered question.

**Process design and measured improvement**
Recurring failures get a structural fix and a self-running check, not a runbook note. I
document the process, then encode it so the next occurrence is caught automatically. Every
change ships with the verb that proves it worked.

**Incident response discipline**
I run the on-call for a distributed fleet: root-cause to the mechanism, correct the record
publicly when my own diagnosis was wrong, and never merge past a red signal without naming
why. Recent example: a system daemon consuming tens of gigabytes traced to my own leaked
processes rather than the daemon — found by process-table forensics, fixed at the source,
and given an automatic reaper so it cannot recur.

**Stakeholder partnership**
Seventeen years as co-founder and CTO: technology licensed to Fortune 500 customers
including Home Depot and Lowe's, requirements negotiated with enterprise partners, and cross-functional
delivery with engineering, design, and business stakeholders.

---

## Experience

### Cambrian — Co-founder, CTO, Principal Engineer · 2009–present

**Continuum (2025–present)** — open-source Rust platform for governed AI agents.
- Multi-agent orchestration: agents claim work, execute tools, review each other, and are
  scored against committed benchmark artifacts (43 of 76 graded attempts resolved).
- Guardrails: adoption gates on every learned capability, bounded tool surfaces, refusal
  paths that name what could not be verified rather than returning a default.
- Provenance: signed attestation on every produced artifact — ES256/EdDSA, post-quantum
  ML-DSA — recording what ran, on which hardware, with which code and inputs.
- Telemetry: typed structured events across a dozen concurrent agents, queryable after the
  fact; automated resource governance with policy-driven reclamation.
- Python and API automation throughout the toolchain; CI pipeline ownership including
  hardening the build against third-party dependency failures.

**Computer vision & AR (2009–2020)** — real-time scene understanding on phone hardware,
licensed to Fortune 500 customers and deployed to millions of users. First-named inventor,
**US10964097B2** (segmentation on surfaces and objects).

### TripleBlind → Ideem — Software Engineer, Cybersecurity · 2023–2026
Cybersecurity product engineering: cryptographic authentication technology, device-bound
key handling without dedicated secure hardware, secure client integration, and the SDK
surface enterprise customers build against — in a small engineering organization where the
same person owns design, implementation, and customer integration.

### EyeVerify / ZOLOZ — Software Engineer, Computer Vision & Biometrics · 2012–2016
One of the first two engineers on eye-vein biometric authentication; acquired by Ant
Financial (Alibaba) for over $100M in 2016; rebranded ZOLOZ.
- **Adversarial detection.** Presentation-attack and liveness work distinguishing a live
  person from a photo, replay, or mask — threat modeling an attacker who controls the input.
- Co-inventor, **US9665784B2**: spoof detection using only a phone's own earpiece and
  microphone (sonic 3D face sensing, photometric analysis, multi-source pulse detection).
  Also named on **US8437513B1** and **US8675925B2**.
- Sub-second verification on commodity cameras; turned research algorithms into a commercial
  SDK integrated by enterprise customers; stayed through acquisition and integration.

### Earlier
**Propaganda3** (2010–2012) · **VML** (2006–2010) · **AgileWise** (2005–2006, hardware and
embedded) · **NovaStar, Federal Home Loan Bank of Topeka, AllofE Solutions** (1999–2006)

---

## Technical

**AI & automation** — LLM agent orchestration and tool execution, guardrails and adoption
gates, evaluation harness design, prompt and context engineering, retrieval and memory
systems, LoRA fine-tuning, model pruning and quantization, Python and REST/API automation

**Security** — presentation-attack and liveness detection, adversarial ML, cryptographic
SDK engineering, signed attestation and artifact provenance (ES256/EdDSA, ML-DSA),
authentication flows, threat modeling, secure client integration

**Data & telemetry** — structured event design, queryable observability, metrics that drive
decisions, incident forensics, reproducible experiment design

**Systems** — Rust, C++, Python, Go, TypeScript, C#; distributed systems, concurrency,
Linux, GPU compute, performance analysis, CI/CD pipeline ownership

---

## Education & Patents

**B.S. Computer Engineering — University of Kansas**

- **US10964097B2** — *Pattern Recognition Systems and Methods for Performing Segmentation
  on Surfaces and Objects* (2021, Cambrian Tech LLC). First-named inventor.
- **US9665784B2** — *Systems and Methods for Spoof Detection and Liveness Analysis* (2017).
- **US8437513B1**, **US8675925B2** — *Spoof Detection for Biometric Authentication*
  (2013, 2014).
