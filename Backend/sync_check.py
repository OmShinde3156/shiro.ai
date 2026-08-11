
import sys
import os
from sqlalchemy.orm import Session

# Add Backend to path
sys.path.append(os.path.join(os.getcwd(), "Backend"))

from database.database import SessionLocal, engine
from database.vector_db import VectorDB
from models.database import Document

def sync_databases():
    print("--- SHIRO DATABASE CONSISTENCY AUDITOR ---")
    
    db = SessionLocal()
    vector_db = VectorDB()
    
    try:
        # 1. Get all valid collection names from Relational DB
        valid_docs = db.query(Document).all()
        valid_collection_ids = {doc.vector_db_id for doc in valid_docs if doc.vector_db_id}
        doc_map = {doc.vector_db_id: doc.filename for doc in valid_docs if doc.vector_db_id}
        
        print(f"Found {len(valid_collection_ids)} documents in Relational DB.")

        # 2. Get all existing collections from ChromaDB
        # Note: ChromaDB doesn't have a simple 'list_all' in some versions, 
        # but we can check the ones we expect or use the client to list.
        try:
            # PersistentClient has a list_collections() method
            all_collections = vector_db.client.list_collections()
            all_collection_names = [col.name for col in all_collections]
            print(f"Found {len(all_collection_names)} collections in ChromaDB.")
        except Exception as e:
            print(f"Error listing ChromaDB collections: {e}")
            return

        # 3. Identify Orphans (In Chroma but NOT in SQL)
        orphans = [name for name in all_collection_names if name.startswith("doc_") and name not in valid_collection_ids]
        
        if orphans:
            print(f"\n[!] Found {len(orphans)} orphaned collections in ChromaDB.")
            for orphan in orphans:
                print(f"  - Purging orphan: {orphan}")
                try:
                    vector_db.delete_collection(orphan)
                except Exception as e:
                    print(f"    Failed to delete {orphan}: {e}")
            print("Purge complete.")
        else:
            print("\n[+] No orphaned collections found. ChromaDB is clean.")

        # 4. Identify Missing (In SQL but NOT in Chroma)
        missing = [id for id in valid_collection_ids if id not in all_collection_names]
        
        if missing:
            print(f"\n[!] Found {len(missing)} documents missing vector embeddings.")
            for mid in missing:
                print(f"  - Missing: {doc_map.get(mid)} ({mid})")
            print("\nRecommendation: Re-process these documents to restore searchability.")
        else:
            print("[+] All SQL documents have corresponding ChromaDB collections.")

    finally:
        db.close()
        print("\n--- AUDIT COMPLETE ---")

if __name__ == "__main__":
    sync_databases()
