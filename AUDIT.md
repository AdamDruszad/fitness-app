# FitAI frontend audit and redesign

**Scope:** the React frontend in `frontend/` (every route, component and stylesheet), plus the
backend only as far as it shapes what the UI shows. The backend was not changed.
**Baseline:** branch `Repaired-components-an-design` at `8692cdb`; redesign on branch `redesign`.
**Date:** 2026-10-15.

## How this was checked

- **Code:** every file in `frontend/src`, `frontend/public` and `frontend/index.html`, plus the
  FastAPI routers and schemas the UI calls.
- **Runtime:** the Vite dev server on port 5203. The backend can't start without
  `DATABASE_URL`, `SECRET_KEY` and `ANTHROPIC_API_KEY`, and no `.env` was created. Signed-in
  screens were therefore driven through Playwright (headless Edge) against a mocked API. The
  mock returns the exact response shapes of the backend models (`UserResponse`,
  `plan_response`, `proposal_response`, `SessionResponse`, the SSE chat stream, and so on).
  - Fixtures: `GitHub/.claude/tools/fitness-fixtures.mjs`
  - Screenshots: `fitness-shoot.mjs`
  - Metrics: `fitness-measure.mjs`
- **Screenshots** (not committed): `docs/redesign-screenshots/before/` and `.../after/`. There
  are 19 states at 390 px and 1440 px in the default dark theme, plus a light-theme subset
  prefixed `light-`. File names are `<state>-<width>.png`, for example `log-active-390.png`.
- **Measured** with `fitness-measure.mjs`:
  - text under 12 px;
  - WCAG contrast of every rendered text node, with backgrounds resolved through a canvas so
    `color-mix()` and `oklab()` are handled;
  - interactive targets under 44 px;
  - heading levels;
  - fixed/sticky overlays;
  - logger set-row pitch.

  Bundle sizes come from `vite build`.

## 1. Scores before the redesign

