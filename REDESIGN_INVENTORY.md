# FitAI: redesign content & feature inventory

> This inventory records the pre-merge redesign. For the subsequent merge damage,
> recovery branch and current verification, see [the recovery audit](frontend/docs/REDESIGN_RECOVERY.md).

This is the contract for the redesign on branch `redesign`. Every row below existed in the
frontend at `8692cdb` (branch `Repaired-components-an-design`) and must still exist and work
after the redesign. The **After** column is filled in during verification (section 5 of the
brief): ✅ means present and checked, otherwise the cell explains what changed.

Sources: `frontend/src/**` (read in full), `frontend/public/**`, and the backend routers and
schemas in `backend/app/**` for data shapes. Screens were captured against a mocked API that
returns the backend's exact response shapes (`GitHub/.claude/tools/fitness-fixtures.mjs`),
because the backend needs `DATABASE_URL`, `SECRET_KEY` and `ANTHROPIC_API_KEY` to start.

Legend for data sources: **API** = backend call made by the page, **IDB** = IndexedDB
(`fitai-training` → `drafts`), **LS** = localStorage.

## Verification result (redesign, 2026-10-15)

All **129 / 129** items are present in the redesign. How each was checked:

- **Interactions:** `GitHub/.claude/tools/fitness-interactions.mjs`, 110 of 110 checks pass. It
  covers the flows, the UI states, and every request payload the pages send, compared field by
  field with the backend schemas.
- **PWA:** `fitness-pwa.mjs`, 8 of 8 checks pass on a production build: manifest, icons,
  service worker, offline cache and offline fallback.
- **Screenshots:** the after set in `docs/redesign-screenshots/after/`.
- **Code review:** the data and sync logic of the Logger, Coach, Progress, Onboarding and Plan
  review pages was carried over byte-for-byte; `diff` against the original confirms it.

A note in the **After** column means the item changed, or that its path could not be exercised
with the mocked API (stated in the note).

---

## G. Global shell, routing and platform

