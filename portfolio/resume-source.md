<!-- MASTER SOURCE RESUME. Canonical career record / superset. Tailor per target; do not send this file raw.
     Title line by category:
       Perception / autonomy   Principal Perception & Edge AI Engineer
                               Computer Vision · Spatial Computing · Autonomous Systems · ML Systems
       Frontier ML             Principal ML Systems / Research Engineer
                               LLM Architecture · Inference · Model Efficiency · Continual Learning
       General hard systems    Principal / Staff Systems Engineer
                               AI · Computer Vision · High-Performance Computing · Edge Systems
       Hardware / edge         Principal Systems / Edge AI Engineer
                               Embedded Systems · GPU Compute · Robotics · Intelligent Hardware
       Security                Sr Engineer, Cybersecurity — see resume-security.md
-->

# Joel Teply

**Principal / Staff Engineer — Computer Vision, ML Systems, High-Performance Computing**
Kansas City Metro · joel@cambriantech.com · github.com/CambrianTech

---

## Profile

Full-stack engineer since 1999, with twenty years building computer vision, machine learning,
and high-performance systems on top of that foundation — from backend, databases, web and
embedded systems through pre-ARKit mobile scene understanding, biometric perception, cloud
platforms, LLM architecture and inference runtimes. I work across the whole stack as needed:
hardware, runtimes, models, GPU kernels, memory systems, schedulers, APIs, data, cloud, and
the product above them.

The work includes patented computer vision and liveness detection, real-time 3D scene
understanding on iPhone-class hardware deployed to millions of users, and current research
in attention-head plasticity, structured pruning, and continual learning.

The through-line is the same problem in different decades: take something that assumes a
datacenter, a research rig, or specialized silicon, and make it work on the machine someone
already owns. Mobile was usually the deployment target, not the discipline — phones were
the constrained computers available at scale.

---

## Experience

### Cambrian Tech — Co-founder, CTO, Principal Engineer · 2009–present
Co-founded a computer vision and augmented reality technology company building proprietary
perception technology and delivering custom engineering programs for enterprise clients
across automotive, retail, and home improvement. Owned technical architecture and
implementation end to end — ML, computer vision, real-time 3D perception, GPU optimization,
native and web platforms — setting technical direction and working with engineering teams
and customers to turn hard perception problems into deployable systems. Technology licensed
to Fortune 500 customers including Home Depot and Lowe's, deployed to millions of users.

**Founder / client-facing technical leadership.** Served as Cambrian's technical lead on most
client-facing calls and worked directly with prospective and existing enterprise customers to
understand business problems, evaluate technical feasibility, shape project approaches, explain
architecture and tradeoffs, support integrations, and carry work through delivery. Presented Cambrian's technology to customers,
partners, investors, judges, and industry audiences; helped develop and deliver company pitches
and product demonstrations, represented Cambrian at trade shows and competitions, and ran booth
demos and technical conversations with prospects. Participated in technical/legal discussions
around commercial engagements and contracts. Cambrian won the $100,000 LaunchKC Grand Prize and
was a top-five finalist at Atlanta Startup Battle 6.0.

**Automotive computer vision — Garmin, 2020–2022.** Contributed to early perception research
and engineering for an automotive program under strict accuracy and CPU/GPU constraints,
applying geometry, pose estimation, sensor fusion, and optimization techniques developed for
real-time spatial understanding. The program expanded into a multi-year engagement.

**Perception and spatial computing (2009–2022)**
- **Real-time asynchronous perception.** Maintained a continuously evolving scene
  representation at frame rate while expensive CNN inference ran asynchronously on-device
  with 1–3 second latency. Cellular-automaton region evolution over learned patch
  affinities, watershed segmentation across detected structural lines, tracking and
  temporal interpolation continuously added, removed, extended and joined regions; delayed
  semantic-segmentation and surface-normal results revised the live state as they arrived
  rather than gating the frame rate. Segmentation and surface normals both ran on the
  device — no cloud.
- **Two kinds of consistency, held at once.** Geometric accumulation and tracking gave
  spatial consistency — optical flow, camera pose, RANSAC plane fitting, multi-frame fusion,
  SLAM-like structure from an ordinary camera. Asynchronous state revision gave perceptual
  consistency despite slow inference. Camera parameter estimation (field of view, rotation),
  panorama-to-pinhole reprojection, and online calibration in C++.
