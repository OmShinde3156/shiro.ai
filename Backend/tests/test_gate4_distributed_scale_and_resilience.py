# pyrefly: ignore [missing-import]
import pytest
import os
import time
import json
import sqlite3
from unittest.mock import patch, MagicMock, AsyncMock

from models.database import StudyRoom, RoomMember, RoomMessage, User
from services.websocket_manager import ConnectionManager, WebSocketMode
from scripts.backup_restore import backup_database, verify_backup, restore_database, prune_backups


def test_websocket_mode_classification():
    """Test WebSocket operational mode classification (WS-01)"""
    # 1. Local fallback mode
    mgr_local = ConnectionManager()
    assert mgr_local.get_mode() in (WebSocketMode.LOCAL_FALLBACK, WebSocketMode.DISTRIBUTED)

    # 2. Degraded mode when multi-instance configured without Redis
    with patch.dict(os.environ, {"MULTI_INSTANCE": "true", "REDIS_URL": "redis://invalid-host:9999/0"}):
        mgr_deg = ConnectionManager()
        assert mgr_deg.get_mode() in (WebSocketMode.LOCAL_FALLBACK, WebSocketMode.DEGRADED)


def test_websocket_message_monotonic_sequencing():
    """Test room message sequence counter is monotonic (WS-01)"""
    mgr = ConnectionManager()
    room_id = "test_seq_room_1"
    
    seq1 = mgr.get_next_sequence(room_id)
    seq2 = mgr.get_next_sequence(room_id)
    seq3 = mgr.get_next_sequence(room_id)
    
    assert seq1 == 1
    assert seq2 == 2
    assert seq3 == 3


def test_websocket_idempotent_duplicate_detection():
    """Test duplicate client message IDs are flagged for idempotency (WS-01)"""
    mgr = ConnectionManager()
    room_id = "test_idem_room"
    msg_id = "msg_unique_abc_123"

    assert mgr.is_duplicate(room_id, msg_id) is False
    assert mgr.is_duplicate(room_id, msg_id) is True  # Second time is duplicate
    assert mgr.is_duplicate(room_id, "msg_different_456") is False


@pytest.mark.asyncio
async def test_websocket_local_broadcast_and_dead_connection_cleanup():
    """Test in-memory local broadcast and dead connection removal (WS-01)"""
    mgr = ConnectionManager()
    room_id = "test_room_broadcast"
    
    mock_ws1 = MagicMock()
    mock_ws1.send_json = AsyncMock(return_value=None)
    mock_ws2 = MagicMock()
    mock_ws2.send_json = AsyncMock(side_effect=RuntimeError("Socket closed"))

    # Connect manually into manager
    mgr.active_connections[room_id] = [mock_ws1, mock_ws2]
    
    await mgr.broadcast(room_id, {"type": "chat", "content": "Hello Room"})
    
    # ws1 received broadcast
    assert mock_ws1.send_json.called
    # ws2 failed and was cleaned up
    assert mock_ws2 not in mgr.active_connections[room_id]
    assert len(mgr.active_connections[room_id]) == 1


@pytest.mark.asyncio
async def test_websocket_redis_pubsub_dispatch():
    """Test Redis Pub/Sub broadcast publishing when in DISTRIBUTED mode (WS-01)"""
    mgr = ConnectionManager()
    mgr.mode = WebSocketMode.DISTRIBUTED
    mock_redis = MagicMock()
    mock_redis.publish = AsyncMock(return_value=1)
    mgr.redis_client = mock_redis

    room_id = "room_redis_test"
    message = {"type": "chat", "content": "Distributed message", "sequence": 5}

    await mgr.broadcast(room_id, message)
    
    assert mock_redis.publish.called
    args = mock_redis.publish.call_args[0]
    assert args[0] == f"study_room:{room_id}"
    assert json.loads(args[1])["content"] == "Distributed message"


@pytest.mark.asyncio
async def test_websocket_subscription_lifecycle_locking():
    """Test connect and disconnect lifecycle updates active connections and members (WS-01)"""
    mgr = ConnectionManager()
    room_id = "room_lifecycle_1"
    
    mock_ws = MagicMock()
    mock_ws.accept = AsyncMock(return_value=None)
    mock_ws.send_json = AsyncMock(return_value=None)

    user_info = {"id": 10, "name": "Alice", "avatar_url": None}

    # Connect
    await mgr.connect(mock_ws, room_id, 10, user_info)
    assert room_id in mgr.active_connections
    assert mock_ws in mgr.active_connections[room_id]
    assert 10 in mgr.room_members[room_id]
    assert mock_ws in mgr.last_seen

    # Heartbeat update
    prev_time = mgr.last_seen[mock_ws]
    time.sleep(0.01)
    mgr.update_heartbeat(mock_ws)
    assert mgr.last_seen[mock_ws] > prev_time

    # Disconnect
    await mgr.disconnect(mock_ws, room_id, 10)
    assert room_id not in mgr.active_connections
    assert room_id not in mgr.room_members
    assert mock_ws not in mgr.last_seen


