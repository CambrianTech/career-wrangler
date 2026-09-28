# LinkedIn — Joel Teply

*Limits: headline 220 chars · About 2,600 · each Experience description 2,000.
Counts verified at the bottom of this file.*

---

## Headline

**LinkedIn is ONE profile.** It does not vary by viewer — there is no per-audience version,
no "views," no swapping copy per application. Every recruiter, every hiring manager, every
old colleague sees the same page. The résumé PDFs are the per-target artifact; this is not.
So the headline has one job: cover perception, ML systems and edge in a single line that
still reads as a specific person.

One headline. Use this:

```
Principal Engineer — Computer Vision · Edge AI · ML Systems | Real-time perception and continual learning on consumer grade hardware
```

It leads with a level and three disciplines a recruiter actually searches, and the clause
after the bar is the through-line that ties twenty years together. Your own version —
"Computer Engineer | AI Systems · Computer Vision · Robotics · Edge Computing | Building
hard things on commodity hardware" — says the same thing but opens on a generic title;
"Computer Engineer" is what a new graduate writes.

If your target genuinely shifts to frontier ML, change three words rather than rewriting:
`Computer Vision · Edge AI · ML Systems` → `LLM Architecture · Inference · Model Efficiency`.
Nothing else moves.

**Where multiple targets actually live:** not in the profile copy. LinkedIn's one real
multi-value targeting field is **Open To Work** (Settings → Job seeking preferences) — it
takes a list of job titles and locations, is used by recruiter search, and can be shown only
to recruiters rather than publicly. That list is where "perception OR ML systems OR research
engineer, Kansas or remote" belongs. The Skills section is the second lever: recruiter
search matches on skills, so their ORDER does real work. Both are at the bottom of this file.

---

## About

*(First two lines are what shows before "see more" — they carry the whole pitch.)* 

2600 chars max

```
I like hard engineering problems — especially the ones that look unreasonable on the hardware available.

I've spent twenty years building them. I co-founded Cambrian and led its technical work across computer vision, ML, GPU computing and real-time systems, including automotive programs and technology licensed to Fortune 500 companies and deployed to millions of users. Before that, I was one of the first two engineers at EyeVerify, building biometric computer vision on commodity phones. I'm a named inventor on four patents in segmentation and anti-spoofing.



In 2011 we shipped photographic mixed reality — gpgpu optimized, learned wall segmentation, tracking, lighting estimation and re-rendering under the room's actual illumination — a year before AlexNet. By 2016 we had walkable AR flooring before ARKit and real-time 3D scene understanding running entirely on an iPhone.

Making that work required more than a good model. Our perception system maintained and revised its understanding of the scene at frame rate while segmentation and surface-normal CNNs ran asynchronously on-device with 1–3 second latency. Tracking, geometry and temporal evidence kept the world coherent until new inference arrived. That work led naturally into automotive computer vision and maps closely onto autonomous perception.



Now I'm attacking the same constraint at a different scale.

Continuum is a local-first system for persistent, continually learning societies of multimodal, embodied AI beings. Models are resources, not identities: citizens retain memory, relationships, skills and experience as models come and go. Experience becomes curriculum; evaluated LoRA adaptations become heritable genes; individual learning can propagate through a population.



Underneath them, a peer-to-peer Grid distributes inference, training and learned intelligence across available hardware. Today one laptop can serve the models for fourteen embodied citizens while rendering their 3D bodies at 30 fps. We're pushing the architecture toward frontier-scale mixture-of-experts inference distributed across consumer hardware rather than requiring one machine to hold the whole system.



The domains keep changing. The job I enjoy doesn't: understand the whole system, find where the assumptions are wrong, and make it work efficiently on the hardware. 



I'm interested in Staff/Principal problems in perception, autonomy, embodied AI, ML systems, inference, edge intelligence — or something difficult I haven't thought of yet.

github.com/CambrianTech/continuum

```

---

## Experience

2000 char limit EACH

### Cambrian — Co-founder, CTO & Principal Engineer
**Aug 2009 – Present · Kansas City Metropolitan Area**