- **The pipeline that made it possible.** Priority-scheduled and backpressured C++
  perception pipeline over lazily evaluated shared frame representations, so estimators with
  radically different cost ran at their own cadence without stalling the world model.
  Optimized with SIMD, threading, and OpenGL ES compute/GPGPU shaders. One core architecture
  targeting iOS/Objective-C++, Android/JNI, Unity, browser (TensorFlow.js, WebGL), and
  headless servers.
- Walkable AR flooring **before ARKit existed**: a rendered floor that stays locked to the
  room as you walk on it, on large low-texture foreshortened surfaces where plane fitting
  fails and only real-time semantics hold the boundary.
- **Photographic compositing rather than overlay.** Scene lighting and shadow estimation,
  texture and material decomposition, and re-rendering surfaces under the room's real
  illumination. The realism bar came from a visual-arts background — knowing what makes a
  composite read as a photograph rather than a sticker drove which physical quantities the
  perception stack had to recover in the first place. Shipped in Wall Painter and Home Harmony (stills) and **Video Painter
  (App Store, 2011)** in live video, when mobile AR still meant sprite overlays.
- First-named inventor, **US10964097B2** — *Pattern Recognition Systems and Methods for
  Performing Segmentation on Surfaces and Objects*.

**Applied ML research (2009–2022)**
- Learned-affinity segmentation **before AlexNet**: a modified Siamese network learned the
  patch-similarity metric that drove the region evolution above. On our task it outperformed ImageNet-pretrained semantic segmentation and
  ran far faster, being adaptive to the image and evaluating a growing frontier rather than
  dense inference. Migrated to CNNs once they generalized without a seed and had hardware
  acceleration behind them.
- Weight quantization and model compression tooling for deployed CNNs (2017) — the same
  problem now being solved at LLM scale.
- ICNet retargeted for both semantic segmentation and surface-normal prediction, trained
  and exported for mobile inference; soft segmentation and matting for boundary quality.
- Cross-framework model engineering: Caffe to TensorFlow and Caffe to CoreML/MLKit
  conversion so one trained model shipped to every target.
- Synthetic training data: image synthesis pipelines, including Unreal Engine scenes, built
  to produce labeled ground truth where real data was unobtainable.
- **Production Python ML infrastructure.** Built the server-side image-processing pipeline
  behind Cambrian's flooring platform: uploaded photographs moved through TensorFlow and
  classical CV/ML stages for semantic structure, surface normals, geometry/elevation,
  lighting, field of view, and other scene representations used to reconstruct and re-render
  rooms with new materials. Built serving APIs, S3-backed data flow, Docker CPU/GPU
  deployment, tests, model utilities, and elastically scaling AWS inference infrastructure.
- Generative work: inpainting and seamless texture synthesis for surface replacement;
  photo-driven video generation.

**LLM systems and continual learning (2023–present)** — see Selected Projects.

### TripleBlind → Ideem — Software Engineer, Cybersecurity · 2023–2026
Cryptographic authentication technology: device-bound key handling without dedicated secure
hardware, secure client integration, and the SDK surface enterprise customers build against.

### EyeVerify / ZOLOZ — Software Engineer, Computer Vision & Biometrics · 2012–2016
One of the first two engineers on eye-vein biometric authentication; acquired by Ant
Financial (Alibaba) for over $100M in 2016.
- Identified scleral vasculature from commodity front-facing cameras with verification in
  under a second; eye and iris tracking, segmentation, multi-frame fusion, and image
  enhancement at camera frame rate via OpenGL/GLSL and threaded pipelines.
- Presentation-attack and liveness detection: distinguishing a live person from a photo,
  replay, or mask. Co-inventor, **US9665784B2** — spoof detection using only a phone's own
  earpiece and microphone (sonic 3D face sensing, photometric analysis, multi-source pulse
  detection). Also named on **US8437513B1** and **US8675925B2**.
- Turned research algorithms into a commercial SDK; stayed through acquisition and
  integration.

### Earlier
**Propaganda3** — Software Engineer · 2010–2012. Primarily mobile product engineering for
agency clients. Built H&R Block's first tax app in roughly three months, including OCR/photo
W-2 ingestion and a reusable engine supporting federal and state tax forms; the architecture
was reused for the Android implementation. Also built iOS fitness, media, and other consumer
applications.

**VML** — Software Engineer · 2006–2010. Full-stack agency engineering for major brands:
C#/.NET and CMS-backed web systems, frontend work, databases/SQL, Java, and early native
mobile. Designed database structures and layered client/server systems using JSON, SOAP and
REST services; built CMS integrations and jQuery plugins and used NUnit for automated testing.

