"""
Workout Plans Router.

Endpoints to trigger AI generation of custom workout programs,
fetch the user's active plan, and view past plan archives.
"""

from datetime import datetime, timedelta, timezone
import logging
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.plan import WorkoutPlan, PlanProposal
from app.models.chat import ChatMessage
from app.schemas.plan import GeneratedPlan, PlanResponse, ProposalCreate, ProposalUpdate, ProposalApply, RestorePlan
from app.services.ai import generate_plan, generate_proposal
from app.services.plans import active_plan, activate, lock_user, fingerprint, plan_response, validated_plan

router = APIRouter()
logger = logging.getLogger(__name__)


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

    # Serialize generations for this account across workers. Otherwise concurrent
    # requests can both pass the cooldown and create two active plans.
    db.query(User).filter(User.id == current_user.id).with_for_update().one()

    # Check cooldown: rate limit to 1 plan per 2 minutes
    last_plan = (
        db.query(WorkoutPlan)
        .filter(WorkoutPlan.user_id == current_user.id)
        .order_by(WorkoutPlan.created_at.desc())
        .first()
    )
    created_at = last_plan.created_at if last_plan else None
    if created_at is not None and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    if created_at and created_at > datetime.now(timezone.utc) - timedelta(minutes=2):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You can only generate a plan once every 2 minutes. Please wait."
        )

    # Provider output is untrusted: validate before changing the active plan.
    try:
        plan = GeneratedPlan.model_validate(generate_plan(current_user)).model_dump()
    except Exception as e:
        db.rollback()
        logger.warning("Plan generation failed (%s)", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate a valid plan. Please try again."
        )

    previous = active_plan(db, current_user.id)
    wo_plan = activate(db, current_user.id, plan, previous.id if previous else None, "generated")
    db.commit()
    db.refresh(wo_plan)

    return plan_response(wo_plan)


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
    return plan_response(plan)