| Area | Score | Evidence |
|---|---:|---|
| Visual design & consistency | **5/10** | **Strengths:** the charcoal and terracotta identity and the dashboard hierarchy work well (`before/dashboard-1440.png`).<br>**Two visual languages:** the dashboard has its own polished pattern (`index.css:239-302`). The newer screens are paragraphs inside a generic `.continuity-card` (`index.css:3-26`).<br>**Unstyled headings:** on Progress, Session and Plan history the section headings render as body text, because Tailwind preflight resets `h2` and nothing restyles them. "Exercise performance" is 16 px regular weight (`before/progress-1440.png`).<br>**Fonts:** none are loaded; the system stack (`-apple-system`/Segoe) is used everywhere.<br>**Favicon:** still Vite's purple lightning bolt (`public/favicon.svg`).<br>**Hierarchy clash:** on mobile the "Next up" `h2` (28 px) is as large as the page `h1` (28 px).<br>**Three content widths:** the header is 1120 px, the dashboard 1040 px, every other page 800 px (`index.css:125, 135, 240`). Pages jump sideways when you switch tabs. |
| UX & navigation | **5/10** | **Strengths:** a clear four-item nav, honest save language ("Saved on this device", "Waiting to sync"), and back links on deep pages.<br>**Logger is too sparse:** each set row takes **114 px**, because "Remove" sits on its own line. The sticky save bar (136 px) and bottom nav (72 px) together cover **208 px of an 844 px screen**, so about two sets are visible at a time (`before/log-active-390.png`).<br>**Chooser detour:** "Open workout" on the dashboard lands on a chooser where the same day must be picked again (`WorkoutLogger.jsx:130`).<br>**Broken saved screen:** it renders a "Next time ·" row with an **empty exercise name**, only shows the first two targets, and resets the title to "Workout" (`WorkoutLogger.jsx:128`, `before/log-saved-390.png`).<br>**Plan review length:** the page is **9,329 px tall on mobile** and 8,227 px on desktop, because every field of every exercise is expanded (`PlanEditor.jsx`).<br>**Coach composer** is a single-line `<input>` (`Coach.jsx:376`), so a pasted multi-line routine loses its line breaks.<br>**Two primary buttons:** while a workout draft exists, the dashboard shows both "Resume workout" and "Open workout". |
| Responsiveness / mobile | **6/10** | **Strengths:** no horizontal overflow on any of the 19 states at 390 px; the bottom nav honours `safe-area-inset-bottom`.<br>**Coach squeeze:** the conversation height is a hard-coded `calc(100dvh - 186px …)` (`index.css:318`). With the "Improve my routine" panel above it, the log is about 300 px tall on an 844 px phone (`before/coach-390.png`).<br>**Small text:** 9–11 px text on phones (`.coach-note` 9 px, `index.css:323`).<br>**Plan editor:** cramped two-column fields at 390 px. |
| Accessibility | **6/10** | **Strengths:** skip link, a visible 2 px focus ring, labelled inputs, `role="status"`/`role="alert"`, `aria-current`, reduced-motion support. Contrast passes WCAG AA for **every** rendered text node in both themes (0 failures measured).<br>**Small text:** **19 text elements under 12 px** on the dashboard (10 px eyebrows, 11 px meta).<br>**Undersized targets:** header icon buttons are 40×40 and desktop nav items 42 px tall, both under 44 px. The Coach "Plan history" link is 12 px tall (measured).<br>**Set toggle:** it combines `aria-pressed` with a label that flips between "Complete…" and "Undo…" (`WorkoutLogger.jsx:148`), so screen readers hear "Undo Bench press set 1, pressed".<br>**Heading skip:** Plan history jumps from `h1` to `h3` (`PlanHistory.jsx:23`).<br>**Unlinked login error:** it isn't tied to the inputs with `aria-describedby` (`Login.jsx:143`).<br>**Theme default:** the theme ignores `prefers-color-scheme` and always starts dark (`ThemeContext.jsx:19-22`). |
| Performance | **6/10** | **Strengths:** Coach (with `react-markdown`) is already lazy; there are no images and no web fonts.<br>**Eager bundle:** the entry chunk is **374.95 kB (117.75 kB gzip)** and contains every signed-in page, so the login screen downloads the logger, plan editor and progress code. Coach adds 164 kB (49.9 kB gzip) and CSS is 44.8 kB (9.4 kB gzip).<br>**Request per keystroke:** typing in the "load increment" field fires one `POST /sessions/previous` per keystroke (`WorkoutLogger.jsx:50-58, 140`).<br>**Dead assets:** `src/assets/hero.png` and `public/icons.svg` are shipped in the repo but referenced nowhere. |
| Code quality & structure | **6/10** | **Strengths:** the hard logic is pure and tested (30 `node --test` cases for drafts, onboarding, auth session and artwork); requests are abort-safe; workout completion is idempotent.<br>**Duplicated auth pages:** `Login.jsx` and `Register.jsx` repeat about 120 lines of identical markup and long Tailwind class strings.<br>**Two `apiError` helpers** with different fallbacks (`utils/apiError.js`, `utils/plans.js:29`).<br>**Three styling approaches:** Tailwind utility soup (Login/Register/Onboarding/Coach), hand-written classes (dashboard), and `.continuity-card` paragraphs.<br>**One-line JSX:** several pages are written as single lines hundreds of characters long (`PlanHistory.jsx:23`, `SessionDetail.jsx:29`, `WorkoutLogger.jsx:128-157`).<br>**Dead CSS:** `.set-grid`, `.workout-summary`, `.exercise-list`, `.progress-*`, `.scrollbar-hide` (`index.css:79-86, 148-176, 298-302`).<br>**Dead files:** `App.css`, `hero.png`, `icons.svg`. |
| SEO basics | **4/10** | **Present:** `<title>`, meta description, `lang="en"`, and per-route titles (`App.jsx:25-42`).<br>**Missing:** Open Graph and Twitter tags (a shared link has no preview), a light-theme `theme-color`, and a `color-scheme` hint. The favicon is the Vite default. `robots.txt` allows everything, which is fine because all real content sits behind sign-in. |
| Security red flags (report only) | **6/10** | **Frontend is reasonable:** Markdown is rendered without raw HTML, so the coach's output can't inject markup, and there are no secrets in the bundle (`VITE_API_URL` only).<br>**Token in localStorage:** the JWT lives in `localStorage` (`api/token.js`), so any future XSS could read it.<br>**No CSP:** there's no Content-Security-Policy anywhere.<br>**Headers not served:** the security headers in the root `vercel.json` aren't served if the Vercel project is rooted at `frontend/` (see the 2026-10-10 audit, F-01).<br>**Backend items** are in section 6. |

## 2. Top 10 problems, ranked by impact

1. **The workout logger is hard to use between sets on a phone.**
   - *Why it matters:* the logger is the core loop and is used one-handed, tired, mid-session.
   - *Evidence:* 114 px per set row and 208 px of fixed bars mean about two sets per screen
     and constant scrolling.
2. **The coach composer destroys pasted routines.**
   - *Why it matters:* "bring my routine and improve it" is the product's main promise.
   - *Evidence:* the single-line input flattens "Day 1⏎Bench 3x8⏎…" into one run-on line
     before the coach sees it.
