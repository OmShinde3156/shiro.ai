import sqlite3
import json

conn = sqlite3.connect('Backend/study_guide.db')
cursor = conn.cursor()

tables = ["users", "documents", "quizzes", "quiz_results", "flashcard_sets", "flashcard_progress", "chat_history", "summaries", "podcasts", "mindmaps", "study_timetables", "timetable_progress"]
counts = {}

for table in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        counts[table] = cursor.fetchone()[0]
    except Exception as e:
        counts[table] = str(e)

print(json.dumps(counts, indent=2))
conn.close()
