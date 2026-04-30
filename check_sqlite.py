import sqlite3
import os

# Connect to SQLite database
db_path = 'db.sqlite3'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("SQLite tables:", [table[0] for table in tables])

    # Check data in our app tables
    app_tables = ['core_userprofile', 'analysis_tireanalysis']
    for table in app_tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            count = cursor.fetchone()[0]
            print(f"{table}: {count} records")
        except sqlite3.OperationalError as e:
            print(f"{table}: Error - {e}")

    conn.close()
else:
    print("SQLite database file not found")