3. **Half the app has no visual hierarchy.**
   - *Why it matters:* users can't scan their own training data, and the app feels unfinished
     next to the dashboard.
   - *Evidence:* Progress, Session detail, Plan history and Plan review show data as run-on
     paragraphs inside identical boxes, and their section headings render as body text.
4. **Plan review is an 8–9k px wall of inputs.**
   - *Why it matters:* the decision to activate a plan (the trust moment) is buried.
   - *Evidence:* the change summary, the warnings and the "Save as my active plan" action are
     separated by dozens of always-open fields.
5. **The "Workout saved" screen is broken.**
   - *Why it matters:* the reward and next-step moment looks like a bug.
   - *Evidence:* a blank "Next time ·" row, targets for only two exercises, and the title
     reverting to "Workout".
6. **Text is too small on phones.**
   - *Why it matters:* it fails readability expectations and makes labels (dates, counts,
     notes) hard to read in a gym.
   - *Evidence:* 19 elements under 12 px on the dashboard, and the coach note at 9 px.
7. **The next step is unclear.**
   - *Why it matters:* it adds friction to starting a workout, the most frequent action.
   - *Evidence:* with a draft in progress there are two competing primary buttons, and "Open
     workout" leads to a chooser that asks for the same day again.
8. **The brand surface looks unfinished.**
   - *Why it matters:* the installed PWA and shared links look like a template, which erodes
     trust in an app that holds health data.
   - *Evidence:* the default Vite favicon, system fonts only, no social preview metadata, and
     page widths that jump between 800, 1040 and 1120 px.
9. **First load downloads every page.**
   - *Why it matters:* first paint on mobile networks is slower than it needs to be.
   - *Evidence:* a 375 kB (118 kB gzip) entry chunk, even for the login screen.
10. **Copy and default glitches add up.**
    - *Why it matters:* small errors undermine an app whose value is precise numbers.
    - *Evidence:*
      - "1 exercises logged", "1 records loaded", "1 exercises";
      - the theme ignores the system preference;
      - the set toggle's screen-reader label flips meaning;
      - the coach conversation is squeezed to about 300 px on a phone.

## 3. Design direction: "Iron & chalk logbook"

FitAI is a personal training logbook with a coach attached. It's read in a gym, between sets,
with sweaty thumbs and divided attention, and also on a desktop when planning. The direction
leans into that instead of the generic SaaS card look.

- **Kept identity.** The charcoal ground, the single terracotta accent and the skewed
  "plate" bar of the wordmark stay. They're already on the PWA icons and in users' memory.
  - The neutrals are now one *warm* grey family: ink, iron and chalk instead of blue-grey
    Tailwind greys.
  - Terracotta is the only accent.
  - A muted green is used purely as a *state* colour (set done, workout saved), never as
    decoration.
- **Type with a gym-signage voice.** Archivo Variable (self-hosted, OFL) uses its *width*
  axis:
  - **Condensed and heavy** for page titles, workout names and every number that matters
    (set counts, weights, reps, stats), like a scoreboard or plate stamp.
  - **Normal width** for reading text.
  - Tabular figures everywhere data lines up.
  - Labels are 12 px and up, sentence case. Uppercase is used only for short tracked
    micro-labels.
- **Ledger, not cards.** Data reads as ruled rows, like a training log. Plan days, sessions,
  history and changes are hairline-divided lists with numbers on the left. Cards are kept
  only for primary objects: today's workout, an exercise being logged, a form.
- **Knurl texture.** The hero surfaces (today's workout, the sign-in panel) carry a faint
  diagonal crosshatch, like a barbell's knurled grip. It's the one decorative motif, and it
  doubles as a visual cue for "this is where you act".
- **One rhythm.** Every page uses the same shell width (1120 px) and the same page header
  (eyebrow, condensed title, description, optional actions). Reading and form pages sit in a
  760 px column. Spacing comes from a 4 px scale, and radii come in three sizes (6 / 10 /
  16 px).
- **Mobile-first logging.**
  - Set rows are compact: `# · kg · reps · ✓ · ⋯`, with remove as an in-row icon.
  - The finish bar is one line and sits directly above the tab bar.
  - Exercise art shrinks to a thumbnail.
  - The coach gets a multi-line composer.
  - Plan review leads with a change summary and folds each day's editor.

Implementation rules: the same stack (React 19, Vite 8, Tailwind 4). All design tokens live in
`src/styles/tokens.css` (CSS custom properties, exposed to Tailwind through `@theme`). The
component classes are in `src/styles/components.css`. API calls, payloads, auth and token
handling are unchanged.
