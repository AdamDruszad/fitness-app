# Redesign recovery audit

## Branch and cause

Recovery branch: `fix/redesign-recovery`, created from `origin/main` at `7c0be2e`
(Redesign #23). This starts from the deployed history, so the repair can be a normal
pull request into `main` without replaying the earlier merges or reverts.

The intended redesign is recoverable at `c282ff8`. Comparing that tree with the
merge `ef6be22`, the reverts, and current `main` shows a partial merge of two UI
systems. The compilation repair `9fe3874` fixed JSX and undefined references but
left the stylesheet entry point and several pages in the older design.

The crucial failure was `src/index.css`: **all 12 redesign imports after Tailwind
were removed** (the font plus 11 design-system stylesheets). The files still existed,
and components still referenced their classes, so a build could succeed while
rendering mostly reset HTML. Old styles were reintroduced in their place.

## Findings and repair

| Before | After | Why |
| --- | --- | --- |
| Tailwind reset loaded; Archivo, tokens, shared styles and page styles disconnected | One complete CSS entry point loads all redesign layers | Restores actual typography, colours, spacing and layouts |
| Redesigned shell/auth/Coach mixed with older Dashboard, Logger, Progress and plan pages | Every route uses matching redesign markup and CSS | Fixes the inconsistent and unformatted screens rather than patching individual margins |
| Expanded plan editor and dense history paragraphs | Folded day editors, change summary, version cards and session set chips | Makes reviewing and finding training records manageable |
| Tall set rows, remove button on a separate line, incomplete saved summary | Compact five-column rows, stable completion labels, named next targets and retained session title | Restores the redesigned training workflow |
| Exercise art squeezed prescriptions into a very narrow column on small phones | Header separates artwork/name/tally from the full-width prescription | Keeps set targets readable at 320px |
| Mobile remove target 40px; completion target wider than its grid track | Both action tracks and controls are 44px | Avoids overlap and improves touch targeting |
| Hover styles remained after a touch tap | Hover is capability-gated; press feedback stays available | Prevents a touch press looking stuck |
| No safe-area padding at the header; arbitrary long titles could grow the page | Safe-area-aware gutters/header, wrap rules and input keyboard viewport hint | Supports narrow screens and landscape cutouts |
| Duplicate theme, description, manifest and icon tags in the HTML head | One of each, with a consistent pre-paint theme rule | Removes conflicting browser metadata |
| Manifest/offline page reverted to old colours and service-worker cache v1 | Matching offline design and cache v3 | Ensures an updated offline page is installed |
| SPA routing config only at repository root, while Vercel builds `frontend/` | Config also supplied in the actual frontend project root | Direct page links and refreshes reach the React router |
| Build-only verification could miss absent CSS; undefined JSX was only a warning | Browser layout checks plus strict lint and a PR workflow | Makes this class of merge regression detectable |

## Codebase review

| Area | Files and conclusion |
| --- | --- |
| Bootstrap and routing | `main.jsx`, `App.jsx`, auth/theme providers: retain lazy pages, session states and protected routing. Coach now also uses the user-keyed protected-page wrapper. |
| Shared UI | `Layout`, `PageHeading`, `AuthLayout`, `ui`, `InstallHelp`, `PlanEditor`: align callers with the shared design system. Install help appeared twice in merged Onboarding; restore its single intended placement. |
| All routes | Login, Register, Dashboard, WorkoutLogger, Coach, Progress, Onboarding, PlanReview, PlanHistory, SessionDetail and NotFound checked for their layout dependencies and browser rendering. |
| CSS | Tokens, base, components, shell, all seven page files and exercise artwork reviewed. Removed obsolete global styles instead of layering conflicting definitions on top. |
| Data contracts | Compared frontend operations with `backend/app/schemas/{user,plan,session}.py`; retain plan IDs/revisions, rep-versus-duration measurements, load basis, correction payloads and draft ownership. |
| Local workouts | `utils/drafts.js` uses IndexedDB compare/write revisions. Persistence and completion logic retained; browser checks exercise reload and confirmed-set submission. |
| API/auth | Axios bearer-token interceptor, 401 handling and auth session logic retained. Tests intercept synthetic API responses rather than accessing production data. |
| Delivery | Vite entry imports, font assets, HTML metadata, manifest, offline worker and Vercel root configuration reviewed together. |

## Verification

- Existing external interaction runner: **110/110 checks passed**, including auth,
  navigation/focus, logger payloads and recovery, Coach, onboarding, progress export,
  plan save/apply/refine/restore and session corrections.
- Screenshot smoke pass across nine core pages at **320, 390, 768 and 1440px**:
  no console errors, failed requests or horizontal overflow in those scenarios.
- Light-theme text measurements at 390/1440px found no contrast failures in the
  rendered samples. The workout rows retain a **52px pitch** at both sizes.
- Repository-owned checks: strict lint passes; **31/31 unit tests pass**;
  **80/80 browser layout/flow tests pass** across five viewport/theme configurations.
  The production PWA check passes separately after correcting its setup to visit the
  signed-in dashboard, where service-worker registration occurs. Four duplicate PWA
  runs are intentionally skipped in other viewport projects.
  The browser suite checks computed layouts and real loaded fonts, not just class
  strings or successful compilation. It saves screenshots and retains failure traces.
- Regular production build passes: entry JS **287.54 kB / 94.73 kB gzip**, shared
  CSS **57.60 kB / 12.22 kB gzip**. Archivo font assets are emitted and load successfully.
- The PR workflow builds a test-mode production bundle with an intercepted local API.
  A regular `npm run build` remains the Vercel production build.

These are browser/emulated viewport checks with synthetic data. Live backend/AI
responses, physical-phone keyboard/notch behavior and native install prompts still
need a device/deployment check. Earlier scores in the root `AUDIT.md` describe the
pre-merge redesign; they are historical, not a new claim of production verification.

## Merge this repair

Commit and push `fix/redesign-recovery`, then open a pull request into `main`.
Review the Vercel preview and the **Frontend checks** workflow before merging.
Use this branch's complete repair; merging the original `redesign` branch again
does not restore the imports it lost.
