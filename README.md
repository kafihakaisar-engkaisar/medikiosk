# MediKiosk — Smart Healthcare Kiosk Platform

MediKiosk is a modern, responsive, and multilingual digital health kiosk web application designed to bridge the gap between patients, primary healthcare facilities, and specialized doctors.

---

## 🌟 Key Features

### 1. Patient Onboarding & ABHA Integration
* **Instant Registration & Sign In**: Unique Patient ID generation (`MK-XXXXX`) with phone verification.
* **ABHA (Ayushman Bharat Health Account)**: Built-in ABHA card generation, ID verification, and demo data filling.
* **Smart Location Detection**:
  * Auto-fill address, city, state, and 6-digit PIN code via the browser Geolocation API and reverse geocoding.
  * Manual address and PIN code entry with automatic region resolution.
  * Privacy-preserving: coordinates used exclusively for nearby healthcare matching.

### 2. Location & Nearby Healthcare Discovery
* **Proximity Matching**: Haversine distance-sorted recommendations for:
  * 👨‍⚕️ **Doctors / Clinics**: Specialty, experience, hospital affiliation, distance, and direct appointment booking.
  * 🏥 **Hospitals & UPHCs**: 24/7 emergency casualty status, government/private types, and directions.
  * 💊 **Pharmacies**: 24/7 open status, home delivery, and Jan Aushadhi generic medicine tags.
  * 🧪 **Diagnostic Centers**: Accredited pathology and radiology testing labs with home collection support.
* **Multi-City Support**: Deterministic regional matrix providing authentic, isolated recommendations across major cities and postal regions across India (e.g. Jamshedpur, Delhi, Bengaluru, Mumbai, Patna, Pune, Kolkata, Ranchi).
* **Maps & Directions**: Direct integration with Google Maps route directions.

### 3. AI-Assisted Clinical Triage & Symptom Checker
* Comprehensive symptom questionnaire with severity and duration assessment.
* Real-time triage priority determination (Low, Medium, High / Emergency).
* Smart vitals checking with automated safety warnings.
* Multilingual voice-guided input support.

### 4. Doctor Consultation & Doctor Dashboard
* Role-based Doctor login, profile registration, and credential management.
* Waiting patient queue management and real-time consultation tracking.
* Digital prescription generation with integrated medication scanner.
* Analytics dashboard tracking daily patient volume and triage breakdown.

### 5. Multilingual Interface
* Full multilingual support across 5 languages:
  * English
  * Hindi (हिन्दी)
  * Hinglish (Hinglish)
  * Bhojpuri (भोजपुरी)
  * Urdu (اردو) with right-to-left (RTL) styling.

### 6. Admin Portal
* Comprehensive patient list management with real-time multi-column search filtering.
* Edit and update patient demographics, address, and PIN codes.
* Doctor verification and approval management.

---

## 🏗️ Project Architecture

```
medikiosk/
├── index.html                   # Primary MediKiosk kiosk and patient portal UI
├── script.js                    # Core application logic, routing, triage, geolocation
├── style.css                    # Responsive styling, accessible themes, and kiosk layout
├── i18n.js                      # Multilingual dictionaries (English, Hindi, Hinglish, Bhojpuri, Urdu)
├── backend/
│   ├── main.py                  # FastAPI application and REST endpoints
│   ├── database.py              # SQLite database schema, migrations, and seeding
│   ├── ai_triage.py             # Rule-based and AI symptom triage engine
│   ├── safety_engine.py         # Clinical safety evaluation engine
│   ├── models.py                # Data models and schemas
│   └── requirements.txt         # Python dependencies
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
* **Python 3.10+**
* Modern Web Browser (Chrome, Edge, Firefox, Safari)

### 1. Start the Backend API Server
```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment
python -m venv venv
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server with Uvicorn
python main.py
```
* Backend runs at: `http://127.0.0.1:8000`
* Interactive API Documentation (Swagger): `http://127.0.0.1:8000/docs`

### 2. Launch the Frontend
Open `index.html` directly in your browser, or serve it using Python's built-in HTTP server:
```bash
# From the project root folder:
python -m http.server 3000
```
Then visit `http://127.0.0.1:3000` in your web browser.

---

## 🔒 Privacy & Permissions
Location coordinates are processed strictly for local healthcare discovery and are never shared or sold. MediKiosk functions fully even if location permissions are denied, with manual address and PIN code fallback options.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