| ID | Item | Details | After |
|---|---|---|---|
| G1 | Skip link | "Skip to content" → `#main-content` | ✅ |
| G2 | Brand | "FitAI" wordmark with skewed terracotta bar, links to `/`, accessible name "FitAI home" | ✅ |
| G3 | Desktop navigation | Your plan (`/`), Workout (`/log`), Coach (`/coach`), Progress (`/progress`); active item marked with `aria-current="page"` | ✅ Underline marker; tab also stays highlighted on `/plans/*` and `/sessions/*` (`aria-current="true"`) |
| G4 | Mobile navigation | Same four destinations as a fixed bottom bar with icons + labels, safe-area padding | ✅ Same section-aware highlight as G3 |
| G5 | Theme toggle | "Switch to light mode" / "Switch to dark mode"; persisted in LS `theme`; `.light` class on `<html>` | ✅ Now follows the system preference until the user picks a theme; only an explicit toggle is saved. A pre-paint script prevents a flash |
| G6 | Training preferences | Header icon link to `/onboarding` ("Training preferences") | ✅ |
| G7 | Sign out | Header icon button ("Sign out") → `logout()` (clears token) | ✅ |
| G8 | Route change behaviour | Scroll to top and move focus to `<main id="main-content">` on every path change | ✅ Verified after client-side navigation |
| G9 | Document titles | `FitAI — ` + Your plan / Log workout / AI Coach / Your progress / Training preferences / Log in / Create account / Your routine (`/plans/*`) / Saved session (`/sessions/*`) / Page not found | ✅ |
| G10 | App loading | "Opening your training space…" (`role="status"`) while the token is validated | ✅ Also used while a lazy page chunk loads |
| G11 | Session check failure | "Let's reconnect." + "We couldn't check your session. Check your connection and try again." + **Try again** (refetch) + **Return to login** (logout) | ✅ |
| G12 | Error boundary | "Something went wrong" / "An unexpected application error occurred. You can reload the page or navigate back." / dev-only "Error details" / **Reload application** | ✅ Restyled with the same copy and button. Not triggered at runtime (needs a thrown render error) |
| G13 | Auth routing | Protected routes redirect to `/login` when signed out; `/login` and `/register` redirect a signed-in user to `/` (has goal) or `/onboarding` (no goal); unknown paths → 404 page | ✅ |
| G14 | Session sync | API 401 (non-`/auth/` URL) dispatches `fitai:unauthorized` → logout; `storage` events sync the token across tabs; aborted requests never restore a signed-out user | ✅ Client, token and AuthProvider code unchanged; sign-out path verified |
| G15 | Coach lazy route | `/coach` is code-split with fallback "Opening your coach…" | ✅ Every page is now code-split; Coach keeps its own fallback |
| G16 | PWA | `manifest.webmanifest` (name, short name, description, icons 192/512, standalone, theme/background colour), `sw.js` registered in production only, `offline.html` fallback for navigations, apple-touch-icon, `theme-color` | ✅ Verified on a production build: SW registers, offline page cached (cache bumped to `fitai-public-v2` so the restyled page is picked up), manifest colours updated to the new ink |
| G17 | Install help (on Dashboard and Onboarding) | Disclosure "Keep FitAI one tap away"; "Add FitAI to your home screen for an app-like training space."; **Add to home screen** when the browser offers an install prompt, otherwise the iPhone/iPad + Android/desktop instructions; connection/storage disclaimer paragraph; **Apply available update after training** when a new service worker waits; notices: install failure, "An update is ready. Finish or discard your saved workout before applying it.", "Update activated. It will be used next time you open FitAI.", "Could not check saved workouts. Apply the update after your session." | ✅ Restyled disclosure with the same copy. The browser install prompt and waiting-worker update paths can't be triggered headlessly (logic unchanged) |
| G18 | Head metadata | `<title>FitAI — AI Fitness Coach</title>`, meta description "FitAI — Your personal AI-powered fitness coach. Get custom workout plans, log sessions, track progress, and chat with your AI coach.", viewport with `viewport-fit=cover`, `apple-mobile-web-app-capable` | ✅ Plus Open Graph/Twitter tags, `color-scheme`, a light-theme `theme-color` and a FitAI favicon (was the Vite logo) |
| G19 | Offline page | "Let's reconnect." / "Opening FitAI requires a connection. Workouts saved on this device remain available after you reconnect and sign into the same account." / link "Try opening FitAI again" | ✅ Same copy, restyled, follows the system theme; verified offline |

## L. Log in — `/login`

| ID | Item | Details | After |
|---|---|---|---|
| L1 | Brand + theme toggle | Wordmark and theme switch on the card | ✅ |
| L2 | Heading | "Welcome back" | ✅ |
| L3 | Email field | Label "Email", `type=email`, required, `autocomplete=email`, placeholder `you@example.com`, mail icon | ✅ |
| L4 | Password field | Label "Password", required, `autocomplete=current-password`, lock icon | ✅ |
| L5 | Submit | **Log in**; while submitting "Logging in..." with spinner, inputs + button disabled, double submit ignored | ✅ |
| L6 | Errors | 401 → "Invalid email or password."; anything else → "Couldn't log in. Check your connection and try again." (`role="alert"`) | ✅ Error is now also linked to both inputs via `aria-describedby` |
| L7 | Switch | "Don't have an account? Register" → `/register` | ✅ |
| L8 | API | `POST /auth/login {email, password}` → `login(access_token)` → route redirect | ✅ |

## R. Create account — `/register`

| ID | Item | Details | After |
|---|---|---|---|
| R1 | Brand + theme toggle | As L1 | ✅ |
| R2 | Heading + intro | "Create an account" / "Get your own personalized AI workout plan." | ✅ |
| R3 | Email field | Required, `autocomplete=email`, no autocapitalise/spellcheck, value trimmed on submit | ✅ |
| R4 | Password field | Required, `minLength=8`, `maxLength=128`, `autocomplete=new-password`, hint "Use 8–128 characters." linked via `aria-describedby` | ✅ |
| R5 | Submit | **Create account** / "Creating account..." with spinner; fieldset disabled while submitting | ✅ |
| R6 | Error banner | `apiError(err, "Registration failed. Please try again.")` (FastAPI string or validation-array details); clears when either field changes | ✅ Verified with an API `detail` string |
| R7 | Switch | "Already have an account? Log in" → `/login` | ✅ |
| R8 | API | `POST /auth/register {email: trimmed, password}` → `login(access_token)` | ✅ |

