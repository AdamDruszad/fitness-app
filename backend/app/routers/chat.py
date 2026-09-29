"""
AI Coach Chat Router.

Handles conversational interactions with FitAI, including message persistence
and real-time streaming responses via Server-Sent Events (SSE).
"""

import json
from typing import List
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.chat import ChatMessage
from app.schemas.chat import ChatMessageIn, ChatMessageResponse
from app.services.ai import stream_chat

router = APIRouter()


@router.get("/", response_model=List[ChatMessageResponse], status_code=status.HTTP_200_OK)
def prev_chat_msgs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves up to 50 previous messages from the user's chat history in chronological order.
    
    Args:
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        List[ChatMessageResponse]: Chronologically sorted chat messages.
    """
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(50)
        .all()
    )
    return list(reversed(history))


@router.post("/", status_code=status.HTTP_200_OK)
def message(
    body: ChatMessageIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> StreamingResponse:
    """
    Submits a user query and streams back the AI assistant's response via Server-Sent Events (SSE).
    
    Flow:
    1. Persists the user's prompt in the chat_messages table.
    2. Retrieves recent conversation history (up to 20 messages) for multi-turn context.
    3. Streams response tokens as SSE formatted chunks ('data: "..."\\n\\n').
    4. Upon completion, persists the accumulated assistant response to the database.
    5. Sends an 'event: done' event indicating stream conclusion.
    
    Args:
        body: ChatMessageIn containing prompt text.
        current_user: Authenticated User instance.
        db: Scoped database session.
        
    Returns:
        StreamingResponse: text/event-stream response for frontend consumption.
    """
    # 1. Save user query to database
    msg = ChatMessage(user_id=current_user.id, role="user", content=body.content)
    db.add(msg)
    db.commit()

    # 2. Retrieve recent conversation history for prompt context
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in reversed(history)]

    # 3. Buffer generator to yield tokens and persist assistant reply
    collected = []

    def generate():
        for chunk in stream_chat(current_user, messages, db):
            collected.append(chunk)
            yield f"data: {json.dumps(chunk)}\n\n"

        # Persist full assistant reply to database
        full_text = "".join(collected)
        if full_text:
            response_msg = ChatMessage(
                role="assistant",
                content=full_text,
                user_id=current_user.id
            )
            db.add(response_msg)
            db.commit()

        # Signal completion to frontend reader
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")