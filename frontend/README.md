# FitAI frontend

React 19, Vite 8 and Tailwind 4. The UI uses the **Iron & chalk** redesign: Archivo
variable type, warm neutrals, terracotta actions, compact workout rows and a shared
responsive shell.

## Develop

```sh
npm ci
npm run dev
```

The API defaults to `http://localhost:8000`. Set `VITE_API_URL` for your backend.

## Verify before merging

```sh
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Browser tests build and serve the actual bundle on port 5204. They use synthetic,
intercepted API responses; no backend, credentials or AI service is needed.
`PLAYWRIGHT_CHANNEL=msedge` can use an installed Edge browser instead of downloading
Chromium. On PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:e2e
```

The suite checks all routes at 320, 390, 768 and 1440 pixels, dark/light themes,
computed CSS and font loading, navigation, overflow with long names, workout draft
recovery and completion, plan activation, chat and the production offline fallback.
Screenshots are in `test-results/`; open the report with `npx playwright show-report`.
The GitHub workflow runs these checks for pull requests and uploads the results.

## Styling contract

`src/index.css` is the stylesheet entry point. It must import:

1. Tailwind's reset/utilities and the self-hosted Archivo font.
2. `styles/tokens.css` — colours, type, spacing and theme values.
3. `styles/base.css`, `components.css`, `layout.css` — defaults, controls and shell.
4. Every stylesheet in `styles/pages/` — layouts paired with their React pages.

Compose `Layout`, `PageHeading`, `Notice`, `LoadingLine`, `BackLink` and the shared
`btn`, `field`, `ledger`, `card` and `disclosure` classes. Keep page markup and page
CSS together when resolving merges. The retired `continuity-*`, `fitai-*-button`
and `workout-savebar` styles are no longer part of this design system.

## Vercel

Use **Root Directory: `frontend`**, **Framework: Vite**, **Build: `npm run build`**,
**Output: `dist`**, with `VITE_API_URL` set for the deployed backend.
`frontend/vercel.json` supplies the SPA fallback for direct links and refreshes on
routes such as `/coach` and `/plans/history`.

See [the recovery audit](docs/REDESIGN_RECOVERY.md) for the merge failure, repair
scope and verification details.
