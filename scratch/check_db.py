import sqlite3
import os

db_path = 'trades.db'
if not os.path.exists(db_path):
    print(f"File {db_path} not found")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, type, status, entry_price, pnl, entry_time FROM trade ORDER BY entry_time DESC LIMIT 10")
        rows = cursor.fetchall()
        print("Recent Trades:")
        for row in rows:
            print(row)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
