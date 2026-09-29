from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import shutil
from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import datetime
import uuid
import hashlib
import urllib.request
import urllib.parse
import urllib.error
import json
import base64
import time
import random
import re
import math
from database import get_connection, create_tables

load_dotenv()

app = FastAPI(title="MediKiosk API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
create_tables()


class Patient(BaseModel):
    name: str
    age: int
    phone: str
    abha: str = ""
    user_id: str = ""
    password: str = ""
    is_guest: bool = False
    gender: str = ""
    allergies: str = ""
    current_medicines: str = ""
    reports: str = ""
    address: str = ""
    city: str = ""
    state: str = ""
    pincode: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class PatientUpdateRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[Union[int, str]] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    symptoms: Optional[str] = None
    current_medicines: Optional[str] = None
    allergies: Optional[str] = None


class LocationUpdateRequest(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CoordinatesRequest(BaseModel):
    latitude: float
    longitude: float


class GeocodeRequest(BaseModel):
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None


class LoginRequest(BaseModel):
    user_id: str
    password: str


class VisitCreate(BaseModel):
    patient_id: int
    symptoms: str
    duration: str = ""
    priority: str
    risk_indicators: str = ""
    healthcare_pathway: str
    summary: str


class Symptom(BaseModel):
    patient_id: int
    symptoms: str


class AppointmentCreate(BaseModel):
    token: str
    patient_id: str
    patient_name: str
    doctor_id: str = ""
    doctor_name: str
    specialty: str
    department: str
    cabin: str
    slot_time: str
    appointment_date: str
    symptom: str = ""
    status: str = "Confirmed"


UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def home():
    return {
        "message": "MediKiosk Backend is running!",
        "status": "success"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.post("/upload-medicine-image")
async def upload_medicine_image(file: UploadFile = File(...)):
    safe_name = os.path.basename(file.filename or f"upload_{int(time.time())}.jpg")
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {
        "message": "Medicine image uploaded successfully",
        "filename": safe_name,
        "path": file_path
    }


@app.post("/identify-medicine")
async def identify_medicine(file: UploadFile = File(...)):
    safe_name = os.path.basename(file.filename or f"upload_{int(time.time())}.jpg")
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # Demo response — AI/database will be connected later
    return {
        "success": True,
        "medicine": {
            "name": "Sample Medicine",
            "composition": "Demo composition",
            "uses": "Demo information",
            "warning": "Please verify medicine details with a qualified healthcare professional."
        },
        "image": file.filename
    }


@app.post("/register-patient")
@app.post("/api/patients/register")
def register_patient(patient: Patient):
    connection = get_connection()
    if not patient.is_guest and (not patient.user_id.strip() or not patient.password):
        connection.close()
        raise HTTPException(status_code=400, detail="User ID and password are required")
    if patient.user_id.strip():
        existing_user = connection.execute(
            "SELECT id FROM patients WHERE lower(user_id) = lower(?)",
            (patient.user_id.strip(),),
        ).fetchone()
        if existing_user:
            connection.close()
            raise HTTPException(status_code=409, detail="That user ID is already in use")

    # Verify Phone Number & Enforce Single Patient ID per Mobile Number
    clean_phone = "".join(filter(str.isdigit, patient.phone or ""))[-10:]
    if not patient.is_guest:
        if len(clean_phone) != 10:
            connection.close()
            raise HTTPException(status_code=422, detail="A valid 10-digit mobile phone number is required.")
        existing_phone = connection.execute(
            """
            SELECT id, user_id, name, phone FROM patients
            WHERE is_guest = 0 AND (
                replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+91', ''), '+', '') LIKE '%' || ?
            )
            ORDER BY id DESC LIMIT 1
            """,
            (clean_phone,),
        ).fetchone()
        if existing_phone:
            existing_uid = existing_phone["user_id"] or f"Patient #{existing_phone['id']}"
            existing_name = existing_phone["name"] or "Registered Patient"
            connection.close()
            raise HTTPException(
                status_code=409,
                detail=f"Mobile number +91 {clean_phone} is already registered with Patient ID: {existing_uid} ({existing_name}). A phone number can only receive one Patient ID. Please sign in with your existing ID."
            )

    existing = None
    if not patient.is_guest and patient.abha and patient.abha != "Guest":
        existing = connection.execute(
            """
            SELECT p.id FROM patients p
            LEFT JOIN visits v ON v.patient_id = p.id
            WHERE p.abha = ?
            GROUP BY p.id
            ORDER BY COUNT(v.id) DESC, p.id DESC
            LIMIT 1
            """,
            (patient.abha,),
        ).fetchone()
    if existing:
        existing_patient = connection.execute(
            "SELECT name FROM patients WHERE id = ?",
            (existing["id"],),
        ).fetchone()
        if existing_patient and existing_patient["name"].strip().casefold() != patient.name.strip().casefold():
            connection.close()
            raise HTTPException(
                status_code=409,
                detail="This ABHA ID is already linked to another patient name. Use the matching name or continue as a guest.",
            )
        connection.execute(
            """
            UPDATE patients
            SET name = ?, age = ?, phone = ?, gender = ?,
                allergies = ?, current_medicines = ?, reports = ?,
                address = ?, city = ?, state = ?, pincode = ?, latitude = ?, longitude = ?
            WHERE id = ?
            """,
            (
                patient.name, patient.age, patient.phone, patient.gender,
                patient.allergies, patient.current_medicines, patient.reports,
                patient.address, patient.city, patient.state, patient.pincode,
                patient.latitude, patient.longitude,
                existing["id"],
            ),
        )
        connection.commit()
        patient_id = existing["id"]
        connection.close()
        return {
            "success": True,
            "message": "Patient profile updated successfully",
            "patient_id": patient_id,
            "patient": patient.dict() | {"id": patient_id},
        }
    cursor = connection.execute(
        """
        INSERT INTO patients
        (name, age, phone, abha, user_id, password_hash, is_guest, gender, allergies, current_medicines, reports, address, city, state, pincode, latitude, longitude)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            patient.name, patient.age, patient.phone, patient.abha, patient.user_id.strip() or None,
            hashlib.sha256(patient.password.encode()).hexdigest() if patient.password else None,
            patient.is_guest,
            patient.gender, patient.allergies, patient.current_medicines, patient.reports,
            patient.address, patient.city, patient.state, patient.pincode,
            patient.latitude, patient.longitude
        )
    )
    connection.commit()
    patient_id = cursor.lastrowid
    connection.close()
    return {
        "success": True,
        "message": "Patient registered successfully",
        "patient_id": patient_id,
        "patient": {
            "name": patient.name,
            "age": patient.age,
            "phone": patient.phone,
            "abha": patient.abha,
            "is_guest": patient.is_guest,
            "gender": patient.gender,
            "allergies": patient.allergies,
            "current_medicines": patient.current_medicines,
            "reports": patient.reports,
            "address": patient.address,
            "city": patient.city,
            "state": patient.state,
            "pincode": patient.pincode,
            "latitude": patient.latitude,
            "longitude": patient.longitude,
        }
    }


@app.get("/patients")
def get_patients():
    connection = get_connection()
    patients = connection.execute(
        "SELECT * FROM patients ORDER BY id DESC"
    ).fetchall()
    connection.close()
    return {
        "success": True,
        "count": len(patients),
        "patients": [dict(patient) for patient in patients]
    }


@app.get("/patients/{patient_id}")
def get_patient(patient_id: Union[int, str]):
    connection = get_connection()
    pid = int(patient_id) if str(patient_id).isdigit() else -1
    patient = connection.execute(
        "SELECT * FROM patients WHERE id = ? OR lower(user_id) = lower(?)",
        (pid, str(patient_id).strip())
    ).fetchone()
    connection.close()
    if patient is None:
        return {
            "success": False,
            "message": "Patient not found"
        }
    return {
        "success": True,
        "patient": dict(patient)
    }


@app.post("/api/patients/{patient_identifier}/update")
def update_patient_info(patient_identifier: str, data: PatientUpdateRequest):
    connection = get_connection()
    pid = int(patient_identifier) if patient_identifier.isdigit() else -1
    patient = connection.execute(
        "SELECT * FROM patients WHERE lower(user_id) = lower(?) OR id = ?",
        (patient_identifier.strip(), pid)
    ).fetchone()
    if patient is None:
        connection.close()
        return {"success": False, "message": "Patient not found in database"}
    
    clean_age = int(data.age) if (data.age is not None and str(data.age).strip().isdigit()) else None
    connection.execute(
        """
        UPDATE patients
        SET name = COALESCE(?, name),
            age = COALESCE(?, age),
            gender = COALESCE(?, gender),
            phone = COALESCE(?, phone),
            address = COALESCE(?, address),
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            pincode = COALESCE(?, pincode),
            latitude = COALESCE(?, latitude),
            longitude = COALESCE(?, longitude),
            current_medicines = COALESCE(?, current_medicines),
            allergies = COALESCE(?, allergies)
        WHERE id = ?
        """,
        (data.name, clean_age, data.gender, data.phone, data.address, data.city, data.state, data.pincode, data.latitude, data.longitude, data.current_medicines, data.allergies, patient["id"])
    )
    connection.commit()
    connection.close()
    return {"success": True, "message": "Patient record updated successfully"}


@app.post("/api/login")
def login_patient(data: LoginRequest):
    connection = get_connection()
    query = """
        SELECT p.* FROM patients p
        LEFT JOIN visits v ON v.patient_id = p.id
        WHERE lower(p.user_id) = lower(?) AND p.password_hash = ?
    """
    params = [data.user_id.strip(), hashlib.sha256(data.password.encode()).hexdigest()]
    query += " GROUP BY p.id ORDER BY COUNT(v.id) DESC, p.id DESC LIMIT 1"
    patient = connection.execute(query, params).fetchone()
    connection.close()
    if patient is None:
        raise HTTPException(status_code=401, detail="Patient could not be authenticated")
    patient_data = dict(patient)
    patient_data.pop("password_hash", None)
    return {"success": True, "patient": patient_data}


@app.get("/api/patient/{patient_id}")
def get_patient_profile(patient_id: int):
    patient_response = get_patient(patient_id)
    if not patient_response.get("success"):
        raise HTTPException(status_code=404, detail="Patient not found")
    connection = get_connection()
    visits = connection.execute(
        "SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date DESC, id DESC",
        (patient_id,),
    ).fetchall()
    connection.close()
    return {"success": True, "patient": patient_response["patient"], "visits": [dict(visit) for visit in visits]}


@app.get("/api/patient/{patient_id}/history")
def get_patient_profile_history(patient_id: int):
    connection = get_connection()
    history = connection.execute(
        "SELECT * FROM medical_history WHERE patient_id = ? ORDER BY visit_date DESC, id DESC",
        (patient_id,),
    ).fetchall()
    connection.close()
    return {"success": True, "patient_id": patient_id, "history": [dict(record) for record in history]}


@app.get("/api/patient/{patient_id}/visits")
def get_patient_visits(patient_id: int):
    connection = get_connection()
    visits = connection.execute(
        "SELECT * FROM visits WHERE patient_id = ? ORDER BY visit_date DESC, id DESC",
        (patient_id,),
    ).fetchall()
    connection.close()
    return {"success": True, "patient_id": patient_id, "visits": [dict(visit) for visit in visits]}


@app.post("/api/visits")
def create_visit(data: VisitCreate):
    if not data.symptoms.strip() or not data.summary.strip():
        raise HTTPException(status_code=422, detail="Symptoms and summary are required")
    if data.healthcare_pathway != "Conventional Healthcare":
        raise HTTPException(status_code=422, detail="Invalid healthcare pathway")
    connection = get_connection()
    patient = connection.execute("SELECT id FROM patients WHERE id = ?", (data.patient_id,)).fetchone()
    if patient is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Patient not found")
    visit_id = f"MK-V-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
    cursor = connection.execute(
        """
        INSERT INTO visits
        (visit_id, patient_id, symptoms, duration, priority, risk_indicators,
         healthcare_pathway, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            visit_id, data.patient_id, data.symptoms.strip(), data.duration,
            data.priority, data.risk_indicators, data.healthcare_pathway,
            data.summary.strip(),
        ),
    )
    connection.commit()
    visit = connection.execute("SELECT * FROM visits WHERE id = ?", (cursor.lastrowid,)).fetchone()
    connection.close()
    return {"success": True, "visit": dict(visit)}


@app.get("/api/visits/{visit_id}")
def get_visit(visit_id: str):
    connection = get_connection()
    visit = connection.execute("SELECT * FROM visits WHERE visit_id = ?", (visit_id,)).fetchone()
    connection.close()
    if visit is None:
        raise HTTPException(status_code=404, detail="Visit not found")
    return {"success": True, "visit": dict(visit)}


@app.post("/symptoms")
def add_symptoms(data: Symptom):
    connection = get_connection()
    cursor = connection.execute(
        """
        INSERT INTO symptoms (patient_id, symptoms)
        VALUES (?, ?)
        """,
        (data.patient_id, data.symptoms)
    )
    connection.commit()
    symptom_id = cursor.lastrowid
    connection.close()
    return {
        "success": True,
        "message": "Symptoms recorded successfully",
        "symptom_id": symptom_id,
        "patient_id": data.patient_id,
        "symptoms": data.symptoms
    }


@app.get("/patients/{patient_id}/symptoms")
def get_patient_symptoms(patient_id: int):
    connection = get_connection()
    symptoms = connection.execute(
        """
        SELECT * FROM symptoms
        WHERE patient_id = ?
        ORDER BY id DESC
        """,
        (patient_id,)
    ).fetchall()
    connection.close()
    return {
        "success": True,
        "patient_id": patient_id,
        "count": len(symptoms),
        "symptoms": [dict(symptom) for symptom in symptoms]
    }


class VoiceSymptom(BaseModel):
    patient_id: int
    transcript: str


@app.post("/voice-symptoms")
def save_voice_symptoms(data: VoiceSymptom):
    connection = get_connection()
    cursor = connection.execute(
        """
        INSERT INTO symptoms (patient_id, symptoms)
        VALUES (?, ?)
        """,
        (data.patient_id, data.transcript)
    )
    connection.commit()
    symptom_id = cursor.lastrowid
    connection.close()
    return {
        "success": True,
        "message": "Voice symptoms recorded successfully",
        "symptom_id": symptom_id,
        "patient_id": data.patient_id,
        "transcript": data.transcript
    }


class TriageRequest(BaseModel):
    symptoms: str
    medical_history: List[str] = []
    medical_history: list[str] = []


class MedicalHistory(BaseModel):
    patient_id: Union[int, str]
    diagnosis: Optional[str] = ""
    symptoms: Optional[str] = ""
    medications: Optional[str] = ""
    notes: Optional[str] = ""


@app.post("/triage")
@app.post("/api/triage")
def triage(data: TriageRequest):
    # FastAPI/Pydantic validates JSON before this handler; normalize values again
    # so matching is safe and malformed history entries cannot affect triage.
    symptoms = str(data.symptoms or "").lower().strip()
    medical_history = {
        str(condition).strip().casefold()
        for condition in data.medical_history
        if isinstance(condition, str) and condition.strip()
    }
    if not symptoms:
        return {
            "success": False,
            "message": "Please enter your symptoms."
        }
    # Emergency symptoms
    emergency_keywords = [
        "chest pain",
        "difficulty breathing",
        "breathing difficulty",
        "severe bleeding",
        "unconscious",
        "fainted",
        "stroke",
        "seizure"
    ]
    # Priority symptoms
    priority_keywords = [
        "high fever",
        "fever",
        "vomiting",
        "severe headache",
        "dizziness",
        "abdominal pain",
        "stomach pain",
        "persistent cough"
    ]
    if "heart disease" in medical_history and "chest pain" in symptoms:
        priority = "high"
        message = (
            "Chest pain with a history of heart disease requires urgent medical "
            "assessment. Please contact a healthcare professional immediately."
        )
    elif any(keyword in symptoms for keyword in emergency_keywords):
        priority = "Emergency"
        message = (
            "Your symptoms may require urgent medical attention. "
            "Please contact a healthcare professional or emergency service immediately."
        )
    elif any(keyword in symptoms for keyword in priority_keywords):
        priority = "Priority"
        message = (
            "Your symptoms should be assessed by a healthcare professional "
            "as soon as reasonably possible."
        )
    else:
        priority = "Routine"
        message = (
            "Your symptoms do not appear to indicate an immediate emergency "
            "based on this basic screening. Please consult a healthcare "
            "professional if symptoms continue or worsen."
        )
    return {
        "success": True,
        "priority": priority,
        "message": message,
        "symptoms": data.symptoms,
        "medical_history": sorted(medical_history)
    }


# Medical History Endpoints
@app.post("/medical-history")
def add_medical_history(history: MedicalHistory):
    connection = get_connection()
    pid = history.patient_id
    if isinstance(pid, str) and (pid.startswith("MK-") or not pid.isdigit()):
        row = connection.execute("SELECT id FROM patients WHERE user_id = ?", (pid,)).fetchone()
        if row:
            pid = row["id"]
        else:
            clean_digits = "".join(filter(str.isdigit, pid))
            pid = int(clean_digits) if clean_digits else 1
    else:
        pid = int(pid)

    cursor = connection.execute(
        """
        INSERT INTO medical_history (patient_id, visit_date, diagnosis, symptoms, medications, notes)
        VALUES (?, CURRENT_DATE, ?, ?, ?, ?)
        """,
        (pid, history.diagnosis, history.symptoms, history.medications, history.notes)
    )
    connection.commit()
    history_id = cursor.lastrowid
    connection.close()
    return {
        "success": True,
        "message": "Medical history added successfully",
        "history_id": history_id,
        "patient_id": history.patient_id
    }


@app.get("/medical-history/{patient_id}")
def get_medical_history(patient_id: str):
    connection = get_connection()
    pid = patient_id
    if pid.startswith("MK-") or not pid.isdigit():
        row = connection.execute("SELECT id FROM patients WHERE user_id = ?", (pid,)).fetchone()
        if row:
            pid = row["id"]
        else:
            clean_digits = "".join(filter(str.isdigit, pid))
            pid = int(clean_digits) if clean_digits else 1
    else:
        pid = int(pid)

    cursor = connection.execute(
        """
        SELECT * FROM medical_history 
        WHERE patient_id = ? 
        ORDER BY visit_date DESC
        """,
        (pid,)
    )
    history = cursor.fetchall()
    connection.close()
    return {
        "success": True,
        "patient_id": patient_id,
        "count": len(history),
        "history": [dict(record) for record in history]
    }


@app.get("/medical-history")
def get_all_medical_history():
    connection = get_connection()
    cursor = connection.execute(
        "SELECT * FROM medical_history ORDER BY visit_date DESC"
    )
    history = cursor.fetchall()
    connection.close()
    return {
        "success": True,
        "count": len(history),
        "history": [dict(record) for record in history]
    }


# ================================================================
# PHONE VERIFICATION & DUPLICATE PREVENTION (ONE ID PER NUMBER)
# ================================================================

@app.get("/api/verify-phone/{phone}")
def verify_phone_availability(phone: str):
    """
    Verifies a 10-digit mobile number:
    - Validates 10-digit format
    - Checks if an existing non-guest patient already has this phone number
    - Returns whether the phone is already registered (with patient info) or available for a new ID
    """
    clean_phone = "".join(filter(str.isdigit, phone or ""))[-10:]
    if len(clean_phone) != 10:
        raise HTTPException(status_code=422, detail="Please enter a valid 10-digit mobile phone number.")

    connection = get_connection()
    existing = connection.execute(
        """
        SELECT id, user_id, name, phone FROM patients
        WHERE is_guest = 0 AND (
            replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+91', ''), '+', '') LIKE '%' || ?
        )
        ORDER BY id DESC LIMIT 1
        """,
        (clean_phone,),
    ).fetchone()
    connection.close()

    if existing:
        return {
            "success": True,
            "registered": True,
            "phone": clean_phone,
            "message": f"Mobile number +91 {clean_phone} is already registered with Patient ID: {existing['user_id'] or existing['id']}.",
            "patient": {
                "user_id": existing["user_id"] or f"Patient #{existing['id']}",
                "name": existing["name"],
                "phone": clean_phone
            }
        }

    return {
        "success": True,
        "registered": False,
        "phone": clean_phone,
        "message": "Mobile number is verified and available for new patient registration."
    }


# ==============================================================================
# APPOINTMENT BOOKING & MANAGEMENT ENDPOINTS
# ==============================================================================

@app.post("/api/appointments")
def create_appointment(data: AppointmentCreate):
    connection = get_connection()
    existing = connection.execute(
        "SELECT id FROM appointments WHERE token = ?",
        (data.token.strip(),)
    ).fetchone()

    if existing:
        connection.execute(
            """
            UPDATE appointments SET
                patient_id = ?, patient_name = ?, doctor_id = ?, doctor_name = ?,
                specialty = ?, department = ?, cabin = ?, slot_time = ?,
                appointment_date = ?, symptom = ?, status = ?
            WHERE token = ?
            """,
            (
                data.patient_id.strip(), data.patient_name.strip(), data.doctor_id.strip(),
                data.doctor_name.strip(), data.specialty.strip(), data.department.strip(),
                data.cabin.strip(), data.slot_time.strip(), data.appointment_date.strip(),
                data.symptom.strip(), data.status.strip(), data.token.strip()
            )
        )
    else:
        connection.execute(
            """
            INSERT INTO appointments (
                token, patient_id, patient_name, doctor_id, doctor_name,
                specialty, department, cabin, slot_time, appointment_date, symptom, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data.token.strip(), data.patient_id.strip(), data.patient_name.strip(),
                data.doctor_id.strip(), data.doctor_name.strip(), data.specialty.strip(),
                data.department.strip(), data.cabin.strip(), data.slot_time.strip(),
                data.appointment_date.strip(), data.symptom.strip(), data.status.strip()
            )
        )
    connection.commit()
    appt = connection.execute("SELECT * FROM appointments WHERE token = ?", (data.token.strip(),)).fetchone()
    connection.close()
    return {
        "success": True,
        "appointment": dict(appt) if appt else data.dict()
    }


@app.get("/api/appointments")
def get_appointments(patient_id: Optional[str] = None):
    connection = get_connection()
    if patient_id:
        clean_pid = patient_id.strip()
        rows = connection.execute(
            """
            SELECT * FROM appointments
            WHERE lower(patient_id) = lower(?) AND status != 'Cancelled'
            ORDER BY id DESC
            """,
            (clean_pid,)
        ).fetchall()
    else:
        rows = connection.execute(
            "SELECT * FROM appointments WHERE status != 'Cancelled' ORDER BY id DESC"
        ).fetchall()
    connection.close()
    return {
        "success": True,
        "count": len(rows),
        "appointments": [dict(r) for r in rows]
    }


@app.post("/api/appointments/{token}/cancel")
@app.delete("/api/appointments/{token}")
def cancel_appointment(token: str):
    connection = get_connection()
    clean_token = token.strip().replace("Token #", "").strip()
    row = connection.execute(
        "SELECT id, token, patient_name, doctor_name FROM appointments WHERE token = ? OR token = ? OR token = ?",
        (token.strip(), clean_token, f"Token #{clean_token}")
    ).fetchone()
    if not row:
        connection.close()
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    connection.execute(
        "UPDATE appointments SET status = 'Cancelled' WHERE id = ?",
        (row["id"],)
    )
    connection.commit()
    connection.close()
    return {
        "success": True,
        "message": f"Appointment {row['token']} with {row['doctor_name']} has been cancelled."
    }


class DoctorRegisterRequest(BaseModel):
    name: str
    specialty: str
    cabin: str
    phone: Optional[str] = ""
    license_no: Optional[str] = ""


class DoctorLoginRequest(BaseModel):
    doctor_id_or_name: str
    password: str


class DoctorApprovalAction(BaseModel):
    status: str  # 'approved' or 'rejected'


def normalize_doctor_name(name: str) -> str:
    cleaned = re.sub(r'^(dr\.|dr|doctor)\s+', '', name.strip(), flags=re.IGNORECASE).strip()
    cleaned = cleaned.split(',')[0].strip()
    return re.sub(r'\s+', ' ', cleaned).lower()


def extract_last_name_and_generate_password(name: str) -> tuple[str, str]:
    cleaned = re.sub(r'^(dr\.|dr|doctor)\s+', '', name.strip(), flags=re.IGNORECASE).strip()
    cleaned = cleaned.split(',')[0].strip()
    tokens = [t for t in cleaned.split() if t]
    if tokens:
        last_name = tokens[-1].capitalize()
    else:
        last_name = "Doctor"
    num = random.randint(1000, 9999)
    password = f"{last_name}{num}"
    return last_name, password


@app.post("/api/doctor/register")
def register_doctor(req: DoctorRegisterRequest):
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Doctor name is required")
    
    clean_phone = re.sub(r'\D', '', req.phone or '').strip()
    clean_license = (req.license_no or '').strip()
    norm_name = normalize_doctor_name(req.name)
    
    connection = get_connection()
    
    # Check if duplicate license, phone, or name already registered (one person, one time)
    all_docs = connection.execute("SELECT * FROM doctors").fetchall()
    for d in all_docs:
        d_norm_name = normalize_doctor_name(d["name"])
        d_clean_phone = re.sub(r'\D', '', d["phone"] or '').strip()
        d_clean_license = (d["license_no"] or '').strip()
        
        # 1. Match License No
        if clean_license and d_clean_license and clean_license.lower() == d_clean_license.lower():
            connection.close()
            raise HTTPException(
                status_code=409,
                detail=f"Doctor with license '{clean_license}' is already registered (Doctor ID: {d['doctor_id']}, Name: {d['name']}). One person can register only one time."
            )
            
        # 2. Match Phone No (last 10 digits)
        if clean_phone and len(clean_phone) >= 10 and d_clean_phone and len(d_clean_phone) >= 10 and clean_phone[-10:] == d_clean_phone[-10:]:
            connection.close()
            raise HTTPException(
                status_code=409,
                detail=f"Doctor with phone '{req.phone}' is already registered (Doctor ID: {d['doctor_id']}, Name: {d['name']}). One person can register only one time."
            )
            
        # 3. Match Normalized Doctor Name
        if norm_name and d_norm_name and norm_name == d_norm_name:
            connection.close()
            raise HTTPException(
                status_code=409,
                detail=f"Doctor '{d['name']}' is already registered (Doctor ID: {d['doctor_id']}). One person can register only one time."
            )

    last_name, password = extract_last_name_and_generate_password(req.name)
    doctor_id = f"DOC-{random.randint(1000, 9999)}"

    connection.execute("""
        INSERT INTO doctors (doctor_id, name, last_name, password, specialty, cabin, phone, license_no, approval_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    """, (
        doctor_id,
        req.name.strip(),
        last_name,
        password,
        req.specialty.strip() or "General OPD",
        req.cabin.strip() or "Cabin 101",
        clean_phone,
        clean_license
    ))
    connection.commit()

    created = connection.execute("SELECT * FROM doctors WHERE doctor_id = ?", (doctor_id,)).fetchone()
    connection.close()

    return {
        "success": True,
        "doctor_id": doctor_id,
        "password": password,
        "last_name": last_name,
        "approval_status": "pending",
        "doctor": dict(created),
        "message": f"Doctor registration submitted. Password generated as '{password}'. Approval request sent to Hospital Admin."
    }


@app.post("/api/doctor/login")
def login_doctor(req: DoctorLoginRequest):
    identifier = req.doctor_id_or_name.strip()
    pwd = req.password.strip()
    if not identifier or not pwd:
        raise HTTPException(status_code=400, detail="Doctor ID / Name and Password are required")

    connection = get_connection()
    all_doctors = connection.execute("SELECT * FROM doctors").fetchall()
    
    clean_id = identifier.lower().strip()
    norm_id = re.sub(r'^(dr\.|dr|doctor)\s+', '', clean_id, flags=re.IGNORECASE).strip()
    clean_numeric = re.sub(r'\D', '', clean_id)
    clean_phone = clean_numeric[-10:] if len(clean_numeric) >= 10 else ""

    doctor = None
    for d in all_doctors:
        d_id = (d["doctor_id"] or "").lower().strip()
        d_num = re.sub(r'\D', '', d_id)
        d_norm_name = normalize_doctor_name(d["name"])
        d_last = (d["last_name"] or "").lower().strip()
        d_phone = re.sub(r'\D', '', d["phone"] or "")

        # Check match criteria
        is_id_match = (d_id == clean_id) or (clean_numeric and d_num and clean_numeric == d_num)
        is_name_match = (norm_id and (norm_id == d_norm_name or norm_id in d_norm_name or d_norm_name in norm_id))
        is_last_match = (norm_id and d_last and norm_id == d_last)
        is_phone_match = bool(clean_phone and d_phone and (clean_phone == d_phone or d_phone.endswith(clean_phone)))

        if is_id_match or is_name_match or is_last_match or is_phone_match:
            doctor = d
            break

    if not doctor:
        connection.close()
        raise HTTPException(
            status_code=401, 
            detail=f"Doctor profile not found for '{identifier}'. Please check your Doctor ID (e.g. DOC-1655) or register first."
        )

    # Case-insensitive, trimmed password verification
    entered_pwd = pwd.strip()
    db_pwd = (doctor["password"] or "").strip()
    if entered_pwd != db_pwd and entered_pwd.lower() != db_pwd.lower():
        connection.close()
        raise HTTPException(
            status_code=401, 
            detail=f"Incorrect password for Doctor {doctor['name']} ({doctor['doctor_id']}). Expected format: {doctor['last_name']} + numbers."
        )

    connection.close()

    status = doctor["approval_status"].lower()
    if status == "pending":
        return {
            "success": True,
            "allowed": False,
            "status": "pending",
            "doctor": dict(doctor),
            "message": "⏳ Approval Pending: Your login request has been sent to the Admin. Please wait for the administrator to approve your account before entering the application."
        }
    elif status == "rejected":
        return {
            "success": True,
            "allowed": False,
            "status": "rejected",
            "doctor": dict(doctor),
            "message": "❌ Access Denied: Your doctor account application has been rejected by the Hospital Administrator."
        }
    else:  # approved
        return {
            "success": True,
            "allowed": True,
            "status": "approved",
            "doctor": dict(doctor),
            "message": f"✓ Access Granted: Welcome, {doctor['name']}!"
        }


@app.get("/api/doctor/approvals")
def get_doctor_approvals():
    connection = get_connection()
    rows = connection.execute("""
        SELECT id, doctor_id, name, last_name, password, specialty, cabin, phone, license_no, approval_status, created_at
        FROM doctors
        ORDER BY CASE WHEN approval_status = 'pending' THEN 0 ELSE 1 END, id DESC
    """).fetchall()
    connection.close()
    return {
        "success": True,
        "count": len(rows),
        "approvals": [dict(r) for r in rows]
    }


@app.get("/api/doctor/registered")
def get_registered_doctors():
    connection = get_connection()
    rows = connection.execute("""
        SELECT id, doctor_id, name, last_name, password, specialty, cabin, phone, license_no, approval_status, created_at
        FROM doctors
        ORDER BY id DESC
    """).fetchall()
    connection.close()
    return {
        "success": True,
        "count": len(rows),
        "doctors": [dict(r) for r in rows]
    }


@app.post("/api/doctor/approvals/{doctor_id}/action")
def action_doctor_approval(doctor_id: str, act: DoctorApprovalAction):
    new_status = act.status.strip().lower()
    if new_status not in ["approved", "rejected", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'approved', 'rejected', or 'pending'")

    connection = get_connection()
    doc = connection.execute("SELECT * FROM doctors WHERE doctor_id = ? OR id = ?", (doctor_id, doctor_id)).fetchone()
    if not doc:
        connection.close()
        raise HTTPException(status_code=404, detail="Doctor not found")

    connection.execute(
        "UPDATE doctors SET approval_status = ? WHERE id = ?",
        (new_status, doc["id"])
    )
    connection.commit()
    updated = connection.execute("SELECT * FROM doctors WHERE id = ?", (doc["id"],)).fetchone()
    connection.close()

    return {
        "success": True,
        "doctor_id": doc["doctor_id"],
        "name": doc["name"],
        "approval_status": new_status,
        "message": f"Doctor {doc['name']} has been {new_status}."
    }


@app.delete("/api/doctor/{doctor_id}")
def delete_doctor(doctor_id: str):
    connection = get_connection()
    doc = connection.execute("SELECT * FROM doctors WHERE doctor_id = ? OR id = ?", (doctor_id, doctor_id)).fetchone()
    if not doc:
        connection.close()
        raise HTTPException(status_code=404, detail="Doctor not found")

    connection.execute("DELETE FROM doctors WHERE id = ?", (doc["id"],))
    connection.commit()
    connection.close()

    return {
        "success": True,
        "message": f"Doctor {doc['name']} ({doc['doctor_id']}) has been deleted."
    }


# =========================================================================
# LOCATION & NEARBY HEALTHCARE RECOMMENDATION APIS
# =========================================================================

CITY_COORDINATES = {
    "831": {"city": "Jamshedpur", "state": "Jharkhand", "lat": 22.8046, "lng": 86.2029},
    "110": {"city": "Delhi", "state": "Delhi", "lat": 28.5282, "lng": 77.2135},
    "400": {"city": "Mumbai", "state": "Maharashtra", "lat": 19.0657, "lng": 72.8682},
    "560": {"city": "Bengaluru", "state": "Karnataka", "lat": 12.9587, "lng": 77.6492},
    "800": {"city": "Patna", "state": "Bihar", "lat": 25.5941, "lng": 85.1582},
    "801": {"city": "Patna", "state": "Bihar", "lat": 25.5941, "lng": 85.1582},
    "411": {"city": "Pune", "state": "Maharashtra", "lat": 18.5312, "lng": 73.8770},
    "700": {"city": "Kolkata", "state": "West Bengal", "lat": 22.4988, "lng": 88.3980},
    "834": {"city": "Ranchi", "state": "Jharkhand", "lat": 23.3857, "lng": 85.3440},
    "226": {"city": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8690, "lng": 80.9160},
    "500": {"city": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lng": 78.4867},
    "600": {"city": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lng": 80.2707},
    "380": {"city": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lng": 72.5714},
    "302": {"city": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lng": 75.7873},
    "452": {"city": "Indore", "state": "Madhya Pradesh", "lat": 22.7196, "lng": 75.8577},
    "751": {"city": "Bhubaneswar", "state": "Odisha", "lat": 20.2961, "lng": 85.8245},
    "160": {"city": "Chandigarh", "state": "Chandigarh", "lat": 30.7333, "lng": 76.7794},
    "682": {"city": "Kochi", "state": "Kerala", "lat": 9.9312, "lng": 76.2673},
    "781": {"city": "Guwahati", "state": "Assam", "lat": 26.1445, "lng": 91.7362},
}


def haversine_km(lat1: Optional[float], lon1: Optional[float], lat2: Optional[float], lon2: Optional[float]) -> float:
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 1.0
    try:
        r = 6371.0
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(r * c, 2)
    except Exception:
        return 1.0


@app.post("/api/patients/{patient_identifier}/location")
def update_patient_location(patient_identifier: str, data: LocationUpdateRequest):
    connection = get_connection()
    pid = int(patient_identifier) if patient_identifier.isdigit() else -1
    patient = connection.execute(
        "SELECT * FROM patients WHERE lower(user_id) = lower(?) OR id = ?",
        (patient_identifier.strip(), pid)
    ).fetchone()
    if patient is None:
        connection.close()
        raise HTTPException(status_code=404, detail="Patient not found")

    connection.execute(
        """
        UPDATE patients
        SET address = COALESCE(?, address),
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            pincode = COALESCE(?, pincode),
            latitude = COALESCE(?, latitude),
            longitude = COALESCE(?, longitude)
        WHERE id = ?
        """,
        (data.address, data.city, data.state, data.pincode, data.latitude, data.longitude, patient["id"])
    )
    connection.commit()
    connection.close()
    return {"success": True, "message": "Patient location updated successfully"}


@app.get("/api/patients/{patient_identifier}/location")
def get_patient_location(patient_identifier: str):
    connection = get_connection()
    pid = int(patient_identifier) if patient_identifier.isdigit() else -1
    patient = connection.execute(
        "SELECT id, user_id, name, address, city, state, pincode, latitude, longitude FROM patients WHERE lower(user_id) = lower(?) OR id = ?",
        (patient_identifier.strip(), pid)
    ).fetchone()
    connection.close()
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "success": True,
        "patient_id": patient["user_id"] or patient["id"],
        "location": {
            "address": patient["address"] or "",
            "city": patient["city"] or "",
            "state": patient["state"] or "",
            "pincode": patient["pincode"] or "",
            "latitude": patient["latitude"],
            "longitude": patient["longitude"],
        }
    }


@app.post("/api/location/reverse-geocode")
def reverse_geocode(data: CoordinatesRequest):
    lat = float(data.latitude)
    lng = float(data.longitude)
    
    # Try Nominatim reverse geocode
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&addressdetails=1"
        req = urllib.request.Request(url, headers={"User-Agent": "MediKiosk/2.0 (healthcare@medikiosk.local)"})
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            addr_data = body.get("address", {})
            road = addr_data.get("road") or addr_data.get("suburb") or addr_data.get("neighbourhood") or "Main Road"
            city = addr_data.get("city") or addr_data.get("town") or addr_data.get("state_district") or "Central"
            state = addr_data.get("state") or "India"
            postcode = "".join(filter(str.isdigit, str(addr_data.get("postcode", ""))))[:6] or "831001"
            return {
                "success": True,
                "address": f"{road}, {city}",
                "city": city,
                "state": state,
                "pincode": postcode,
                "latitude": lat,
                "longitude": lng,
                "display_name": body.get("display_name", f"{road}, {city}")
            }
    except Exception:
        pass

    # Fallback to nearest city in CITY_COORDINATES
    best_city = "Jamshedpur"
    best_state = "Jharkhand"
    best_pin = "831001"
    min_dist = 99999.0
    for pfx, info in CITY_COORDINATES.items():
        d = haversine_km(lat, lng, info["lat"], info["lng"])
        if d < min_dist:
            min_dist = d
            best_city = info["city"]
            best_state = info["state"]
            best_pin = pfx + "001"

    return {
        "success": True,
        "address": f"Main Road, {best_city}",
        "city": best_city,
        "state": best_state,
        "pincode": best_pin,
        "latitude": lat,
        "longitude": lng,
        "display_name": f"Main Road, {best_city}, {best_state} - {best_pin}"
    }


@app.post("/api/location/geocode")
def geocode_address(data: GeocodeRequest):
    pin = (data.pincode or "").strip()[:6]
    pfx = pin[:3] if len(pin) >= 3 else ""

    if pfx in CITY_COORDINATES:
        c = CITY_COORDINATES[pfx]
        return {
            "success": True,
            "latitude": c["lat"],
            "longitude": c["lng"],
            "city": c["city"],
            "state": c["state"],
            "pincode": pin or (pfx + "001")
        }

    # Search by city name
    city_lower = (data.city or "").lower().strip()
    for pfx, c in CITY_COORDINATES.items():
        if c["city"].lower() in city_lower or city_lower in c["city"].lower():
            return {
                "success": True,
                "latitude": c["lat"],
                "longitude": c["lng"],
                "city": c["city"],
                "state": c["state"],
                "pincode": pin or (pfx + "001")
            }

    # Default coordinates (Jamshedpur center)
    return {
        "success": True,
        "latitude": 22.8046,
        "longitude": 86.2029,
        "city": data.city or "Jamshedpur",
        "state": data.state or "Jharkhand",
        "pincode": pin or "831001"
    }


@app.get("/api/nearby/doctors")
def get_nearby_doctors(lat: Optional[float] = None, lng: Optional[float] = None, city: Optional[str] = None, pincode: Optional[str] = None, symptom: Optional[str] = None):
    connection = get_connection()
    clean_pin = (pincode or "").strip()[:6]
    pfx = clean_pin[:3]
    city_name = (city or "").strip()

    # Query matching city or pincode prefix or all approved doctors
    query = "SELECT * FROM doctors WHERE approval_status = 'approved'"
    params = []
    if clean_pin:
        query += " AND (pincode LIKE ? OR city LIKE ?)"
        params.extend([f"{pfx}%", f"%{city_name}%" if city_name else f"%{pfx}%"])

    docs = connection.execute(query, params).fetchall()
    if not docs:
        docs = connection.execute("SELECT * FROM doctors WHERE approval_status = 'approved' LIMIT 20").fetchall()
    connection.close()

    result = []
    for d in docs:
        doc_dict = dict(d)
        doc_lat = doc_dict.get("latitude")
        doc_lng = doc_dict.get("longitude")
        dist = haversine_km(lat, lng, doc_lat, doc_lng) if (lat and lng and doc_lat and doc_lng) else round(random.uniform(0.5, 3.5), 1)
        doc_dict["distanceKm"] = dist
        doc_dict["mapUrl"] = f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(doc_dict['name'] + ' ' + (doc_dict.get('hospital_clinic') or '') + ' ' + (doc_dict.get('address') or ''))}"
        result.append(doc_dict)

    result.sort(key=lambda x: x["distanceKm"])
    return {"success": True, "count": len(result), "doctors": result}


@app.get("/api/nearby/hospitals")
def get_nearby_hospitals(lat: Optional[float] = None, lng: Optional[float] = None, city: Optional[str] = None, pincode: Optional[str] = None):
    # Standard hospitals directory
    clean_pin = (pincode or "").strip()[:6]
    pfx = clean_pin[:3]
    c_info = CITY_COORDINATES.get(pfx, {"city": city or "Local", "state": "State", "lat": lat or 22.8046, "lng": lng or 86.2029})
    c_name = c_info["city"]
    base_lat = lat or c_info["lat"]
    base_lng = lng or c_info["lng"]

    hospitals = [
        {
            "id": f"HOSP-{pfx}-01",
            "name": f"{c_name} Apex Multispeciality Hospital" if pfx != "831" else "Tata Main Hospital (TMH)",
            "type": "Level-1 Trauma & Tertiary Hospital",
            "address": f"Main Hospital Road, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat + 0.005, base_lng + 0.005),
            "phone": "+91-657-222-4561" if pfx == "831" else "+91-11-4713-5000",
            "timing": "Open 24 Hours (Emergency & Casualty)",
            "rating": "4.9 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(c_name + ' Hospital')}"
        },
        {
            "id": f"HOSP-{pfx}-02",
            "name": f"{c_name} Civil District Hospital",
            "type": "Government General Hospital",
            "address": f"Civil Lines, Collectorate Road, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat - 0.008, base_lng + 0.004),
            "phone": "+91-180-011-1002",
            "timing": "Open 24 Hours",
            "rating": "4.5 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote(c_name + ' Civil Hospital')}"
        },
        {
            "id": f"HOSP-{pfx}-03",
            "name": f"Urban Community Health Center (UPHC {c_name})",
            "type": "Primary Health Centre (PHC/CHC)",
            "address": f"Sector 2 Health Post, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat + 0.002, base_lng - 0.006),
            "phone": "+91-180-011-1003",
            "timing": "08:00 AM - 08:00 PM",
            "rating": "4.6 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote('UPHC ' + c_name)}"
        }
    ]
    hospitals.sort(key=lambda x: x["distanceKm"])
    return {"success": True, "count": len(hospitals), "hospitals": hospitals}


@app.get("/api/nearby/pharmacies")
def get_nearby_pharmacies(lat: Optional[float] = None, lng: Optional[float] = None, city: Optional[str] = None, pincode: Optional[str] = None):
    clean_pin = (pincode or "").strip()[:6]
    pfx = clean_pin[:3]
    c_info = CITY_COORDINATES.get(pfx, {"city": city or "Local", "state": "State", "lat": lat or 22.8046, "lng": lng or 86.2029})
    c_name = c_info["city"]
    base_lat = lat or c_info["lat"]
    base_lng = lng or c_info["lng"]

    pharmacies = [
        {
            "id": f"PHARM-{pfx}-01",
            "name": f"Apollo Pharmacy 24/7 {c_name}",
            "type": "24x7 Retail & Emergency Chemist",
            "address": f"Shop 4, Market Complex, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat + 0.002, base_lng + 0.003),
            "phone": "+91-180-020-0101",
            "timing": "Open 24 Hours",
            "rating": "4.9 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote('Apollo Pharmacy ' + c_name)}"
        },
        {
            "id": f"PHARM-{pfx}-02",
            "name": f"Pradhan Mantri Jan Aushadhi Kendra {c_name}",
            "type": "Generic Medicine Store (Govt)",
            "address": f"Opp. Civil Hospital Gate, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat - 0.004, base_lng + 0.002),
            "phone": "+91-180-020-0102",
            "timing": "08:00 AM - 09:30 PM",
            "rating": "4.8 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote('Jan Aushadhi ' + c_name)}"
        },
        {
            "id": f"PHARM-{pfx}-03",
            "name": f"MedPlus Chemist & Druggist {c_name}",
            "type": "Discount Medical Store",
            "address": f"Station Road, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat + 0.007, base_lng - 0.004),
            "phone": "+91-180-020-0103",
            "timing": "07:30 AM - 11:00 PM",
            "rating": "4.7 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote('MedPlus ' + c_name)}"
        }
    ]
    pharmacies.sort(key=lambda x: x["distanceKm"])
    return {"success": True, "count": len(pharmacies), "pharmacies": pharmacies}


@app.get("/api/nearby/diagnostics")
def get_nearby_diagnostics(lat: Optional[float] = None, lng: Optional[float] = None, city: Optional[str] = None, pincode: Optional[str] = None):
    clean_pin = (pincode or "").strip()[:6]
    pfx = clean_pin[:3]
    c_info = CITY_COORDINATES.get(pfx, {"city": city or "Local", "state": "State", "lat": lat or 22.8046, "lng": lng or 86.2029})
    c_name = c_info["city"]
    base_lat = lat or c_info["lat"]
    base_lng = lng or c_info["lng"]

    diagnostics = [
        {
            "id": f"DIAG-{pfx}-01",
            "name": f"Dr. Lal PathLabs {c_name}",
            "type": "NABL Accredited Pathology & Blood Testing",
            "address": f"Ground Floor, Medical Plaza, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat + 0.003, base_lng + 0.004),
            "phone": "+91-180-030-0201",
            "timing": "07:00 AM - 08:30 PM (Home Sample Pickup Available)",
            "rating": "4.9 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote('Dr Lal PathLabs ' + c_name)}"
        },
        {
            "id": f"DIAG-{pfx}-02",
            "name": f"SRL Diagnostics (Agilus) {c_name}",
            "type": "Complete Pathology, X-Ray & Ultrasound",
            "address": f"Opposite City Central Mall, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat - 0.005, base_lng + 0.006),
            "phone": "+91-180-030-0202",
            "timing": "07:30 AM - 09:00 PM",
            "rating": "4.8 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote('SRL Diagnostics ' + c_name)}"
        },
        {
            "id": f"DIAG-{pfx}-03",
            "name": f"Thyrocare & Metropolis Diagnostic Center {c_name}",
            "type": "Preventive Health & Thyroid Checkup Center",
            "address": f"Commercial Complex, Sector 4, {c_name}",
            "city": c_name,
            "pincode": clean_pin or (pfx + "001"),
            "distanceKm": haversine_km(lat, lng, base_lat + 0.008, base_lng - 0.003),
            "phone": "+91-180-030-0203",
            "timing": "06:30 AM - 08:00 PM",
            "rating": "4.7 ⭐",
            "mapUrl": f"https://www.google.com/maps/dir/?api=1&destination={urllib.parse.quote('Thyrocare ' + c_name)}"
        }
    ]
    diagnostics.sort(key=lambda x: x["distanceKm"])
    return {"success": True, "count": len(diagnostics), "diagnostics": diagnostics}