```
Co-founded Cambrian and led its technical work across computer vision, ML, GPU computing and real-time systems. We built proprietary perception technology and engineering programs for enterprise clients across automotive, retail and home improvement. Technology was licensed to Fortune 500 companies and deployed to millions of users.

REAL-TIME PERCEPTION & MIXED REALITY

In 2011 we shipped photographic mixed reality in live mobile video, a year before AlexNet: learned wall segmentation and tracking combined with lighting and material estimation to re-render surfaces under the room's actual illumination. By 2016 we had walkable AR flooring before ARKit and real-time 3D scene understanding running entirely on an iPhone.

Our perception architecture maintained an evolving scene representation at frame rate while segmentation and surface-normal CNNs ran asynchronously on-device with 1–3 second latency. Learned affinities, watershed segmentation, structural lines, tracking and temporal interpolation continuously revised the scene as new evidence arrived. Geometry added spatial consistency through optical flow, camera pose, RANSAC planes and multi-frame fusion.

Underneath was a priority-scheduled, backpressured C++ pipeline using lazy shared frames, SIMD, threading and GPU/GPGPU acceleration.

AUTOMOTIVE COMPUTER VISION — GARMIN, 2020–2022

Contributed to early research and engineering for an automotive computer-vision program under strict accuracy and CPU/GPU constraints. The work applied many of the same perception and optimization techniques we'd developed for real-time spatial understanding; the program expanded into a multi-year engagement.

APPLIED ML

Siamese metric learning, CNN segmentation/depth/surface normals, model quantization and compression, synthetic training data, and cross-framework deployment to mobile and web.

First-named inventor, US10964097B2. Inaugural $100K LaunchKC Grand Prize winner.

```

### TripleBlind, then Ideem — Software Engineer, Cybersecurity
**2023 – 2026 · Kansas City Metropolitan Area**

*Ideem spun out of TripleBlind in 2024, founded by Toby Rush — EyeVerify's founder — to
commercialize device-bound cryptographic authentication for payments. On LinkedIn these are
two company pages: split this into two positions if you want both to link, or keep one entry
and let it sit on the page you spent longer at.*

```
Cybersecurity product engineering: cryptographic authentication that binds a key to the device without relying on dedicated secure hardware, replacing step-up friction in payment flows — digital wallets, pay-by-bank, BNPL. Secure client integration and the SDK surface enterprise customers build against, in a small engineering organization where the same person owns design, implementation and customer integration.
```

### EyeVerify (now ZOLOZ) — Software Engineer, Computer Vision & Biometrics
**Mar 2012 – Sep 2016 · Kansas City Metropolitan Area**

```
One of the first two engineers, turning novel biometric computer-vision research into a production system running on commodity smartphones. Acquired by Ant Financial (Alibaba) for over $100M in 2016 — one of Kansas City's largest exits of the decade; rebranded ZOLOZ the following year.

Identified vasculature in the sclera from ordinary front-facing cameras with verification in under a second. Built high-performance C++ vision: eye and iris tracking, segmentation, multi-frame fusion, image enhancement, all at camera frame rate via OpenGL/GLSL and threaded real-time architectures.

Presentation-attack and liveness detection — distinguishing a live person from a photo, replay or mask. Co-inventor on US9665784B2, which detects spoofs using only a phone's own earpiece and microphone: sonic 3D face sensing, photometric analysis and multi-source pulse detection. Also named on US8437513B1 and US8675925B2.

Productized research algorithms into a commercial SDK and assisted with technical integration through the acquisition.
```

### Propaganda3 — Software Engineer
**Nov 2010 – Mar 2012 · Kansas City Metropolitan Area**
```
Production mobile and web systems, including a tax application supporting forms across nearly all U.S. states with photo-based W-2 data ingestion.
```

### VML — Software Engineer
**Aug 2006 – Sep 2010 · Kansas City Metropolitan Area**
```
Production backend, web, device and early mobile systems across C#, ASP.NET, Objective-C, databases, web services and layered application architectures.
```