## D. Your plan (dashboard) — `/`

| ID | Item | Details | After |
|---|---|---|---|
| D1 | Page heading | Eyebrow "Your training space", title "Your plan", "One session at a time. Make today count." | ✅ |
| D2 | Plan links | "Improve my existing routine" → `/coach`; "Plan history" → `/plans/history`; active plan "{title} · Version {n}" | ✅ Links became header action buttons; plan title plus a "Version N" tag |
| D3 | Workout in progress | When an IDB draft exists: "Workout in progress · {day}", "Plan version {n} · Waiting to sync / Saved on this device", **Resume workout** → `/log` | ✅ Now the primary hero; "Open workout" drops to a secondary button while a draft exists (one primary action) |
| D4 | Plan loading | "Loading your plan…" (`role="status"`) | ✅ |
| D5 | Plan error | "Could not load your plan. Please try again." + **Try again** (reloads all dashboard data) | ✅ Verified with a 500 from `/plans/current` |
| D6 | Empty plan | "Your next chapter starts here." / "Create a plan around your goals, equipment and schedule." / **Create your plan** → `/onboarding` | ✅ Verified with the empty scenario |
| D7 | Next workout | "Today · {weekday}" or "Next up · {day}"; heading = focus or day; "{n} exercises · Ready when you are"; **Start today's workout** / **Open workout** → `/log` with `state.day` | ✅ Also lists the day's exercises with sets × reps (plan data) |
| D8 | Training week | "Your training week", "{n} days in your plan"; numbered rows (01…) with day name, "Today" tag, focus or "Recovery", "{n} exercises"; each row links to `/log` with `state.day` | ✅ Ledger rows; Today row gets an accent edge |
| D9 | At a glance | Plan weeks (fallback 8) "Intended length"; "Completed this week" (`summary.week_completed`, "—" until loaded); "{n} recent sessions loaded" (completed sessions, "—" while loading/error); "Explore your progress" → `/progress` | ✅ Big condensed numerals; plural-correct "recent session(s)" |
| D10 | Recent sessions | Up to 4 sessions: date ("Tue, Oct 13" style) + "{n} exercises logged"; loading "Loading sessions…"; error "Could not load recent sessions." + **Try again**; empty "Your completed sessions will appear here. Start with your first workout." | ✅ Rows now link to `/sessions/{id}` and show a date chip; fixes "1 exercises logged" |
| D11 | Install help | G17 | ✅ |
| D12 | Data | API `GET /sessions/summary`, `GET /plans/current` (404 = no plan), `GET /sessions`; IDB draft for the user; all requests aborted on unmount | ✅ |

## W. Workout logger — `/log`

