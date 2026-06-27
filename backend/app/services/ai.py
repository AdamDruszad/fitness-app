import json
from anthropic import Anthropic
from app.config import settings

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