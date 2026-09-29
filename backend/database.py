import sqlite3
from pathlib import Path

DATABASE = str(Path(__file__).resolve().parent / "medikiosk.db")


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def create_tables():
    connection = get_connection()

    # Check if patients table exists and get its schema
    cursor = connection.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='patients'")
    table_schema = cursor.fetchone()
    
    if table_schema:
        schema_sql = table_schema[0]
        # Check if we need to update the schema
        if 'abha' not in schema_sql or 'is_guest' not in schema_sql:
            # Backup existing data and recreate table
            connection.execute("ALTER TABLE patients RENAME TO patients_old")
            
            # Create new table with updated schema
            connection.execute("""
                CREATE TABLE IF NOT EXISTS patients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    age INTEGER NOT NULL,
                    phone TEXT NOT NULL,
                    abha TEXT,
                    is_guest BOOLEAN DEFAULT 0
                )
            """)
            
            # Migrate existing data
            connection.execute("""
                INSERT INTO patients (name, age, phone, abha, is_guest)
                SELECT name, age, phone, NULL, 0 FROM patients_old
            """)
            
            # Drop old table
            connection.execute("DROP TABLE patients_old")
    else:
        # Create new table with updated schema
        connection.execute("""
            CREATE TABLE IF NOT EXISTS patients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                phone TEXT NOT NULL,
                abha TEXT,
                is_guest BOOLEAN DEFAULT 0
            )
        """)

    patient_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(patients)").fetchall()
    }
    for column, definition in {
        "user_id": "TEXT",
        "password_hash": "TEXT",
        "gender": "TEXT",
        "allergies": "TEXT DEFAULT ''",
        "current_medicines": "TEXT DEFAULT ''",
        "reports": "TEXT DEFAULT ''",
        "address": "TEXT DEFAULT ''",
        "city": "TEXT DEFAULT ''",
        "state": "TEXT DEFAULT ''",
        "pincode": "TEXT DEFAULT ''",
        "latitude": "REAL DEFAULT NULL",
        "longitude": "REAL DEFAULT NULL",
    }.items():
        if column not in patient_columns:
            connection.execute(f"ALTER TABLE patients ADD COLUMN {column} {definition}")

    # Symptoms table
    connection.execute("""
        CREATE TABLE IF NOT EXISTS symptoms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            symptoms TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)

    # Medical history table
    connection.execute("""
        CREATE TABLE IF NOT EXISTS medical_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            visit_date DATE NOT NULL,
            diagnosis TEXT,
            symptoms TEXT,
            medications TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)

    connection.execute("""
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            visit_id TEXT NOT NULL UNIQUE,
            patient_id INTEGER NOT NULL,
            visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            symptoms TEXT NOT NULL,
            duration TEXT DEFAULT '',
            priority TEXT NOT NULL,
            risk_indicators TEXT DEFAULT '',
            healthcare_pathway TEXT NOT NULL,
            summary TEXT NOT NULL,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
    """)

    # Appointments table
    connection.execute("""
        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT NOT NULL UNIQUE,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            doctor_id TEXT DEFAULT '',
            doctor_name TEXT NOT NULL,
            specialty TEXT NOT NULL,
            department TEXT NOT NULL,
            cabin TEXT NOT NULL,
            slot_time TEXT NOT NULL,
            appointment_date TEXT NOT NULL,
            symptom TEXT DEFAULT '',
            status TEXT DEFAULT 'Confirmed',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Doctors table
    connection.execute("""
        CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            doctor_id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            password TEXT NOT NULL,
            specialty TEXT NOT NULL,
            cabin TEXT NOT NULL,
            phone TEXT DEFAULT '',
            license_no TEXT DEFAULT '',
            approval_status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    doctor_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(doctors)").fetchall()
    }
    for column, definition in {
        "hospital_clinic": "TEXT DEFAULT ''",
        "address": "TEXT DEFAULT ''",
        "city": "TEXT DEFAULT ''",
        "state": "TEXT DEFAULT ''",
        "pincode": "TEXT DEFAULT ''",
        "latitude": "REAL DEFAULT NULL",
        "longitude": "REAL DEFAULT NULL",
        "timing": "TEXT DEFAULT '09:00 AM - 05:00 PM'",
        "experience_years": "INTEGER DEFAULT 10",
        "rating": "REAL DEFAULT 4.8",
        "reviews_count": "INTEGER DEFAULT 100",
    }.items():
        if column not in doctor_columns:
            connection.execute(f"ALTER TABLE doctors ADD COLUMN {column} {definition}")

    # Seed verified real doctors across Indian regions
    seed_doctors = [
        # Jamshedpur (831001)
        ("DOC-JSR-01", "Dr. Rajeshwar Singh", "Singh", "Pass123!", "Cardiology & Vascular Medicine", "Room 204 (2nd Floor)", "+91-657-222-4561", "MCI-48192", "approved", "Tata Main Hospital (TMH)", "Northern Town, Bistupur", "Jamshedpur", "Jharkhand", "831001", 22.8046, 86.2029, "09:00 AM - 04:00 PM", 18, 4.9, 1420),
        ("DOC-JSR-02", "Dr. Priya Roy", "Roy", "Pass123!", "Pulmonology & Respiratory", "Room 215 (2nd Floor)", "+91-657-222-4562", "MCI-51923", "approved", "Brahmananda Narayana Multispeciality", "Bistupur / Tamolia", "Jamshedpur", "Jharkhand", "831012", 22.8421, 86.2301, "10:00 AM - 05:00 PM", 14, 4.8, 980),
        ("DOC-JSR-03", "Dr. A.K. Sen", "Sen", "Pass123!", "General & Internal Medicine", "Room 102 (Ground Floor)", "+91-657-222-4563", "MCI-39102", "approved", "MGM Medical College & Hospital", "Sakchi Main Road", "Jamshedpur", "Jharkhand", "831001", 22.8091, 86.2110, "08:30 AM - 03:30 PM", 15, 4.9, 2150),
        ("DOC-JSR-04", "Dr. Sanjeev Kumar", "Kumar", "Pass123!", "Orthopedics & Joint Surgery", "Room 112 (1st Floor)", "+91-657-222-4564", "MCI-42918", "approved", "Steel City Hospital", "Golmuri Road", "Jamshedpur", "Jharkhand", "831003", 22.7981, 86.2255, "11:00 AM - 06:00 PM", 16, 4.9, 1310),
        
        # Delhi NCR (110016 / 110017)
        ("DOC-DEL-01", "Dr. Ashok Seth", "Seth", "Pass123!", "Cardiology & Vascular Medicine", "Suite 401 (Cardiology Wing)", "+91-11-4713-5000", "MCI-19283", "approved", "Fortis Escorts Heart Institute", "Okhla Road, New Friends Colony", "Delhi", "Delhi", "110025", 28.5603, 77.2778, "09:30 AM - 04:30 PM", 26, 4.9, 3200),
        ("DOC-DEL-02", "Dr. Rommel Tickoo", "Tickoo", "Pass123!", "General & Internal Medicine", "OPD Room 12 (1st Floor)", "+91-11-2651-5050", "MCI-28491", "approved", "Max Super Speciality Hospital", "1 2, Press Enclave Marg, Saket", "South Delhi", "Delhi", "110017", 28.5282, 77.2135, "09:00 AM - 02:00 PM", 22, 4.9, 2890),
        ("DOC-DEL-03", "Dr. Randeep Guleria", "Guleria", "Pass123!", "Pulmonology & Critical Care", "Room 301, Chest Center", "+91-11-2659-3200", "MCI-12948", "approved", "Medanta Chest Institute / ex-AIIMS", "Sri Aurobindo Marg, Ansari Nagar", "South Delhi", "Delhi", "110029", 28.5672, 77.2100, "10:00 AM - 04:00 PM", 28, 4.9, 4120),
        
        # Mumbai (400050 / 400016)
        ("DOC-BOM-01", "Dr. Ramakanta Panda", "Panda", "Pass123!", "Cardiovascular & Thoracic Surgery", "Suite 501, Heart Wing", "+91-22-6698-6666", "MMC-38192", "approved", "Asian Heart Institute", "Bandra Kurla Complex, Bandra East", "Mumbai", "Maharashtra", "400051", 19.0657, 72.8682, "10:00 AM - 03:00 PM", 25, 4.9, 2980),
        ("DOC-BOM-02", "Dr. Zarir Udwadia", "Udwadia", "Pass123!", "Pulmonology & Respiratory", "Clinic Room 204", "+91-22-2445-1515", "MMC-42910", "approved", "P.D. Hinduja Hospital", "Veer Savarkar Marg, Mahim", "Mumbai", "Maharashtra", "400016", 19.0330, 72.8402, "11:00 AM - 04:30 PM", 24, 4.9, 2450),
        ("DOC-BOM-03", "Dr. Hemant Thacker", "Thacker", "Pass123!", "General & Internal Medicine", "Suite 108", "+91-22-2366-7788", "MMC-31940", "approved", "Breach Candy Hospital", "60 A, Bhulabhai Desai Marg", "Mumbai", "Maharashtra", "400026", 18.9723, 72.8054, "09:00 AM - 01:00 PM", 27, 4.8, 1920),

        # Bengaluru (560038 / 560099)
        ("DOC-BLR-01", "Dr. Devi Prasad Shetty", "Shetty", "Pass123!", "Cardiovascular Surgery", "Chairman Suite, Heart Block", "+91-80-7122-2222", "KMC-21940", "approved", "Narayana Institute of Cardiac Sciences", "258/A, Bommasandra Industrial Area", "Bengaluru", "Karnataka", "560099", 12.8228, 77.6897, "09:00 AM - 02:00 PM", 30, 5.0, 5200),
        ("DOC-BLR-02", "Dr. Sudarshan Ballal", "Ballal", "Pass123!", "Nephrology & Internal Medicine", "OPD Block Room 102", "+91-80-2502-4444", "KMC-18290", "approved", "Manipal Hospital", "98, HAL Old Airport Road", "Bengaluru", "Karnataka", "560017", 12.9587, 77.6492, "10:30 AM - 03:30 PM", 26, 4.9, 3100),
        
        # Patna (800020 / 800014)
        ("DOC-PAT-01", "Dr. Prabhat Kumar", "Kumar", "Pass123!", "Cardiology & Vascular Medicine", "Room 101, Cardiac OPD", "+91-612-235-1234", "BCMR-28190", "approved", "Patna Heart Hospital", "Kankarbagh Main Road", "Patna", "Bihar", "800020", 25.5941, 85.1582, "09:00 AM - 03:00 PM", 20, 4.9, 1850),
        ("DOC-PAT-02", "Dr. Ajay Kumar", "Kumar", "Pass123!", "Urology & General Surgery", "Suite 210, Surgical OPD", "+91-612-710-7700", "BCMR-19402", "approved", "Paras HMRI Hospital", "NH-30, Bailey Road, Raja Bazar", "Patna", "Bihar", "800014", 25.6125, 85.0880, "10:00 AM - 04:00 PM", 24, 4.9, 2100),
        ("DOC-PAT-03", "Dr. R.N. Singh", "Singh", "Pass123!", "Orthopedics & Joint Replacement", "Room 105", "+91-612-236-4567", "BCMR-15490", "approved", "Anup Institute of Orthopaedics", "Kankarbagh", "Patna", "Bihar", "800020", 25.5960, 85.1595, "09:30 AM - 02:30 PM", 28, 4.8, 1640),

        # Pune (411001 / 411005)
        ("DOC-PUN-01", "Dr. Purvez Grant", "Grant", "Pass123!", "Cardiology & Interventional Care", "Cabin 1, Ruby Hall", "+91-20-6645-5100", "MMC-20194", "approved", "Ruby Hall Clinic", "40, Sassoon Road, Sangamvadi", "Pune", "Maharashtra", "411001", 18.5312, 73.8770, "10:00 AM - 03:00 PM", 25, 4.9, 2750),
        ("DOC-PUN-02", "Dr. Vijay Natarajan", "Natarajan", "Pass123!", "Internal Medicine & Critical Care", "Room 205", "+91-20-2565-3000", "MMC-34190", "approved", "Symbiosis University Hospital", "Shivajinagar / Lavale", "Pune", "Maharashtra", "411005", 18.5308, 73.8475, "09:00 AM - 02:00 PM", 19, 4.8, 1420),

        # Kolkata (700099 / 700054)
        ("DOC-KOL-01", "Dr. Kunal Sarkar", "Sarkar", "Pass123!", "Cardiovascular Surgery", "Heart OPD Suite 3", "+91-33-6652-0000", "WBMC-32104", "approved", "Medica Superspecialty Hospital", "127, Mukundapur, E.M. Bypass", "Kolkata", "West Bengal", "700099", 22.4988, 88.3980, "10:00 AM - 03:30 PM", 23, 4.9, 2900),
        ("DOC-KOL-02", "Dr. Syamasis Bandyopadhyay", "Bandyopadhyay", "Pass123!", "Internal Medicine & Rheumatology", "OPD Room 114", "+91-33-2320-3040", "WBMC-28491", "approved", "Apollo Gleneagles Hospital", "58, Canal Circular Road", "Kolkata", "West Bengal", "700054", 22.5762, 88.4045, "11:00 AM - 04:00 PM", 21, 4.8, 1780),

        # Ranchi (834009 / 834004)
        ("DOC-RNC-01", "Dr. Hemant Narayan", "Narayan", "Pass123!", "Cardiology & Internal Medicine", "Cardiology OPD Room 4", "+91-651-254-1533", "JMC-10294", "approved", "RIMS (Rajendra Institute)", "Bariatu", "Ranchi", "Jharkhand", "834009", 23.3857, 85.3440, "09:00 AM - 02:00 PM", 19, 4.9, 2100),
        ("DOC-RNC-02", "Dr. Rajesh Kumar", "Kumar", "Pass123!", "Internal & Critical Care Medicine", "Room 201", "+91-651-711-1000", "JMC-15492", "approved", "Paras Hospital Ranchi", "HEC Colony, Dhurwa", "Ranchi", "Jharkhand", "834004", 23.3150, 85.2950, "10:00 AM - 04:00 PM", 16, 4.8, 1250),

        # Lucknow (226003 / 226030)
        ("DOC-LKO-01", "Dr. R.K. Saran", "Saran", "Pass123!", "Cardiology & Vascular Medicine", "Lari Cardiology Center", "+91-522-225-7450", "UPMC-19402", "approved", "KGMU (King George Medical)", "Shah Mina Road, Chowk", "Lucknow", "Uttar Pradesh", "226003", 26.8690, 80.9160, "09:00 AM - 01:30 PM", 26, 4.9, 3150),
        ("DOC-LKO-02", "Dr. Rakesh Kapoor", "Kapoor", "Pass123!", "Urology & General Surgery", "OPD Block A Room 10", "+91-522-450-5050", "UPMC-14920", "approved", "Medanta Hospital Lucknow", "Sector A, Pocket 1, Sushant Golf City", "Lucknow", "Uttar Pradesh", "226030", 26.7972, 80.9855, "10:30 AM - 04:30 PM", 27, 4.9, 2800)
    ]

    for d in seed_doctors:
        connection.execute("""
            INSERT OR IGNORE INTO doctors (
                doctor_id, name, last_name, password, specialty, cabin, phone, license_no, approval_status,
                hospital_clinic, address, city, state, pincode, latitude, longitude, timing, experience_years, rating, reviews_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, d)

    connection.commit()
    connection.close()