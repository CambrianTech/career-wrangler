# Joel Teply

**Principal Perception & Edge AI Engineer**
Computer Vision · Spatial Computing · Autonomous Systems · ML Systems
Kansas City Metro · joel@cambriantech.com · github.com/CambrianTech

---

## Profile

Twenty years building real-time perception systems that run on hardware which should not be
able to run them. Semantic segmentation, monocular depth, surface normals, optical flow,
camera pose and calibration, plane fitting, multi-frame fusion, scene reconstruction — all
of it shipped on-device, in production, to millions of users, years before the platforms
that later made it routine.

The recurring problem is the one an autonomous system lives with: perception components
finish at wildly different times, and the world model cannot wait for the slowest. I build
the representation, the scheduler, and the runtime around that constraint.

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

**Automotive computer vision — Garmin, 2020–2022.** Contributed to early perception research
and engineering for an automotive program under strict accuracy and CPU/GPU constraints,
applying geometry, pose estimation, sensor fusion, and optimization techniques developed for
real-time spatial understanding. The program expanded into a multi-year engagement.

**Real-time asynchronous perception.** Maintained a continuously evolving scene
representation at frame rate while expensive CNN inference ran asynchronously on-device at
1–3 second latency. Cellular-automaton region evolution over learned patch affinities,
watershed segmentation across detected structural lines, tracking and temporal interpolation
continuously added, removed, extended and joined regions; delayed semantic-segmentation and
surface-normal results revised the live state as they arrived rather than gating frame rate.
Segmentation and surface normals both ran on the device — no cloud.

**Two kinds of consistency, held at once.** Geometric accumulation and tracking for spatial
consistency — optical flow, camera pose, RANSAC plane fitting, multi-frame fusion, SLAM-like
structure from an ordinary camera, camera parameter estimation (field of view, rotation),
panorama-to-pinhole reprojection, online calibration in C++. Asynchronous state revision for
perceptual consistency despite slow inference.

**The runtime.** Priority-scheduled, backpressured C++ perception pipeline over lazily
evaluated shared frame representations, so estimators with radically different cost ran at
their own cadence without stalling the world model. SIMD, threading, OpenGL ES compute and
GPGPU shaders. One core architecture targeting iOS/Objective-C++, Android/JNI, Unity,
browser, and headless servers.

**Walkable AR flooring, before ARKit existed.** A rendered floor that stays locked to the
room as you walk on it — large, low-texture, steeply foreshortened surfaces where plane
fitting fails and only real-time semantics hold the boundary. Required building the tracking
and geometry ourselves.

**Photographic compositing rather than overlay.** Scene lighting and shadow estimation,
texture and material decomposition, and re-rendering surfaces under the room's real
illumination. The realism bar came from a visual-arts background: knowing what makes a
composite read as a photograph rather than a sticker determined which physical quantities
the perception stack had to recover.

**Perception ML.** Learned-affinity segmentation before AlexNet — a modified Siamese network
learning the patch-similarity metric that drove region evolution; on our task it outperformed
ImageNet-pretrained semantic segmentation and ran far faster. ICNet retargeted for both
segmentation and surface-normal prediction, trained and exported for mobile inference. Soft
segmentation and matting for boundary quality. Weight quantization and model compression for
deployed CNNs (2017). Caffe→TensorFlow and Caffe→CoreML conversion pipelines. Synthetic
training data from Unreal Engine scenes where real ground truth was unobtainable. Production
Python/TensorFlow CV services for scene decomposition and reconstruction, with S3-backed data
flow, Docker CPU/GPU deployment, testing/model utilities, and elastically scaling AWS
inference. Inpainting and seamless texture synthesis.

First-named inventor, **US10964097B2** — *Pattern Recognition Systems and Methods for
Performing Segmentation on Surfaces and Objects*.

### EyeVerify / ZOLOZ — Software Engineer, Computer Vision & Biometrics · 2012–2016
One of the first two engineers on eye-vein biometric authentication; acquired by Ant Financial (Alibaba) for over $100M in 2016.
- Scleral vasculature identification from commodity front-facing cameras, verification in
  under a second: eye and iris tracking, segmentation, multi-frame fusion, image enhancement
  at camera frame rate via OpenGL/GLSL and threaded pipelines.
- Presentation-attack and liveness detection. Co-inventor, **US9665784B2** — spoof detection
  using only a phone's earpiece and microphone (sonic 3D face sensing, photometric analysis,
  multi-source pulse detection). Also named on **US8437513B1**, **US8675925B2**.

### TripleBlind → Ideem — Software Engineer, Cybersecurity · 2023–2026
Cryptographic authentication: device-bound key handling without dedicated secure hardware,
secure client integration, and the SDK surface enterprise customers build against.

### Earlier
**Propaganda3** (2010–2012) · **VML** (2006–2010) · **AgileWise** (2005–2006, PCB design,
touchscreen embedded prototype, RFID, Windows CE platform and display drivers) ·
**NovaStar, Federal Home Loan Bank of Topeka, AllofE Solutions** (1999–2006)

---

## Current Work

**Continuum** — open-source Rust platform for AI agents running across commodity hardware.
Sole architect, 550,000 lines. Inference runtime engineering (121 commits on a maintained
llama.cpp fork: backend lifetime, KV-cache behaviour, Metal/CUDA placement), scheduling under
memory scarcity, and embodied presence — fourteen concurrent 3D agents at 30 fps rendered by
the same machine serving their models. *github.com/CambrianTech/continuum*

**Sentinel-AI** — transformer architecture research, *Experiential Plasticity*: attention
heads that contribute specialize while the rest are pruned, so architecture co-evolves with
training. 24% perplexity improvement on a 4B from a smaller model; models published with
recipes. *github.com/CambrianTech/sentinel-ai*

---

## Technical

**Perception** — semantic segmentation, monocular depth, surface normals, optical flow,
camera pose and calibration, RANSAC plane fitting, multi-frame fusion, scene reconstruction,
SLAM-like systems, tracking, matting, real-time compositing

**ML** — CNN architectures for segmentation, depth, normals, classification and
reconstruction; metric learning and Siamese networks; GANs, diffusion and generative
pipelines; synthetic data; transformers and LLMs; structured pruning, quantization, LoRA,
inference-runtime engineering

**Systems** — C++, Rust, Python, Go, TypeScript; production Python ML services, Docker/AWS; SIMD, concurrency, GPU/GPGPU (Metal, CUDA,
OpenGL/GLSL, WebGL), real-time scheduling and backpressure, memory-constrained execution,
embedded and edge platforms

**Platforms** — iOS/Objective-C++, Android/JNI, Linux, Unity, Unreal Engine, browser ML,
native camera pipelines, PCB-level hardware

---

## Education & Patents

**B.S. Computer Engineering — University of Kansas**

- **US10964097B2** — *Pattern Recognition Systems and Methods for Performing Segmentation on
  Surfaces and Objects* (2021, Cambrian Tech LLC). First-named inventor.
- **US9665784B2** — *Systems and Methods for Spoof Detection and Liveness Analysis* (2017).
- **US8437513B1**, **US8675925B2** — *Spoof Detection for Biometric Authentication*.
- $100,000 LaunchKC grand prize (2017); top-five finalist, Atlanta Startup Battle 6.0 (2019, TechSquare Labs).
