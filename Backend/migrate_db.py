import sqlite3
import os

db_path = os.path.join(os.getcwd(), 'Backend', 'study_guide.db')

if not os.path.exists(db_path):
    # Try just current dir if Backend prefix fails depending on where it's run
    db_path = 'study_guide.db'

print(f"Targeting database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(users)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'avatar_url' not in columns:
        print("Adding 'avatar_url' column to 'users' table...")
        cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT")
        conn.commit()
        print("Column added successfully.")
    else:
        print("Column 'avatar_url' already exists.")
        
    conn.close()
except Exception as e:
    print(f"Error: {e}")