| ID | Item | Details | After |
|---|---|---|---|
| W1 | Back link | "Back to my plan" → `/` | ✅ |
| W2 | Heading | Eyebrow "Make every set count"; title = draft day or "Workout"; description "{plan title} · Version {n} · {date}" or "Choose a workout. Your session keeps the plan version it starts with." | ✅ After saving, the title keeps the day and the description shows the saved plan/version/date |
| W3 | Save status (`role="status"`) | "Saving on this device…", "Saved on this device", "Waiting to sync", "Not saved on this device", "Saving workout…", "Workout saved", "Waiting to sync — retry with the same workout" | ✅ With a status dot. On the saved screen it is visually hidden (still announced) so "Workout saved" isn't shown twice |
| W4 | Error alert | API errors, validation errors ("{exercise}: enter valid repetitions.", "Complete at least one actual set first.", "Some entered rows aren't confirmed. Mark them done or clear them before finishing.", load range, legacy prescription), "Previous performance unavailable. …" | ✅ |
| W5 | Storage conflict | Storage error text (e.g. "This workout changed in another tab. Reload the saved draft before continuing.") + **Reload saved draft** | ✅ Markup present; logic verbatim. Not exercised (needs two tabs racing on IndexedDB) |
| W6 | Loading | "Recovering your workout…" | ✅ |
| W7 | No plan | "Choose a plan first." + link "Improve my routine with Coach" → `/coach` | ✅ |
| W8 | Day chooser | One button per training day (day + focus, "· Selected from your plan" when arriving from the dashboard); disabled on storage error; click creates and saves a new IDB draft | ✅ The day picked on the dashboard is highlighted |
| W9 | Older plan notice | "This session uses an earlier plan version. Your entries stay with this workout." | ✅ |
| W10 | Set count line | "{n} completed sets. Copying a target never marks a set done." | ✅ Adds "/ total" and a progress meter |
| W11 | Exercise header | Exercise artwork (decorative SVG), name, prescription ("3 sets × 6–8 · Starting load 52.5 kg · 150 s rest"), "Load: {basis}" | ✅ Prescription shown as chips; art shrinks to 72 px on phones; per-exercise done/total tally |
| W12 | Last time | "Last time · {date}" + formatted sets, or "No comparable completed record yet."; **Use previous values** (fills unfinished rows, records copy-previous target) | ✅ |
| W13 | Next target | Disclosure "Next target · {sets}" or "· Establish a baseline"; reason text; "Optional available load increment (kg)" (0–100, step 0.25; refetches targets); **Use target values** | ✅ Increment refetch verified with payload; "Use target values" present |
| W14 | Legacy warning | "Original prescription: {reps}. Clarify its measurement in a plan draft before logging this exercise." | ✅ Markup present; the fixtures have no legacy exercise |
| W15 | Set rows | Column labels Set / Actual kg / Reps or Seconds / Done; per row: number, kg input (disabled + "—" for bodyweight; label mentions "per dumbbell" for per-hand), reps or seconds input, **Done** toggle (✓ when done, `aria-pressed`), **Remove** (`Remove {exercise} set {n}`) | ✅ Single 44 px row (`# · kg · reps · ✓ · ×`, 52 px pitch, was 114 px). The done toggle keeps a constant label "Complete {exercise} set {n}" with `aria-pressed` (it used to flip to "Undo…") |
| W16 | Add set | **Add set** (max 100 rows) | ✅ |
| W17 | Exercise note | "Optional note (difficulty or target adjustment)", max 2000 | ✅ |
| W18 | Undo removal | "Undo last row removal (restores previous entries)" | ✅ |
| W19 | Save bar | "{n} completed sets" + "Confirm entered rows before finishing." + **Finish workout** / "Saving…" / **Retry workout save** (disabled with no completed sets or storage error) | ✅ One compact bar above the tab bar (88 px on phones, was 136 px) |
| W20 | Pending / discard | Pending draft: **Check save status before editing**; otherwise **Discard this draft** → confirm "Remove this device's unfinished workout and its entered sets?" **Discard entered workout** / **Keep training** | ✅ Confirm/keep verified; the pending branch is unchanged code |
| W21 | Saved state | "Workout saved"; "{n} completed sets · {n} exercises"; "Session recorded. You now have a reference for next time."; comparable-improvement sentences; "Next time · {exercise}" + target reason; **View saved session** → `/sessions/{id}`; "Back to my plan" | ✅ "Next time" now lists every logged exercise with numbers (it showed the first two, including a blank exercise name) |
| W22 | Locking | Inputs locked while saving, while a completion is pending, or on storage error; owner-token check prevents saving after an account switch | ✅ Unchanged logic; verified that finishing with unconfirmed rows is blocked |
| W23 | Data | API `GET /plans/current`, `POST /sessions/previous {plan_id, day_id, increments}`, `POST /sessions/complete` (idempotent payload from `completionPayload`), `GET /sessions/occurrences/{id}`; IDB draft read/compare/write | ✅ Completion payload shape verified field by field |

## C. AI Coach — `/coach`

