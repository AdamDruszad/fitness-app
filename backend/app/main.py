"""
Main FastAPI Application Entrypoint.

Initializes the FastAPI app, configures CORS middleware for frontend communication,
registers all feature routers, and defines basic health check endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, users, plans, chat, sessions, progress

# Initialize FastAPI application instance
app = FastAPI(
    title="Fitness App API",
    description="Backend API for personalized AI workouts, workout logging, progress analytics, and coach chat.",
    version="1.0.0",
)

# Configure Cross-Origin Resource Sharing (CORS) to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Local Vite frontend dev server
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
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