import sqlite3
from datetime import datetime

DATABASE = "medikiosk.db"

def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection

def print_separator():
    print("=" * 60)

def check_database():
    print_separator()
    print("MediKiosk Database Inspection")
    print(f"Checked at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print_separator()
    
    conn = get_connection()
    
    try:
        # Check patients table structure
        print("\nPATIENTS TABLE STRUCTURE:")
        cursor = conn.execute("PRAGMA table_info(patients)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  - {col[1]}: {col[2]}")
        
        # Count total patients
        cursor = conn.execute("SELECT COUNT(*) as count FROM patients")
        total_patients = cursor.fetchone()['count']
        print(f"\nTotal Patients: {total_patients}")
        
        # Count guests vs registered
        cursor = conn.execute("SELECT COUNT(*) as count FROM patients WHERE is_guest = 1")
        guest_count = cursor.fetchone()['count']
        cursor = conn.execute("SELECT COUNT(*) as count FROM patients WHERE is_guest = 0")
        registered_count = cursor.fetchone()['count']
        print(f"  - Guest Patients: {guest_count}")
        print(f"  - Registered Patients: {registered_count}")
        
        # Count patients with ABHA
        cursor = conn.execute("SELECT COUNT(*) as count FROM patients WHERE abha IS NOT NULL AND abha != 'Guest'")
        abha_count = cursor.fetchone()['count']
        print(f"  - Patients with ABHA: {abha_count}")
        
        # Show latest 5 patients
        print_separator()
        print("LATEST 5 PATIENTS:")
        cursor = conn.execute("SELECT * FROM patients ORDER BY id DESC LIMIT 5")
        patients = cursor.fetchall()
        for patient in patients:
            print(f"\n  ID: {patient['id']}")
            print(f"  Name: {patient['name']}")
            print(f"  Age: {patient['age']}")
            print(f"  Phone: {patient['phone']}")
            print(f"  ABHA: {patient['abha']}")
            print(f"  Guest: {'Yes' if patient['is_guest'] else 'No'}")
        
        # Check symptoms table
        print_separator()
        print("SYMPTOMS TABLE STRUCTURE:")
        cursor = conn.execute("PRAGMA table_info(symptoms)")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  - {col[1]}: {col[2]}")
        
        # Count total symptoms
        cursor = conn.execute("SELECT COUNT(*) as count FROM symptoms")
        total_symptoms = cursor.fetchone()['count']
        print(f"\nTotal Symptom Records: {total_symptoms}")
        
        # Show latest 5 symptoms
        print_separator()
        print("LATEST 5 SYMPTOM RECORDS:")
        cursor = conn.execute("""
            SELECT s.*, p.name as patient_name 
            FROM symptoms s 
            JOIN patients p ON s.patient_id = p.id 
            ORDER BY s.id DESC LIMIT 5
        """)
        symptoms = cursor.fetchall()
        for symptom in symptoms:
            print(f"\n  Symptom ID: {symptom['id']}")
            print(f"  Patient ID: {symptom['patient_id']} ({symptom['patient_name']})")
            print(f"  Symptoms: {symptom['symptoms']}")
            if 'created_at' in symptom:
                print(f"  Created: {symptom['created_at']}")
        
        # Show specific patient search
        print_separator()
        print("SEARCH OPTIONS:")
        print("To search for a specific patient, use the search function below.")
        
    except Exception as e:
        print(f"Error checking database: {e}")
    finally:
        conn.close()
    
    print_separator()
    print("Database inspection complete!")

def search_patient(patient_id=None, name=None):
    """Search for a specific patient by ID or name"""
    conn = get_connection()
    
    try:
        if patient_id:
            cursor = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,))
            patient = cursor.fetchone()
            if patient:
                print_separator()
                print(f"PATIENT FOUND (ID: {patient_id}):")
                print(f"  Name: {patient['name']}")
                print(f"  Age: {patient['age']}")
                print(f"  Phone: {patient['phone']}")
                print(f"  ABHA: {patient['abha']}")
                print(f"  Guest: {'Yes' if patient['is_guest'] else 'No'}")
                
                # Get patient symptoms
                cursor = conn.execute("SELECT * FROM symptoms WHERE patient_id = ? ORDER BY id DESC", (patient_id,))
                symptoms = cursor.fetchall()
                print(f"\n  Symptoms ({len(symptoms)} records):")
                for symptom in symptoms:
                    print(f"    - {symptom['symptoms']}")
                    if 'created_at' in symptom:
                        print(f"      Created: {symptom['created_at']}")
                print_separator()
            else:
                print(f"Patient with ID {patient_id} not found")
        
        elif name:
            cursor = conn.execute("SELECT * FROM patients WHERE name LIKE ?", (f"%{name}%",))
            patients = cursor.fetchall()
            if patients:
                print_separator()
                print(f"PATIENTS FOUND WITH NAME '{name}':")
                for patient in patients:
                    print(f"  ID: {patient['id']}, Name: {patient['name']}, Age: {patient['age']}, ABHA: {patient['abha']}")
                print_separator()
            else:
                print(f"No patients found with name '{name}'")
        
        else:
            print("Please provide either patient_id or name for search")
            
    except Exception as e:
        print(f"Error searching patient: {e}")
    finally:
        conn.close()

def show_all_patients():
    """Show all patients in the database"""
    conn = get_connection()
    
    try:
        cursor = conn.execute("SELECT * FROM patients ORDER BY id DESC")
        patients = cursor.fetchall()
        
        print_separator()
        print(f"ALL PATIENTS ({len(patients)} total):")
        print_separator()
        
        for patient in patients:
            print(f"ID: {patient['id']:3} | Name: {patient['name']:20} | Age: {patient['age']:3} | ABHA: {str(patient['abha']):20} | Guest: {'Yes' if patient['is_guest'] else 'No'}")
            
    except Exception as e:
        print(f"Error showing all patients: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    print("MediKiosk Database Inspector")
    print("Choose an option:")
    print("1. Check database overview")
    print("2. Search patient by ID")
    print("3. Search patient by name")
    print("4. Show all patients")
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == "1":
        check_database()
    elif choice == "2":
        patient_id = input("Enter patient ID: ").strip()
        if patient_id.isdigit():
            search_patient(patient_id=int(patient_id))
        else:
            print("Invalid patient ID")
    elif choice == "3":
        name = input("Enter patient name: ").strip()
        if name:
            search_patient(name=name)
        else:
            print("Please enter a name")
    elif choice == "4":
        show_all_patients()
    else:
        print("Invalid choice")