| ID | Item | Details | After |
|---|---|---|---|
| C1 | Heading | Eyebrow "A little guidance goes a long way", "AI Coach", "Talk through your training, technique and recovery." | ✅ |
| C2 | Improve my routine | Disclosure "Improve my existing routine": "Paste your routine or describe improvements" (max 6000), "Exercises to keep (comma separated)", **Create plan draft** / "Preparing draft…" (disabled when empty) | ✅ In a side column on desktop, above the chat on phones; payload verified |
| C3 | Open drafts | Up to 3 non-applied proposals: "Plan draft · {title or status} · Review" → `/plans/proposals/{id}` | ✅ |
| C4 | Conversation log | `role="log"`, keyboard-focusable, follows new messages unless the user scrolled up; **Load earlier messages** when 50 were returned; loading spinner; load error "Could not load chat history. You can still send a new message."; empty "Ask your AI coach about exercises, form tips, recovery, or anything training-related." | ✅ Loading, empty and error states present. "Load earlier messages" not exercised (fixtures return fewer than 50) |
| C5 | Messages | User bubble (plain text, line breaks kept); coach bubble rendered as Markdown + GFM, tables in a horizontally scrollable labelled region; avatars; "Incomplete response — retry your message."; **Turn this into a plan** on persisted coach replies; streaming caret | ✅ User line breaks verified; "Turn this into a plan" is a visible secondary button |
| C6 | Error banner | Shown under the log when messages exist | ✅ |
| C7 | Screen-reader status | "Loading chat history" / "Your coach is replying" / "Coach ready" | ✅ |
| C8 | Note | "Chat advice becomes your training plan only when you review and save a plan draft." + link "Plan history" | ✅ |
| C9 | Composer | "Message your coach" field; placeholders "Loading chat history…" / "Waiting for response…" / "Ask your coach…"; **Send message** (spinner while streaming); text restored on failure; focus returns after reply | ✅ Now an auto-growing textarea: Enter sends on keyboard devices, Shift+Enter (or Enter on touch) adds a line; 4000-character limit with a counter. Focus return after a reply fixed (it fell to `<body>`) |
| C10 | Data | API `GET /plans/proposals`, `GET /chat/` (+ `?before=`), streaming `POST /chat/ {content}` via `fetch` with Bearer token (handles `event: error` / `event: done`, 401 → logout), proposal creation `GET /plans/current` + `POST /plans/proposals` with a stable request id → navigate to review | ✅ Streaming logic verbatim; multi-line payload verified |

## P. Progress — `/progress`

| ID | Item | Details | After |
|---|---|---|---|
| P1 | Heading | Eyebrow "See what you did. Choose what's next.", "Your progress", "Your completed training, with full history and metric-unit export." | ✅ |
| P2 | Error | Error text + **Reload history** | ✅ |
| P3 | Loading | "Loading your training records…" | ✅ |
| P4 | Summary | "{n} completed workouts"; "{week} of your {goal} planned sessions completed this week · Since {week_start}" (or "… sessions completed this week") | ✅ Big numerals plus a week meter; the full sentence is kept as the text equivalent |
| P5 | Weekly goal | "Optional weekly session goal" (1–14) + **Save goal** → notice "Weekly goal saved." | ✅ Inline form; numeric payload verified |
| P6 | Empty | "Your first workout creates a baseline." + **Open a workout** → `/log` | ✅ |
| P7 | Performance intro | "Exercise performance" + "Comparisons below cover {n} loaded records (all available history / ; load earlier sessions for more). Equipment and measurement variants stay separate." | ✅ |
| P8 | Coach ideas | Disclosure "Coach's training ideas": "Optional AI advice. Actual next-session targets appear in your workout with their source and rule."; **Ask for training ideas** → list of exercise + suggestion, or "No coaching ideas available yet." | ✅ |
| P9 | Per-exercise history | One disclosure per exercise/measurement/load variant: "{name} · {n} records loaded"; entries with date link → `/sessions/{id}`, load basis, formatted sets | ✅ Rows show each exercise's latest sets before expanding |
| P10 | Session history | "Session history"; each session links to `/sessions/{id}`: "{day or Training record} · {date}", "{n} exercises · Completed / Legacy record — completion unverified" | ✅ |
| P11 | Paging + export | **Load earlier sessions** (when a cursor exists); **Export all workouts (JSON)** downloads `fitai-workouts.json` | ✅ Export moved to the page header (download verified). "Load earlier sessions" not exercised (fixture has no cursor) |
| P12 | Data | API `GET /sessions/history` (+ `before`), `GET /sessions/summary?today=`, `PUT /users/me {weekly_session_goal}`, `GET /sessions/export` (blob), `GET /progress/suggestions` | ✅ |

