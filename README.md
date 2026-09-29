# 🏋️ FitAI - AI-Powered Personal Fitness Coach & Workout Tracker

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6+-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Anthropic Claude](https://img.shields.io/badge/Anthropic-Claude_Haiku_4.5-D97706?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)

**FitAI** is a modern, full-stack fitness application that combines an intelligent AI coaching assistant with dynamic workout generation, set-by-set exercise logging, and progressive overload analytics.

Built with a **FastAPI** backend and a **React 19 + Vite** frontend, FitAI empowers athletes to achieve their personal best through data-driven workout tracking and evidence-based AI feedback.

---

## 📑 Table of Contents

- [Features](#-features)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Local Development Setup](#-local-development-setup)
  - [1. Backend Setup](#1-backend-setup)
  - [2. Frontend Setup](#2-frontend-setup)
- [Environment Variables](#-environment-variables)
- [API Documentation](#-api-documentation)
- [Running Tests](#-running-tests)
- [Deployment (Vercel Multi-Service)](#-deployment-vercel-multi-service)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🤖 AI Workout Plan Generation
- Automatically generates custom multi-week periodized programs tailored to:
  - Fitness goals (Muscle Gain, Fat Loss, Strength, General Fitness)
  - Experience level (Beginner, Intermediate, Advanced)
  - Weekly schedule (2 to 6 days/week)
  - Available equipment (Full Gym, Home Equipment, Bodyweight/None)
  - Physical biometrics (Age, Gender, Weight) and existing injuries/limitations
- Intelligent cooldown rate-limiting (2 minutes) to prevent accidental double-generation and LLM quota exhaustion.

### 💬 Context-Aware AI Fitness Coach
- Live streaming chat powered by **Claude Haiku** via Server-Sent Events (SSE).
- The coach has real-time context of the user's active workout plan, biometric stats, and recent workout session logs.
- Rich text and Markdown support with formatted tables, lists, and advice.
- Persistent conversation history stored in the database.

### 🏋️ Interactive Workout Logger
- Dynamic per-day workout routine loading from the active plan.
- Set-by-set logging with precise weights (kg) and repetition counts.
- Add or remove sets dynamically with smooth auto-scroll.
- Batch saving with `Promise.allSettled` to guarantee partial successes are not lost.
- Input validation with automatic `NaN` filtering to ensure database consistency.

### 📈 Progress Tracking & Progressive Overload
- Total volume KPIs: Total sessions, sessions this week, and total exercises completed.
- Searchable exercise database with personal bests (heaviest weight lifted, total repetitions, total sets).
- Drill-down drawer showing chronological performance history for any individual movement.
- AI-driven **Progressive Overload Suggestions** analyzing past sessions to recommend optimal weight and rep increments.

### 🎨 Design & Experience
- Sleek dark and light theme toggle with persistent preferences in `localStorage`.
- Ambient animated grid, blurred glow gradients, and Tabler icons.
- Fully responsive layout designed for mobile devices and desktop screens.
- Top-level `ErrorBoundary` protecting against unexpected client-side crashes.

---

## 🏛 Architecture & Tech Stack

```mermaid
graph TD
    Client["Client (Browser) - React 19 + Vite"] -->|HTTP / REST| API["FastAPI Application"]
    Client -->|Server-Sent Events (SSE)| ChatStream["/chat/ (Stream)"]
    API -->|SQLAlchemy 2.0 ORM| DB[("PostgreSQL Database")]
    API -->|Claude API Client| Anthropic["Anthropic Claude Haiku"]
    ChatStream -->|Claude Messages API| Anthropic
```

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) with [SQLAlchemy 2.0](https://www.sqlalchemy.org/) (declarative base with JSONB support)
- **Migrations**: [Alembic](https://alembic.sqlalchemy.org/)
- **Validation & Settings**: [Pydantic v2](https://docs.pydantic.dev/) & [pydantic-settings](https://github.com/pydantic/pydantic-settings)
- **Authentication**: JWT (`python-jose`) with Argon2 password hashing (`pwdlib`)
- **AI Integration**: [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python) (`claude-haiku-4-5`)
- **Testing**: [pytest](https://docs.pytest.org/), `pytest-asyncio`, and FastAPI `TestClient`

### Frontend
- **Library**: [React 19](https://react.dev/)
- **Build Tool**: [Vite 6+](https://vitejs.dev/)
- **Routing**: [React Router 8](https://reactrouter.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons**: [@tabler/icons-react](https://tabler.io/icons)
- **HTTP Client**: [Axios](https://axios-http.com/) with automatic token injection and 401 interceptors
- **Markdown**: [react-markdown](https://github.com/remarkjs/react-markdown)

---

## 📂 Repository Structure

```text
fitness-app/
├── backend/
│   ├── alembic/              # Database migration environments and revisions
│   ├── alembic.ini           # Alembic configuration
│   ├── app/
│   │   ├── config.py         # App configuration & environment validation
│   │   ├── database.py       # Engine setup, sessionmaker, Base, get_db dependency
│   │   ├── dependencies.py   # JWT Bearer authentication dependency (get_current_user)
│   │   ├── main.py           # FastAPI app instance, CORS middleware & router imports
│   │   ├── models/           # SQLAlchemy ORM models
│   │   │   ├── user.py       # User profile & credentials
│   │   │   ├── plan.py       # Workout plans (JSONB structure)
│   │   │   ├── session.py    # WorkoutSession & ExerciseLog models
│   │   │   └── chat.py       # ChatMessage history
│   │   ├── schemas/          # Pydantic request & response validation schemas
│   │   │   ├── user.py       # Auth & profile schemas
│   │   │   ├── plan.py       # Plan response schemas
│   │   │   ├── session.py    # Session & exercise set logging schemas
│   │   │   └── chat.py       # Chat input & message schemas
│   │   ├── services/         # Business logic & third-party integrations
│   │   │   ├── auth.py       # Argon2 password hashing & JWT token encode/decode
│   │   │   └── ai.py         # Claude prompt templates, streaming, plan generation
│   │   └── routers/          # API route definitions
│   │       ├── auth.py       # /auth/register, /auth/login
│   │       ├── users.py      # /users/me (GET, PUT)
│   │       ├── plans.py      # /plans/generate, /plans/current, /plans/
│   │       ├── sessions.py   # /sessions (CRUD), /sessions/{id}/logs
│   │       ├── chat.py       # /chat/ (history & SSE stream)
│   │       └── progress.py   # /progress/exercise/{name}, /progress/suggestions
│   ├── requirements.txt      # Python dependencies
│   └── tests/                # Pytest test suite
│       ├── conftest.py       # Database fixtures & test lifecycle cleanup
│       ├── test_auth.py      # Auth endpoint tests
│       ├── test_plans.py     # Plan generation tests (mocked AI)
│       ├── test_sessions.py  # Session & exercise logging tests
│       └── test_users.py     # Profile retrieval & update tests
├── frontend/
│   ├── public/               # Static assets & favicon
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js     # Axios instance with auth interceptors
│   │   ├── components/
│   │   │   └── Layout.jsx    # Master layout with top header & bottom nav
│   │   ├── context/
│   │   │   └── ThemeContext.jsx # Light / Dark mode state management
│   │   ├── hooks/
│   │   │   ├── useAuth.js    # Authentication hook & user session state
│   │   │   └── useTheme.js   # Theme context consumer hook
│   │   ├── pages/            # Application views
│   │   │   ├── Login.jsx     # User sign-in
│   │   │   ├── Register.jsx  # New account creation
│   │   │   ├── Onboarding.jsx# Multi-step profile & plan setup wizard
│   │   │   ├── Dashboard.jsx # Active plan & scheduled daily workout view
│   │   │   ├── Coach.jsx     # AI Coach streaming chat interface
│   │   │   ├── WorkoutLogger.jsx # Set-by-set workout logger
│   │   │   ├── Progress.jsx  # Volume metrics & exercise history analytics
│   │   │   └── NotFound.jsx  # 404 Error page
│   │   ├── App.jsx           # Client-side router configuration & route protection
│   │   ├── ErrorBoundary.jsx # React error boundary component
│   │   ├── index.css         # Tailwind CSS v4 styling & theme variables
│   │   └── main.jsx          # React app entry point
│   ├── package.json          # Node dependencies & npm scripts
│   └── vite.config.js        # Vite & Tailwind configuration
├── vercel.json               # Vercel multi-service project deployment configuration
└── README.md                 # Project documentation
```

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Node.js**: `v18.0.0` or later ([Download Node.js](https://nodejs.org/))
- **Python**: `v3.11` or later ([Download Python](https://www.python.org/))
- **PostgreSQL**: `v14` or later (or an online instance such as [Neon](https://neon.tech/) or [Supabase](https://supabase.com/))
- **Anthropic API Key**: For Claude AI capabilities ([Anthropic Console](https://console.anthropic.com/))

---

## 🚀 Local Development Setup

### 1. Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a Python virtual environment**:
   ```bash
   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate

   # Windows
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file in the `backend/` directory:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/fitness_db
   SECRET_KEY=your_super_secret_jwt_key_here_change_in_production
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=10080
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   ```

5. **Run database migrations (or create tables)**:
   ```bash
   # Run Alembic migrations
   alembic upgrade head
   ```

6. **Start the FastAPI development server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend API will be available at `http://localhost:8000`.  
   Interactive Swagger API documentation can be accessed at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the `frontend/` directory (optional for local dev, defaults to `http://localhost:8000`):
   ```env
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Type | Description | Required | Default |
| :--- | :--- | :--- | :---: | :--- |
| `DATABASE_URL` | String | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`) | **Yes** | — |
| `SECRET_KEY` | String | Cryptographic key used to sign JWT authentication tokens | **Yes** | — |
| `ALGORITHM` | String | JWT signing algorithm | No | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| Integer | Token lifetime in minutes | No | `10080` (7 days) |
| `ANTHROPIC_API_KEY` | String | API key for Anthropic Claude (`claude-haiku-4-5`) | **Yes** | — |

### Frontend (`frontend/.env`)

| Variable | Type | Description | Required | Default |
| :--- | :--- | :--- | :---: | :--- |
| `VITE_API_URL` | String | Base URL of the backend FastAPI service | No | `http://localhost:8000` |

---

## 📡 API Documentation

Interactive Swagger documentation is automatically hosted by FastAPI at:
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Summary of Key Endpoints

| Category | Method | Endpoint | Description | Auth Required |
| :--- | :---: | :--- | :--- | :---: |
| **Auth** | `POST` | `/auth/register` | Register a new user account | No |
| **Auth** | `POST` | `/auth/login` | Authenticate user & return JWT token | No |
| **Users** | `GET` | `/users/me` | Fetch authenticated user's profile | **Yes** |
| **Users** | `PUT` | `/users/me` | Update biometrics & fitness preferences | **Yes** |
| **Plans** | `POST` | `/plans/generate` | Generate AI workout routine (rate-limited 2m) | **Yes** |
| **Plans** | `GET` | `/plans/current` | Retrieve user's currently active plan | **Yes** |
| **Plans** | `GET` | `/plans/` | List all historical plans for user | **Yes** |
| **Sessions** | `POST` | `/sessions/` | Create a workout session record | **Yes** |
| **Sessions** | `GET` | `/sessions/` | Retrieve recent 20 workout sessions | **Yes** |
| **Sessions** | `GET` | `/sessions/{id}` | Retrieve specific session details | **Yes** |
| **Sessions** | `POST` | `/sessions/{id}/logs`| Log completed exercise sets (weight + reps) | **Yes** |
| **Chat** | `GET` | `/chat/` | Fetch recent 50 messages of chat history | **Yes** |
| **Chat** | `POST` | `/chat/` | Send message to AI Coach (returns SSE stream) | **Yes** |
| **Progress** | `GET` | `/progress/exercise/{name}` | Performance history for specific exercise | **Yes** |
| **Progress** | `GET` | `/progress/suggestions` | Progressive overload coaching suggestions | **Yes** |
| **Health** | `GET` | `/health` | Service health status check | No |

---

## 🧪 Running Tests

The application includes an automated integration test suite covering authentication, user profiles, workout plans, and workout sessions.

### Backend Tests
Execute pytest from the `backend/` directory:
```bash
cd backend
source venv/bin/activate
pytest tests -v
```

### Frontend Verification
Verify that the React production bundle builds cleanly and passes linting:
```bash
cd frontend
npm run lint
npm run build
```

---

## 🌐 Deployment (Vercel Multi-Service)

This repository is pre-configured with a root `vercel.json` file for **Vercel Multi-Service Deployment**, allowing both the Vite frontend and the FastAPI backend to run within a single unified project:

```json
{
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "services": {
        "backend": {
            "root": "backend",
            "framework": "fastapi"
        },
        "frontend": {
            "root": "frontend",
            "framework": "vite",
            "bindings": [
                {
                    "type": "service",
                    "service": "backend",
                    "format": "url",
                    "env": "VITE_API_URL"
                }
            ]
        }
    },
    "rewrites": [
        {
            "source": "/api/(.*)",
            "destination": {
                "service": "backend"
            }
        },
        {
            "source": "/(.*)",
            "destination": {
                "service": "frontend"
            }
        }
    ]
}
```

### Deployment Steps:
1. Push this repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New Project** and import `fitness-app`.
3. Vercel automatically detects the multi-service configuration in `vercel.json`.
4. Under project **Settings > Environment Variables**, add:
   - `DATABASE_URL`: Your production PostgreSQL connection string (from Neon, Supabase, or AWS RDS).
   - `SECRET_KEY`: A secure random secret key.
   - `ANTHROPIC_API_KEY`: Your production Anthropic API key.
5. Deploy the project. The frontend automatically receives `VITE_API_URL` pointing to the backend service.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

When contributing, please follow our repository standards:
1. **Fork the repository** and create your branch from `main`:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. **Follow code documentation standards**:
   - Add concise, meaningful comments to any non-trivial logic.
   - Document Python functions and modules with type hints and docstrings.
   - Document React components with JSDoc headers.
3. **Run tests before committing**:
   - Ensure `pytest tests` passes in `backend/`.
   - Ensure `npm run build` succeeds in `frontend/`.
4. **Commit your changes**:
   ```bash
   git commit -m "feat: add amazing new feature"
   ```
5. **Open a Pull Request** against `main`.

Please remember that all contributions to this repository must adhere to the [GitHub Community Guidelines](https://docs.github.com/articles/github-community-guidelines).

---

## 📄 License

This project is licensed under the MIT License. Feel free to use, modify, and distribute it for personal and commercial projects.
