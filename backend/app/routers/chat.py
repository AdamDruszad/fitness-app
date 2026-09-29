import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.chat import ChatMessage
from app.schemas.chat import ChatMessageIn, ChatMessageResponse
from app.services.ai import stream_chat
from app.dependencies import get_current_user

router = APIRouter()

@router.get("/", response_model=List[ChatMessageResponse])
def prev_chat_msgs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    history = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).order_by(ChatMessage.created_at.desc()).limit(50).all()
    return list(reversed(history))

@router.post("/")
def message(body: ChatMessageIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StreamingResponse:
    msg = ChatMessage(user_id = current_user.id, role = "user", content = body.content)
    db.add(msg); db.commit()

    history = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).order_by(ChatMessage.created_at.desc()).limit(20).all()
    messages = [{"role": m.role, "content": m.content} for m in reversed(history)]

    # Collect the full response text so we can persist it after streaming.
    # We use a mutable container because the generator closes over it and
    # the DB session from Depends(get_db) stays alive for the duration of
    # the StreamingResponse (FastAPI holds the dependency scope open until
    # the response is fully sent).
    collected = []

    def generate():
        for chunk in stream_chat(current_user, messages, db):
            collected.append(chunk)
            yield f"data: {json.dumps(chunk)}\n\n"
        # Persist the assistant reply after the full stream is consumed.
        full_text = "".join(collected)
        if full_text:
            response_msg = ChatMessage(role="assistant", content=full_text, user_id=current_user.id)
            db.add(response_msg)
            db.commit()
        yield "event: done\ndata: {}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")