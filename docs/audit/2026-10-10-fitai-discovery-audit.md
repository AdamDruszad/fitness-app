# FitAI: product discovery, market research, UX and engineering audit

**Mode:** AUDIT_AND_PLAN. No application code or production data was changed.
**Date:** 2026-10-10. **Branch:** `Repaired-components-an-design` at `7d5ed27` (clean tree, 13 commits ahead of `main`).
**Analysis files added:** this report, `docs/audit/img/*` (screenshots of synthetic test data only), and `.claude/launch.json` (local test-server launcher; untracked, safe to delete).

Evidence tags used throughout:

| Tag | Meaning |
|---|---|
| **[Obs·runtime]** | Reproduced in the locally running app (disposable SQLite API with a fake AI provider) |
| **[Obs·prod]** | Observed on the public production URLs without signing in |
| **[Obs·static]** | Established by reading source or configuration |
| **[Reported]** | Founder-reported context from the brief (one regular user; one exploring reviewer) |
| **[External]** | A linked source I inspected on 2026-10-10 (list in Appendix A) |
| **[Hypothesis]** | Plausible, needs validation |
| **[Unknown]** | Not established |

---

## 1. Decision summary

**What FitAI does well.** The engineering foundation for "my routine → coach → saved plan → workout → history" is better than typical for a solo project [Obs·static, Obs·runtime]:

- Plans are versioned and immutable, and become active only through an explicit button.
- Workout drafts survive reloads and are scoped to the account.
- Completion is atomic and idempotent, and "Workout saved" appears only after the server confirms.
- Exercises the user asked to keep are enforced before a draft can be activated.
- There are 74 backend tests (29 covering continuity and security) and 30 frontend tests.