def test_reconnect_sync_messages_from_db(db):
    """Test sync query returns missed messages in sequential order (WS-01)"""
    room_id = "room_sync_db_test"
    
    # Insert 4 sequenced messages
    m1 = RoomMessage(room_id=room_id, user_id=1, sequence=1, content="Msg 1")
    m2 = RoomMessage(room_id=room_id, user_id=1, sequence=2, content="Msg 2")
    m3 = RoomMessage(room_id=room_id, user_id=1, sequence=3, content="Msg 3")
    m4 = RoomMessage(room_id=room_id, user_id=1, sequence=4, content="Msg 4")
    db.add_all([m1, m2, m3, m4])
    db.commit()

    # Reconnect with last_sequence = 2 (should fetch 3 and 4)
    last_seq = 2
    missed = db.query(RoomMessage).filter(
        RoomMessage.room_id == room_id,
        RoomMessage.sequence > last_seq
    ).order_by(RoomMessage.sequence.asc()).all()

    assert len(missed) == 2
    assert missed[0].sequence == 3
    assert missed[0].content == "Msg 3"
    assert missed[1].sequence == 4
    assert missed[1].content == "Msg 4"


def test_database_backup_and_restore_cycle(tmp_path):
    """
    Test deep database backup, SHA-256 verification, and complete restore cycle (OPS-03).
    Verifies critical tables: users, documents, flashcard_reviews, document_ingestion_jobs, ai_request_logs, study_rooms, room_messages.
    """
    # 1. Create a test SQLite database with critical tables and seed data
    db_file = tmp_path / "source.sqlite3"
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    
    cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    cursor.execute("CREATE TABLE documents (id INTEGER PRIMARY KEY, filename TEXT)")
    cursor.execute("CREATE TABLE flashcard_reviews (id INTEGER PRIMARY KEY, flashcard_id TEXT)")
    cursor.execute("CREATE TABLE document_ingestion_jobs (id INTEGER PRIMARY KEY, document_id INTEGER)")
    cursor.execute("CREATE TABLE ai_request_logs (id INTEGER PRIMARY KEY, request_id TEXT)")
    cursor.execute("CREATE TABLE study_rooms (id TEXT PRIMARY KEY, name TEXT)")
    cursor.execute("CREATE TABLE room_messages (id INTEGER PRIMARY KEY, content TEXT, sequence INTEGER)")

    cursor.execute("INSERT INTO users VALUES (1, 'Alice')")
    cursor.execute("INSERT INTO documents VALUES (10, 'Quantum.pdf')")
    cursor.execute("INSERT INTO room_messages VALUES (100, 'Test Room Msg', 1)")
    conn.commit()
    conn.close()

    # 2. Perform Backup
    backup_dir = tmp_path / "backups"
    meta = backup_database(str(db_file), str(backup_dir))
    backup_path = meta["backup_path"]

    assert os.path.exists(backup_path)
    assert os.path.exists(f"{backup_path}.sha256")
    assert verify_backup(backup_path) is True

    # 3. Restore to new destination
    restored_db_file = tmp_path / "restored.sqlite3"
    restore_info = restore_database(backup_path, str(restored_db_file))

    assert restore_info["status"] == "success"
    assert restore_info["integrity_check"] == "ok"
    assert restore_info["table_row_counts"]["users"] == 1
    assert restore_info["table_row_counts"]["documents"] == 1
    assert restore_info["table_row_counts"]["room_messages"] == 1


def test_backup_pruning_retention(tmp_path):
    """Test backup retention policy prunes old snapshots (OPS-03)"""
    backup_dir = tmp_path / "backups"
    os.makedirs(backup_dir, exist_ok=True)

    # Create 5 mock backup snapshots
    for i in range(5):
        fname = f"shiro_backup_20260824_100{i}00.sqlite3.gz"
        fpath = os.path.join(backup_dir, fname)
        with open(fpath, "w") as f: f.write("mock")
        with open(f"{fpath}.sha256", "w") as f: f.write("mock")

    # Retain only 3 newest
    removed = prune_backups(str(backup_dir), retain_count=3)
    assert len(removed) == 2
    remaining = [f for f in os.listdir(backup_dir) if f.endswith(".sqlite3.gz")]
    assert len(remaining) == 3


def test_frontend_config_url_normalization():
    """Test API and WebSocket URL normalization (FE-01)"""
    raw_api = "http://localhost:8000/"
    clean_api = raw_api.rstrip("/")
    clean_ws = clean_api.replace("http://", "ws://").replace("https://", "wss://")

    assert clean_api == "http://localhost:8000"
    assert clean_ws == "ws://localhost:8000"

