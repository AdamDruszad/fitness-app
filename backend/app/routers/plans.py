"""
Workout Plans Router.

Endpoints to trigger AI generation of custom workout programs,
fetch the user's active plan, and view past plan archives.
"""

from datetime import datetime, timedelta, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.plan import WorkoutPlan
from app.schemas.plan import PlanResponse
from app.services.ai import generate_plan

router = APIRouter()


@router.post("/generate", response_model=PlanResponse, status_code=status.HTTP_200_OK)
def generate(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> PlanResponse:
    """
    Generates a new AI workout routine using Claude based on user's profile.
    
    Includes rate-limiting (maximum one generation every 2 minutes) to prevent
    abuse and excessive LLM API costs.
    
    Args:
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Raises:
        HTTPException: 400 Bad Request if user hasn't set their fitness goal.
        HTTPException: 429 Too Many Requests if user tries to generate within 2 minutes of the previous plan.
        HTTPException: 503 Service Unavailable if LLM generation fails.
        
    Returns:
        PlanResponse: The newly created active workout plan.
    """
    if current_user.goal is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete your profile first"
        )

    # Check cooldown: rate limit to 1 plan per 2 minutes
    last_plan = (
        db.query(WorkoutPlan)
        .filter(WorkoutPlan.user_id == current_user.id)
        .order_by(WorkoutPlan.created_at.desc())
        .first()
    )
    if (
        last_plan
        and last_plan.created_at
        and last_plan.created_at > datetime.now(timezone.utc) - timedelta(minutes=2)
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You can only generate a plan once every 2 minutes. Please wait."
        )

    # Deactivate existing active plans before creating the new one
    db.query(WorkoutPlan).filter(
        WorkoutPlan.user_id == current_user.id,
        WorkoutPlan.is_active == True
    ).update({"is_active": False})

    # Call AI service to generate structured plan JSON
    try:
        plan = generate_plan(current_user)
    except Exception as e:
        print(f"PLAN GENERATION ERROR: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Something went wrong"
        )

    # Persist the new active plan in database
    wo_plan = WorkoutPlan()
    wo_plan.user_id = current_user.id
    wo_plan.plan_data = plan
    wo_plan.is_active = True

    db.add(wo_plan)
    db.commit()
    db.refresh(wo_plan)

    return wo_plan


@router.get("/current", response_model=PlanResponse, status_code=status.HTTP_200_OK)
def current(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> PlanResponse:
    """
    Retrieves the currently active workout plan for the authenticated user.
    
    Args:
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Raises:
        HTTPException: 404 Not Found if no active plan exists.
        
    Returns:
        PlanResponse: The active workout plan data.
    """
    plan = db.query(WorkoutPlan).filter(
        WorkoutPlan.user_id == current_user.id,
        WorkoutPlan.is_active == True
    ).first()

    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active plan"
        )
    return plan


@router.get("/", response_model=List[PlanResponse], status_code=status.HTTP_200_OK)
def all_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[PlanResponse]:
    """
    Retrieves all workout plans (active and historical) created for the user.
    
    Args:
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        List[PlanResponse]: List of all historical plans.
    """
    plans = db.query(WorkoutPlan).filter(WorkoutPlan.user_id == current_user.id).all()
    return plans