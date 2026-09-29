import sqlite3
from datetime import datetime

DATABASE = "medikiosk.db"

def quick_check():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    
    print("=" * 50)
    print("MediKiosk Quick Database Check")
    print(f"Time: {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 50)
    
    # Patient counts
    cursor = conn.execute("SELECT COUNT(*) as count FROM patients")
    total = cursor.fetchone()['count']
    
    cursor = conn.execute("SELECT COUNT(*) as count FROM patients WHERE is_guest = 1")
    guests = cursor.fetchone()['count']
    
    cursor = conn.execute("SELECT COUNT(*) as count FROM patients WHERE is_guest = 0")
    registered = cursor.fetchone()['count']
    
    print(f"Total Patients: {total}")
    print(f"  - Guests: {guests}")
    print(f"  - Registered: {registered}")
    
    # Latest patient
    cursor = conn.execute("SELECT * FROM patients ORDER BY id DESC LIMIT 1")
    latest = cursor.fetchone()
    
    if latest:
        print(f"\nLatest Patient:")
        print(f"  ID: {latest['id']}")
        print(f"  Name: {latest['name']}")
        print(f"  Age: {latest['age']}")
        print(f"  ABHA: {latest['abha']}")
        print(f"  Guest: {'Yes' if latest['is_guest'] else 'No'}")
    
    # Symptoms count
    cursor = conn.execute("SELECT COUNT(*) as count FROM symptoms")
    symptoms = cursor.fetchone()['count']
    print(f"\nTotal Symptom Records: {symptoms}")
    
    conn.close()
    print("=" * 50)

if __name__ == "__main__":
    quick_check()