The visual identity (charcoal and terracotta, Tabler icons, the dashboard's "Next up" card) is calm and distinctive.

**Main verified obstacles**

1. **Production is broken on every route except `/`** [Obs·prod]. Reloading `/log` mid-workout, opening `/login` directly, or an installed web app restoring a sub-page returns Vercel's plain-text `NOT_FOUND`. The cause is in Git history: `frontend/vercel.json` was deleted in `e8e38bc` (2026-10-08), and Vercel builds from `frontend/`. The same cause means the security headers in the root `vercel.json` are not served.
2. **The founder's reported gap is no longer "missing".** The coach-to-plan workflow shipped on 2026-10-09 and works end to end against the test API [Obs·runtime]. Its input path, however, is undermined:
   - the chat box strips line breaks from a pasted routine (F-03);
   - the coach fails roughly once every 10 exchanges because of how history is windowed (F-02);
   - it has never been verified against the real AI provider with the founder's real routine [Unknown].
3. **The "useful next step" the founder wants is weak.**
   - The dashboard always suggests the first workout for plans named "Workout A/B" or "Day 1/2".
   - Progression targets need a load increment re-typed every session inside a collapsed panel.
   - The post-workout screen shows rule text without numbers.
   - Progress is a list with no trend.

**Strongest opportunity.** Close the weekly loop: one concrete next session (the right workout, per-exercise targets with numbers, and a short "what changed vs last time" after finishing). The progression logic already exists in `backend/app/services/progression.py`. What's missing is persistence and UI, so the cost is days, not weeks, and needs no AI.

**Largest uncertainty.** Whether the shipped coach-to-plan flow, with real Claude output and the founder's real routine, produces a draft the founder accepts with few edits. One observed session (section 8) answers this cheaply and should come before any new import work. Willingness to pay, and demand beyond one user, are unknown.

---

## 2. Current product map and audit coverage

### 2.1 Stack and deployment [Obs·static, Obs·prod]

- **Backend:** FastAPI 0.136, SQLAlchemy 2, PostgreSQL (JSONB), Alembic. JWT (HS256, 7 days, kept in `localStorage`). Anthropic `claude-haiku-4-5` for chat, plan drafts and "training ideas".
- **Frontend:** React 19, Vite 8, Tailwind v4, React Router 8, axios. IndexedDB holds workout drafts. A service worker caches only `offline.html`.
- **Hosting:**
  - Vercel serves the frontend. The production asset hash `index-BG9d8s9i.js` equals a local build of `7d5ed27`, so this branch is live.
  - Render (behind Cloudflare) serves the API. Its public `/openapi.json` lists the proposal and atomic-completion endpoints.
  - Whether `alembic upgrade head` has been applied to the production database is **[Unknown]**: verifying it needs an authenticated account.

### 2.2 Capability map

| Capability | Entry point | Implementation | Status | Verified by |
|---|---|---|---|---|
| Register / log in | `/register`, `/login` | `routers/auth.py`, `Login.jsx` | Working locally; **direct URL 404 in prod** | Runtime + prod |
| Preferences, then AI plan draft | `/onboarding` | `Onboarding.jsx` → `PUT /users/me`, `POST /plans/proposals` (120 s timeout) | Working (structure); real AI output unverified | Static |
| Coach chat (streaming) | `/coach` | `routers/chat.py`, `services/ai.py` | **Partial**: periodic 400s (F-02), multi-line input lost (F-03) | Static + simulation; error state runtime |
| Saved coach reply → plan draft | "Turn this into a plan" on each saved reply | `Coach.jsx:246`, `plans.py:184` | Working; small text link per message | Runtime (fake provider) |
| Pasted routine → plan draft | Coach → "Improve my existing routine" | Same endpoint | Working; diff compares to the active plan, not to the pasted routine | Runtime (fake provider) |
| Review / edit / save / activate | `/plans/proposals/:id` | `PlanReview.jsx`, `PlanEditor.jsx`, `apply_proposal` | **Working**: keep-list enforced, unsaved edits survive reload, double-click sends one request | Runtime |
| Plan versions and restore | `/plans/history` | `PlanHistory.jsx`, `restore` | Working | Static + tests |
| Next workout suggestion | `/` | `utils/workout.js:3` | **Partial**: rotation ignored for non-weekday names | Static + unit test |
| Logging with local drafts | `/log` | `WorkoutLogger.jsx`, `utils/drafts.js` | Working; reload recovery; offline save retry | Runtime |
| Atomic, idempotent completion | "Finish workout" | `training.py:32` | Working: simulated network failure → "Waiting to sync" → retry → exactly one session | Runtime + tests |
| Previous performance and targets | Logger | `/sessions/previous`, `progression.py` | Working, high friction (F-10) | Runtime |
| Rest timer | — | — | **Absent** (`rest_seconds` is shown, never timed) | Static |
| Exercise instructions | — | Plan notes only | **Absent** | Static |
| Exercise artwork | Logger card | `ExerciseArtwork.jsx` (25 original SVG poses) | Working, decorative | Runtime |
| Progress | `/progress` | `Progress.jsx` | **Partial**: counts and lists; no trends, PRs or comparison | Runtime |
| Correct a saved session | `/sessions/:id` | `SessionDetail.jsx`, `correction` | Working | Static + tests |
| Export | Progress | `training.py:101` | **Partial**: sessions only (JSON); no plans or routines | Static |
| AI "training ideas" | Progress (collapsed) | `progress.py` | Working, on demand, cached 5 min | Static |
| Install / offline page | `InstallHelp.jsx`, `sw.js` | — | Files served in prod; deep links break (F-01) | Prod + static |
| Privacy notice, health disclaimer, account deletion, password reset | — | — | **Absent** | Static (grep) |
| Legacy writers: `POST /plans/generate`, `POST /sessions`, `/sessions/{id}/logs` | Not used by the UI | Still exposed | Dead code | Static |

### 2.3 Core journey, as experienced (local runtime, fake AI)

| Step | What happened | Friction or risk |
|---|---|---|
| 1. Bring a routine | Pasted into the collapsed "Improve my existing routine" panel; a comma-separated "keep" field | Pasting into the main chat box instead loses all line breaks (F-03). The panel is easy to miss. |
| 2. Coach adapts it | Draft created; navigated to review | Real AI latency and quality **[Unknown]**. Coach requests time out at 30 s; onboarding allows 120 s (F-04). |
| 3. Review and adopt | "Requested exercises missing: Push-ups" blocked activation; added it by hand; reload kept edits; "Save draft edits", then "Save as my active plan" | On first import the diff lists everything as "Added", so you can't see what the coach changed from your routine. Acceptance is all or nothing. |
| 4. Start a workout | Dashboard → "Open workout" → choose the same workout again | One redundant tap (F-08) |
| 5. Record performance | 5 interactions per set (kg, type, reps, type, Done). Set 2 is not pre-filled from set 1. Reload kept progress. Simulated network loss was handled honestly. | ~27% of a phone screen covered by sticky bars (F-07). Raw "Network Error" text. |
| 6. Understand progress, choose next | "Next time · Bench press: Repeat your last recorded values…" for 2 exercises only. Progress page is a text list. | No numbers, no trend, next workout not rotation-aware (F-09–F-11) |
| 7. Return next session | "Last time" shown per exercise; target appears only after typing an increment, which is not remembered | F-10 |

Things the user must remember or repeat:

- re-type load increments every session;
- know which workout is next when days aren't weekday-named;
- pick the workout twice;
- paste multi-line text into the right box.

### 2.4 Inspection coverage

| Area | Done | Not done or not possible |
|---|---|---|
| Baseline checks | Backend `pytest`: **74 passed** (1 Starlette TestClient deprecation warning). Frontend `npm test`: **30 passed**. `oxlint`: 0 issues. `vite build`: OK (main 375 kB / 118 kB gz; lazy Coach chunk 164 kB / 50 kB gz). `npm audit`: 0 vulnerabilities. OSV query of all 54 pinned Python packages (see F-15). | `backend/scripts/check_postgres.py` (needs a disposable PostgreSQL on 127.0.0.1:55439): not run |
| Runtime browser | Login, empty dashboard, coach panel, draft creation, keep-list enforcement, draft edit, reload, save, double-click activate, dashboard, workout start, set logging, mid-workout reload, simulated save failure and retry, completion, progress, second session with previous values and targets, coach failure state, keyboard focus | Real Claude responses (no API key; the harness blocks provider calls); authenticated production flows (I didn't create a production account); real iOS/Android devices, screen readers, software keyboards |
| Viewports | 375×812 (mobile emulation), 768×1024, 1280×800, 800×450 pane | 320 px (previous release notes report no overflow; not re-run) |
| Production | Public pages, headers, deep-link status codes, API surface | Database migration state |

Pre-existing failures: none in the suites. The one warning is a library deprecation.

---

## 3. Evidence-backed findings

Severity: **P0** critical exposure or data loss · **P1** major security or core-workflow failure · **P2** material usability, reliability or accessibility issue · **P3** minor.

| ID | Sev | Status | Finding | Location | Evidence and impact |
|---|---|---|---|---|---|
| **F-01** | **P1** | Confirmed defect | **Every production route except `/` returns 404.** `/login`, `/log`, `/coach`, `/progress`, `/plans/history` and `/sessions/…` all return `X-Vercel-Error: NOT_FOUND`. The `vercel.json` security headers (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) are also absent. | `frontend/vercel.json` deleted in `e8e38bc` (a revert); root `vercel.json` ignored because the Vercel project is rooted at `frontend/` (README deployment step 3) | [Obs·prod] `curl` 2026-10-09 22:28 UTC. A refresh during a workout shows a plain-text 404. Data survives (IndexedDB) but recovery requires navigating to `/`. In an installed home-screen app there is no address bar to do that. The service worker doesn't help, because a 404 is a response, not a network failure. **Fix (<1 h):** restore `frontend/vercel.json` (rewrites + headers), deploy, then check that `curl -I /log` returns 200 with the headers. Delete or annotate the ignored root copy to stop it recurring. |
| **F-02** | **P2** | Confirmed by static analysis + simulation; **not reproduced against the live API** | **The coach fails about once every 10 exchanges.** Each request sends the last 20 stored messages. With alternating turns, the window starts with an assistant message from the 11th question on. The bundled Anthropic API error reference lists "first message is `assistant`" as a 400. The router then shows "Your coach could not finish this response". The retry succeeds because the failed user message shifts the parity, but it leaves a duplicate in history. | `backend/app/routers/chat.py:88-95` | Simulating this logic (scratch script, no provider call): questions 11, 21 and 31 fail on the first attempt. **Fix:** drop leading assistant messages from the window; add a regression test with 21+ alternating messages. Verification costs one API call. |
| **F-03** | **P2** | Confirmed defect | **The chat composer destroys a pasted routine's structure.** `<input type="text">` strips line breaks: assigning "Day 1 Push⏎Bench press 3x8 60kg⏎Pike push-ups 3x10" produced `Day 1 PushBench press 3x8 60kgPike push-ups 3x10`. There's no client-side length limit (the server caps at 4,000 characters). | `frontend/src/pages/Coach.jsx:377-379` | [Obs·runtime]. This hits the founder's primary workflow: share the routine, then collaborate. **Fix:** auto-growing `<textarea>`; Enter sends and Shift+Enter adds a line on desktop; an explicit Send button on touch; a counter near the limit. |
| F-04 | P2 | Potential risk | "Turn this into a plan" uses the default 30 s axios timeout. The same endpoint gets 120 s from onboarding. The provider call allows 60 s × (1 + 1 retry). A timeout shows "Could not connect…" while the draft is still being created. A same-request retry recovers it, but drafts stuck in `creating` after a server restart stay "Preparing…" forever. | `frontend/src/api/client.js:14`, `Onboarding.jsx:145`, `services/ai.py:18`, `routers/plans.py:213` | [Obs·static]. **Fix:** 120 s timeout for proposal requests; a "still preparing" state that polls; mark `creating` drafts older than 5 min as failed with a retry. |
| F-05 | P2 | Potential risk | **No per-user limit on coach messages.** Each `/chat/` call is a provider request (up to 1,000 output tokens plus plan, history and 20 messages of input). Only login and registration are rate-limited, per IP. | `routers/chat.py:59`; `routers/auth.py:21-22` | [Obs·static]. Cost exposure if the app is opened to others; no abuse observed. **Fix:** per-user limit (e.g. 20 messages / 10 min) and daily cap; set a spend limit in the Anthropic console. |
| F-06 | P2 (before any second user) | Confirmed absence | No privacy notice, health disclaimer or consent, account deletion, or password reset. Injuries and training data are sent to Anthropic (`docs/PRIVACY-OUTLINE.md`). | grep of `frontend/src`; no DELETE routes | [Obs·static]. Low urgency for the founder alone; a trust and legal gap before inviting anyone. [External] Hevy Trainer requires accepting health terms before generating a program. |
| F-07 | P2 | Confirmed (measured) | **Mobile logger space.** Sticky save bar (136 px) plus bottom nav (72 px) cover 218 px, **27% of a 375×812 screen**. Each set row is about 114 px because "Remove" sits on its own line, so roughly 2 sets are visible at once. | `frontend/src/index.css:19, 178, 222` | [Obs·runtime] screenshot `img/02-logger-sets-375.jpg`. |
| F-08 | P3 | Confirmed | "Open workout" lands on a chooser where the same day must be tapped again (labelled "Selected from your plan"). | `WorkoutLogger.jsx:130` | [Obs·runtime] |
| F-09 | P2 | Confirmed logic gap | **"Next up" ignores history.** For day names that aren't weekdays ("Workout A", "Day 1"), the dashboard always suggests the first training day. A unit test encodes this fallback. | `frontend/src/utils/workout.js:3-10` | [Obs·static + test]. Directly undermines the "useful next step" the founder wants. |
| F-10 | P3 | Confirmed | Progression targets need a "load increment" typed **per exercise, per session** (draft-scoped `increments: {}`) inside a collapsed `<details>`. The field also appears for bodyweight and timed exercises, where it can't apply. Each keystroke fires `POST /sessions/previous` (3 requests while typing "2.5"). | `utils/drafts.js:41`; `WorkoutLogger.jsx` | [Obs·runtime] `img/03-logger-target-375.jpg` |
| F-11 | P3 | Confirmed | The completion screen: "Next time" shows rule text without numbers and only for the first 2 exercises; "Workout saved" appears twice; the heading reverts to "Choose a workout". | `WorkoutLogger.jsx:128` | [Obs·runtime] `img/04-workout-saved-375.jpg` |
| F-12 | P3 | Confirmed | Export covers sessions only (JSON). Plans and routines, the thing the founder wants to keep when switching tools, are not exported. No CSV. | `routers/training.py:101-105` | [Obs·static]; [Reported] switching criterion |
| F-13 | P3 | Confirmed | Copy: "1 sets ×", "1 completed workouts", "1 days in your plan", raw axios "Network Error". | Various | [Obs·runtime] |
| F-14 | P3 | Optional | Legacy and dead surface: `POST /plans/generate` (an AI endpoint the UI no longer calls), legacy session writers, unused helpers in `utils/workout.js`, unused CSS (`.set-grid`, `.workout-summary`, …). | `plans.py:28`, `sessions.py`, `workout.js:13-70` | [Obs·static]. Smaller AI-cost and attack surface if removed. |
| F-15 | P3 | Potential risk (none judged reachable) | OSV advisories on pinned packages: anyio, cryptography (bundled OpenSSL, fixed in 48.0.1), ecdsa (no fix), Mako, pyasn1, pydantic-settings, **python-jose (critical, no fix)**, starlette. python-jose's issue requires a public key verified via HMAC without an algorithm restriction. FitAI uses HS256 with a fixed algorithm list and no asymmetric keys, there are no form endpoints (Starlette), and Mako is Alembic-only. | `backend/requirements.txt` | [Obs·static] + [External] OSV. **Plan:** bump cryptography ≥48.0.1, anyio ≥4.14.2, pyasn1 ≥0.6.4 and Starlette via a compatible FastAPI, with tests. Move JWT from python-jose to PyJWT when convenient. Don't bulk-upgrade. |
| F-16 | P3 | Optional | `/docs` and `/openapi.json` are public in production. | `app/main.py` | [Obs·prod]. Low risk; disable docs in production if desired. |
| F-17 | P3 | Optional | Workout drafts don't request persistent storage (`navigator.storage.persist()`). WebKit evicts non-persistent origin data least-recently-used first. | `utils/drafts.js` | [External] WebKit storage policy. Low impact; drafts are short-lived. |

**What held up under test** [Obs·runtime]:

- unsaved draft edits survive a reload and are labelled honestly;
- double-clicking activation sent one request;
- the logger draft survived a reload;
- a failed save showed "Waiting to sync — retry with the same workout", and the retry created exactly one session;
- coach failure shows a clear message and restores the input;
- the focus ring is visible (2 px terracotta); skip link present; form labels correctly associated (checked via `element.labels`);
- 44 px touch targets; no horizontal overflow at 375 px.

The console 404s were the expected "no active plan yet" checks.

**AI reliability notes** [Obs·static]:

- Normal workouts never depend on the provider: logging, targets and history are deterministic.
- Plan JSON is validated with Pydantic before it can become a draft.
- Output is parsed from free text (`json.loads` after stripping fences). Haiku 4.5 supports structured outputs ([External] Anthropic docs), which would remove a class of failed drafts.
- Drafts are generated non-streaming with `max_tokens=8000`.
- The coach system prompt embeds the full plan JSON (with UUIDs) plus 3 sessions on every message.
- Token usage isn't recorded, so real cost per user is unknown.

---

## 4. Market and user-problem research

Method: official product pages, help centres and US App Store listings, checked 2026-10-10. No hands-on testing of competitors. Prices are US App Store listings in USD. Several apps list more than one price for the same plan (regional, legacy or promotional variants), so local prices may differ.

### 4.1 Focused comparison

| Alternative | Intended user / main job | Existing routine and adaptation | Execution, logging, progression | Platforms | Price (US, USD) | Implication for FitAI |
|---|---|---|---|---|---|---|
| **Hevy** (+ Hevy Trainer, HevyGPT) | Gym-goers who log and share workouts | Manual routines (free limit 4 per Hevy help centre; Pro unlimited). **Trainer** (Pro) builds a program from a questionnaire, explicitly "do not rely on AI"; settings include *Excluded Exercises*, *Injuries*, *Program Variety*. **HevyGPT** saved ChatGPT plans to Hevy, free; now being sunset, with Hevy citing "big limitations" and bugs. | Auto rest timers, Apple Watch with live sync, Trainer suggests when and how much to increase load | iOS, Android | Pro $2.99 or $3.99/mo, $23.99/yr, $74.99 lifetime | The market leader already tried "chat → saved routine" and is reworking it. FitAI can't win on logger breadth or price. |
| **Alpha Progression** | Hypertrophy and strength lifters who want prescriptions | Custom plans **free**; generator and editing in Pro | Pro: per-set weight and rep recommendations, RIR, periodization, deloads. Free: unlimited logging, rest timer, 795 **real-gym videos**, CSV export | iOS, Android; "works fully offline" | $12.99/mo, $79.99/yr; 14-day trial on yearly | Per-set prescriptions are a **paid** feature in the market. The bar for exercise media is real video. |
| **Fitbod** | People who want each workout generated | Generates workouts (describes "adaptive AI" and recovery tracking); swap exercises; save favourite workouts | 1,000+ exercise videos, Apple Watch, Health integrations | iOS, Android, Watch | $12.99–15.99/mo, $79.99–95.99/yr | A "generate fresh each day" model is the opposite of the founder's "keep my routine" preference. |
| **Strong** | Lifters with their own routine who want a fast logger | Templates (free: 3 routines) | Rest timer with notifications, Watch, plate and warm-up calculators, 1RM charts, CSV export; no generation | iOS, Android, Watch | $4.99/mo, $19.99/6 mo, $29.99/yr, $99.99 forever | The "own routine" persona is already well served for **logging**; FitAI's addition has to be the coaching loop. |
| **SmartGym** (import reference) | iOS users | **Paste plain text → structured routine** using Apple's on-device model; needs iOS 26+ and an Apple Intelligence device; asks for strict formatting (one exercise per line, no ranges); advises reviewing results | Normal logger | iOS | Not checked | Transcribing a text routine is becoming a commodity feature. Robustness to messy input and clear review are what matter. |
| **Substitute:** general AI chat + notes or spreadsheet | Anyone | Flexible conversation; nothing structured | Manual copying, logging in notes; no next-step logic | Anywhere | Free or an existing subscription | **[Reported]** the founder's pattern before FitAI. FitAI must beat this on structure, memory of results and next step, not on conversation quality. |

### 4.2 Recurring problems and how strong the evidence is

| Problem | Supporting evidence | Counter-evidence and caveats | Strength |
|---|---|---|---|
| Turning AI or coach advice into a tracked routine is hard | [Reported] founder gap; [External] Hevy built HevyGPT and is now replacing it, citing limitations and bugs; SmartGym built text import | The sunset could equally mean low demand or poor execution; we can't tell which | Medium as a signal that the job exists; weak on how often it happens |
| Lifters value knowing what to lift next | [External] Alpha Progression and Hevy Trainer both sell per-set or per-session progression as Pro features | That vendors sell it doesn't prove FitAI users want it; [Reported] the founder's preference for prescribed targets is tentative | Medium |
| Basic logging is expected free | [External] Hevy, Strong and Alpha free tiers all include unlimited logging | — | Strong |
| Gamification sustains exercise | [External] Mazeas et al. 2022 (16 RCTs, 2,407 participants): physical-activity effect g = 0.42 overall, **g = 0.23 vs non-gamified interventions**, **g = 0.15 at ~14-week follow-up** | Mostly general activity (e.g. steps), not strength training; small long-term effect | Weak for FitAI's case; don't lead with streaks |
| First-hand frustrations: copying coach advice, losing exercises, confusing targets, paywalls | **Not obtained.** My search tool didn't return usable first-hand forum threads. The "reviews" it did return were mostly competitor-authored marketing blogs, which I excluded. | — | **Gap**; needs founder-led interviews (section 8) |

App-store ratings (Hevy 4.9 from 97K ratings, Fitbod 4.8 from 287K, Strong 4.9 from 109K, Alpha 4.9 from 2.2K) are selection-biased and say little about specific pains.

**Gaps competitors already solve that FitAI lacks:** rest timer, exercise demonstrations, Watch, real offline. **Not unique to FitAI:** chat-to-routine conversion. **Plausibly distinctive, but only as a combination** [Hypothesis]:

- the user's *own* routine stays primary;
- AI changes are shown as a reviewable, versioned diff;
- deterministic next targets are explained from the user's own results;
- the coach sees those results.

---

## 5. Design refinement proposal

### 5.1 Preserve

- Charcoal `#16171d` with terracotta accent (`#d85a30`, AA-checked `#bc4722` for filled buttons), the skewed-bar wordmark, and thin-stroke Tabler icons.
- The dashboard's hierarchy (`img/01-dashboard-375.jpg`): small uppercase eyebrow, large title, "Next up" hero, numbered training-week list, "At a glance" stats. This is the strongest screen and the pattern to extend.
- Honest status language ("Saved on this device", "Waiting to sync", "Draft saved. Your active plan has not changed.").
- 44 px targets, skip link, visible focus, reduced-motion support, dark and light themes.

### 5.2 What's wrong visually

The 2026-10-09 continuity screens (plan review, logger internals, progress, session detail) use a generic `.continuity-card` of paragraphs and `<details>`, not the dashboard's section headings and stat patterns. The app now has **two visual languages**. No structural redesign is needed: the navigation and page structure work. The fixes are polish, component refinement and layout adjustment.

### 5.3 Prioritised screen changes

| # | Screen and level | Observed issue | Treatment | States and mobile | Acceptance criteria |
|---|---|---|---|---|---|
| D1 | **Logger** (component + layout) | F-07, F-10; 5 interactions per set; no carry-forward; no rest timer | Compact row `Set · kg · reps · ✓`; "Remove" in a row overflow menu. Previous or target values as **placeholders**; ✓ confirms the displayed values (still an explicit confirmation). A target chip above the rows ("Aim 60 × 10/10/10 · Why?") with a "Use" button. One-line sticky footer ("6/9 sets · Finish"). **Focus mode**: hide the bottom nav while a draft is active. Artwork at 72 px on mobile. A foreground rest-timer chip appears after ✓. | Pending sync locks rows (as now); storage conflict; legacy exercise; bodyweight hides kg | ≥4 set rows visible at 375×667; a set matching its placeholder takes **1 tap**; no overflow at 320 px; screen reader announces "Bench press set 2, 60 kg, 10 reps, completed" |
| D2 | **Workout saved** (component) | F-11 | One "Saved ✓" headline. Per exercise: today vs last ("60 kg · 10/10/9 → was 57.5 · 10/9/8"), then **Next time with numbers**. Primary CTA: "Next: Workout B". | No history: "Baseline recorded" | Every exercise listed; numbers equal the saved sets |
| D3 | **Coach** (component) | F-03; plan actions are small text links | Multi-line composer. "Turn this into a plan" as a visible secondary button on the latest substantial reply. Replace the collapsed panel with a "Bring your routine" entry card. Open drafts as small cards with a status. | Streaming, error, draft creating/failed | Pasted line breaks preserved; drafts reachable in 1 tap from the coach |
| D4 | **Plan review** (layout) | Long editor; diff in a side column that stacks below on mobile | On mobile, put the **change summary first** (counts: Kept 5 · Changed 2 · Added 1 · Removed 1). Editor collapsed per day. Per-change accept or reject comes later (Opportunity 3). | Stale, missing keep-list exercises, applied | All changes visible without scrolling past the editor |
| D5 | **Progress** (layout) | Text list; goal form occupies the top (`img/05-progress-375.jpg`) | Top: "This week 2 of 3" (no streak). Cards for the most-logged exercises: best recent set, a small trend with a text alternative ("+2.5 kg since 12 Sep"). Goal setting moved to a settings link. History below. | Empty: "Your first workout creates a baseline" | The trend has a text equivalent; no chart-only information |
| D6 | **Dashboard** (polish) | Two competing primary actions when a draft exists (`img/08-dashboard-draft-1280.jpg`); F-09; plurals | The draft becomes the hero ("Resume Workout A · 4/9 sets"). Rotation-aware next workout. Plural fixes. | — | One primary action at a time |
| D7 | Global polish | Labels at 9–10 px (`.eyebrow`, `.coach-note`, `.today-tag`) | Minimum 12 px for informational text; respect `prefers-color-scheme` on first visit | — | No informational text under 12 px |

Concept wireframe for D1 (a concept, not a final design):

```
┌ Bench press · 3 × 8–10 · 90 s ─────────── [art] ┐
│ Aim 60 kg × 10/10/10  · why?        [ Use ]     │
│ 1   [ 60 ]  [ 10 ]   ✓                     ⋯   │
│ 2   [ 60 ]  [ 10 ]   ✓   ← placeholders        │
│ 3   [ 60 ]  [  9 ]   ○                     ⋯   │
│ Rest 1:12  [ +15 ] [ Skip ]                     │
└─────────────────────────────────────────────────┘
  6/9 sets                          [ Finish ]
```

### 5.4 Exercise artwork

Current state [Obs·static]: 25 original inline-SVG poses already exist, matched by an exact-alias registry with a neutral fallback, decorative by default (`frontend/docs/EXERCISE_ARTWORK.md`). The reviewer's offer [Reported] would therefore *replace* existing art for consistency and quality; it isn't starting from nothing.

| Option | Role | Mobile cost | Effect on logging |
|---|---|---|---|
| Small thumbnail (current slot, 72–116 px) | Recognition at a glance | ~1 card header | Neutral if kept small |
| Larger illustration in an exercise sheet (tap the name) | Recognition plus 3–5 short cues | None in the logger | Neutral; on demand |
| Light demonstration (2–3 frames) | Movement direction | Only in the sheet | Not in the logger |

**Recommendation:** run a pilot before any library. Commission 6 exercises: the reviewer's 4 (push-up, pike push-up, triceps/bench dip, forearm plank) plus the 2 movements the founder logs most. Compare against the current SVGs.

**Illustrator brief** (for discussion; nothing is agreed):

- **Style:** flat, consistent single character. Terracotta top (`#d85a30`), neutral shorts, works on `#16171d` and `#faf9f7`. No text inside images. Side view at the working position; an optional second frame for the sheet.
- **Formats:** SVG preferred (theme via CSS variables, 180×132 view box like the current set), or WebP/PNG at 2× (360×264), transparent background, **≤20 kB each**.
- **Accessibility:** decorative next to a visible name; descriptive alt text when standalone; recognisable in both themes; no meaning carried by colour alone.
- **Accuracy:** a qualified coach or physiotherapist reviews each pose and the text cues. An attractive picture doesn't establish correct technique, and FitAI must not present art as safety instruction.
- **Rights, agreed in writing before work:** licence scope (exclusive or not, perpetual, worldwide, modification and derivative rights), payment or unpaid terms, attribution, delivery of source files, an originality warranty (no traced or undisclosed AI-generated work), and portfolio-use rights.
- **Fallback:** keep the existing registry and neutral art; text labels remain primary.

**Pilot success:** 5 people name ≥5 of 6 exercises from the image alone; the founder prefers the new art; logger rows don't grow.

---

## 6. Prioritised opportunities and roadmap

### 6.1 Immediate defects (not ranked against features)

F-01 (P1), F-02, F-03, F-04, F-05, F-08: see section 8, milestone M1.

### 6.2 Ranked shortlist

| # | Opportunity | User impact | Frequency | Evidence | Effort | Ongoing cost | Risk |
|---|---|---|---|---|---|---|---|
| **1** | **Next-session loop**: rotation-aware next workout, remembered increments, targets with numbers, completion "vs last time / next time" | High | Every session | Reported desire + Obs F-09–F-11; External: competitors monetise this | M (≈2–4 days) | None (deterministic) | Low |
| 2 | Faster mobile logging + foreground rest timer (D1) | High | Every set | Obs F-07, 5 interactions per set | S–M (≈2–3 days) | None | Low |
| 3 | Faithful routine adoption: deterministic import, then per-change review | High when used | Low (routine changes) | Reported gap + Obs (diff vs active plan; all-or-nothing) | M (≈3–5 days) | ~0 | Medium (needs validation first) |
| 4 | Visible progress per exercise (D5) | Medium–high | Weekly | Reported desire + Obs absence | M | None | Low |
| 5 | Portability: export plans and routines, plus a CSV of history | Medium (trust) | Rare | Reported switching criterion; Obs F-12 | S | None | Low |
| 6 | Trust basics before a second user: privacy notice, health disclaimer, deletion, password reset | High for others, low for the founder | Once | Obs F-06; External: Hevy health terms | M | Email provider (reset) | Low |
| 7 | Coach grounding: compact per-exercise history in context; "explain this target" | Medium | Per chat | Hypothesis | M | Slight AI cost | Medium |
| 8 | Exercise artwork pilot (5.4) | Low–medium | Passive | One reviewer's suggestion | S engineering + illustrator time | Rights and review | Licensing, accuracy |

### 6.3 Main bet: the next-session loop

**Why it beats the alternatives:**

- **vs #3 (import):** the coach-to-plan flow already works structurally and is used rarely. Its next step is *validation*, not building.
- **vs #2 (logging speed):** close call. Speed removes friction, but #1 delivers the value the founder named ("understanding previous activity, visible progress and a useful next step") at the same weekly frequency, and the backend logic already exists. Build #2 immediately after.

**Ready to build?** Yes, as **suggestions** rather than prescriptions, because the founder's preference for prescribed targets is tentative. Validate over 4 sessions.

### 6.4 Top three in detail

#### Opportunity 1: Next-session loop (main bet)

- **Problem:** After a workout, FitAI doesn't say concretely what to do next (F-09, F-10, F-11).
- **Target user:** the founder (weekly, has a routine), then lifters like them.
- **Existing capability:** `progression.py` (`repeat-v1`, `double-progression-v1` with explanations), `/sessions/previous`, `target_data` stored per log, `comparableImprovement()` in `utils/plans.js`. Workaround today: remember the increment and the next day yourself.
- **Before:** Dashboard says "Next up · Workout A" again → tap → choose A → expand "Next target" → type 2.5 → target appears → log → "Repeat your last recorded values…".
- **After:** Dashboard says "Next up · Workout B (last: A, Tue)" → **Start** → each exercise shows "Aim 60 × 10/10/10" with placeholders → log → summary "Bench +2 reps vs last · Next time 62.5 × 8".
- **Affected:** `Dashboard.jsx`, `utils/workout.js`, `WorkoutLogger.jsx`, `routers/training.py` (`/summary`, `/previous`), new increment persistence, `progression.py` (unchanged rules).
- **Minimum scope:**
  1. `/sessions/summary` returns `last_completed {plan_id, day_id, date}`. Next day = the one after the last completed `day_id` in the active plan's order; weekday-named plans keep weekday logic.
  2. One-tap start from the dashboard (fixes F-08).
  3. Load increment saved **once per exercise identity**, server-side (a small `exercise_preferences` table, or JSON on `users`, plus a migration). Shown only for `reps` with `total`/`per_hand`/`added` load. Debounced.
  4. Logger: target chip plus placeholders (D1 subset).
  5. Completion summary for **all** exercises, with numbers (D2).
- **Exclusions:** no AI calls; no automatic plan changes; no periodization or deloads; no RIR; no notifications or streaks.
- **Acceptance criteria:**
  - Days "Workout A/B/C", last completed B → "Next up · Workout C". No history → A. Last `day_id` missing from the current version → first day, with the note "Your plan changed since your last workout."
  - "Start" creates exactly one draft (existing occurrence logic). If a draft exists, the only primary action is "Resume".
  - An increment saved once applies to later sessions of the same exercise identity. Editing sends ≤1 request per 500 ms.
  - Targets never mark sets done. "Use" fills only unconfirmed rows. User edits always win.
  - If `/sessions/previous` fails, the logger still works and shows "Targets unavailable — log as usual."
  - All existing completion, idempotency and isolation tests still pass. New tests: rotation rules, increment persistence and ownership (another user's preference is never readable), summary numbers.
- **Effort:** ≈2–4 focused days (assumes the current developer, one migration, tests included). **Recurring cost:** none. **Risks:** wrong targets erode trust (mitigated by the existing conservative rules and explanations); clutter (mitigated by D1 layout).
- **Validation:** the founder's next 4 sessions. Record from existing data whether each session started from the suggested workout, and the share of logs where `target_data.rule` is a progression or target rule, not manual. Add one optional post-workout question ("Was today's plan clear? 1–5").
  - **Success:** ≥3 of 4 sessions started from the suggestion; targets used for ≥50% of loaded exercises; rating ≥4.
  - **Reconsider:** targets overridden in >50% of exercises, or the founder ignores the suggestion.

#### Opportunity 2: Faster mobile logging + foreground rest timer

- **Problem:** About 5 interactions per set; ~2 sets visible; no rest timer, so the founder likely needs another app (whether they use one is [Unknown]).
- **Scope:** D1 rows and footer; carry-forward placeholders (set n+1 shows set n's actual values); focus mode; a rest chip using the prescribed `rest_seconds`, computed from a start timestamp so it is correct after the app returns from background; optional Screen Wake Lock toggle; vibration where supported.
- **Exclusions:** lock-screen alerts, background audio, Watch, supersets, plate calculator.
- **Acceptance criteria:** D1 criteria; the timer shows correct elapsed time after a 2-minute background with no crash. **No promise** of an alert while locked: the web can't schedule local notifications ([External] Chrome abandoned Notification Triggers), and Web Push needs a push server and, on iOS 16.4+, a home-screen install ([External] WebKit). Screen Wake Lock shipped in iOS 16.4; reports say it didn't work in home-screen apps before iOS 18.4. That claim is unverified, so test on a device.
- **Effort:** ≈2–3 days. **Validation:** stopwatch a 15-set session before and after. Success: ≥30% fewer taps and the founder prefers it.

#### Opportunity 3: Faithful routine adoption (build after validation)

- **Problem:**
  - Paste and improve happen in one AI step, and the review compares against the active plan rather than the user's routine (`img/06-plan-review-1280.jpg`: everything shows "Added").
  - Acceptance is all or nothing.
  - "Keep" is free-text matched by name.
- **Before:** paste routine → AI writes a new plan → compare to whatever plan is active.
- **After:**
  1. **Bring my routine:** a deterministic parser turns lines like `Bench press 3x8 60kg`, `Plank 3x45s`, `Rows 4 x 8-10 @ 50kg 90s` into a draft and lists any **unparsed lines** for manual entry. Optional "Ask coach to interpret these lines" is an AI fallback using **structured outputs**. Save it as a version (`source: "imported"`). No AI is needed for the main path: `POST /plans/proposals` already accepts `plan_data` without calling the provider (restore uses this).
  2. **Improve with coach:** the proposal is diffed against *that* version, with per-change accept or reject. The existing edit → apply path activates the result. The keep list becomes a ★ on exercises in the plan.
- **Failure cases (mostly existing safeguards):**
  - AI fails → the draft is marked failed and the pasted text is kept;
  - unknown exercise → kept as typed with neutral art;
  - "AMRAP" or other non-numeric prescriptions → `legacy`, must be resolved before activation;
  - double click → request ID;
  - plan changed meanwhile → stale conflict;
  - save fails → the draft remains.
- **Effort:** ≈3–5 days. **Cost:** ~0 (deterministic) plus optional AI fallback.
- **Validation (before building):** the M1 session in section 8.
  - **Build if:** the real draft needed ≥3 manual edits, dropped or renamed exercises, or the founder couldn't tell what changed.
  - **Don't build if:** it needed ≤2 edits and the founder understood the changes.

### 6.5 Roadmap

| Horizon | Items | Dependencies |
|---|---|---|
| **Now** (solo, ≈2–3 days) | M1: F-01 deploy config, F-02 chat window, F-03 composer, F-04 timeout and stuck drafts, F-05 per-user chat limit, F-08 one-tap start. Founder sets an Anthropic spend limit. Founder validation session (section 8). | None |
| **Next** | Opportunity 1 (main bet) → Opportunity 2 → export plans and routines (F-12) | M1 deployed |
| **Later** | Progress trends (D5); trust basics (F-06; required before inviting anyone); coach grounding with structured outputs; dependency bumps and PyJWT (F-15); remove legacy endpoints (F-14); offline cold start only if gym connectivity proves to be a problem | Validation results |
| **Experiments** | Deterministic import vs AI interpretation (Opportunity 3); artwork pilot; 5–8 user recruitment; willingness-to-pay waitlist; rest-timer lock-screen need probe | Founder time; illustrator terms |
| **Do not build yet** | Native app; payments or checkout; streaks, badges, leaderboards, social feed; push notifications; wearables/HealthKit; automatic missed-day replanning; AI auto-progression without confirmation; importers for Hevy/Strong history; a full artwork library | Evidence of need (section 7) |

---

## 7. Platform and monetization decisions

### 7.1 Platform: stay web; fix and improve the PWA; no native app now

| Need | Responsive web / PWA today | Native (or a Capacitor wrapper) | Evidence |
|---|---|---|---|
| Installation | Works (manifest, icons); iOS needs a manual "Add to Home Screen" | Store distribution | Obs·prod: manifest and service worker served |
| Gym connectivity | An open workout works offline and retries; **cold start needs network** | Full offline | [Unknown] whether the founder's gym has a signal |
| Offline logging | IndexedDB drafts per account | SQLite | Obs·runtime |
| Background rest alerts | **Not possible reliably** (no scheduled local notifications on the web) | Local notifications | [External] Chrome: Notification Triggers abandoned |
| Push reminders | iOS 16.4+ only when installed to the home screen; needs a push server | Native push | [External] WebKit 2023-02-16 |
| Wearables / Health | No | HealthKit, Watch | Competitors offer this (Hevy, Strong, Fitbod) |

**Recommendation:** the founder knows web development, there is one user, and no lock-screen or Watch need has been demonstrated. Fix F-01, ship D1 with a foreground timer, request persistent storage, then reassess after 4–8 weeks of use.

Revisit native **only if** the founder (or recruited users) report missing lock-screen rest alerts or Watch logging as a real reason they keep another app. In that case, evaluate a Capacitor wrapper first: it reuses the React code and adds local notifications. Weigh this against store fees and maintenance.

### 7.2 Monetization: research first; don't implement payments

**Initial hypothesis (all numbers are hypotheses):**

- **Free:**
  - unlimited routines, logging, history and export;
  - deterministic next-session targets;
  - a monthly AI allowance (e.g. ~30 coach messages and 3 plan drafts).
  - *Rationale:* logging is free across the market, and deterministic features cost nothing to run.
- **Paid "Coach" tier:**
  - a larger AI allowance;
  - a periodic AI review of the last training block against logged results, with a proposed (reviewed) plan update.
  - *Rationale:* this ties payment to the recurring variable cost (AI) and to recurring value.
- **Likely buyer:** a lifter with their own routine who wants occasional expert-style adjustments, not a new program every day.

**Guardrails:**

- never interrupt or limit an in-progress workout;
- show the allowance before a conversation starts;
- after cancellation or hitting a limit, plans, history and export stay fully available;
- no trial that auto-charges without a clear reminder.

**Unit-economics scenarios** (assumptions: Haiku 4.5 at $1 / $5 per million input / output tokens [External, Anthropic model table cached 2026-09-25]; coach message 4k–15k input + 300–1,000 output tokens; plan draft 5k–15k input + 2k–6k output; no prompt caching; tokens are not measured in production yet):

| Monthly usage per active user | AI cost |
|---|---|
| Light: 10 messages + 1 draft | ≈ $0.08–0.25 |
| Moderate: 40 messages + 4 drafts | ≈ $0.30–1.00 |
| Heavy: 200 messages + 10 drafts | ≈ $1.40–4.50 |

Payment fees at Stripe's US list rates [External]: 2.9% + $0.30 per charge, +1.5% for international cards, +0.7% for Billing. A $4 monthly charge loses ≈$0.44 (≈11%) to fees, so annual billing is much more efficient. Fees depend on the account's country. Infrastructure (Render, Vercel, Postgres) is a fixed cost I couldn't verify; read it from the dashboards. Support time is the founder's.

Public Anthropic docs fetched on 2026-10-10 also mention a "Claude Haiku 5.5"; I didn't verify its price or availability.

**Validation before any billing work:**

1. Log `usage.input_tokens` and `usage.output_tokens` per user per feature (no message content) for 4–8 weeks to replace the scenarios above with measured cost.
2. Recruit 5–8 lifters (section 8). After ≥3 weeks of use, show an honest "Coach tier isn't available yet: would you join at [price]?" waitlist, with no charge and no pre-payment.
   - **Success:** ≥30% of retained testers join at the stated price, and measured AI cost is ≤30% of that price.
   - **Stop or reconsider:** <10% join, or the cost ratio fails.

---

## 8. Validation and next implementation brief

### 8.1 Milestone M1: make the existing loop reliable in production

| Item | Change | Acceptance criteria |
|---|---|---|
| F-01 | Restore `frontend/vercel.json` with the SPA rewrite and the security headers from the root file; remove or annotate the root file | On a preview deploy, then production: `curl -I` on `/`, `/login`, `/log`, `/coach`, `/plans/history` returns 200 with `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`; static assets still return their real types; reloading `/log` mid-workout shows the draft |
| F-02 | Trim leading assistant messages from the chat window | New test: 21+ alternating stored messages → the first role sent is `user`; existing chat tests pass; one live call succeeds on an account with >20 messages |
| F-03 | Multi-line composer | Pasting 6 lines keeps 6 lines in the stored message; Shift+Enter adds a line on desktop; a Send button on touch; counter shown near 4,000; keyboard and label behaviour unchanged |
| F-04 | 120 s timeout for proposal requests; "still preparing" polling; stale `creating` → `failed` after 5 min | A slow draft never shows "Could not connect" while the server is still working; a stale draft offers retry |
| F-05 | Per-user chat limit + daily cap | The 21st message in 10 min returns 429 with a friendly message; normal use is unaffected; test included |
| F-08 | Start directly from the dashboard selection | Dashboard → Start → exercise list, with no chooser |

Excluded from M1: new features, dependency upgrades, design changes beyond the composer. Verification: backend `pytest`, `npm test`, `oxlint`, `vite build`, the browser journey above at 375 and 1280 px, and the production `curl` checks.

### 8.2 Founder validation session (right after M1; about 45 minutes; no code)

1. Paste the real routine into the coach (or the "Improve my existing routine" panel) exactly as it lives today.
2. Ask for one improvement you'd actually want, then press "Turn this into a plan".
3. Record:
   - seconds until the draft appears;
   - exercises dropped or renamed;
   - number of manual edits before you would activate it;
   - whether "What changed" told you what the coach did.
4. Activate it, train the next session from it, and note every moment you had to remember something or guess whether it saved.

These results decide whether Opportunity 3 gets built (thresholds in 6.4).

### 8.3 Research beyond one user (proposal only; contact nobody without the founder's decision)

- **Recruit** 5–8 people who train at least twice a week with an existing routine and use a phone in the gym. The exploring reviewer could be one of them.
- **Method:**
  1. a 30-minute observed session importing their routine and logging one workout;
  2. 3 weeks of normal use;
  3. an exit interview on next-step usefulness, logging effort, and what they would keep if they switched apps.
- **Later metrics,** when there are ≥20 sign-ups (from existing data, no new tracking beyond token logging):
  - **activation:** first plan activated **and** first workout completed within 7 days of registration, divided by registrations in the cohort;
  - **return:** ≥1 completed workout in week 2 and in week 4 after activation, divided by activated users;
  - **loop use:** share of completed logs whose `target_data.rule` is a progression or target rule.
- No A/B tests at this traffic level, and small samples are not retention results.

### 8.4 Material unresolved questions

1. Has `alembic upgrade head` run against production? If not, the new endpoints will fail with server errors.
2. What format is the founder's real routine in (day naming, per-hand dumbbells, timed holds, supersets)? This shapes the import parser and next-day logic.
3. How often does the founder change routines compared with simply following one?
4. Does the founder already use a separate rest timer? Does their gym have a phone signal?
5. Are the reviewer's illustration offer, rights and accuracy review acceptable?
6. Who is the intended audience beyond the founder (country and language)? It affects the privacy duties for sending health data to Anthropic (`docs/PRIVACY-OUTLINE.md` Q1), pricing currency and copy. The artwork registry includes Hungarian aliases, but that doesn't establish a market.

---

## Appendix A: External sources (all checked 2026-10-10)

| Source | Used for |
|---|---|
| [Hevy Help: Hevy Trainer explained](https://help.hevyapp.com/hc/en-us/articles/38385724273047-Hevy-Trainer-Explained-How-It-Builds-Your-Workout-Program) (read in browser; automated fetch got 403) | Trainer is Pro-only, algorithmic not AI, questionnaire, health terms |
| [Hevy Help: Trainer settings](https://help.hevyapp.com/hc/en-us/articles/43572343844247-How-Hevy-Trainer-Settings-Work) (table of contents only rendered) | Excluded Exercises, Injuries, Program Variety settings |
| [Hevy Help: Hevy Pro](https://help.hevyapp.com/hc/en-us/articles/35119778922263-Hevy-Pro-Subscription-How-to-get-Pro-and-What-Does-It-Include) (search snippet only; not fetched) | Free limits: 4 routines, 7 custom exercises (medium confidence) |
| [Hevy on the US App Store](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350) | Prices, Pro unlocks, rest timer, Watch, rating |
| [HevyGPT feature page](https://www.hevyapp.com/features/hevy-gpt/) | ChatGPT → Hevy plans; being sunset |
| [Alpha Progression on the US App Store](https://apps.apple.com/us/app/gym-workout-alpha-progression/id1462277793) and [alphaprogression.com](https://alphaprogression.com/en) | Free vs Pro, per-set recommendations, 795 videos, offline, prices |
| [Fitbod on the US App Store](https://apps.apple.com/us/app/fitbod-gym-fitness-planner/id1041517543) | Generation model, prices |
| [Strong on the US App Store](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577) | Free limit, features, prices |
| [SmartGym: import routine from text](https://help.smartgymapp.com/article/150-import-routine-from-text) | On-device text → routine import |
| [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) (2023-02-16) | Push requires a home-screen web app; Wake Lock in 16.4 |
| [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/) (2023-08-10) | Eviction, `persist()` |
| [Chrome: Notification Triggers](https://developer.chrome.com/docs/web-platform/notification-triggers) | Scheduled web notifications abandoned |
| [Mazeas et al., JMIR 2022](https://www.jmir.org/2022/1/e26779/) | Gamification effect sizes |
| [Stripe pricing](https://stripe.com/pricing) | Card and Billing fees |
| [Anthropic: Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages) + bundled Claude API reference (cached 2026-09-25) | Message rules, Haiku 4.5 pricing, structured-output support |
| [OSV.dev](https://osv.dev) API | Python dependency advisories (IDs in F-15) |

## Appendix B: Screenshots (local test API, synthetic data)

`img/01-dashboard-375.jpg` · `img/02-logger-sets-375.jpg` · `img/03-logger-target-375.jpg` · `img/04-workout-saved-375.jpg` · `img/05-progress-375.jpg` · `img/06-plan-review-1280.jpg` · `img/07-coach-error-768.jpg` · `img/08-dashboard-draft-1280.jpg`

To reproduce: run `backend/tests/browser_app.py` on port 8011 and Vite on port 5187 (see `docs/training-continuity.md`), or use `.claude/launch.json`.
