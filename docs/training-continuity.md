# Training continuity release

## Workflows

- **Coach → plan:** choose an earlier saved coach response (history is paginated), or paste a routine under “Improve my existing routine.” Create a persisted draft, review the complete prescriptions and derived changes, edit it, and explicitly activate it. Favorite exercises supplied in the keep list must remain present.
- **Plan versions:** activations create immutable versions. Stale-base activation conflicts are explicit. An applied proposal can be replayed without creating another version. Old versions remain in paginated plan history and can become a new reviewed draft.
- **Preferences:** saving profile preferences is separate from requesting a plan draft.
- **Workout:** select a workout to create a unique occurrence. Drafts use IndexedDB transactions scoped to the account. Reload/navigation recovery and compare-and-write revision checks protect against accidental multi-tab overwrite. Plan changes affect future workouts; an existing draft keeps its starting snapshot.
- **Completion:** confirm actual sets, then finish. Copied previous values and targets are not completed sets. One transaction writes the session and all logs. A unique account/occurrence constraint plus payload fingerprint returns identical replays and rejects changed-payload reuse. Pending completion freezes its payload until resolved. “Workout saved” means the server confirmed it.
- **Measurements:** reps and seconds are distinct. Load basis (total, per hand, added, assistance, bodyweight, unspecified) is explicit and part of conservative exercise identity. Legacy data is retained; unknown historical units are not retroactively inferred.
- **Guidance:** optional double progression uses comparable completed sets, a valid rep range, an explicitly chosen load increment, and a recent baseline. Changed prescriptions, difficulty notes, unsupported loads, and large increments fall back to repeating/reviewing. Suggestions explain their source and rule; user-entered results remain authoritative.
- **Progress:** complete session pagination, exercise-specific actual results, optional weekly goal, correction with revision checking, and JSON export. Old records have “completion unverified” status and remain accessible; they do not masquerade as newly verified completions. Optional existing AI training ideas remain available on demand.
- **Installation:** manifest, raster icons, platform-specific home-screen instructions, and a public offline explanation. An update never forcibly reloads a live workout. Private pages and API results are not cached by the service worker.

## Deployment

1. Back up the deployment database using the existing operations procedure.
2. Deploy the additive backend migration and compatible API: from `backend`, run `alembic upgrade head` using the intended deployment environment.
3. Deploy the frontend build. Coordinate server/client versions: the new frontend requires proposal and atomic-completion endpoints.

Migration `f01_training_continuity` retains legacy JSON and session records. If historical data contains several active flags for one user, it keeps the newest plan active and retains all others as history. The partial unique index enforces one active plan thereafter. Downgrading removes the new continuity fields and proposal table; it is not a data-preserving rollback of new feature use.

## Storage and platform boundaries

Signing out removes visible account state. Device drafts are retained under their owner so the same account can recover after reauthentication; no upload is replayed into another account. This is account isolation, not encrypted multi-user device storage. Clearing browser data can remove local drafts. Server-confirmed sessions remain in history.

Home-screen installation is not full offline cold launch. Opening/authenticating requires a connection. An already-open workout can retain edits locally; finishing while disconnected remains pending and exposes explicit retry. Background upload, push alarms, health/watch integrations, and native-store packaging are not implemented.

Exercise identities intentionally use account, normalized exact name, measurement, and load basis. No fuzzy aliases or artwork IDs are used. Historical records without a confirmed identity remain visible in history but are not silently included in automatic progression.

## Verification commands

```text
backend:  .venv\Scripts\python.exe -m pytest tests -q
frontend: npm test
frontend: npm run lint
frontend: npm run build
```

`backend/scripts/check_postgres.py` additionally verifies migrations and real row-lock concurrency. It only accepts an explicitly disposable cluster at `127.0.0.1:55439/postgres` through `FITAI_TEST_POSTGRES_URL`; it creates and drops a randomly named test database. It never reads the production database URL for this test.

For local browser checks, `backend/tests/browser_app.py` provides a disposable in-memory SQLite API with synthetic accounts and a fake plan provider. Run it on localhost port 8011 and run Vite on port 5187 with `VITE_API_URL=http://127.0.0.1:8011`. The synthetic accounts are `browser@example.com` and `other@example.com`, password `browser-test-password`. Do not deploy this test-only app.

Real iOS/Android installation, screen-reader behavior, software keyboards, and training-session usability still require owner/device validation. Automated browser emulation cannot establish these hardware-specific outcomes.

### Verified on 2026-10-09

- 74 backend tests and 30 frontend utility/data tests passed; frontend lint and production build passed.
- PostgreSQL 16: initial-to-current migration with legacy plans, metadata consistency, concurrent same-proposal activation, competing activations, concurrent completion replay, correction conflicts, and preserved session/plan linkage passed in the disposable cluster.
- Headless Microsoft Edge: older-chat selection, draft edit/reload, activation, typed workout reload, actual IndexedDB multi-tab conflict, server-committed/lost-response retry producing one session, correction, copy-forward remaining uncompleted, resume, and account isolation passed against the isolated test API.
- Review, logger, and progress screens had no horizontal overflow at 320, 390, 768, and 1280 px in light/dark themes.
- Production build: manifest and PNG icons loaded, service worker registered, only the public offline explanation was cached, and disconnected cold navigation showed that explanation. No JavaScript page errors occurred in these checks.
- The database check exposed pre-existing migration/ORM disagreement about nullable legacy log fields. The ORM/response handling now preserves those legacy nulls instead of imposing a destructive backfill.

## Release scope

This remains a free product. Billing, AI quotas/paid entitlements, native integrations, full offline bootstrap, substitutions, advanced periodization, and automatic missed-day replanning are gated follow-up work. No production user data or provider calls are required by the automated checks.
