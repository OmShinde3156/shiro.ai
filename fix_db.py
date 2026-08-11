import sqlite3

def fix_db():
    db_paths = ['study_guide.db', 'Backend/study_guide.db']
    for db_path in db_paths:
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            print(f"--- Migrating {db_path} ---")

            for sql_cmd, msg in [
                ("ALTER TABLE flashcard_sets ADD COLUMN user_id INTEGER", "Added user_id to flashcard_sets"),
                ("ALTER TABLE documents ADD COLUMN content_hash TEXT", "Added content_hash to documents"),
                ("ALTER TABLE documents ADD COLUMN source_url TEXT", "Added source_url to documents"),
                ("ALTER TABLE documents ADD COLUMN video_id TEXT", "Added video_id to documents"),
                ("ALTER TABLE knowledge_edges ADD COLUMN confidence_score FLOAT DEFAULT 1.0", "Added confidence_score to knowledge_edges"),
                ("ALTER TABLE flashcard_progress ADD COLUMN review_count INTEGER DEFAULT 0", "Added review_count to flashcard_progress"),
                ("ALTER TABLE flashcard_progress ADD COLUMN last_reviewed DATETIME", "Added last_reviewed to flashcard_progress"),
            ]:
                try:
                    cursor.execute(sql_cmd)
                    print(msg)
                except Exception as e:
                    pass

            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error opening {db_path}: {e}")

if __name__ == "__main__":
    fix_db()