## O. Training preferences (onboarding) — `/onboarding`

| ID | Item | Details | After |
|---|---|---|---|
| O1 | Back link | "Back to your plan" → `/` | ✅ |
| O2 | Heading | Eyebrow "Make it yours"; "Training preferences" (saved prefs) or "Build your training plan"; "A plan that fits your goals, schedule, and equipment." | ✅ |
| O3 | Coach link | "Already have a routine? Improve it with Coach" → `/coach` | ✅ |
| O4 | Install help | G17 | ✅ |
| O5 | Load states | "Loading your preferences..." ; error "We couldn't load your saved preferences. Retry to continue with your existing details." + **Retry loading** | ✅ Present; logic verbatim. Error path not exercised |
| O6 | Step indicator | 6 steps (Goal, Experience, Schedule, Equipment, About you, Review), `aria-current="step"`, completed steps marked | ✅ Desktop: numbered/checked vertical stepper. Mobile: segmented bar with screen-reader labels |
| O7 | Step copy | "Step {n} of 6 · {name}", per-step title and description (6 pairs) | ✅ |
| O8 | Step fields | Goal: Build muscle / Lose fat / Get stronger / General fitness (with descriptions); Experience: Beginner / Intermediate / Advanced; Schedule: 2–6 days; Equipment: Full gym / Home equipment / No equipment; About you: Age, Weight (kg), Gender (Male / Female / Other); Review: optional injuries textarea + hint + summary list (Goal, Experience, Schedule, Equipment, Age, Weight) + explanation | ✅ Choice cards with a selected mark; schedule as five big numeric buttons |
| O9 | Validation | Messages from `validateOnboardingStep`, field focused, `aria-invalid` / `aria-describedby` | ✅ Goal and age validation verified, including focus and `aria-invalid` |
| O10 | Actions | **Back**; **Save preferences only** (review step); **Continue** / **Generate my plan** / **Generate new plan**; busy labels "Saving preferences..." / "Generating plan..." | ✅ "Save preferences only" and "Generate my plan" verified |
| O11 | Status + errors | "Saving your training preferences..." / "Your preferences are saved. Keep this page open while we create your plan."; "We couldn't save your preferences. …" / "Your preferences were saved, but we couldn't generate a plan. …" | ✅ |
| O12 | Data | API `GET /users/me`, `PUT /users/me` (numbers coerced), `GET /plans/current`, `POST /plans/proposals` (120 s timeout) → `/plans/proposals/{id}`; heading focus on step change | ✅ |

## PR. Review plan draft — `/plans/proposals/:id`