**AgileWise** — Hardware & Software Engineer · 2005–2006. Designed PCB-level embedded
hardware and a touchscreen computer/phone prototype; integrated LCD and RFID hardware, wrote
display-driver and platform code, created a Windows CE OS/platform image, later brought up
Linux, and built device/server software spanning Compact Framework applications, web services,
database procedures, and low-level device integration.

**VML (contract)** — Software Engineer · 2005 and later contracting. Built backend
infrastructure for Bluetooth.com in C#/ASP.NET; produced UML/design documentation and
customized CMS/SharePoint systems and web parts.

**NovaStar Financial** — Software Engineer · 2004–2005. Built business applications for loan
underwriting, including SQL Server stored procedures, COM components, and C#/.NET systems.

**Federal Home Loan Bank of Topeka** — Software Engineer · 2002–2004. Built ASP.NET/C#
accounting software for internal users and client banks using SQL-backed, three-tier
application architectures.

**AllofE Solutions** — Software Engineer · 2000–2002. Full-stack B2B application development
for Kansas City-area customers using PHP, Perl, Java, LAMP/MySQL and SQL. Designed database
schemas and carried products through implementation, deployment, and maintenance.

**Midwestern Electronics** — Electronics Assembly · 1999. Assembled and soldered PCBs used
by Allied Signal and government customers.

**Independent hardware / robotics design.** Built low-level hardware including stepper-motor
drivers, servo controllers, sensors, digitally controlled lighting, and mobile-device
prototypes using ARM microcontrollers, GSM modules, LCDs, MOSFETs, and mixed digital/analog
components. Experience interfacing evaluation boards and building autonomous-robot hardware.

Across these roles and later startups, repeatedly built full-stack systems end to end,
including relational schemas and SQL, custom ORMs, web servers, backend services, frontend
applications, deployment infrastructure, and client integrations.

---

## Selected Projects

**Continuum** — open-source Rust platform for persistent AI agents running across commodity
hardware. Sole architect, 550,000 lines. Multi-agent orchestration with governed tool
execution; typed KV-slot leases and priced eviction so a dozen agents share a few warm
slots; evaluation-gated continual learning where agent experience generates LoRA curricula,
reaching 43 of 76 resolved SWE-bench Verified attempts (57%) with reproducible verdict
artifacts; peer-to-peer distribution of inference, training and adapters with signed
provenance. 121 commits on a maintained llama.cpp fork covering backend lifetime, KV-cache
behaviour, and Metal/CUDA placement. Sustains ~50 tok/s solo and ~128 batched on Metal,
80–237 on consumer CUDA; renders fourteen concurrent embodied agents at 30 fps on the same
machine serving their models.
*github.com/CambrianTech/continuum*

**Sentinel-AI** — transformer architecture research with a published paper, *Experiential
Plasticity*: attention heads that contribute to a domain specialize while the rest are
removed, so architecture co-evolves with training. Qwen3.5-4B forged on code improved
perplexity 24% over baseline from a smaller model; the 27B improved 3.5% and runs in 17 GB
at 4-bit against 28 GB at fp16. Models published on HuggingFace with their recipes.
*github.com/CambrianTech/sentinel-ai*

**AIRC** — Rust peer-to-peer communication substrate for AI agents across tabs, machines,
and accounts; end-to-end encrypted multi-agent messaging and file sharing. Architectural
foundation for Continuum's distributed agent communication.
*github.com/CambrianTech/airc*

**Model compaction** — head pruning by gate-gradient utilization took a 14B coder model from
27 GB to 8.9 GB; runtime activation profiling pruned a 35B mixture-of-experts from 67 GB to
47 GB. Published with reproducible recipes.

---

## Technical

**ML architecture and research** — metric learning and Siamese networks; CNN architectures
for segmentation, depth, surface normals, classification and reconstruction; GANs, diffusion
and generative pipelines; synthetic data; transformers and LLMs; attention-head plasticity,
LoRA, structured pruning, quantization, and inference-runtime engineering.

**Perception and spatial computing** — semantic segmentation, monocular depth, optical flow,
camera pose and calibration, plane fitting, multi-frame fusion, scene reconstruction,
SLAM-like systems, tracking, biometrics, real-time AR compositing.

**Systems and performance** — Rust, C, C++, Python, Java, C#, Go, TypeScript/JavaScript,
PHP, Perl, Objective-C/Objective-C++, Swift, Kotlin, Lua, shell/Bash, Visual Basic, and
assembly; production Python ML services and APIs; Node.js/TypeScript and .NET backend
systems; SIMD, concurrency, memory-constrained execution, scheduling/backpressure, distributed
systems, and embedded/edge platforms. Historical stacks include ASP/ASP.NET, ColdFusion,
Java applets, LAMP/MySQL, and numerous CMS and web frameworks.

