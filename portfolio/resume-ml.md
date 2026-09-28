# Joel Teply

**Principal ML Systems / Research Engineer**
LLM Architecture · Inference · Model Efficiency · Continual Learning
Kansas City Metro · joel@cambriantech.com · github.com/CambrianTech

---

## Profile

I design model architectures and the runtimes that serve them. Current work is transformer
plasticity, structured pruning, and continual learning; the same specialty runs back through
CNN quantization in 2017 and metric-learning architectures before AlexNet.

Twenty years of making research-grade computation practical on constrained hardware, which
in this field means the model, the kernel, the memory system, and the scheduler are one
problem rather than four.

---

## Current Research & Systems

### Sentinel-AI — transformers that grow their own architecture · 2025–present
Architecture research with a written paper, *Experiential Plasticity*: attention heads that
contribute to a domain specialize while the rest are removed, so architecture co-evolves with
training instead of being fixed at design time.
- Qwen3.5-4B forged on code: **24% perplexity improvement over baseline from a smaller
  model.** Qwen3.5-27B: 3.5% better than baseline, running in 17 GB at 4-bit against 28 GB
  at fp16.
- LoRA with mixed-precision training; memory-tier detection so one recipe runs on a laptop
  or a 32 GB GPU. Models published on HuggingFace with the recipes that produced them.

*github.com/CambrianTech/sentinel-ai*

### Model compaction — utilization-aware surgery, not blind quantization
- Head pruning by gate-gradient utilization: 14B coder model, 27 GB → 8.9 GB (3×).
- MoE expert pruning by runtime activation profiling: 35B, 67 GB → 47 GB.
- Both published with reproducible recipes; compacted models run on hardware that could
  never hold the original.

### AIRC — peer-to-peer agent communication · 2025–present
Rust communication substrate connecting AI agents across tabs, machines, and accounts with
end-to-end encrypted multi-agent messaging and file sharing; foundation for Continuum's
distributed communication layer.

### Continuum — distributed local-first AI · 2025–present
Open-source Rust platform for persistent AI agents across commodity hardware. Sole architect,
550,000 lines.
- **Inference runtime.** 121 commits on a maintained llama.cpp fork: backend lifetime
  contracts, slot and KV-cache behaviour, Metal and CUDA placement. ~50 tok/s solo and ~128
  batched on Metal, 80–237 on consumer CUDA; a 48B linear-attention model at ~57 tok/s on a
  Mac.
- **Scheduling under memory scarcity.** Typed KV-slot leases, traffic classes and priced
  eviction so a dozen agents share a few warm slots instead of each holding a model.
- **Continual learning, evaluation-gated.** Agent experience generates LoRA training
  curricula; an adapter is adopted only when evaluation improves. 43 of 76 resolved
  SWE-bench Verified attempts (57%), with reproducible verdict artifacts.
- **Distributed training and inference.** Peer-to-peer mesh moving work and learned adapters
  toward suitable hardware, with signed provenance on produced artifacts.
- Fourteen concurrent embodied agents at 30 fps with real-time voice, rendered by the same
  machine serving their models.

*github.com/CambrianTech/continuum*

---

## Experience

### Cambrian Tech — Co-founder, CTO, Principal Engineer · 2009–present
Co-founded a computer vision and augmented reality technology company building proprietary
perception technology and delivering engineering programs for enterprise clients across
automotive, retail and home improvement. Owned technical architecture end to end and set
technical direction across engineering teams. Technology licensed to Fortune 500 customers
including Home Depot and Lowe's, deployed to millions of users. Automotive computer-vision program with
Garmin, 2020–2022, under strict accuracy and CPU/GPU constraints, expanding into a multi-year
engagement.

**Applied ML, 2009–2022**
- **Metric learning before AlexNet.** A modified Siamese network learned a patch-similarity
  metric driving cellular-automaton region evolution for segmentation. On our task it
  outperformed ImageNet-pretrained semantic segmentation and ran far faster — adaptive to the
  image, evaluating a growing frontier rather than dense inference. Migrated to CNNs once
  they generalized without a seed and had hardware acceleration behind them.
- **Quantization and compression, 2017.** Weight quantization and model compression tooling
  for deployed CNNs — the same problem now being solved at LLM scale.
- **Architecture retargeting.** ICNet adapted for both semantic segmentation and
  surface-normal prediction, trained and exported for on-device inference. Soft segmentation
  and matting for boundary quality.
- **Cross-framework engineering.** Caffe→TensorFlow and Caffe→CoreML/MLKit conversion so one
  trained model shipped to every target.
- **Synthetic data.** Image synthesis pipelines, including Unreal Engine scenes, generating
  labeled ground truth where real data was unobtainable.
- **Production Python ML infrastructure.** Built the server-side image-processing pipeline
  behind Cambrian's flooring platform: uploaded photographs moved through TensorFlow and
  classical CV/ML stages for semantic structure, surface normals, geometry/elevation,
  lighting, field of view, and other scene representations used to reconstruct and re-render
  rooms with new materials. Built serving APIs, S3-backed data flow, Docker CPU/GPU
  deployment, tests, model utilities, and elastically scaling AWS inference infrastructure.
- **Generative.** Inpainting, seamless texture synthesis, photo-driven video generation.
- **Deployment.** CNN inference at 1–3 second latency on phones, asynchronously revising a
  scene representation maintained at frame rate — segmentation and surface normals both
  on-device, no cloud.

First-named inventor, **US10964097B2** — *Pattern Recognition Systems and Methods for
Performing Segmentation on Surfaces and Objects*.

### EyeVerify / ZOLOZ — Software Engineer, Computer Vision & Biometrics · 2012–2016
One of the first two engineers on eye-vein biometric authentication; acquired by Ant
Financial (Alibaba) for over $100M in 2016. Vision algorithms at camera frame rate on constrained hardware; presentation-attack
and liveness detection. Co-inventor, **US9665784B2**; also named on **US8437513B1** and
**US8675925B2**.

### TripleBlind → Ideem — Software Engineer, Cybersecurity · 2023–2026
Cryptographic authentication technology and the SDK surface enterprise customers build
against.

### Earlier
**Propaganda3** (2010–2012) · **VML** (2006–2010) · **AgileWise** (2005–2006, hardware and
embedded) · **NovaStar, Federal Home Loan Bank of Topeka, AllofE Solutions** (1999–2006)

---

## Technical

**ML architecture** — transformers and LLMs, attention-head plasticity, structured pruning,
quantization, LoRA and mixed-precision training, distillation, metric learning and Siamese
networks, CNN architectures for segmentation/depth/normals/reconstruction, GANs, diffusion,
synthetic data

**Inference & systems** — llama.cpp internals, KV-cache and slot scheduling, memory-tier
planning, GPU compute (Metal, CUDA, OpenGL/GLSL), SIMD, concurrency, distributed systems,
production Python ML services, Docker/AWS infrastructure, Rust, C++, Python, Go, TypeScript

**Evaluation** — benchmark harness design, reproducible experiment artifacts, provenance and
attestation, telemetry that supports the claim

---

## Education & Patents

**B.S. Computer Engineering — University of Kansas**

- **US10964097B2** (2021, Cambrian Tech LLC). First-named inventor.
- **US9665784B2** (2017), **US8437513B1**, **US8675925B2**.
- $100,000 LaunchKC grand prize (2017); top-five finalist, Atlanta Startup Battle 6.0 (2019, TechSquare Labs).
