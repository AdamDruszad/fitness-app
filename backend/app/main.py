"""
Main FastAPI Application Entrypoint.

Initializes the FastAPI app, configures CORS middleware for frontend communication,
registers all feature routers, and defines basic health check endpoints.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
import app.models  # noqa: F401 - Register models with Base.metadata
from app.routers import auth, users, plans, chat, sessions, progress


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.
    Ensures all database schema tables exist before serving traffic.
    Uses engine.begin() to commit DDL transactions through PgBouncer/Neon poolers.
    """
    with engine.begin() as conn:
        Base.metadata.create_all(conn)
    yield


# Initialize FastAPI application instance
app = FastAPI(
    title="Fitness App API",
    description="Backend API for personalized AI workouts, workout logging, progress analytics, and coach chat.",
    version="1.0.0",
    lifespan=lifespan,
)

# Parse allowed origins from environment variable if provided, with local fallbacks
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]
env_origins = os.getenv("ALLOWED_ORIGINS")
if env_origins:
    allowed_origins.extend([origin.strip() for origin in env_origins.split(",") if origin.strip()])

# Configure Cross-Origin Resource Sharing (CORS) to allow requests from local dev ports and Vercel domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^(https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?|https:\/\/.*\.vercel\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules with modular URL prefixes and OpenAPI tags
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(plans.router, prefix="/plans", tags=["plans"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(progress.router, prefix="/progress", tags=["progress"])


@app.get("/health", tags=["health"])
def health():
    """
    Health check endpoint for deployment monitoring, load balancers, and uptime checks.
    
    Returns:
        dict: {"status": "ok"} when the service is responsive.
    """
    return {"status": "ok"}