### AgileWise — Hardware & Software Engineer
**Nov 2005 – Aug 2006 · Blue Springs, Missouri**
```
Engineered PCBs and a touchscreen embedded-computer prototype; integrated RFID hardware; created a Windows CE platform image and display drivers; developed software spanning embedded devices and backend services.
```

---

## Projects *(LinkedIn Projects section — separate from Experience)*

**Continuum** — open-source Rust platform for persistent AI agents across commodity hardware.
Sole architect, 550,000 lines. Multi-agent orchestration, typed KV-slot leases and priced
eviction, evaluation-gated continual learning (43/76 resolved SWE-bench Verified), inference
runtime work (121 commits on a maintained llama.cpp fork), peer-to-peer distribution with
signed provenance. github.com/CambrianTech/continuum

**Sentinel-AI** — transformer architecture research, *Experiential Plasticity*: attention
heads that contribute to a domain specialize while the rest are pruned, so architecture
co-evolves with training. 24% perplexity improvement on a 4B from a smaller model; 27B runs
in 17GB at 4-bit vs 28GB fp16. Models published on HuggingFace with recipes.
github.com/CambrianTech/sentinel-ai

**Model compaction** — head pruning by gate-gradient utilization (14B: 27GB → 8.9GB);
MoE expert pruning by activation profiling (35B: 67GB → 47GB). Published with recipes.

---

## Education

**University of Kansas — B.S. Computer Engineering · 1998–2002**
Digital circuit design, computer architecture, robotics, embedded systems.

---

## Skills — priority order

Computer Vision · Machine Learning · Artificial Intelligence · Systems Engineering ·
C++ · Rust · Python · Edge Computing · GPU Computing · CUDA · Metal · Deep Learning ·
Image Processing · Robotics · Distributed Systems · Embedded Systems · Real-Time Systems ·
Neural Networks · Semantic Segmentation · SLAM · Augmented Reality · Performance Optimization

*Move iOS Development, Swift, Objective-C and generic Web Development well down. They are
true but they are the deployment target, not the discipline, and they are what makes
recruiters read you as a mobile engineer.*

---

## Featured — order

1. Continuum repository
2. Sentinel-AI repository (paper + published models)
3. Current résumé (perception or ML cut, matching the roles you're targeting)
4. Best Cambrian perception/AR demo video
5. LaunchKC or other third-party Cambrian coverage

---

## Company pages — attach each position to the right one

LinkedIn only counts a position toward a company's alumni network, and only shows its logo,
when the entry is attached to the company **page** rather than typed as free text. Check each.

| Employer | Page | Note |
|---|---|---|
| Cambrian Tech | verify — you own it; claim the page if it doesn't exist | Founded 2011 with Heather Spalding per press and her CV. Your entry says Aug 2009 — see below. |
| Ideem | search "Ideem" — spun out of TripleBlind, Aug 2024 | Founded by Toby Rush, EyeVerify's founder |
| TripleBlind | linkedin.com/company/tripleblind | Wound down; page still exists |
| ZOLOZ (was EyeVerify) | attach to the **ZOLOZ** page — that is the live entity | Renamed 2017, after you left; an Ant Financial subsidiary. The old EyeVerify page may linger, but alumni and recruiters sit on ZOLOZ. |
| Propaganda3 | linkedin.com/company/propaganda3 | Still operating, KC, since 2001 |
| VML | search "VML" | VMLY&R + Wunderman Thompson merged into VML, Jan 2024; Jon Cook still runs it from KC |
| AgileWise | no page found | Type as free text; no web trace remains |

**The Cambrian date, your call.** Your entry says Aug 2009. Startland News (2017) and Heather's
CV both say the company was founded in 2011. Either is defensible — 2009 if you're dating the
work, 2011 if you're dating the company — but two co-founders showing two different start dates
is the kind of small mismatch a recruiter notices. Pick one and make it match hers, or write
"2009" and let the company entry say "founded 2011."

---

## Open-to-work targeting

Titles: Principal/Staff Engineer, Perception Engineer, Computer Vision Engineer, ML Systems
Engineer, Research Engineer, Edge AI Engineer, Robotics Perception Engineer.
Not: iOS Engineer, Mobile Developer, Full-Stack.
