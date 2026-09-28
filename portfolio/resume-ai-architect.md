# Joel Teply

**Principal AI/ML Architect & Engineer**  
AI Systems · Machine Learning · GenAI · Technical Strategy · Production Architecture  
Kansas City Metro · joel@cambriantech.com · github.com/CambrianTech

---

## Profile

Technical founder and hands-on AI/ML architect with twenty years turning difficult research and
engineering problems into production systems. Experience spans modern LLM and agent systems,
computer vision, production ML infrastructure, GPU/edge computing, SDKs, cloud platforms, and
enterprise delivery.

I work comfortably on both sides of the table: understanding a customer's problem, determining
what is technically feasible, explaining architecture and tradeoffs to technical and business
stakeholders, and then going deep enough to build the difficult parts myself.

---

## Current AI Systems & Research

### Continuum — distributed, continually learning AI · 2025–present
Open-source Rust platform for persistent multimodal AI agents across commodity hardware.
- Agentic systems with memory, RAG, tool/function execution, model routing, multimodal
  interaction, and persistent identity.
- Evaluation-gated continual learning: agent experience generates LoRA curricula; adaptations
  are adopted only when evaluation improves.
- Inference-runtime engineering across a maintained llama.cpp fork, including KV-cache/slot
  behavior, Metal/CUDA placement, memory-constrained scheduling, and distributed compute.
- Peer-to-peer movement of inference, training, and learned adapters with signed provenance.
- Fourteen concurrent embodied agents at 30 fps with real-time voice on the same machine
  serving their models.

*github.com/CambrianTech/continuum*

### Sentinel-AI — transformer architecture research
Python/PyTorch research into experiential plasticity: attention heads specialize or are pruned
based on contribution during training. Published models and reproducible recipes; work spans
LoRA, mixed precision, structured pruning, quantization, evaluation, and model efficiency.

*github.com/CambrianTech/sentinel-ai*

### AIRC — distributed agent communication
Rust peer-to-peer communication substrate connecting AI agents across tabs, machines, and
accounts with end-to-end encrypted messaging and file sharing; foundation for Continuum's
distributed communication layer.

*github.com/CambrianTech/airc*

---

## Experience

### Cambrian Tech — Co-founder, CTO, Principal Engineer · 2009–present

Co-founded a computer vision and AI technology company delivering proprietary products and
custom engineering programs across home improvement, retail, and automotive. Led technical
architecture across ML, computer vision, GPU computing, cloud services, SDKs, native/mobile,
and web systems. Technology was licensed to Fortune 500 customers including Home Depot and
Lowe's and deployed to millions of users.

**CLIENT & TECHNICAL LEADERSHIP**

Served as Cambrian's technical lead on most client-facing calls. Worked with prospective and
existing enterprise customers to understand business problems, evaluate technical feasibility,
shape solutions, explain architecture and tradeoffs, support integrations, and carry work
through delivery. Participated in sales and technical calls, presentations and product demos,
trade shows, investor and competition pitches, and technical/legal discussions around
commercial engagements.

**PRODUCTION ML & CLOUD**

Built production Python/TensorFlow image-processing services for Cambrian's flooring platform.
Uploaded photographs moved through classical CV and ML stages for semantic structure, surface
normals, geometry/elevation, lighting, camera estimation, and other representations used to
reconstruct and re-render scenes. Built serving APIs, S3-backed data flow, Docker CPU/GPU
deployment, tests, model utilities, and elastically scaling AWS inference infrastructure.

**APPLIED AI/ML**

Developed ML systems from research through deployment: metric/Siamese learning, CNN
segmentation/depth/surface normals, model quantization and compression, synthetic training
data, GAN/generative pipelines, cross-framework model conversion, and real-time inference on
constrained hardware. First-named inventor on US10964097B2 for segmentation technology.

Cambrian won the inaugural $100,000 LaunchKC Grand Prize and was a top-five finalist at Atlanta
Startup Battle 6.0.

### EyeVerify / ZOLOZ — Software Engineer, Computer Vision & Biometrics · 2012–2016
One of the first two engineers turning biometric computer-vision research into a production
SDK on commodity phones. Built real-time tracking, segmentation, multi-frame fusion, image
enhancement, and presentation-attack/liveness detection. Named on three patents. Stayed
through acquisition and integration.

### TripleBlind → Ideem — Software Engineer, Cybersecurity · 2023–2026
Built secure client integrations and enterprise SDK surfaces for cryptographic authentication
technology, including device-bound key handling without dedicated secure hardware.

### Earlier
**Propaganda3** (2010–2012) · **VML** (2006–2010) · **AgileWise** (2005–2006, embedded
hardware/software) · **NovaStar, Federal Home Loan Bank of Topeka, AllofE Solutions**
(1999–2006)

---

## Technical

**AI / GenAI** — LLMs, agents, RAG, embeddings/vector retrieval, tool and function execution,
LoRA and model adaptation, prompt-driven workflows, continual learning, evaluation, model
routing, structured pruning, quantization

**ML / Data** — Python, PyTorch, TensorFlow, CNNs, metric learning, GANs, synthetic data,
computer vision, model training/evaluation, production inference pipelines

**Architecture / Cloud** — AWS, Docker, production APIs and SDKs, S3-backed data pipelines,
distributed systems, P2P systems, telemetry/observability, reproducible evaluation artifacts

**Systems** — Rust, C++, Python, Go, TypeScript, C#; CUDA, Metal, OpenGL/GLSL, WebGL; SIMD,
concurrency, scheduling/backpressure, memory-constrained and edge execution

**Client / Leadership** — technical discovery, solution architecture, technical sales support,
stakeholder communication, presentations and demos, enterprise integration, technical
delivery, engineering leadership

---

## Education & Patents

**B.S. Computer Engineering — University of Kansas**

- **US10964097B2** — segmentation systems and methods; first-named inventor
- **US9665784B2**, **US8437513B1**, **US8675925B2** — spoof detection / liveness
- $100,000 LaunchKC Grand Prize winner; Atlanta Startup Battle 6.0 top-five finalist
