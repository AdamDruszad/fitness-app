import json
from anthropic import Anthropic
from app.config import settings
from sqlalchemy.orm import Session

client = Anthropic(api_key=settings.anthropic_api_key)

PLAN_SYSTEM_PROMPT = """You are an expert strength and conditioning coach.
Return ONLY valid JSON, no markdown, no explanation. Schema:
{"weeks": <int>, "days": [{"day": "<name>", "focus": "<focus>", "exercises": 
[{"name": "<name>", "sets": <int>, "reps": "<e.g. 6-8>", "rest_seconds": <int>}]}]}"""

def generate_plan(user) -> dict:
    profile = f"Age: {user.age}, Gender: {user.gender}, Weight_kg: {user.weight_kg}, Goal: {user.goal}, Level: {user.level}, Days_per_week: {user.days_per_week}, Equipment: {user.equipment}, Injuries: {user.injuries}"
    
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=2000,
        system=PLAN_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": profile}]
    )
    
    answ = response.content[0].text.strip()
    
    return json.loads(answ)

def build_coach_system_prompt(user, db: Session) -> str:
    from app.models.plan import WorkoutPlan
    from app.models.session import WorkoutSession, ExerciseLog
    active_plan = db.query(WorkoutPlan).filter(WorkoutPlan.is_active == True, WorkoutPlan.user_id == user.id).first()
    
    w_sessions = db.query(WorkoutSession).filter(WorkoutSession.user_id == user.id).order_by(WorkoutSession.session_date.desc()).limit(3).all()
    
    profile = f"Age: {user.age}, Gender: {user.gender}, Weight_kg: {user.weight_kg}, Goal: {user.goal}, Level: {user.level}, Days_per_week: {user.days_per_week}, Equipment: {user.equipment}, Injuries: {user.injuries}, Plan: {json.dumps(active_plan.plan_data) if active_plan else 'none'}, Sessions: {w_sessions}"
    
    return profile

def stream_chat(user, messages: list, db: Session):
    system = build_coach_system_prompt(user, db)
    with client.messages.stream(
        model="claude-haiku-4-5",
        max_tokens=1000,
        system=system,
        messages=messages
    ) as stream:
        for text in stream.text_stream:
            yield text