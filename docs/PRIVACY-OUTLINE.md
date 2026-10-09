# FitAI — privacy policy — factual outline (internal, NOT published)

> **What this file is.** A factual inventory of what FitAI collects, stores, and — importantly —
> **sends to a third-party AI provider**. Produced by reading the backend models, services,
> routers and the frontend on 2026-10-08, after fast-forwarding to
> `b8a5917` so it reflects the current code. Every claim below points at a file.
>
> **What this file is not.** It is not a privacy policy and it is not legal advice. It makes no
> claims about lawful basis, international transfer mechanisms, or jurisdiction-specific duties.
> Do not publish it as-is. See "Open questions" at the end.

---

## 1. The single most important fact

**FitAI sends personal health data to Anthropic, a third-party AI provider, on several features.**

This is not analytics or telemetry — it is content-level disclosure of profile and training data,
and it is the item any privacy notice must lead with.

`backend/app/services/ai.py` calls the Claude API (`model="claude-haiku-4-5"`) in three places:

| Trigger | What is sent to Anthropic | Source |
| --- | --- | --- |
| **Generating a workout plan** | age, gender, weight_kg, goal, level, days_per_week, equipment, **injuries (free text)** | `generate_plan()`, lines 55–66 |
| **Every AI Coach chat message** | the same profile fields, **plus** the full active workout plan as JSON, **plus** the last 3 logged sessions (session date, exercise names, and per-set weights/reps), **plus** the conversation content itself (up to 20 recent messages) | `build_coach_system_prompt()` lines 88–119 + `stream_chat()` lines 134–142, invoked by `routers/chat.py:94` |
| **Progressive-overload suggestions** | the last 6 logged sessions: dates, exercise names, and per-set weights/reps | `get_progressive_overload_suggestions()`, lines 159–186 |

**Verified negative:** the profile string built for these calls does **not** include the user's
email address or user id (`ai.py` lines 55–59 and 106–112). The disclosure is health and training
data, not account identity — though free-text `injuries` could contain identifying details if a
user types them.

**Consequence for any policy:** whether this is permitted, what disclosures are mandatory, and
whether special-category health data rules apply are legal questions that must be settled before
launch. Anthropic's own data-handling terms (retention, training opt-out, region) are the other
half of this answer and must be checked against Anthropic's current published terms — they are not
determinable from this codebase.

## 2. What is stored, and where

**PostgreSQL**, via SQLAlchemy 2.0 (`backend/app/database.py`). The models use Postgres-specific
`UUID` and `JSONB` types, so Postgres is required in production. The connection string is the
`DATABASE_URL` environment variable; the README names Render, Neon or Supabase as candidate
hosting, and the actual production provider cannot be determined from the code alone.

| Table | Fields held | File |
| --- | --- | --- |
| `users` | email (unique, indexed), **Argon2 password hash**, age, gender, weight_kg, goal, level, days_per_week, equipment, **injuries (free text)**, created_at | `models/user.py` |
| `workout_plans` | user_id, **plan JSONB** (weeks/days/exercises), is_active, created_at | `models/plan.py` |
| `workout_sessions` | user_id, plan_id, session_date, **notes (free text)**, created_at | `models/session.py` |
| `exercise_logs` | session_id, exercise_name, **sets JSONB** (weight + reps per set) | `models/session.py` |
| `chat_messages` | user_id, role, **full message content**, created_at | `models/chat.py` |

Free-text fields — `injuries`, session `notes`, and everything typed into the coach chat — are
the highest-risk data here, because the user controls their content and can put anything in them,
including health conditions and identifying information.

## 3. Authentication and session handling

- **Passwords** are hashed with **Argon2** via `pwdlib` (`services/auth.py:15`). Plaintext
  passwords are never stored or logged.
- **Access tokens** are **JWTs** (HS256) containing only `sub` (the internal user UUID) and `exp`
  (`services/auth.py:56–60`). No email or health data is embedded in the token.
- **Token lifetime: 10 080 minutes = 7 days** (`config.py:27`).
- **Tokens are stored in `localStorage`** under the key `token` (`frontend/src/api/token.js`),
  with an in-memory fallback for the current tab. This is the app's known weak point: a token in
  `localStorage` is readable by any script running on the page, and **there is no server-side
  revocation** — a signed token stays valid until it expires, so "logging out" everywhere is not
  currently possible for a stolen token.
