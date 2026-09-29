import json
from anthropic import Anthropic
from app.config import settings
from sqlalchemy.orm import Session

client = Anthropic(api_key=settings.anthropic_api_key)

PLAN_SYSTEM_PROMPT = """You are an expert strength and conditioning coach.
Return ONLY valid JSON, no markdown, no explanation. Schema:
{"weeks": <int>, "days": [{"day": "<name>", "focus": "<focus>", "exercises": 
[{"name": "<name>", "sets": <int>, "reps": "<e.g. 6-8>", "rest_seconds": <int>}]}]}"""

def _strip_code_fences(text: str) -> str:
    """Remove optional markdown code fences (```json ... ```) from AI output."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0]
    return text.strip()

def generate_plan(user) -> dict:
    profile = f"Age: {user.age}, Gender: {user.gender}, Weight_kg: {user.weight_kg}, Goal: {user.goal}, Level: {user.level}, Days_per_week: {user.days_per_week}, Equipment: {user.equipment}, Injuries: {user.injuries}"
    
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=2000,
        system=PLAN_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": profile}]
    )
    answ = response.content[0].text.strip()
    answ = _strip_code_fences(answ)
    return json.loads(answ)

def build_coach_system_prompt(user, db: Session) -> str:
    from app.models.plan import WorkoutPlan
    from app.models.session import WorkoutSession, ExerciseLog
    active_plan = db.query(WorkoutPlan).filter(WorkoutPlan.is_active == True, WorkoutPlan.user_id == user.id).first()
    
    w_sessions = db.query(WorkoutSession).filter(WorkoutSession.user_id == user.id).order_by(WorkoutSession.session_date.desc()).limit(3).all()
    
    # Build a serialisable summary of recent sessions (the ORM objects are not
    # directly JSON-friendly, which previously produced unhelpful repr strings).
    sessions_summary = []
    for s in w_sessions:
        exercises = []
        for log in db.query(ExerciseLog).filter(ExerciseLog.session_id == s.id).all():
            exercises.append({"exercise": log.exercise_name, "sets": log.sets_data})
        sessions_summary.append({"date": str(s.session_date), "exercises": exercises})
    
    profile = f"Age: {user.age}, Gender: {user.gender}, Weight_kg: {user.weight_kg}, Goal: {user.goal}, Level: {user.level}, Days_per_week: {user.days_per_week}, Equipment: {user.equipment}, Injuries: {user.injuries}, Plan: {json.dumps(active_plan.plan_data) if active_plan else 'none'}, Recent sessions: {json.dumps(sessions_summary)}"
    
    return f"""You are FitAI, an expert AI fitness coach. You have access to the user's profile and workout data.
Be helpful, motivating, and specific. Give evidence-based advice.
If you don't know something, say so rather than guessing.

User profile and context:
{profile}"""

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
            
def get_progressive_overload_suggestions(user, db: Session):
    from app.models.session import WorkoutSession, ExerciseLog
    sessions = db.query(WorkoutSession).filter(WorkoutSession.user_id == user.id).order_by(WorkoutSession.session_date.desc()).limit(6).all()
    if len(sessions) < 2: return []
    history = {}
    for s in sessions:
        for log in db.query(ExerciseLog).filter(ExerciseLog.session_id == s.id).all():
            history.setdefault(log.exercise_name, []).append(
                {"date": str(s.session_date), "sets": log.sets_data}
            )
    if not history: return []
    prompt = f"""Analyze workout history. Return ONLY a JSON array (no markdown, no code fences):
    [{{"exercise": "name", "suggestion": "specific next-session suggestion"}}]
    History: {json.dumps(history)}"""
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}]
    )
    
    answer = response.content[0].text.strip()
    answer = _strip_code_fences(answer)
    
    return json.loads(answer)