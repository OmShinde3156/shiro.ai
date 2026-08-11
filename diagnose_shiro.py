
import sys
import os
import asyncio
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add Backend to path
sys.path.append(os.path.join(os.getcwd(), "Backend"))

from database.database import engine, SessionLocal, init_db
from database.vector_db import VectorDB
from services.graph_service import GraphService
from models.database import User, Document

async def run_diagnostics():
    print("--- SHIRO DIAGNOSTICS START ---")
    
    # 1. Database Connection & Schema
    print("\n[1/4] Testing SQLite Connection & Schema...")
    try:
        init_db()
        db = SessionLocal()
        # Check tables
        result = db.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
        tables = [row[0] for row in result]
        print(f"Found tables: {', '.join(tables)}")
        
        # Check for guest user
        guest = db.query(User).filter(User.id == 1).first()
        if guest:
            print(f"Guest user exists: {guest.email}")
        else:
            print("Guest user MISSING (Expected for fresh DB)")
        db.close()
    except Exception as e:
        print(f"Database Error: {e}")

    # 2. Vector DB (ChromaDB)
    print("\n[2/4] Testing ChromaDB Persistence...")
    try:
        vdb = VectorDB()
        col = vdb.create_collection("test_diagnostics")
        vdb.add_documents("test_diagnostics", ["This is a test document about AI."], [{"source": "test"}])
        res = vdb.query_documents("test_diagnostics", "What is this about?")
        if res['documents']:
            print(f"ChromaDB Query SUCCESS: {res['documents'][0][0]}")
        else:
            print("ChromaDB Query returned NO results.")
    except Exception as e:
        print(f"ChromaDB Error: {e}")

    # 3. GraphRAG Service (Logic Check)
    print("\n[3/4] Testing GraphService Triplet Logic...")
    try:
        gs = GraphService()
        # Mocking extraction since we don't want to hit real LLM tokens yet
        test_text = "Shiro is an AI that helps students study."
        print(f"GraphService initialized. Checking triplet extraction pattern...")
        # We'll just check if the method exists and if it has the regex/json logic
        if hasattr(gs, "_extract_json"):
            sample_json = '[{"source": "Shiro", "relation": "is", "target": "AI"}]'
            extracted = gs._extract_json(f"Random text {sample_json} more text")
            print(f"Internal JSON extractor test: {extracted}")
        else:
            print("GraphService missing _extract_json method!")
    except Exception as e:
        print(f"GraphService Error: {e}")

    # 4. Sync Check (Relational vs Vector)
    print("\n[4/4] Checking Sync Status...")
    try:
        db = SessionLocal()
        docs = db.query(Document).count()
        print(f"Relational Docs Count: {docs}")
        # In a real sync check, we'd compare IDs in Postgres vs ChromaDB
        print("Sync check requires active document ingestion flow.")
        db.close()
    except Exception as e:
        print(f"Sync Check Error: {e}")

    print("\n--- DIAGNOSTICS COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(run_diagnostics())
