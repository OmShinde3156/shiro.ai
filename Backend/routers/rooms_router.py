from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List
import uuid
import json

from database.database import get_db
from models.database import StudyRoom, RoomMember, RoomMessage, User, Document
from services.websocket_manager import manager

router = APIRouter(prefix="/rooms", tags=["Rooms"])

@router.post("/")
async def create_room(room_data: dict, db: Session = Depends(get_db)):
    user_id = room_data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    room_id = str(uuid.uuid4())[:8] # Short code
    new_room = StudyRoom(
        id=room_id,
        name=room_data["name"],
        subject=room_data.get("subject", "General"),
        description=room_data.get("description", ""),
        is_public=room_data.get("is_public", True),
        document_id=room_data.get("document_id"),
        created_by=user_id
    )
    db.add(new_room)
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

@router.websocket("/ws/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        await websocket.close(code=1008)
        return
        
    user_info = {"id": user.id, "name": user.name, "avatar_url": user.avatar_url}
    
    await manager.connect(websocket, room_id, user_id, user_info)
    
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # Handle different message types
            msg_type = payload.get("type", "chat")
            
            if msg_type == "chat":
                # Save to DB
                new_msg = RoomMessage(
                    room_id=room_id,
                    user_id=user_id,
                    is_ai=False,
                    content=payload["content"]
                )
                db.add(new_msg)
                db.commit()
                db.refresh(new_msg)
                
                # Broadcast
                await manager.broadcast(room_id, {
                    "type": "chat",
                    "message": {
                        "id": new_msg.id,
                        "user_id": user_id,
                        "sender_name": user.name,
                        "is_ai": False,
                        "content": payload["content"],
                        "created_at": new_msg.created_at.isoformat()
                    }
                })
                
                # Simple AI hook for now
                if "@ai" in payload["content"].lower():
                    ai_content = f"Here is a room-aware AI answer regarding: '{payload['content']}'. (Connect Context RAG here!)"
                    
                    ai_msg = RoomMessage(
                        room_id=room_id,
                        user_id=None,
                        is_ai=True,
                        content=ai_content
                    )
                    db.add(ai_msg)
                    db.commit()
                    db.refresh(ai_msg)
                    
                    await manager.broadcast(room_id, {
                        "type": "chat",
                        "message": {
                            "id": ai_msg.id,
                            "user_id": None,
                            "sender_name": "Shiro AI",
                            "is_ai": True,
                            "content": ai_content,
                            "created_at": ai_msg.created_at.isoformat()
                        }
                    })
                    
            elif msg_type == "timer_update":
                # Sync timer to everyone else
                await manager.broadcast(room_id, {
                    "type": "timer_update",
                    "timer_state": payload["timer_state"]
                })
                
    except WebSocketDisconnect:
        await manager.disconnect(websocket, room_id, user_id)
