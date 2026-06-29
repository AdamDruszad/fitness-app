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

@router.get("/")
def prev_chat_msgs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ChatMessageResponse:
    history = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).order_by(ChatMessage.created_at.asc()).limit(50).all()
    
    return history

@router.post("/")
def message(body: ChatMessageIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StreamingResponse:
    msg = ChatMessage(user_id = current_user.id, role = "user", content = body.content)
    db.add(msg); db.commit()
    
    history = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).limit(20).all()
    
    messages = [{"role": m.role, "content": m.content} for m in history]
    
    chunks = []
    
    def generate():
        for chunk in stream_chat(current_user, messages, db):
            yield f"data: {chunk}\n\n"
            chunks.append(chunk)
        response = ChatMessage(role="assistant", content="".join(chunks), user_id = current_user.id)
        db.add(response); db.commit()
        yield f"data: [DONE]\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
            