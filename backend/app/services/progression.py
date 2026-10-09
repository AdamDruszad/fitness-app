"""Bounded optional double progression. No provider calls or invented baseline."""
from datetime import date, timedelta
import math
import re


def next_target(exercise, previous, increment=None, today=None):
    target = {"rule": "repeat-v1", "source_session_id": previous.get("session_id") if previous else None,
              "reason": "Record a comfortable starting session to establish a baseline."}
    if not previous or not previous["sets"]:
        if exercise.get("target_weight") is not None:
            target.update(rule="prescription-v1", weight=exercise["target_weight"],
                          reason="Starting target from your reviewed plan. Adjust it before confirming an actual set.")
            if exercise["measurement"] == "duration":
                target["duration_seconds"] = exercise.get("duration_seconds")
            elif match := re.fullmatch(r"(\d+)(?:\s*[-–]\s*\d+)?", exercise.get("reps") or ""):
                target["reps"] = int(match[1])
        return target
    sets = previous["sets"]
    target.update({k: sets[0].get(k) for k in ("weight", "reps", "duration_seconds")})
    target["reason"] = "Repeat your last recorded values, adjusting for how you feel today."
    if exercise["measurement"] != "reps" or exercise["load_basis"] not in ("total", "per_hand", "added"):
        return target
    match = re.fullmatch(r"(\d+)\s*[-–]\s*(\d+)", exercise.get("reps") or "")
    if not match or not increment or not math.isfinite(increment) or not 0 < increment <= 100:
        return target
    low, high = map(int, match.groups())
    weight = sets[0].get("weight")
    old = previous.get("prescription") or {}
    age = (today or date.today()) - date.fromisoformat(previous["date"])
    if age > timedelta(days=28) or age < timedelta(0):
        target["reason"] = "Your baseline is over four weeks old. Choose a comfortable repeat before progressing."
        return target
    if old.get("sets") != exercise["sets"] or old.get("reps") != exercise["reps"] or previous.get("notes"):
        target["reason"] = "Review the changed prescription or previous notes before progressing."
        return target
    if weight is None or weight <= 0 or increment > weight * .1 or weight + increment > 2000:
        return target
    if len(sets) != exercise["sets"] or any(s.get("weight") != weight for s in sets):
        return target
    target["rule"] = "double-progression-v1"
    if all(s.get("reps", 0) >= high for s in sets):
        target.update(weight=round(weight + increment, 3), reps=low,
                      reason=f"All {len(sets)} sets reached {high} reps at {weight:g} kg. Try your {increment:g} kg increment at {low} reps; adjust if needed.")
    else:
        target.update(reps=min(high, min(s["reps"] for s in sets) + 1),
                      reason=f"Repeat {weight:g} kg and work toward {high} reps per set.")
    return target