| ID | Item | Details | After |
|---|---|---|---|
| PR1 | Back link | "Back to Coach" → `/coach` | ✅ |
| PR2 | Heading | Eyebrow "Your routine, made actionable", "Review your plan", "Review the complete routine before making it active. Previous versions and workouts stay in history." | ✅ |
| PR3 | Error + reload | Error alert; **Load plan draft** when the draft failed to load | ✅ Present; logic verbatim. Draft-load failure not exercised |
| PR4 | Status line | "Plan saved. Future workouts use the activated version." / "Draft edits are not saved yet." / "Draft saved. Your active plan has not changed." / server error or "Preparing your draft. Reload to check its status." | ✅ As a notice; ready and dirty states verified |
| PR5 | Applied | **Open my plan** → `/` | ✅ Present (applied state not reachable with the static mock) |
| PR6 | Warnings | Stale: "Your active plan changed. Ask Coach below to review this draft against the current version."; missing keep-list: "Requested exercises missing from this draft: … Restore them before applying." | ✅ |
| PR7 | What changed | Added / Kept / Changed / Removed entries with "{day}: {exercise}" and detail; "Requested to keep: …" | ✅ Adds Kept/Changed/Added/Removed counts and colour-coded rows, in a sticky panel on desktop |
| PR8 | Plan editor | Plan title (200), Intended length (weeks 1–52); per day: Workout name, Focus; per exercise ("Exercise {n}"): Exercise name, Sets (1–20), Measurement (Repetitions / Seconds / Original prescription), Reps / range or Seconds, Rest (seconds), Load basis (unspecified / total / per hand / added / bodyweight / assistance), Optional starting load (kg), Notes, **Remove {name}**; **Add exercise** per day; disabled while busy or not ready | ✅ Each day folded under a numbered summary. Add and remove verified; page is 1.7k px instead of 8–9k |
| PR9 | Local edit backup | Edits mirrored in LS `fitai:proposal:{user}:{id}` with revision check; storage failure → "Draft edits are only in this page. Save draft edits before leaving." | ✅ Logic verbatim (not exercised) |
| PR10 | Save bar | "Started workouts keep their original plan snapshot."; **Save draft edits** (only when dirty); **Save as my active plan** / "Saving…" (disabled when dirty, stale or missing favourites) | ✅ Dirty gating and both payloads verified |
| PR11 | Ask Coach to adjust | "Changes to make" (6000) + **Create revised draft** (disabled when dirty/empty) + **Reload saved draft** | ✅ Refine payload verified |
| PR12 | Data | API `GET /plans/proposals/{id}`, `PUT … {revision, plan_data}`, `POST …/apply {revision, expected_active_id}`, `POST /plans/proposals {request_id, base_plan_id, from_proposal_id, instructions, keep_exercises}` | ✅ |

## PH. Plan history — `/plans/history`

| ID | Item | Details | After |
|---|---|---|---|
| PH1 | Heading | Eyebrow "Your routine over time", "Plan history" | ✅ Plus a visually hidden "Versions" h2 (fixes the h1 → h3 skip) |
| PH2 | Back link | "Back to my plan" → `/` | ✅ |
| PH3 | Error | API error text | ✅ |
| PH4 | Versions | Disclosure per version: "{title} · v{n} · Active · {created date}"; per day "{day} · {focus}" and "{exercise}: {prescription}" list | ✅ Version cards with a v-number, date and Active tag; adds the loading and empty states the page lacked |
| PH5 | Restore | **Review this version again** (inactive versions) → `POST /plans/versions/{id}/restore` → review page | ✅ Restore payload verified |
| PH6 | Paging | **Load earlier versions** when 20 were returned (`GET /plans/?before=`) | ✅ Present; not exercised (fixture has two versions) |

## SD. Saved session — `/sessions/:id`

| ID | Item | Details | After |
|---|---|---|---|
| SD1 | Back link | "Back to progress" → `/progress` | ✅ |
| SD2 | Heading | Eyebrow "Your recorded training"; title = snapshot day or "Saved session"; "{date} · Completed workout / Legacy record — completion unverified · Plan version {n}" or "Loading session…" | ✅ |
| SD3 | Error | API error text | ✅ |
| SD4 | Logs | Per exercise: name (or "Unspecified legacy exercise"), load basis, formatted sets ("No recorded sets"), "Target used" disclosure with reason, notes | ✅ Sets as numbered chips; notes and target in context |
| SD5 | Correction | **Correct an entry** → per set "Set {n}: kg" (disabled for bodyweight) + Reps/Seconds inputs; **Save correction**, **Cancel**, "Progress and next targets use your corrected values." | ✅ "Correct an entry" moves to the header; correction payload verified |
| SD6 | Data | API `GET /sessions/{id}`, `PUT /sessions/{id}/correction {revision, logs, notes}` | ✅ |

## NF. Page not found — any unknown path

| ID | Item | Details | After |
|---|---|---|---|
| NF1 | 404 content | 404 icon, "Page not found", "We couldn't find the page you're looking for. It might have been moved or doesn't exist.", **Go back home** → `/` (inside the app shell) | ✅ Large condensed "404" numerals replace the icon; same copy and link |
