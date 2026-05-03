from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
import os, asyncio
import google.generativeai as genai
from contextlib import AsyncExitStack

from database.database import get_db
from services.graph_service import GraphService
from services.progress_service import ProgressService
from models.database import KnowledgeNode

router = APIRouter()

@router.websocket("/ws/live-mentor/{user_id}")
async def live_mentor_websocket(websocket: WebSocket, user_id: int):
    """
    Shiro Live: Real-time Multimodal Voice Session
    Uses Gemini 2.0 Flash Live for bidirectional audio streaming.
    """
    await websocket.accept()
    
    # Gemini integration is disabled
    await websocket.send_json({"error": "Live Mentor (Gemini) is disabled in this environment."})
    await websocket.close()
    return
    graph_service = GraphService()
    progress_service = ProgressService()
    
    db = next(get_db())
    try:
        progress_data = await progress_service.get_user_progress(user_id, db)
        concepts = db.query(KnowledgeNode).filter(KnowledgeNode.user_id == user_id).limit(15).all()
        concept_list = ", ".join([c.label for c in concepts]) or "General Knowledge"
        
        model_id = "gemini-2.0-flash-exp"
        system_instruction = f"""
        You are Shiro, the student's Live Mentor. 
        STUDENT CONTEXT:
        - Weak Areas: {', '.join(progress_data.get('weak_subjects', []))}
        - Strong Areas: {', '.join(progress_data.get('strong_subjects', []))}
        - Current Library Concepts: {concept_list}
        
        GOAL: Have a natural, bidirectional voice conversation. 
        Focus on the concepts in their library.
        """
        
        config = {
            "model": f"models/{model_id}",
            "system_instruction": system_instruction,
            "generation_config": {"response_modalities": ["AUDIO"]}
        }

        async with AsyncExitStack() as stack:
            session = await stack.enter_async_context(client.aio.live.connect(model=model_id, config=config))
            
            async def receive_audio():
                try:
                    while True:
                        message = await websocket.receive_bytes()
                        await session.send(input=message, end_of_turn=False)
                except WebSocketDisconnect:
                    pass

            async def send_responses():
                try:
                    async for response in session.receive():
                        if response.data:
                            await websocket.send_bytes(response.data)
                        if response.text:
                            await websocket.send_json({"text": response.text})
                except Exception as e:
                    print(f"Gemini Live Error: {e}")

            await asyncio.gather(receive_audio(), send_responses())
    except Exception as e:
        print(f"Live Session Failed: {e}")
    finally:
        db.close()
        await websocket.close()