- The only other item in `localStorage` is `theme` (UI preference, `ThemeContext.jsx`).

## 4. Third parties involved

| Party | Role | What they receive |
| --- | --- | --- |
| **Anthropic** | AI model provider | Profile, injuries, plan, session history, chat content — see section 1 |
| **Render** (per the deployed backend URL) | Backend hosting | All API traffic and the app process |
| **PostgreSQL provider** (Render / Neon / Supabase — unconfirmed) | Database | Everything in section 2 |
| **Vercel** | Frontend static hosting | Page loads only |

**Verified: the frontend has no analytics, no advertising, and no third-party embeds.** No
`@vercel/analytics`, no Speed Insights, no trackers — unlike the portfolio site. The only
localStorage keys are `token` and `theme`. There are no cookies.

## 5. What FitAI does NOT do

Verified by inspecting the routers on 2026-10-08:

| Checked | Finding |
| --- | --- |
| Account deletion | **None.** No `@router.delete` anywhere. A user cannot delete their account or data. |
| Password reset / email | **None.** There is no email service, so no reset flow and no verification emails. |
| Cookies | **None.** Session state is a JWT in localStorage. |
| Analytics / tracking | **None** in the frontend. |
| Data export | **None.** |
| Retention policy | **None defined** — records are kept until deleted, and nothing deletes them. |
| Consent / age gate | **None** — nothing asks for age of majority, and health data is collected at onboarding. |

## 6. Security measures that ARE in place

Verified in code, not assumed:

- Argon2 password hashing (`services/auth.py`).
- **SQL parameter logging suppressed** — `hide_parameters=True` on the engine
  (`database.py:14`), so credentials and personal values do not appear in SQL logs.
- **Rate limiting** on register (5/300 s) and login (10/300 s) per client address
  (`routers/auth.py:21–22`).
- **CORS restricted** to an explicit origin list, with `allow_credentials=False`, a fixed method
  set and only `Authorization`/`Content-Type` headers (`main.py:33–39`).
- Error responses avoid leaking internals; the chat router logs only the exception *type*, not
  message content (`routers/chat.py:106`).
- `.env` and `.env.*` are gitignored and no secret is tracked. (One file, `frontend/.env.production`,
  *is* tracked, but it contains only `VITE_API_URL` — the public backend address — which is
  bundled into client JavaScript by design and is not a secret.)

## 7. Open questions for whoever finalises the policy

1. **The Anthropic disclosure (section 1) is the gating issue.** Decide, with legal input, whether
   sending injuries and training history to a US AI provider is acceptable, what must be disclosed,
   and whether explicit consent is required. Nothing else in this document matters if this is wrong.
2. **Retention.** No data is ever deleted. Decide on a retention period, and note that answering
   "how long do you keep my chat history?" currently requires "indefinitely".
3. **Deletion rights.** There is no deletion endpoint. If a user asks to be erased, today the only
   answer is manual SQL. Either build a deletion flow or state honestly that erasure must be
   requested manually.
4. **Account recovery.** No password reset exists. Decide whether to add one (needs an email
   provider, i.e. a cost) or state plainly that lost passwords mean lost accounts.
5. **Age.** Health data plus no age gate. Consider whether the app should be restricted to adults.
6. **JWT lifetime.** 7 days in localStorage with no revocation is long for an app holding health
   data. Consider shortening it and/or adding server-side revocation.

## Source references

- `backend/app/services/ai.py` — the Anthropic integration (the disclosure in section 1)
- `backend/app/models/{user,plan,session,chat}.py` — everything stored
- `backend/app/services/auth.py`, `backend/app/config.py` — Argon2, JWT, 7-day expiry
- `backend/app/main.py` — CORS configuration
- `backend/app/database.py` — Postgres engine, `hide_parameters=True`
- `backend/app/routers/*.py` — confirmed no delete/export endpoints
- `frontend/src/api/token.js`, `frontend/src/context/ThemeContext.jsx` — the only localStorage use
- `frontend/.env.production` — tracked, but contains only the public backend URL
