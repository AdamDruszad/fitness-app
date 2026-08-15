from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.plan import WorkoutPlan
from app.schemas.plan import PlanResponse
from app.services.ai import generate_plan
from app.dependencies import get_current_user

router = APIRouter()

@router.post("/generate")
def generate(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PlanResponse:
    if current_user.goal is None:
        raise HTTPException(400, "Complete your profile first")
    db.query(WorkoutPlan).filter(WorkoutPlan.user_id == current_user.id, WorkoutPlan.is_active == True).update({"is_active": False})
    
    try:
        plan = generate_plan(current_user)
    except Exception as e:
        print(f"PLAN GENERATION ERROR: {e}")
        raise HTTPException(503, "Something went wrong")
        
    wo_plan = WorkoutPlan()
    wo_plan.user_id = current_user.id
    wo_plan.plan_data = plan
    wo_plan.is_active = True
    
    db.add(wo_plan); db.commit(); db.refresh(wo_plan)
        
    return wo_plan

@router.get("/current")
def current(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> PlanResponse:
    plan = db.query(WorkoutPlan).filter(WorkoutPlan.user_id == current_user.id, WorkoutPlan.is_active == True).first()
    if plan is None:
        raise HTTPException(404, "No active plan")
    return plan

@router.get("/")
def all(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> List:
    plans = db.query(WorkoutPlan).filter(WorkoutPlan.user_id == current_user.id).all()
    return plans