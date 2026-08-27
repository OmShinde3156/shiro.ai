import os
import gzip
import shutil
import hashlib
import json
import sqlite3
from datetime import datetime
from typing import Dict, Any, List


def calculate_sha256(filepath: str) -> str:
    """Computes SHA-256 checksum of a file"""
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def backup_database(db_path: str, backup_dir: str = "backups") -> Dict[str, Any]:
    """
    Creates a compressed, checksummed database backup snapshot (OPS-03).
    """
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"shiro_backup_{timestamp}.sqlite3.gz"
    backup_path = os.path.join(backup_dir, backup_filename)
    
    # 1. Compress SQLite Database
    with open(db_path, 'rb') as f_in:
        with gzip.open(backup_path, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
            
    # 2. Compute SHA-256 Checksum
    checksum = calculate_sha256(backup_path)
    checksum_file = f"{backup_path}.sha256"
    with open(checksum_file, 'w') as f_chk:
        f_chk.write(checksum)

    metadata = {
        "timestamp": timestamp,
        "backup_file": backup_filename,
        "backup_path": backup_path,
        "original_db": db_path,
        "sha256": checksum,
        "size_bytes": os.path.getsize(backup_path),
        "status": "completed"
    }

    meta_file = f"{backup_path}.json"
    with open(meta_file, 'w') as f_meta:
        json.dump(metadata, f_meta, indent=2)

    return metadata


def verify_backup(backup_path: str) -> bool:
    """Verifies that the backup file matches its SHA-256 checksum (OPS-03)"""
    checksum_file = f"{backup_path}.sha256"
    if not os.path.exists(checksum_file):
        return False
    with open(checksum_file, 'r') as f:
        expected_checksum = f.read().strip()
    return calculate_sha256(backup_path) == expected_checksum


def restore_database(backup_path: str, target_db_path: str) -> Dict[str, Any]:
    """
    Restores database from backup and runs deep integrity validation (OPS-03).
    Verifies critical tables: users, documents, flashcard_reviews, document_ingestion_jobs, ai_request_logs, study_rooms, room_messages.
    """
    # 1. Verify Checksum First
    if not verify_backup(backup_path):
        raise ValueError(f"Backup checksum verification failed for {backup_path}")

    # 2. Decompress to Target
    temp_target = f"{target_db_path}.restoring"
    with gzip.open(backup_path, 'rb') as f_in:
        with open(temp_target, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)

    # 3. Deep Schema & Table Integrity Verification
    conn = sqlite3.connect(temp_target)
    cursor = conn.cursor()
    
    # Run SQLite PRAGMA integrity check
    cursor.execute("PRAGMA integrity_check")
    integrity_result = cursor.fetchone()[0]
    if integrity_result != "ok":
        conn.close()
        os.remove(temp_target)
        raise RuntimeError(f"Database PRAGMA integrity_check failed: {integrity_result}")

    # Check existence and count rows across critical tables
    critical_tables = [
        "users", "documents", "flashcard_reviews",
        "document_ingestion_jobs", "ai_request_logs",
        "study_rooms", "room_messages"
    ]
    table_counts = {}
    for table in critical_tables:
        cursor.execute(f"SELECT count(*) FROM sqlite_master WHERE type='table' AND name='{table}'")
        if cursor.fetchone()[0] == 0:
            conn.close()
            os.remove(temp_target)
            raise RuntimeError(f"Missing critical table in restored database: {table}")
        cursor.execute(f"SELECT count(*) FROM {table}")
        table_counts[table] = cursor.fetchone()[0]

    conn.close()

    # Move verified restored DB to target path
    if os.path.exists(target_db_path):
        os.remove(target_db_path)
    os.rename(temp_target, target_db_path)

    return {
        "status": "success",
        "target_path": target_db_path,
        "integrity_check": integrity_result,
        "table_row_counts": table_counts
    }


def prune_backups(backup_dir: str = "backups", retain_count: int = 7) -> List[str]:
    """Prunes older backups while keeping the most recent N snapshots (OPS-03)"""
    if not os.path.exists(backup_dir):
        return []
    
    backup_files = [
        f for f in os.listdir(backup_dir) 
        if f.startswith("shiro_backup_") and f.endswith(".sqlite3.gz")
    ]
    backup_files.sort(reverse=True) # Newest first

    removed = []
    for old_file in backup_files[retain_count:]:
        full_path = os.path.join(backup_dir, old_file)
        os.remove(full_path)
        if os.path.exists(f"{full_path}.sha256"):
            os.remove(f"{full_path}.sha256")
        if os.path.exists(f"{full_path}.json"):
            os.remove(f"{full_path}.json")
        removed.append(old_file)
        
    return removed
