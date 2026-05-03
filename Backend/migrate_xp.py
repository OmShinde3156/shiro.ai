import sqlite3
import os

db_path = os.path.join(os.getcwd(), 'Backend', 'study_guide.db')

if not os.path.exists(db_path):
    db_path = 'study_guide.db'

print(f"Targeting database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(users)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'xp' not in columns:
        print("Adding 'xp' column to 'users' table...")
        cursor.execute("ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0")
        conn.commit()
        print("Column 'xp' added successfully.")
    else:
        print("Column 'xp' already exists.")
        
    if 'level' not in columns:
        print("Adding 'level' column to 'users' table...")
        cursor.execute("ALTER TABLE users ADD COLUMN level INTEGER DEFAULT 1")
        conn.commit()
        print("Column 'level' added successfully.")
    else:
        print("Column 'level' already exists.")

    # Update existing users to level 1 if they have level 0 or null
    cursor.execute("UPDATE users SET level = 1 WHERE level IS NULL OR level = 0")
    conn.commit()
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
