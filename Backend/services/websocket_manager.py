from fastapi import WebSocket
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # room_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # room_id -> user_id -> user_data
        self.room_members: Dict[str, Dict[int, Any]] = {}

    async def connect(self, websocket: WebSocket, room_id: str, user_id: int, user_info: dict):
        await websocket.accept()
        
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
            self.room_members[room_id] = {}
            
        self.active_connections[room_id].append(websocket)
        self.room_members[room_id][user_id] = user_info
        
        logger.info(f"User {user_id} connected to room {room_id}")
        await self.broadcast_room_state(room_id)

    async def disconnect(self, websocket: WebSocket, room_id: str, user_id: int):
        if room_id in self.active_connections:
            if websocket in self.active_connections[room_id]:
                self.active_connections[room_id].remove(websocket)
            
            if user_id in self.room_members[room_id]:
                del self.room_members[room_id][user_id]
                
            if not self.active_connections[room_id]:
                # Cleanup empty room
                del self.active_connections[room_id]
                del self.room_members[room_id]
            else:
                await self.broadcast_room_state(room_id)
                
            logger.info(f"User {user_id} disconnected from room {room_id}")

    async def broadcast_room_state(self, room_id: str):
        if room_id in self.room_members:
            members = list(self.room_members[room_id].values())
            await self.broadcast(room_id, {
                "type": "members_update",
                "members": members
            })

    async def broadcast(self, room_id: str, message: dict):
        if room_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[room_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting to connection in room {room_id}: {e}")
                    dead_connections.append(connection)
            
            # Clean up dead connections
            for dead in dead_connections:
                if dead in self.active_connections[room_id]:
                    self.active_connections[room_id].remove(dead)

manager = ConnectionManager()
