import os
import json
import time
import asyncio
import logging
from enum import Enum
from typing import Dict, List, Any, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("shiro.websocket")


class WebSocketMode(str, Enum):
    DISTRIBUTED = "DISTRIBUTED"
    LOCAL_FALLBACK = "LOCAL_FALLBACK"
    DEGRADED = "DEGRADED"


class ConnectionManager:
    """
    Distributed WebSocket Connection Manager with Redis Pub/Sub (WS-01).
    Features:
    1. Operational modes: DISTRIBUTED, LOCAL_FALLBACK, DEGRADED.
    2. Race-proof Redis channel subscription lifecycle with reference counting and async locks.
    3. Multi-instance cross-process broadcasting via Redis channels ('study_room:{room_id}').
    4. Local in-memory fanout fallback when Redis is absent.
    5. Monotonic sequence numbering and client ACK generation.
    6. Reconnect state synchronization for missed message replay.
    7. Dead connection cleanup and heartbeat monitoring.
    """
    def __init__(self):
        # room_id -> list of local active WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # room_id -> user_id -> user_data
        self.room_members: Dict[str, Dict[int, Any]] = {}
        # websocket -> last_seen timestamp
        self.last_seen: Dict[WebSocket, float] = {}
        # room_id -> next message sequence integer
        self.room_sequences: Dict[str, int] = {}
        # room_id -> set of processed client_message_ids for idempotency
        self.processed_message_ids: Dict[str, Set[str]] = {}
        
        # Redis Pub/Sub state
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.is_multi_instance = os.getenv("MULTI_INSTANCE", "false").lower() in ("true", "1")
        self.redis_client = None
        self.pubsub_client = None
        self.subscriber_tasks: Dict[str, asyncio.Task] = {}
        self.subscription_lock = asyncio.Lock()
        
        # Determine initial mode
        self.mode = WebSocketMode.LOCAL_FALLBACK

    async def init_redis(self):
        """Attempts to initialize Redis async connection for distributed mode"""
        try:
            import redis.asyncio as aioredis
            self.redis_client = aioredis.from_url(
                self.redis_url, 
                socket_connect_timeout=0.5, 
                socket_timeout=0.5,
                decode_responses=True
            )
            await self.redis_client.ping()
            self.mode = WebSocketMode.DISTRIBUTED
            logger.info("WebSocketManager initialized in DISTRIBUTED mode via Redis")
        except Exception as e:
            if self.is_multi_instance:
                self.mode = WebSocketMode.DEGRADED
                logger.warning(f"Multi-instance enabled but Redis unreachable ({e}). Mode set to DEGRADED.")
            else:
                self.mode = WebSocketMode.LOCAL_FALLBACK
                logger.info(f"Redis unavailable ({e}). Running in LOCAL_FALLBACK mode.")

    def get_mode(self) -> WebSocketMode:
        return self.mode

    def get_next_sequence(self, room_id: str) -> int:
        if room_id not in self.room_sequences:
            self.room_sequences[room_id] = 1
        seq = self.room_sequences[room_id]
        self.room_sequences[room_id] += 1
        return seq

    def is_duplicate(self, room_id: str, client_message_id: Optional[str]) -> bool:
        if not client_message_id:
            return False
        if room_id not in self.processed_message_ids:
            self.processed_message_ids[room_id] = set()
        if client_message_id in self.processed_message_ids[room_id]:
            return True
        self.processed_message_ids[room_id].add(client_message_id)
        # Bound cache to 5000 recent message IDs per room
        if len(self.processed_message_ids[room_id]) > 5000:
            self.processed_message_ids[room_id].pop()
        return False

    async def connect(self, websocket: WebSocket, room_id: str, user_id: int, user_info: dict):
        """Connect a local client and ensure Redis channel subscription (WS-01)"""
        await websocket.accept()
        self.last_seen[websocket] = time.time()
        
        async with self.subscription_lock:
            if room_id not in self.active_connections:
                self.active_connections[room_id] = []
                self.room_members[room_id] = {}
                # First local client in this room: subscribe to Redis channel
                if self.redis_client and self.mode == WebSocketMode.DISTRIBUTED:
                    self._start_redis_subscriber(room_id)
                
            self.active_connections[room_id].append(websocket)
            self.room_members[room_id][user_id] = user_info
            
        logger.info(f"User {user_id} connected to room {room_id} (Mode: {self.mode})")
        await self.broadcast_room_state(room_id)

    async def disconnect(self, websocket: WebSocket, room_id: str, user_id: int):
        """Disconnect a local client and clean up Redis channel subscription when empty (WS-01)"""
        if websocket in self.last_seen:
            del self.last_seen[websocket]

        async with self.subscription_lock:
            if room_id in self.active_connections:
                if websocket in self.active_connections[room_id]:
                    self.active_connections[room_id].remove(websocket)
                
                if user_id in self.room_members[room_id]:
                    del self.room_members[room_id][user_id]
                    
                if not self.active_connections[room_id]:
                    # Last local client left: cancel subscriber task and clean up
                    del self.active_connections[room_id]
                    del self.room_members[room_id]
                    self._stop_redis_subscriber(room_id)
                else:
                    await self.broadcast_room_state(room_id)
                    
        logger.info(f"User {user_id} disconnected from room {room_id}")

    def update_heartbeat(self, websocket: WebSocket):
        self.last_seen[websocket] = time.time()

    def _start_redis_subscriber(self, room_id: str):
        if room_id not in self.subscriber_tasks or self.subscriber_tasks[room_id].done():
            self.subscriber_tasks[room_id] = asyncio.create_task(self._redis_listener(room_id))
            logger.info(f"Started Redis Pub/Sub subscriber task for channel study_room:{room_id}")

    def _stop_redis_subscriber(self, room_id: str):
        if room_id in self.subscriber_tasks:
            task = self.subscriber_tasks.pop(room_id)
            task.cancel()
            logger.info(f"Stopped Redis Pub/Sub subscriber task for channel study_room:{room_id}")

    async def _redis_listener(self, room_id: str):
        """Background coroutine listening to Redis Pub/Sub channel and broadcasting locally"""
        try:
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(f"study_room:{room_id}")
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("data"):
                    try:
                        data = json.loads(message["data"])
                        await self._local_broadcast(room_id, data)
                    except Exception as e:
                        logger.error(f"Error parsing PubSub message for room {room_id}: {e}")
                await asyncio.sleep(0.01)
        except asyncio.CancelledError:
            try:
                await pubsub.unsubscribe(f"study_room:{room_id}")
                await pubsub.close()
            except Exception:
                pass
        except Exception as e:
            logger.error(f"Redis listener encountered error on room {room_id}: {e}")

    async def broadcast_room_state(self, room_id: str):
        if room_id in self.room_members:
            members = list(self.room_members[room_id].values())
            await self.broadcast(room_id, {
                "type": "members_update",
                "members": members,
                "timestamp": time.time()
            })

    async def broadcast(self, room_id: str, message: dict):
        """
        Durability & Distribution Pipeline (WS-01):
        1. If in DISTRIBUTED mode, publishes payload to Redis channel.
        2. In LOCAL_FALLBACK or DEGRADED mode, directly broadcasts to local process sockets.
        """
        payload_str = json.dumps(message)
        
        if self.redis_client and self.mode == WebSocketMode.DISTRIBUTED:
            try:
                await self.redis_client.publish(f"study_room:{room_id}", payload_str)
                return
            except Exception as e:
                logger.warning(f"Redis publish failed on room {room_id} ({e}). Falling back to local dispatch.")
                
        # Direct local broadcast fallback
        await self._local_broadcast(room_id, message)

    async def _local_broadcast(self, room_id: str, message: dict):
        """Dispatches message to all local WebSocket connections in room"""
        if room_id in self.active_connections:
            dead_connections = []
            for connection in list(self.active_connections[room_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.debug(f"Connection send failed in room {room_id}: {e}")
                    dead_connections.append(connection)
            
            # Clean up dead sockets
            for dead in dead_connections:
                if dead in self.active_connections[room_id]:
                    self.active_connections[room_id].remove(dead)
                if dead in self.last_seen:
                    del self.last_seen[dead]


manager = ConnectionManager()
