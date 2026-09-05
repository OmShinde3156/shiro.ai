from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import json
import time
from datetime import datetime

from database.database import get_db
from models.database import StudyRoom, RoomMember, RoomMessage, User, Document
from services.websocket_manager import manager
from services.flashcard_service import FlashcardService
from utils.llm_client import llm_client
from utils.auth import get_current_user, get_user_from_token

router = APIRouter(prefix="/rooms", tags=["Rooms"])

@router.post("/")
async def create_room(
    room_data: dict, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new study room bound to authenticated user (SEC-02)"""
    room_name = room_data.get("name")
    if not room_name or not str(room_name).strip():
        raise HTTPException(status_code=400, detail="Room name is required")
        
    room_id = str(uuid.uuid4())[:8] # Short unique room code
    new_room = StudyRoom(
        id=room_id,
        name=str(room_name).strip(),
        subject=room_data.get("subject", "General"),
        description=room_data.get("description", ""),
        is_public=room_data.get("is_public", True),
        document_id=room_data.get("document_id"),
        created_by=current_user.id  # Identity derived strictly from JWT
    )
    db.add(new_room)
    
    # Auto-add creator as active member
    member = RoomMember(room_id=room_id, user_id=current_user.id, is_active=True)
    db.add(member)
    
    db.commit()
    db.refresh(new_room)
    
    return {"room_id": new_room.id, "message": "Room created successfully"}

@router.get("/")
async def get_public_rooms(db: Session = Depends(get_db)):
    rooms = db.query(StudyRoom).filter(StudyRoom.is_public == True).all()
    return [{"id": r.id, "name": r.name, "subject": r.subject, "members_count": len(r.members)} for r in rooms]

@router.get("/{room_id}")
async def get_room(room_id: str, db: Session = Depends(get_db)):
    room = db.query(StudyRoom).filter(StudyRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    doc = None
    if room.document_id:
        document = db.query(Document).filter(Document.id == room.document_id).first()
        if document:
            doc = {
                "id": document.id,
                "filename": document.filename,
                "file_url": document.file_url,
                "text_content": document.text_content
            }
            
    # Load last 50 messages
    messages = db.query(RoomMessage).filter(RoomMessage.room_id == room_id).order_by(RoomMessage.created_at.desc()).limit(50).all()
    messages.reverse() # Oldest first
    
    msg_list = []
    for m in messages:
        sender_name = "Shiro AI" if m.is_ai else (m.user.name if m.user else "Unknown")
        msg_list.append({
            "id": m.id,
            "user_id": m.user_id,
            "sender_name": sender_name,
            "is_ai": m.is_ai,
            "content": m.content,
            "created_at": m.created_at.isoformat()
        })
        
    return {
        "id": room.id,
        "name": room.name,
        "subject": room.subject,
        "description": room.description,
        "document": doc,
        "host_id": room.created_by,
        "recent_messages": msg_list
    }

async def _handle_websocket_connection(websocket: WebSocket, room_id: str, token: Optional[str], db: Session):
    """
    Authenticated WebSocket handshake pipeline (SEC-02):
    1. Verify JWT token and authenticate user (Never trust client-supplied ID).
    2. Verify room exists.
    3. Register active room membership.
    4. Connect and broadcast messages.
    """
    # 1. Authenticate user from JWT token
    user = get_user_from_token(token, db)
    if not user:
        await websocket.close(code=1008) # Policy Violation / Unauthorized
        return
        
    # 2. Check room exists
    room = db.query(StudyRoom).filter(StudyRoom.id == room_id).first()
    if not room:
        await websocket.close(code=1008) # Room does not exist
        return

    # 3. Check authorization: If room is private, user must be creator or pre-existing member
    member = db.query(RoomMember).filter(
        RoomMember.room_id == room_id,
        RoomMember.user_id == user.id
    ).first()
    
    if not room.is_public and room.created_by != user.id and not member:
        # Private room: Unauthorized student rejected
        await websocket.close(code=1008)
        return

    # Auto-register public room membership or activate existing member
    if not member:
        member = RoomMember(room_id=room_id, user_id=user.id, is_active=True)
        db.add(member)
        try: db.commit()
        except: db.rollback()
    else:
        member.is_active = True
        try: db.commit()
        except: db.rollback()

    user_info = {"id": user.id, "name": user.name, "avatar_url": user.avatar_url}
    await manager.connect(websocket, room_id, user.id, user_info)

    try:
        while True:
            data = await websocket.receive_text()
            manager.update_heartbeat(websocket)
            payload = json.loads(data)
            
            msg_type = payload.get("type", "chat")
            
            # 1. Heartbeat Ping/Pong Handling (WS-01)
            if msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
                continue
                
            # 2. Reconnect State Resynchronization (WS-01)
            elif msg_type == "sync_messages":
                last_seq = int(payload.get("last_sequence", 0))
                missed_msgs = db.query(RoomMessage).filter(
                    RoomMessage.room_id == room_id,
                    RoomMessage.sequence > last_seq
                ).order_by(RoomMessage.sequence.asc()).all()
                
                sync_list = [{
                    "id": m.id,
                    "sequence": m.sequence,
                    "client_message_id": m.client_message_id,
                    "user_id": m.user_id,
                    "sender_name": "Shiro AI" if m.is_ai else (m.user.name if m.user else "Unknown"),
                    "is_ai": m.is_ai,
                    "content": m.content,
                    "created_at": m.created_at.isoformat()
                } for m in missed_msgs]
                
                await websocket.send_json({
                    "type": "sync_response",
                    "messages": sync_list,
                    "last_sequence": sync_list[-1]["sequence"] if sync_list else last_seq
                })
                continue

            # 3. Chat Messages with Idempotency & Sequence Numbering (WS-01)
            elif msg_type == "chat":
                client_msg_id = payload.get("client_message_id")
                content = payload.get("content", "").strip()
                if not content:
                    continue

                # Idempotency Check: Skip duplicate client retries
                if client_msg_id and manager.is_duplicate(room_id, client_msg_id):
                    # Immediately return ACK without duplicate DB save or broadcast
                    await websocket.send_json({
                        "type": "ack",
                        "client_message_id": client_msg_id,
                        "status": "already_processed"
                    })
                    continue

                # Assign monotonic room sequence
                seq = manager.get_next_sequence(room_id)

                # Persist to database durably BEFORE broadcast (Durability First)
                new_msg = RoomMessage(
                    room_id=room_id,
                    user_id=user.id,
                    client_message_id=client_msg_id,
                    sequence=seq,
                    is_ai=False,
                    content=content
                )
                db.add(new_msg)
                try:
                    db.commit()
                    db.refresh(new_msg)
                except Exception:
                    db.rollback()
                
                # Send immediate ACK back to sender (WS-01)
                if client_msg_id:
                    await websocket.send_json({
                        "type": "ack",
                        "client_message_id": client_msg_id,
                        "sequence": seq,
                        "status": "delivered"
                    })

                # Broadcast to room across all instances
                await manager.broadcast(room_id, {
                    "type": "chat",
                    "message": {
                        "id": getattr(new_msg, "id", None) or 1,
                        "sequence": seq,
                        "client_message_id": client_msg_id,
                        "user_id": user.id,
                        "sender_name": user.name,
                        "is_ai": False,
                        "content": content,
                        "created_at": datetime.utcnow().isoformat()
                    }
                })
                
                # Handle @shiro or @ai collaborative trigger
                is_ai_triggered = "@shiro" in content.lower() or "@ai" in content.lower()
                if is_ai_triggered:
                    query_clean = content.replace("@shiro", "").replace("@ai", "").strip()
                    doc_context = ""
                    if room.document_id:
                        room_doc = db.query(Document).filter(Document.id == room.document_id).first()
                        if room_doc and room_doc.text_content:
                            doc_context = f"\nROOM ACTIVE DOCUMENT ({room_doc.filename}):\n{room_doc.text_content[:2000]}\n"

                    room_prompt = f"You are Shiro, the collaborative AI tutor inside a live study room.\n{doc_context}\nSTUDENT QUESTION: {query_clean}\n\nProvide a clear, high-yield, encouraging answer suitable for group discussion."
                    
                    try:
                        ai_result = await llm_client.execute_with_governance(
                            prompt=room_prompt,
                            feature="room_copilot",
                            prompt_version="v1.0",
                            user_id=user.id,
                            db=db
                        )
                        ai_content = ai_result.content.strip()
                    except Exception as ex:
                        ai_content = f"Here is a room insight on '{query_clean}': Focus on the core definitions and check the active study document for formulas."

                    ai_seq = manager.get_next_sequence(room_id)
                    ai_msg = RoomMessage(
                        room_id=room_id,
                        user_id=None,
                        sequence=ai_seq,
                        is_ai=True,
                        content=ai_content
                    )
                    db.add(ai_msg)
                    try:
                        db.commit()
                        db.refresh(ai_msg)
                    except Exception:
                        db.rollback()
                    
                    await manager.broadcast(room_id, {
                        "type": "chat",
                        "message": {
                            "id": getattr(ai_msg, "id", None) or 2,
                            "sequence": ai_seq,
                            "user_id": None,
                            "sender_name": "Shiro AI",
                            "is_ai": True,
                            "content": ai_content,
                            "created_at": datetime.utcnow().isoformat()
                        }
                    })

            elif msg_type == "timer_update":
                await manager.broadcast(room_id, {
                    "type": "timer_update",
                    "timer_state": payload.get("timer_state")
                })
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id, user.id)
    except Exception:
        await manager.disconnect(websocket, room_id, user.id)


@router.websocket("/ws/{room_id}")
async def websocket_endpoint_token(
    websocket: WebSocket, 
    room_id: str, 
    token: Optional[str] = Query(None), 
    db: Session = Depends(get_db)
):
    """Standard authenticated WebSocket endpoint"""
    await _handle_websocket_connection(websocket, room_id, token, db)

@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint_legacy(
    websocket: WebSocket, 
    room_id: str, 
    user_id: int, 
    token: Optional[str] = Query(None), 
    db: Session = Depends(get_db)
):
    """Legacy route: Validates token and derives identity from JWT, overriding client user_id"""
    await _handle_websocket_connection(websocket, room_id, token, db)


# ==============================================
# ROOM NOTES & COLLABORATION AI ACTIONS
# ==============================================

@router.post("/{room_id}/summarize-to-notes")
async def summarize_room_to_notes(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Summarizes room chat messages and active document into structured revision notes"""
    room = db.query(StudyRoom).filter(StudyRoom.id == room_id).first()
    doc = None
    if not room:
        if room_id.isdigit():
            doc = db.query(Document).filter(Document.id == int(room_id)).first()
        if not doc:
            # Fallback to user's most recent document if available
            doc = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.id.desc()).first()

    if not room and not doc:
        raise HTTPException(status_code=404, detail="Study room or document not found")

    room_name = room.name if room else doc.filename
    room_subject = room.subject if room else (doc.subject or "General")

    messages = []
    if room:
        messages = db.query(RoomMessage).filter(RoomMessage.room_id == room_id).order_by(RoomMessage.created_at.desc()).limit(20).all()
    chat_transcript = "\n".join([f"- {('Shiro' if m.is_ai else (m.user.name if m.user else 'Student'))}: {m.content}" for m in reversed(messages)]) if messages else "- Focus study session on active reading and revision."

    doc_text = ""
    target_doc = None
    if room and room.document_id:
        target_doc = db.query(Document).filter(Document.id == room.document_id).first()
    elif doc:
        target_doc = doc

    if target_doc and target_doc.text_content:
        doc_text = f"\nACTIVE DOCUMENT EXCERPT:\n{target_doc.text_content[:2500]}\n"

    summary_prompt = f"""You are Shiro, the collaborative study room AI.
Generate clean, highly structured Markdown revision notes summarizing the key topics studied in this session.

ROOM / DOCUMENT TOPIC: {room_name} ({room_subject})
{doc_text}
RECENT SESSION CHAT & DISCUSSIONS:
{chat_transcript}

FORMAT RULES:
1. Use bold headings (## Key Concepts, ## Formulas / Theorems, ## Action Items).
2. Use concise bullet points suitable for quick revision.
3. Highlight high-yield points for exam recall.
"""

    try:
        res = await llm_client.execute_with_governance(
            prompt=summary_prompt,
            feature="room_copilot",
            prompt_version="v1.0",
            user_id=current_user.id,
            db=db
        )
        notes_content = res.content.strip()
    except Exception as e:
        notes_content = f"## Study Notes: {room_name}\n\n- Reviewed session topics.\n- Continue active recall drills on key definitions."

    return {
        "room_id": room_id,
        "notes": notes_content,
        "generated_at": datetime.utcnow().isoformat()
    }


@router.post("/{room_id}/notes-to-flashcards")
async def convert_notes_to_flashcards(
    room_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Converts study room notes into a flashcard review deck"""
    notes_text = payload.get("notes", "").strip()
    if not notes_text or len(notes_text) < 10:
        raise HTTPException(status_code=400, detail="Notes content must contain at least 10 characters")

    flashcard_service = FlashcardService()
    cards = await flashcard_service.generate_flashcards_from_text(
        text=notes_text,
        num_cards=5,
        user_id=current_user.id,
        db=db
    )

    return {
        "room_id": room_id,
        "flashcards": cards,
        "count": len(cards)
    }

