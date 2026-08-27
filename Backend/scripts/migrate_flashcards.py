import sqlite3
import json
import uuid
import os
from datetime import datetime

def migrate():
    db_path = os.path.join('Backend', 'study_guide.db')
    if not os.path.exists(db_path):
        db_path = 'study_guide.db'
    
    if not os.path.exists(db_path):
        print("Database not found.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Starting Flashcard Migration...")

    try:
        # 1. Create new tables if they don't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS flashcards (
                id TEXT PRIMARY KEY,
                set_id TEXT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                created_at DATETIME,
                FOREIGN KEY (set_id) REFERENCES flashcard_sets (id)
            )
        """)
        
        # 2. Check if the old 'flashcards' column exists in 'flashcard_sets'
        cursor.execute("PRAGMA table_info(flashcard_sets)")
        columns = [c[1] for c in cursor.fetchall()]
        
        if 'flashcards' in columns:
            print("Found old JSON flashcards column. Migrating data...")
            
            # Fetch all old sets
            cursor.execute("SELECT id, document_id, flashcards, created_at FROM flashcard_sets")
            sets = cursor.fetchall()
            
            for s_id, doc_id, cards_json, created_at in sets:
                if not cards_json:
                    continue
                    
                try:
                    cards = json.loads(cards_json)
                    for card in cards:
                        card_id = card.get('id', str(uuid.uuid4()))
                        question = card.get('question', '')
                        answer = card.get('answer', '')
                        
                        # Insert into new flashcards table
                        cursor.execute(
                            "INSERT OR IGNORE INTO flashcards (id, set_id, question, answer, created_at) VALUES (?, ?, ?, ?, ?)",
                            (card_id, s_id, question, answer, created_at)
                        )
                        
                        # Check if progress exists for this card
                        cursor.execute("SELECT id FROM flashcard_progress WHERE flashcard_id = ?", (card_id,))
                        if not cursor.fetchone():
                            # Create initial progress if it doesn't exist
                            # We need user_id, which we can get from document
                            cursor.execute("SELECT user_id FROM documents WHERE id = ?", (doc_id,))
                            user_row = cursor.fetchone()
                            if user_row:
                                user_id = user_row[0]
                                cursor.execute(
                                    "INSERT INTO flashcard_progress (user_id, flashcard_id, ease_factor, interval_days, next_review, review_count) VALUES (?, ?, ?, ?, ?, ?)",
                                    (user_id, card_id, 2.5, 0, created_at, 0)
                                )
                except Exception as e:
                    print(f"Error migrating set {s_id}: {e}")

            # Optionally: we don't drop the column in SQLite easily, but we've moved the data.
            print("Migration complete. Data moved to 'flashcards' table.")
        else:
            print("No old JSON column found. Migration not needed.")

        conn.commit()
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