**Cloud, backend and data** — extensive AWS across application, infrastructure, storage,
compute, serverless, and deployment workflows; S3, CloudFormation, elastically scaling
services, Docker, REST and GraphQL APIs. Decades of SQL and relational data work across SQL
Server, MySQL, PostgreSQL, and SQLite, plus NoSQL/Dgraph; designed schemas and repeatedly
wrote custom ORMs and web servers. Message-driven systems, data/ML pipelines, automated
backend testing, and production SDK/service integration.

**Hardware and embedded design** — PCB design and assembly; ARM microcontrollers; LCD/display
integration and display drivers; RFID; stepper/servo control; sensors; GSM modules; MOSFET and
mixed digital/analog prototyping; Windows CE platform/OS bring-up; embedded Linux; autonomous
robot hardware.

**GPU, native and embedded** — SIMD; Metal, CUDA, OpenGL/GLSL, OpenGL ES GPGPU, WebGL and
shader pipelines; GPUImage-era mobile GPU work; native camera/media pipelines; iOS and
Android/JNI; embedded Linux and Windows CE; PCB design, hardware bring-up and display-driver
work; Unity and Unreal Engine.

**Web and product engineering** — React, Node.js, TypeScript/JavaScript, HTML/CSS/SCSS,
browser graphics and ML, frontend and backend web systems, SDK design, thin client libraries,
cross-platform integrations, and product systems spanning mobile, web and cloud.

**Security and device identity** — PKI, OpenSSL, encryption, device-bound identity and key
handling, secure enclaves, Face ID/biometric integration, authentication SDKs, and
cryptographic client integration.

**Platforms** — iOS/Objective-C++, Android/JNI, Linux, Windows/.NET, Unity, Unreal Engine,
browser ML, native camera pipelines, embedded and PCB-level hardware.

---

## Education & Patents

**B.S. Computer Engineering — University of Kansas**

Coursework included digital circuit design, programming, robotics, computer architecture, and
advanced mathematics. Assisted with initial design work on the NASA/NSF-funded PRISM robot
before entering industry.

- **US10964097B2** — *Pattern Recognition Systems and Methods for Performing Segmentation on
  Surfaces and Objects* (2021, Cambrian Tech LLC). First-named inventor.
- **US9665784B2** — *Systems and Methods for Spoof Detection and Liveness Analysis* (2017).
- **US8437513B1**, **US8675925B2** — *Spoof Detection for Biometric Authentication* (2013,
  2014).
- $100,000 LaunchKC grand prize (2017); top-five finalist, Atlanta Startup
  Battle 6.0 (2019, TechSquare Labs).

---

## Source Notes / Facts Worth Preserving

These are canonical facts for tailoring, not necessarily bullets for every submitted resume.

- Full-stack software engineering dates to 1999; mobile was a deployment target, not the discipline.
- Hardware experience is real and early: PCB assembly/design, drivers, OS/platform bring-up,
  microcontrollers, sensors, motor control, RFID, GSM/LCD integration, and autonomous-robot hardware.
- Enterprise/business software predates Cambrian: B2B web systems, banking/accounting,
  loan-underwriting software, databases, SQL, web services, CMS platforms, testing, and layered architectures.
- Cambrian was a functioning technology company, not a hobby project: company leadership,
  hiring/team leadership, customer discovery, sales, partnerships, licensing, agency/customer SDK
  integration, product delivery, enterprise engagements, and substantial technical R&D.
- Cambrian's product forms included SDKs, native applications, web platforms, backend/cloud
  systems, still-image processing, real-time AR, and automotive/spatial-computing work.
- Preserve the distinction between company-level Garmin/BMW work and individual contribution:
  Heather Spalding led that program; Joel contributed early perception/algorithm work and technical
  discussions while leading related Cambrian perception/platform work.
- EyeVerify demonstrates production biometrics/CV, SDK productization, patents, and acquisition;
  it should not eclipse the technically broader Cambrian work.
- TripleBlind/TB Holdings/Ideem was 2023–2026, contract then full-time, focused on
  cryptographic authentication/client SDK engineering while Cambrian continued.
- Current AI work includes Continuum, Sentinel-AI, AIRC, model compaction, distributed systems,
  inference/runtime work, continual learning, evaluation/provenance, multimodal systems, and
  heterogeneous compute.
- Historical Cambrian material documents Fortune 500 licensing, national magazine/TV advertising,
  and more than five million users at the time.
- Do not put birth date or full street address on modern resumes.