@router.get("/", response_model=List[PlanResponse], status_code=status.HTTP_200_OK)
def all_plans(
    before: uuid.UUID | None = None,
    limit: int = Query(20, ge=1, le=100),
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
    query = db.query(WorkoutPlan).filter(WorkoutPlan.user_id == current_user.id)
    if before:
        cursor = query.filter(WorkoutPlan.id == before).first()
        if not cursor:
            raise HTTPException(404, "Plan cursor not found")
        query = query.filter(or_(WorkoutPlan.created_at < cursor.created_at,
            and_(WorkoutPlan.created_at == cursor.created_at, WorkoutPlan.id < cursor.id)))
    plans = query.order_by(WorkoutPlan.created_at.desc(), WorkoutPlan.id.desc()).limit(limit).all()
    return [plan_response(plan) for plan in plans]


def owned_proposal(db, user_id, proposal_id, lock=False):
    query = db.query(PlanProposal).filter_by(id=proposal_id, user_id=user_id)
    if lock:
        query = query.with_for_update().populate_existing()
    proposal = query.first()
    if not proposal:
        raise HTTPException(404, "Plan draft not found")
    return proposal


def proposal_response(db, proposal):
    current = active_plan(db, proposal.user_id)
    base = db.get(WorkoutPlan, proposal.base_plan_id) if proposal.base_plan_id else None
    return {key: getattr(proposal, key) for key in (
        "id", "status", "revision", "base_plan_id", "applied_plan_id", "plan_data",
        "instructions", "keep_exercises", "error", "created_at", "request_id") } | {
        "stale": (current.id if current else None) != proposal.base_plan_id and proposal.status != "applied",
        "base_plan": plan_response(base) if base else None,
        "active_id": current.id if current else None,
    }


@router.get("/proposals")
def proposals(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(PlanProposal).filter_by(user_id=current_user.id).order_by(PlanProposal.created_at.desc()).limit(50).all()
    return [proposal_response(db, row) for row in rows]


@router.post("/proposals")
def create_proposal(body: ProposalCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    lock_user(db, user_id)
    digest = fingerprint(body.model_dump(mode="json"))
    existing = db.query(PlanProposal).filter_by(user_id=user_id, request_id=body.request_id).first()
    if existing:
        if existing.request_hash != digest:
            raise HTTPException(409, "This request ID belongs to different draft content")
        return proposal_response(db, existing)
    base = db.query(WorkoutPlan).filter_by(id=body.base_plan_id, user_id=user_id).first() if body.base_plan_id else None
    if body.base_plan_id and not base:
        raise HTTPException(404, "Base plan not found")
    source = owned_proposal(db, user_id, body.from_proposal_id) if body.from_proposal_id else None
    messages = []
    for message_id in body.source_message_ids:
        selected = db.query(ChatMessage).filter_by(id=message_id, user_id=user_id).first()
        if not selected:
            raise HTTPException(404, "Source message not found")
        context = db.query(ChatMessage).filter(ChatMessage.user_id == user_id, ChatMessage.created_at <= selected.created_at).order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(12).all()
        messages.extend({"role": m.role, "content": m.content} for m in reversed(context))
    if not body.plan_data and not messages and not body.instructions.strip() and not source:
        raise HTTPException(422, "Select a coach response or describe your routine")
    if not body.plan_data:
        last = db.query(PlanProposal).filter_by(user_id=user_id).order_by(PlanProposal.created_at.desc()).first()
        stamp = last.created_at.replace(tzinfo=timezone.utc) if last and last.created_at.tzinfo is None else last.created_at if last else None
        if stamp and stamp > datetime.now(timezone.utc) - timedelta(seconds=30):
            raise HTTPException(429, "Please wait 30 seconds before requesting another coach draft")
    proposal = PlanProposal(user_id=user_id, request_id=body.request_id, request_hash=digest,
        base_plan_id=body.base_plan_id, source_message_ids=[str(i) for i in body.source_message_ids],
        instructions=body.instructions, keep_exercises=body.keep_exercises, status="creating")
    db.add(proposal)
    db.flush()
    seed = proposal.id
    base_data = plan_response(base)["plan_data"] if base else None
    source_data = source.plan_data if source else None
    # Materialize profile before releasing the transaction for the provider call.
    profile = {k: getattr(current_user, k) for k in ("goal", "level", "days_per_week", "equipment", "injuries")}
    db.commit()
    try:
        raw = body.plan_data.model_dump() if body.plan_data else generate_proposal(profile, base_data, messages, body.instructions, body.keep_exercises, source_data)
        data = validated_plan(raw, user_id, seed)
        proposal = owned_proposal(db, user_id, seed, lock=True)
        proposal.plan_data, proposal.status = data, "ready"
    except Exception as error:
        db.rollback()
        logger.warning("Proposal generation failed (%s)", type(error).__name__)
        proposal = owned_proposal(db, user_id, seed, lock=True)
        proposal.status, proposal.error = "failed", "Could not create a valid draft. Your active plan is unchanged."
    db.commit()
    return proposal_response(db, proposal)


@router.get("/proposals/{proposal_id}")
def get_proposal(proposal_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return proposal_response(db, owned_proposal(db, current_user.id, proposal_id))


@router.put("/proposals/{proposal_id}")
def update_proposal(proposal_id: uuid.UUID, body: ProposalUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    proposal = owned_proposal(db, current_user.id, proposal_id, lock=True)
    if proposal.status != "ready" or proposal.revision != body.revision:
        raise HTTPException(409, "The draft changed. Reload before editing.")
    try:
        proposal.plan_data = validated_plan(body.plan_data.model_dump(), current_user.id, proposal.id)
    except ValueError as error:
        raise HTTPException(422, str(error))
    proposal.revision += 1
    db.commit()
    return proposal_response(db, proposal)


@router.post("/proposals/{proposal_id}/apply", response_model=PlanResponse)
def apply_proposal(proposal_id: uuid.UUID, body: ProposalApply, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lock_user(db, current_user.id)
    proposal = owned_proposal(db, current_user.id, proposal_id, lock=True)
    if proposal.revision != body.revision or proposal.base_plan_id != body.expected_active_id:
        raise HTTPException(409, "The reviewed draft or its base version changed")
    if proposal.status == "applied":
        return plan_response(db.get(WorkoutPlan, proposal.applied_plan_id))
    if proposal.status != "ready":
        raise HTTPException(409, "This draft is not ready to apply")
    names = {e["name"].strip().casefold() for d in proposal.plan_data["days"] for e in d["exercises"]}
    missing = [n for n in proposal.keep_exercises if n.casefold() not in names]
    if missing:
        raise HTTPException(422, "Restore your requested exercises before saving: " + ", ".join(missing))
    plan = activate(db, current_user.id, proposal.plan_data, body.expected_active_id)
    proposal.status, proposal.applied_plan_id = "applied", plan.id
    db.commit()
    return plan_response(plan)


@router.post("/versions/{plan_id}/restore")
def restore(plan_id: uuid.UUID, body: RestorePlan, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    old = db.query(WorkoutPlan).filter_by(id=plan_id, user_id=current_user.id).first()
    if not old:
        raise HTTPException(404, "Plan not found")
    # Restore remains a reviewed proposal; activation uses the same idempotent path.
    return create_proposal(ProposalCreate(request_id=body.request_id, base_plan_id=body.expected_active_id,
        plan_data=GeneratedPlan.model_validate(plan_response(old)["plan_data"])), current_user, db)
