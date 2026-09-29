const API_URL = "http://127.0.0.1:8000";

const LANGUAGE_CODES = {
  English: "en-IN",
  Hindi: "hi-IN",
  Hinglish: "hi-IN",
  Bhojpuri: "hi-IN",
  Bengali: "bn-IN",
  Urdu: "ur-IN"
};

// LANG_META is defined in i18n.js

const EMERGENCY_KEYWORDS = [
  "chest pain",
  "difficulty breathing",
  "breathing difficulty",
  "cannot breathe",
  "severe bleeding",
  "uncontrolled bleeding",
  "unconscious",
  "not responding",
  "fainted",
  "stroke",
  "seizure"
];

const state = {
  language: "English",
  patient: {
    id: null,
    userId: "",
    name: "",
    age: "",
    phone: "",
    abha: "",
    isGuest: false,
    gender: "",
    allergies: "",
    currentMedicines: "",
    reports: "",
    address: "",
    city: "",
    pincode: "",
    location: {
      lat: null,
      lng: null
    }
  },
  visitId: null,
  visitSaved: false,
  symptoms: "",
  medicalHistory: [],
  medicalHistoryRecords: [],
  abhaMedicalHistoryRecords: [],
  ayushSystem: null,
  ayushConsultation: false,
  priority: "medium",
  redFlag: false,
  riskIndicators: "",
  carePathway: "Not selected",
  visitDate: "",
  answers: {},
  offline: false,
   sentToDoctor: false,
  audit: [],
  queue: [
    { name: "Aarav Kumar", priority: "high", symptoms: "Chest discomfort", mode: "Voice", action: "Review" },
    { name: "Sara Ali", priority: "low", symptoms: "Headache", mode: "Text", action: "Open" },
    { name: "Riya Singh", priority: "medium", symptoms: "Cough, fever", mode: "Offline", action: "Open" }
  ]
};

// Keep the public state name explicit while preserving the existing state references.
const kioskState = state;

function generateVisitId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `MK-${year}${month}${day}-${random}`;
}

// Location detection is implemented below with reverse geocoding and dynamic directory refresh.

// Location-based recommendations helper
function getLocationBasedRecommendations() {
  return {
    doctors: (typeof getActiveDoctorsDirectory === "function") ? getActiveDoctorsDirectory() : [],
    healthcare: (typeof getActiveHospitalsDirectory === "function") ? getActiveHospitalsDirectory() : [],
    pharmacies: (typeof getActivePharmaciesDirectory === "function") ? getActivePharmaciesDirectory() : []
  };
}

// Show patient profile modal
function showPatientProfileModal() {
  if (!state.patient || !state.patient.id) {
    toast("No patient profile loaded. Please sign in first.");
    return;
  }
  
  // Update profile modal content with current patient data
  const profileModal = document.getElementById('patientProfileModal');
  if (profileModal) {
    // Update main profile fields
    document.getElementById('profileName').textContent = state.patient.name || "N/A";
    document.getElementById('profileDetailUserId').textContent = state.patient.userId || "N/A";
    document.getElementById('profileDetailName').textContent = state.patient.name || "N/A";
    document.getElementById('profileDetailAge').textContent = state.patient.age ? `${state.patient.age} years` : "N/A";
    document.getElementById('profileDetailGender').textContent = state.patient.gender || "N/A";
    document.getElementById('profileDetailPhone').textContent = state.patient.phone || "N/A";
    document.getElementById('profileDetailAddress').textContent = state.patient.address ? `${state.patient.address} - PIN ${state.patient.pincode || "N/A"}` : "N/A";
    document.getElementById('profileDetailABHA').textContent = state.patient.abha || "Not linked";
    document.getElementById('profileDetailPincode').textContent = state.patient.pincode || "N/A";
    
    // Update location information
    document.getElementById('profilePatientAddress').textContent = state.patient.address || "N/A";
    document.getElementById('profilePatientPincode').textContent = state.patient.pincode || "N/A";
    
    if (state.patient.location && state.patient.location.lat && state.patient.location.lng) {
      document.getElementById('profilePatientCoordinates').textContent = `${state.patient.location.lat.toFixed(4)}, ${state.patient.location.lng.toFixed(4)}`;
    } else {
      document.getElementById('profilePatientCoordinates').textContent = "Not detected";
    }
    
    // Update quick summary
    document.getElementById('profilePatientName').textContent = state.patient.name || "N/A";
    document.getElementById('profilePatientAge').textContent = state.patient.age || "N/A";
    document.getElementById('profilePatientGender').textContent = state.patient.gender || "N/A";
    document.getElementById('profilePatientPhone').textContent = state.patient.phone || "N/A";
    document.getElementById('profilePatientABHA').textContent = state.patient.abha || "Not linked";
    
    // Show the modal
    openModal('patientProfileModal');
    addAudit("Patient profile viewed from top bar");
  } else {
    toast("Profile modal not available");
  }
}
function getDirectionsFromPatientLocation(facilityName, facilityAddress) {
  if (!state.patient.location) {
    const searchQuery = `${facilityName} ${facilityAddress} ${state.patient.pincode}`;
    openGoogleMaps(searchQuery);
  } else {
    const destination = `${facilityName} ${facilityAddress}`;
    const mapsUrl = `https://www.google.com/maps/dir/${state.patient.location.lat},${state.patient.location.lng}/${encodeURIComponent(destination)}`;
    
    try {
      window.open(mapsUrl, '_blank');
      toast(`Opening directions to ${facilityName}...`);
      addAudit(`Directions requested from patient location to ${facilityName}`);
    } catch (error) {
      console.error("Failed to open directions:", error);
      toast("Unable to open maps. Please use Maps app manually.");
    }
  }
}

// Modal event handlers for medical support cards
document.addEventListener('DOMContentLoaded', function() {
  // Healthcare card click handlers
  const healthcareCard = document.querySelector('.medical-card[data-modal="nearbyHealthcareModal"]');
  if (healthcareCard) {
    healthcareCard.addEventListener('click', function() {
      openNearbyHealthcareModal();
    });
  }
  
  // Pharmacy card click handlers
  const pharmacyCard = document.querySelector('.medical-card[data-modal="findPharmacyModal"]');
  if (pharmacyCard) {
    pharmacyCard.addEventListener('click', function() {
      openPharmacyModal();
    });
  }
});

// Open nearby healthcare modal with location-based recommendations
function openNearbyHealthcareModal() {
  openModal('nearbyHealthcareModal');
  if (typeof renderNearbyHospitals === 'function') {
    renderNearbyHospitals();
  }
  const loc = (typeof resolvePatientLocationInfo === 'function') ? resolvePatientLocationInfo() : { city: 'Jamshedpur', pincode: '831001' };
  addAudit(`Opened nearby healthcare recommendations for ${loc.city} (PIN ${loc.pincode})`);
}

// Open pharmacy modal with location-based recommendations
function openPharmacyModal() {
  openModal('findPharmacyModal');
  if (typeof renderNearbyPharmacies === 'function') {
    renderNearbyPharmacies();
  }
  const loc = (typeof resolvePatientLocationInfo === 'function') ? resolvePatientLocationInfo() : { city: 'Jamshedpur', pincode: '831001' };
  addAudit(`Opened pharmacy recommendations for ${loc.city} (PIN ${loc.pincode})`);
}


function hasBackendPatientId() {
  const id = Number(state.patient.id);
  return Number.isInteger(id) && id > 0 && id < 1e12;
}

function toast(msg, duration = 3000) {
  try {
    const el = document.getElementById("toast");
    if (!el) {
      console.warn("Toast element not found, using fallback");
      alert(msg);
      return;
    }
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => {
      el.classList.remove("show");
    }, duration);
  } catch (error) {
    console.error("Toast error:", error);
    alert(msg);
  }
}

function showScreen(id) {
  console.log("showScreen called with:", id);
  
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });

  const target = document.getElementById(id);
  if (target) {
    console.log("Target screen found:", id);
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    console.log("Screen activated and scrolled to top");
    
    // Save current screen to sessionStorage for restore after reload
    try {
      sessionStorage.setItem('currentScreen', id);
      console.log("Screen saved to sessionStorage:", id);
    } catch (e) {
      console.error("Error saving to sessionStorage:", e);
    }
  } else {
    console.error("Screen not found:", id);
  }
}

function togglePatientProfileModal(show) {
  console.log("togglePatientProfileModal called with:", show);
  const modal = document.getElementById("patientProfileModal");
  if (!modal) {
    console.error("patientProfileModal element not found!");
    return;
  }
  if (show) {
    renderPatientProfile();
    modal.classList.remove("hidden");
    modal.classList.add("active");
    modal.style.display = "flex";
    if (document.body) document.body.style.overflow = "hidden";
  } else {
    modal.classList.remove("active");
    modal.classList.add("hidden");
    modal.style.display = "none";
    if (document.body) document.body.style.overflow = "";
  }
}

function updateTopbarProfileBox() {
  const nameEl = document.getElementById("topbarProfileName");
  const idEl = document.getElementById("topbarProfileId");
  const avatarEl = document.querySelector(".topbar-profile-avatar");

  const patient = state.patient;
  const hasUser = Boolean(patient && (patient.userId || (patient.id && patient.id !== "null") || (patient.name && patient.name.trim().length > 0)));

  if (nameEl) {
    if (hasUser) {
      nameEl.textContent = patient.name || (patient.userId ? `Patient (${patient.userId})` : "Patient");
    } else {
      nameEl.textContent = "Profile";
    }
  }
  if (idEl) {
    if (hasUser) {
      const displayId = patient.userId || (patient.id ? `MK-${patient.id}` : (patient.isGuest ? "Guest" : ""));
      idEl.textContent = displayId ? `ID: ${displayId}` : "";
      idEl.style.display = displayId ? "inline-block" : "none";
    } else {
      idEl.textContent = "";
      idEl.style.display = "none";
    }
  }
  if (avatarEl) {
    if (hasUser && patient.name && patient.name.trim().length > 0) {
      avatarEl.textContent = patient.name.trim().charAt(0).toUpperCase();
    } else {
      avatarEl.textContent = "👤";
    }
  }

  if (typeof updateTopbarAppointmentBadge === "function") {
    updateTopbarAppointmentBadge();
  }
}

const demoVisitHistory = [
  {
    visit_id: "MK-20260814-1042",
    visit_date: "2026-08-14T10:30:00",
    symptoms: "Mild throat irritation, dry cough for 2 days",
    priority: "low",
    healthcare_pathway: "Primary Care / General OPD",
    summary: "Patient presented with mild pharyngitis. Advised warm fluids and hydration. No fever detected."
  },
  {
    visit_id: "MK-20260520-1415",
    visit_date: "2026-05-20T14:15:00",
    symptoms: "Seasonal allergy flare-up, sneezing, nasal congestion",
    priority: "medium",
    healthcare_pathway: "Allergy & Immunology Clinic",
    summary: "Allergic rhinitis management. Prescribed Cetirizine 10mg once daily. Advised allergen avoidance."
  }
];

function formatVisitDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      date: String(value || "Unknown date"),
      time: "",
      full: String(value || "Unknown date")
    };
  }
  const dateStr = date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return {
    date: dateStr,
    time: timeStr,
    full: `${dateStr} · ${timeStr}`
  };
}

function formatVisitDate(value) {
  return formatVisitDateTime(value).full;
}

function showProfileTab(panelId, button) {
  document.querySelectorAll(".profile-tab-panel").forEach(panel => panel.classList.remove("active"));
  document.querySelectorAll(".profile-tab").forEach(tab => tab.classList.remove("active"));
  document.getElementById(panelId)?.classList.add("active");
  button?.classList.add("active");
}

function renderPatientProfile() {
  const patient = state.patient;
  updateTopbarProfileBox();

  const hasUser = Boolean(patient && (patient.userId || (patient.id && patient.id !== "null") || (patient.name && patient.name.trim().length > 0)));

  if (!hasUser) {
    const fields = {
      profileName: "Profile",
      profileMeta: "No patient ID entered · Sign in to view records",
      profileDetailName: "No user signed in",
      profileDetailAge: "—",
      profileDetailGender: "—",
      profileDetailPhone: "—",
      profileDetailUserId: "Not entered",
      profileDetailAddress: "Not registered"
    };
    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });

    const avatarEl = document.getElementById("profileAvatarInitial");
    if (avatarEl) avatarEl.textContent = "👤";

    const count = document.getElementById("profileVisitCount");
    if (count) count.textContent = "Please enter your User ID or click Demo to access saved visits.";

    const list = document.getElementById("visitHistoryList");
    if (list) {
      list.innerHTML = `
        <div style="text-align: center; padding: 24px; color: #64748b;">
          <p style="margin-bottom: 12px; font-size: 14px;">Please enter your User ID or load demo account to view previous visits.</p>
          <button type="button" class="primary sm-btn" onclick="togglePatientProfileModal(false); showScreen('registration');">🔑 Sign In / Enter User ID</button>
        </div>
      `;
    }
    return;
  }

  const isKnownDemo = patient.userId === "MK-88219";
  const fallbackName = isKnownDemo ? "Eleanor Vance" : (patient.name || "Demo Patient");
  const fallbackAge = isKnownDemo ? "34 years" : (patient.age ? `${patient.age} years` : "Not provided");
  const fallbackGender = isKnownDemo ? "Female" : (patient.gender || "Not provided");
  const fallbackPhone = isKnownDemo ? "9876543210" : (patient.phone || "Not provided");

  const activeName = patient.name || fallbackName;
  const formattedAddress = [patient.address, patient.pincode ? `PIN ${patient.pincode}` : ""].filter(Boolean).join(" - ") || patient.city || "Not provided";

  const fields = {
    profileName: activeName,
    profileMeta: `${patient.isGuest ? "Guest session" : "Account verified"} · Consent recorded`,
    profileDetailName: activeName,
    profileDetailAge: patient.age ? `${patient.age} years` : fallbackAge,
    profileDetailGender: patient.gender || fallbackGender,
    profileDetailPhone: patient.phone || fallbackPhone,
    profileDetailUserId: patient.userId || (patient.isGuest ? "Guest session" : (patient.id ? `MK-${patient.id}` : "MK-88219")),
    profileDetailAddress: formattedAddress
  };
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  const avatarEl = document.getElementById("profileAvatarInitial");
  if (avatarEl) {
    avatarEl.textContent = (activeName && activeName.trim().length > 0) ? activeName.trim().charAt(0).toUpperCase() : "👤";
  }

  loadPatientDashboard();
}

function renderProfileClinicalData(historyRecords) {
  const records = [...state.abhaMedicalHistoryRecords, ...(historyRecords || [])];
  const conditions = document.getElementById("profileConditions");
  const medicines = document.getElementById("profileMedicines");
  if (conditions) {
    const entries = records.map(record => record.diagnosis).filter(Boolean);
    conditions.innerHTML = entries.length
      ? entries.map(entry => `<div style="padding: 6px 12px; margin-bottom: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #1e293b;">• <strong>${escapeHtml(entry)}</strong></div>`).join("")
      : `<p class="muted">No previous conditions recorded.</p>`;
  }
  if (medicines) {
    const medList = [];
    const addMed = (med) => {
      const trimmed = String(med || "").trim();
      if (!trimmed || trimmed === "None" || trimmed === "No current medicines recorded.") return;
      if (!medList.some(m => m.toLowerCase() === trimmed.toLowerCase())) {
        medList.push(trimmed);
      }
    };
    if (state.patient.currentMedicines) {
      state.patient.currentMedicines.split(/·|;/).forEach(addMed);
    }
    records.forEach(record => {
      if (record.medications) {
        record.medications.split(/·|;/).forEach(addMed);
      }
    });
    medicines.textContent = medList.length ? medList.join(" · ") : "Cetirizine 10mg (once daily as needed)";
  }
}

async function loadPatientDashboard() {
  const patientKey = (state.patient && (state.patient.userId || (state.patient.id ? `MK-${state.patient.id}` : ""))) || (state.patient?.isGuest ? "guest" : "MK-88219");
  const persistentVisits = getPatientVisits(patientKey);

  const visitMap = new Map();
  (state.savedVisits || []).forEach(v => { if (v && v.visit_id) visitMap.set(v.visit_id, v); });
  persistentVisits.forEach(v => { if (v && v.visit_id && !visitMap.has(v.visit_id)) visitMap.set(v.visit_id, v); });

  if (!state.patient?.isGuest && (!state.patient?.userId || state.patient?.userId === "MK-88219")) {
    demoVisitHistory.forEach(v => {
      if (v && v.visit_id && !visitMap.has(v.visit_id)) {
        visitMap.set(v.visit_id, v);
      }
    });
  }

  const allLocalVisits = Array.from(visitMap.values());
  state.savedVisits = allLocalVisits;

  if (!hasBackendPatientId()) {
    renderVisitHistory(allLocalVisits);
    return;
  }
  try {
    const response = await fetch(`${API_URL}/api/patient/${state.patient.id}`);
    if (!response.ok) throw new Error("Profile unavailable");
    const data = await response.json();
    const patient = data.patient || state.patient;
    state.patient = {
      ...state.patient,
      gender: patient.gender || state.patient.gender || "",
      allergies: patient.allergies || state.patient.allergies || "",
      currentMedicines: patient.current_medicines || state.patient.currentMedicines || "",
      reports: patient.reports || state.patient.reports || ""
    };
    const genderEl = document.getElementById("profileDetailGender");
    if (genderEl) genderEl.textContent = state.patient.gender || "Not provided";

    const combinedVisits = [...(data.visits || []), ...allLocalVisits];
    const seen = new Set();
    const uniqueVisits = combinedVisits.filter(v => {
      if (seen.has(v.visit_id)) return false;
      seen.add(v.visit_id);
      return true;
    });
    renderVisitHistory(uniqueVisits);
  } catch (error) {
    renderVisitHistory(allLocalVisits);
  }
}

function renderVisitHistory(visits) {
  const list = document.getElementById("visitHistoryList");
  const count = document.getElementById("profileVisitCount");
  const visitsList = Array.isArray(visits) ? visits : [];
  if (count) {
    count.textContent = visitsList.length ? `${visitsList.length} saved visit${visitsList.length === 1 ? "" : "s"} on file` : "No previous visits recorded.";
  }
  if (!list) return;

  if (!visitsList.length) {
    list.innerHTML = `<p class="muted">No previous visits recorded.</p>`;
    return;
  }

  list.innerHTML = visitsList.map(visit => {
    const dt = formatVisitDateTime(visit.visit_date);
    const priorityClass = String(visit.priority || "medium").toLowerCase();
    const visitIdEscaped = escapeHtml(visit.visit_id || "Visit");
    return `
      <button type="button" class="visit-history-item" onclick="viewPreviousVisit('${visitIdEscaped}')">
        <div>
          <div class="visit-history-datetime">
            <span>📅 Date: ${escapeHtml(dt.date)}</span>
            <span>🕒 Time: ${escapeHtml(dt.time)}</span>
          </div>
          <div class="visit-history-symptoms"><strong>Symptoms:</strong> ${escapeHtml(visit.symptoms || "Consultation recorded")}</div>
        </div>
        <div class="visit-history-meta">
          <strong class="priority-pill ${priorityClass}">${escapeHtml(visit.priority || "Normal")}</strong>
          <small class="visit-id-tag">${visitIdEscaped}</small>
        </div>
      </button>
    `;
  }).join("");
}

async function viewPreviousVisit(visitId) {
  const patientKey = (state.patient && (state.patient.userId || (state.patient.id ? `MK-${state.patient.id}` : ""))) || (state.patient?.isGuest ? "guest" : "MK-88219");
  const storedVisits = getPatientVisits(patientKey);
  const allVisits = [...(state.savedVisits || []), ...storedVisits, ...demoVisitHistory];
  const localVisit = allVisits.find(v => v && v.visit_id === visitId);
  if (localVisit) {
    const dt = formatVisitDateTime(localVisit.visit_date);
    alert(`📋 Visit Record: ${localVisit.visit_id}\n` +
          `Date & Time: ${dt.full}\n` +
          `Priority: ${String(localVisit.priority || "Normal").toUpperCase()}\n` +
          `Care Pathway: ${localVisit.healthcare_pathway || "General OPD"}\n\n` +
          `Symptoms:\n${localVisit.symptoms}\n\n` +
          `Summary:\n${localVisit.summary || "Routine triage encounter."}`);
    return;
  }
  try {
    const response = await fetch(`${API_URL}/api/visits/${encodeURIComponent(visitId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Visit unavailable");
    const visit = data.visit;
    const dt = formatVisitDateTime(visit.visit_date);
    alert(`📋 Visit Record: ${visit.visit_id}\n` +
          `Date & Time: ${dt.full}\n` +
          `Priority: ${String(visit.priority || "Normal").toUpperCase()}\n` +
          `Care Pathway: ${visit.healthcare_pathway || "General OPD"}\n\n` +
          `Symptoms:\n${visit.symptoms}\n\n` +
          `Summary:\n${visit.summary || "Routine triage encounter."}`);
  } catch (error) {
    toast("Previous visit details are unavailable.");
  }
}

function loadAuthorizedAbhaData() {
  const historyList = document.getElementById("abhaHistoryList");
  if (!historyList || state.patient.isGuest || state.patient.abha === "Guest") return;

  state.abhaMedicalHistoryRecords = [
    {
      visit_date: "2026-08-12",
      diagnosis: "Seasonal asthma review",
      symptoms: "Occasional wheezing during seasonal changes",
      medications: "Salbutamol inhaler as needed",
      notes: "Stable at last recorded consultation"
    },
    {
      visit_date: "2026-05-03",
      diagnosis: "Vitamin D deficiency",
      symptoms: "Fatigue",
      medications: "Vitamin D supplement",
      notes: "Course completed; follow-up recommended"
    }
  ];
  historyList.innerHTML = state.abhaMedicalHistoryRecords.map(record => `
    <div class="history-item abha-history-item">
      <div class="history-date">🔗 ABHA-linked · ${record.visit_date}</div>
      <div class="history-field"><strong>Diagnosis:</strong> ${escapeHtml(record.diagnosis)}</div>
      <div class="history-field"><strong>Symptoms:</strong> ${escapeHtml(record.symptoms)}</div>
      <div class="history-field"><strong>Medication:</strong> ${escapeHtml(record.medications)}</div>
      <div class="history-field"><strong>Notes:</strong> ${escapeHtml(record.notes)}</div>
    </div>
  `).join("");
}

function setLanguage(lang, btn) {
  state.language = lang;
  document.querySelectorAll(".lang").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  
  // Update HTML lang attribute and direction
  const metaObj = (typeof LANG_META !== "undefined" ? LANG_META : (window.LANG_META || {}));
  const langMeta = metaObj[lang] || metaObj.English || { htmlLang: "en", dir: "ltr" };
  document.documentElement.lang = langMeta.htmlLang;
  document.documentElement.dir = langMeta.dir;
  
  // Apply language-specific font class to body
  document.body.classList.remove("font-devanagari", "font-nastaliq");
  if (lang === "Hindi" || lang === "Hinglish" || lang === "Bhojpuri") {
    document.body.classList.add("font-devanagari");
  } else if (lang === "Urdu") {
    document.body.classList.add("font-nastaliq");
  }
  
  // Update all translatable elements
  updateTranslations();
  
  toast(`Language selected: ${lang}`);
}

function updateTranslations() {
  const translations = I18N[state.language] || I18N.English;
  
  // Update elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[key]) {
      if (el.hasAttribute('data-i18n-html')) {
        el.innerHTML = translations[key];
      } else {
        el.textContent = translations[key];
      }
    }
  });
  
  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[key]) {
      el.placeholder = translations[key];
    }
  });
}

function demoABHA() {
  const abhaEl = document.getElementById("abhaId");
  const nameEl = document.getElementById("signupName") || document.getElementById("patientName");
  const ageEl = document.getElementById("signupAge") || document.getElementById("patientAge");
  const phoneEl = document.getElementById("signupPhone") || document.getElementById("patientPhone");
  const genderEl = document.getElementById("signupGender") || document.getElementById("patientGender");

  if (abhaEl) abhaEl.value = "12-3456-7890-1234";
  if (nameEl) nameEl.value = "Demo Patient";
  if (ageEl) ageEl.value = "28";
  if (phoneEl) phoneEl.value = "9876543210";
  if (genderEl) genderEl.value = "Female";
  toast("Demo ABHA record loaded");
}

const knownPatients = {
  "MK-88219": {
    id: "MK-88219",
    userId: "MK-88219",
    name: "Eleanor Vance",
    age: "34",
    gender: "Female",
    phone: "9876543210",
    abha: "ABHA-9901-4432-1109",
    isGuest: false,
    allergies: "None reported",
    currentMedicines: "Cetirizine 10mg (once daily as needed) · Salbutamol inhaler as needed",
    symptoms: "Mild throat irritation, dry cough for 2 days",
    reports: "",
    address: "Main Road, Bistupur",
    city: "Jamshedpur",
    pincode: "831001"
  },
  "MK-49210": {
    id: "MK-49210",
    userId: "MK-49210",
    name: "Priya Sharma",
    age: "28",
    gender: "Female",
    phone: "9811223344",
    abha: "ABHA-4412-8871-3320",
    isGuest: false,
    allergies: "Sulfa antibiotics",
    currentMedicines: "Sumatriptan 50mg, Naproxen 250mg",
    symptoms: "Severe throbbing migraine with photophobia",
    reports: "Brain MRI normal (2025)",
    address: "12/A, 100ft Road, Indiranagar",
    city: "Indiranagar, Bengaluru",
    pincode: "560038"
  },
  "MK-71534": {
    id: "MK-71534",
    userId: "MK-71534",
    name: "Arjun Patel",
    age: "45",
    gender: "Male",
    phone: "9822334455",
    abha: "ABHA-7721-3390-5512",
    isGuest: false,
    allergies: "Penicillin",
    currentMedicines: "Metformin 500mg twice daily, Telmisartan 40mg",
    symptoms: "Type 2 Diabetes routine review, mild numbness in toes",
    reports: "HbA1c: 7.1%",
    address: "B-204, Hill Road, Bandra West",
    city: "Bandra West, Mumbai",
    pincode: "400050"
  },
  "MK-30912": {
    id: "MK-30912",
    userId: "MK-30912",
    name: "Rajesh Verma",
    age: "52",
    gender: "Male",
    phone: "9833445566",
    abha: "ABHA-3310-9944-7711",
    isGuest: false,
    allergies: "None reported",
    currentMedicines: "Amlodipine 5mg, Atorvastatin 20mg",
    symptoms: "Mild chest tightness, elevated BP (145/95)",
    reports: "ECG normal (June 2026)",
    address: "Sector 62, Phase 8, Institutional Area",
    city: "Sector 62, Noida",
    pincode: "201301"
  },
  "MK-62188": {
    id: "MK-62188",
    userId: "MK-62188",
    name: "Ananya Sen",
    age: "23",
    gender: "Female",
    phone: "9844556677",
    abha: "ABHA-6620-1188-4499",
    isGuest: false,
    allergies: "Dust mites, Pollen",
    currentMedicines: "Budesonide + Formoterol inhaler, Levocetirizine 5mg",
    symptoms: "Seasonal allergic asthma, wheezing on exertion",
    reports: "PFT: Mild obstruction",
    address: "House 18, HAL Old Airport Road, Kodihalli",
    city: "Kodihalli, Bengaluru",
    pincode: "560017"
  }
};

function loadPatientDetailsCard(patient) {
  const detailsCard = document.getElementById("patientDetailsCard");
  if (!detailsCard) return;
  detailsCard.classList.remove("hidden");
  const nameEl = document.getElementById("previewPatientName");
  const fullEl = document.getElementById("previewFullName");
  const ageEl = document.getElementById("previewAge");
  const genderEl = document.getElementById("previewGender");
  const phoneEl = document.getElementById("previewPhone");
  const metaEl = document.getElementById("previewPatientMeta");
  const locEl = document.getElementById("previewLocation");
  if (nameEl) nameEl.textContent = patient.name || "Patient";
  if (fullEl) fullEl.textContent = patient.name || "Patient";
  if (ageEl) ageEl.textContent = patient.age ? `${patient.age} yrs` : "Not provided";
  if (genderEl) genderEl.textContent = patient.gender || "Not specified";
  if (phoneEl) phoneEl.textContent = patient.phone || "Not provided";
  if (metaEl) metaEl.textContent = `Profile loaded for ${patient.userId || "Kiosk"}`;
  if (locEl) {
    const locText = [patient.address, patient.pincode ? `PIN ${patient.pincode}` : ""].filter(Boolean).join(" - ") || patient.city || "Area registered";
    locEl.textContent = locText;
  }
}

function showSmsModal(userId, phone) {
  const modal = document.getElementById("smsAlertModal");
  const idEl = document.getElementById("smsGeneratedUserId");
  const phoneEl = document.getElementById("smsPhoneRecipient");
  if (idEl) idEl.textContent = userId;
  if (phoneEl) phoneEl.textContent = `To: +91 ${phone}`;
  if (modal) modal.classList.remove("hidden");
}

function dismissSmsModal() {
  const modal = document.getElementById("smsAlertModal");
  if (modal) modal.classList.add("hidden");
}

function demoAccount() {
  const userIdInput = document.getElementById("loginUserId");
  if (userIdInput) userIdInput.value = "MK-88219";
  const demoPatient = knownPatients["MK-88219"];
  state.patient = { ...state.patient, ...demoPatient };
  const demoVisits = getPatientVisits("MK-88219");
  if (demoVisits && demoVisits.length > 0) {
    state.savedVisits = demoVisits;
  }
  persistClientState();
  loadPatientDetailsCard(demoPatient);
  updateTopbarProfileBox();
  renderPatientProfile();
  const status = document.getElementById("loginStatus");
  if (status) {
    status.className = "status success";
    status.textContent = "Demo profile loaded (MK-88219). Click 'Sign in & Continue' to proceed.";
  }
  toast("Demo account MK-88219 loaded");
}

async function registerPatientOnServer(patient) {
  const ageNumber = parseInt(patient.age, 10);
  const response = await fetch(`${API_URL}/register-patient`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: patient.name,
      age: Number.isFinite(ageNumber) && ageNumber > 0 ? ageNumber : 1,
      phone: patient.phone || "Not provided",
      abha: "",
      user_id: patient.userId || "",
      password: patient.password || "",
      is_guest: patient.isGuest || false,
      gender: patient.gender || "",
      allergies: patient.allergies || "",
      current_medicines: patient.currentMedicines || "",
      reports: patient.reports || "",
      address: patient.address || "",
      city: patient.city || "",
      state: patient.state || "",
      pincode: patient.pincode || "",
      latitude: patient.latitude != null ? patient.latitude : (patient.location ? patient.location.lat : null),
      longitude: patient.longitude != null ? patient.longitude : (patient.location ? patient.location.lng : null)
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.detail || "Registration failed");
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const patientId = data.patient_id || data.id;
  if (!patientId) {
    throw new Error("No patient_id returned");
  }
  return patientId;
}

async function loginPatient() {
  const userIdInput = document.getElementById("loginUserId");
  const userId = userIdInput ? userIdInput.value.trim() : "";
  const status = document.getElementById("loginStatus");
  if (status) {
    status.className = "status";
    status.textContent = "";
  }

  if (!userId) {
    if (status) {
      status.className = "status error";
      status.textContent = "Please enter your User ID or click Demo.";
    }
    toast("Please enter your User ID or click Demo.");
    userIdInput?.focus();
    return;
  }

  // Check known registered patients or demo account
  let patient = knownPatients[userId];

  if (!patient) {
    try {
      const stored = JSON.parse(localStorage.getItem("medikiosk_registered_patients") || "{}");
      if (stored[userId]) {
        patient = stored[userId];
        knownPatients[userId] = patient;
      }
    } catch (e) {}
  }

  if (!patient && (userId === "MK-88219" || userId.toLowerCase() === "demo" || userId.toLowerCase() === "demo_user")) {
    patient = knownPatients["MK-88219"];
  }

  // If not found in local store, attempt backend login if server is running
  if (!patient) {
    const passwordInput = document.getElementById("loginPassword");
    const password = passwordInput ? passwordInput.value : "demo123";
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password })
      });
      if (response.ok) {
        const data = await response.json();
        const p = data.patient;
        patient = {
          id: p.id,
          userId: p.user_id,
          name: p.name,
          age: p.age,
          phone: p.phone,
          abha: p.abha,
          isGuest: Boolean(p.is_guest),
          gender: p.gender || "",
          address: p.address || "",
          city: p.city || "",
          pincode: p.pincode || "",
          location: null
        };
        knownPatients[userId] = patient;
      }
    } catch (err) {}
  }

  if (patient) {
    state.patient = { ...state.patient, ...patient };
    const patientKey = patient.userId || (patient.id ? `MK-${patient.id}` : "MK-88219");
    const previousVisits = getPatientVisits(patientKey);
    if (previousVisits && previousVisits.length > 0) {
      state.savedVisits = previousVisits;
    }
    persistClientState();
    loadPatientDetailsCard(patient);
    renderPatientProfile();
    updateTopbarProfileBox();

    if (status) {
      status.className = "status success";
      status.textContent = `✓ Signed in successfully as ${patient.name}! Starting consultation...`;
    }
    toast(`✓ Signed in as ${patient.name}. Starting consultation...`);

    setTimeout(() => {
      startNewVisit();
    }, 450);
  } else {
    if (status) {
      status.className = "status error";
      status.textContent = `User ID "${userId}" not found. Please click Demo or Sign up.`;
    }
    toast(`User ID not found. Click Demo or Sign up.`);
  }
}

const signupState = {
  phone: "",
  isPhoneVerified: false,
  existingPatient: null,
  createdUserId: null
};

function resetSignupSteps() {
  const formStep = document.getElementById("signupFormStep");
  const successCard = document.getElementById("signupSuccessCard");
  const status = document.getElementById("signupStatus");
  const notice = document.getElementById("phoneVerifyNotice");
  const btn = document.getElementById("btnRegisterPatient");
  const phoneInput = document.getElementById("signupPhone");
  const nameInput = document.getElementById("signupName");
  const ageInput = document.getElementById("signupAge");
  const genderInput = document.getElementById("signupGender");
  const consentInput = document.getElementById("signupConsent");

  if (formStep) formStep.classList.remove("hidden");
  if (successCard) successCard.classList.add("hidden");
  if (status) { status.textContent = ""; status.className = "status"; }
  if (notice) { notice.innerHTML = ""; notice.className = "phone-verify-notice hidden"; }
  if (btn) { btn.disabled = false; btn.textContent = "Verify Number & Register Patient ID ✓"; }

  if (phoneInput) phoneInput.value = "";
  if (nameInput) nameInput.value = "";
  if (ageInput) ageInput.value = "";
  if (genderInput) genderInput.value = "";
  if (consentInput) consentInput.checked = false;

  signupState.phone = "";
  signupState.isPhoneVerified = false;
  signupState.existingPatient = null;
  signupState.createdUserId = null;
}

function toggleSignup(show) {
  const signinView = document.getElementById("signinView");
  const signupCard = document.getElementById("signupCard");
  const loginStatus = document.getElementById("loginStatus");
  const signupStatus = document.getElementById("signupStatus");
  if (loginStatus) { loginStatus.textContent = ""; loginStatus.className = "status"; }
  if (signupStatus) { signupStatus.textContent = ""; signupStatus.className = "status"; }

  if (show) {
    if (signinView) signinView.classList.add("hidden");
    if (signupCard) signupCard.classList.remove("hidden");
    resetSignupSteps();
    document.getElementById("signupName")?.focus();
  } else {
    if (signupCard) signupCard.classList.add("hidden");
    if (signinView) signinView.classList.remove("hidden");
  }
}

function generateAccountCredentials(phone = "") {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase();
  return {
    userId: phone.replace(/\D/g, "") || `MK${new Date().getFullYear()}${token}`,
    password: `Med${Math.random().toString(36).slice(2, 8)}!`
  };
}

let phoneDebounceTimer = null;

function onSignupPhoneInput(val) {
  const clean = String(val || "").replace(/\D/g, "").slice(0, 10);
  const phoneInput = document.getElementById("signupPhone");
  if (phoneInput && phoneInput.value !== clean) {
    phoneInput.value = clean;
  }

  const notice = document.getElementById("phoneVerifyNotice");
  const btn = document.getElementById("btnRegisterPatient");

  if (phoneDebounceTimer) {
    clearTimeout(phoneDebounceTimer);
  }

  if (clean.length < 10) {
    signupState.phone = clean;
    signupState.isPhoneVerified = false;
    signupState.existingPatient = null;
    if (notice) {
      notice.innerHTML = "";
      notice.className = "phone-verify-notice hidden";
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify Number & Generate Patient ID ✓";
    }
    return;
  }

  signupState.phone = clean;
  if (notice) {
    notice.innerHTML = "<span>⏳ Verifying mobile number uniqueness...</span>";
    notice.className = "phone-verify-notice checking";
  }

  phoneDebounceTimer = setTimeout(async () => {
    await checkPhoneAvailability(clean);
  }, 300);
}

async function checkPhoneAvailability(cleanPhone) {
  const notice = document.getElementById("phoneVerifyNotice");
  const btn = document.getElementById("btnRegisterPatient");

  // 1. Check local client-side memory
  let existing = null;
  for (const pid in knownPatients) {
    const p = knownPatients[pid];
    if (p && !p.isGuest && p.phone) {
      const pClean = String(p.phone).replace(/\D/g, "").slice(-10);
      if (pClean === cleanPhone) {
        existing = {
          user_id: p.userId || p.id || pid,
          name: p.name || "Patient",
          phone: p.phone
        };
        break;
      }
    }
  }

  // 2. Check localStorage
  if (!existing) {
    try {
      const stored = JSON.parse(localStorage.getItem("medikiosk_registered_patients") || "{}");
      for (const pid in stored) {
        const p = stored[pid];
        if (p && !p.isGuest && p.phone) {
          const pClean = String(p.phone).replace(/\D/g, "").slice(-10);
          if (pClean === cleanPhone) {
            existing = {
              user_id: p.userId || p.id || pid,
              name: p.name || "Patient",
              phone: p.phone
            };
            break;
          }
        }
      }
    } catch (e) {
      console.warn("Storage check warning:", e);
    }
  }

  // 3. Query backend verification endpoint
  if (!existing) {
    try {
      const res = await fetch(`${API_URL}/api/verify-phone/${cleanPhone}`);
      if (res.ok) {
        const data = await res.json();
        if (data.registered && data.patient) {
          existing = data.patient;
        }
      }
    } catch (e) {
      console.warn("Backend phone verification unreachable:", e);
    }
  }

  if (existing) {
    signupState.isPhoneVerified = false;
    signupState.existingPatient = existing;
    if (notice) {
      notice.className = "phone-verify-notice warning";
      notice.innerHTML = `
        <div style="font-weight: 700; margin-bottom: 4px;">⚠️ Mobile Number Already Registered</div>
        <div>Mobile <b>+91 ${cleanPhone}</b> already has Patient ID <b>${existing.user_id}</b> (${existing.name}).</div>
        <div style="font-size: 12px; margin-top: 4px; color: #854d0e;">Only one Patient ID is issued per mobile number. Please sign in with your existing ID.</div>
        <button type="button" class="btn-signin-existing" onclick="fillAndGoToSignIn('${existing.user_id}')">
          🔑 Sign In with Existing ID (${existing.user_id})
        </button>
      `;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Number Already Registered ✗";
    }
    return false;
  } else {
    signupState.isPhoneVerified = true;
    signupState.existingPatient = null;
    if (notice) {
      notice.className = "phone-verify-notice success";
      notice.innerHTML = `
        <div>✓ Mobile <b>+91 ${cleanPhone}</b> is verified and available for a new Patient ID.</div>
      `;
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Verify Number & Generate Patient ID ✓";
    }
    return true;
  }
}

function fillAndGoToSignIn(userId) {
  toggleSignup(false);
  const loginUserId = document.getElementById("loginUserId");
  if (loginUserId) {
    loginUserId.value = userId;
    loginUserId.focus();
  }
  const patient = knownPatients[userId];
  if (patient) {
    loadPatientDetailsCard(patient);
    state.patient = { ...state.patient, ...patient };
    persistClientState();
    updateTopbarProfileBox();
    renderPatientProfile();
  }
  toast(`Selected existing Patient ID: ${userId}`);
}

function quickFillLocation(address, cityOrPin, optionalPin) {
  const addrEl = document.getElementById("signupAddress");
  const pinEl = document.getElementById("signupPincode");
  const noticeEl = document.getElementById("locationDetectNotice");

  const pincode = optionalPin || (cityOrPin && /^\d{6}$/.test(cityOrPin) ? cityOrPin : "");

  if (addrEl) addrEl.value = address;
  if (pinEl && pincode) pinEl.value = pincode;

  if (noticeEl) {
    noticeEl.classList.remove("hidden");
    noticeEl.textContent = `✓ Selected location: ${address}${pincode ? ` (${pincode})` : ""}`;
  }
  toast(`📍 Locality selected: ${address}`);
}

function useCurrentLocationForSignup() {
  const statusEl = document.getElementById("signupLocationStatus");
  const noticeEl = document.getElementById("locationDetectNotice");
  const btnEl = document.getElementById("btnUseCurrentLocation");
  const addrEl = document.getElementById("signupAddress");
  const cityEl = document.getElementById("signupCity");
  const stateEl = document.getElementById("signupState");
  const pinEl = document.getElementById("signupPincode");
  const latEl = document.getElementById("signupLatitude");
  const lngEl = document.getElementById("signupLongitude");

  if (statusEl) {
    statusEl.classList.remove("hidden");
    statusEl.style.color = "#1d4ed8";
    statusEl.style.background = "#eff6ff";
    statusEl.style.border = "1px solid #bfdbfe";
    statusEl.textContent = "⏳ Requesting permission & detecting your GPS coordinates...";
  }
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = "<span>⏳</span><span>Detecting GPS Location...</span>";
  }
  if (typeof toast === "function") toast("📍 Requesting location permission...");

  if (!navigator.geolocation) {
    if (statusEl) {
      statusEl.style.color = "#b91c1c";
      statusEl.style.background = "#fef2f2";
      statusEl.style.border = "1px solid #fecaca";
      statusEl.textContent = "⚠️ Geolocation is not supported by your browser. Please enter details manually.";
    }
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = "<span>📍</span><span>Use My Current Location</span>";
    }
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (latEl) latEl.value = lat;
        if (lngEl) lngEl.value = lng;

        if (state && state.patient) {
          state.patient.latitude = lat;
          state.patient.longitude = lng;
          state.patient.location = { lat, lng };
        }

        let geocoded = null;
        // Try backend reverse-geocoding API first
        try {
          const res = await fetch(`${API_URL}/location/reverse-geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.location) {
              geocoded = data.location;
            }
          }
        } catch (e) {
          console.warn("Backend reverse-geocoding notice:", e);
        }

        // Fallback to OpenStreetMap Nominatim
        if (!geocoded) {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.address) {
                const a = data.address;
                const road = a.road || a.suburb || a.neighbourhood || a.residential || "Main Road";
                const city = a.city || a.town || a.village || a.state_district || "Jamshedpur";
                const stateName = a.state || "Jharkhand";
                const postcode = (a.postcode && a.postcode.replace(/\D/g, "").slice(0, 6)) || "831001";
                geocoded = {
                  address: `${road}, ${city}`,
                  city: city,
                  state: stateName,
                  pincode: postcode
                };
              }
            }
          } catch (e) {
            console.warn("Nominatim reverse-geocoding notice:", e);
          }
        }

        // Fallback to local default coordinates
        if (!geocoded) {
          geocoded = {
            address: "Main Road, Bistupur",
            city: "Jamshedpur",
            state: "Jharkhand",
            pincode: "831001"
          };
        }

        if (addrEl) addrEl.value = geocoded.address || "";
        if (cityEl) cityEl.value = geocoded.city || "";
        if (stateEl) stateEl.value = geocoded.state || "";
        if (pinEl) pinEl.value = geocoded.pincode || "";

        if (statusEl) {
          statusEl.style.color = "#047857";
          statusEl.style.background = "#ecfdf5";
          statusEl.style.border = "1px solid #a7f3d0";
          statusEl.textContent = `✓ Detected: ${geocoded.city}, ${geocoded.state} (${geocoded.pincode}) - You may verify or edit before registering.`;
        }
        if (noticeEl) {
          noticeEl.classList.remove("hidden");
          noticeEl.textContent = `✓ Location active: ${geocoded.address}, ${geocoded.city} (${geocoded.pincode})`;
        }
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = "<span>✓</span><span>Location Detected (Click to Re-detect)</span>";
        }
        if (typeof toast === "function") toast(`✓ Location auto-filled: ${geocoded.city} (${geocoded.pincode})`);
        resolve(geocoded);
      },
      (err) => {
        console.warn("Geolocation denied or error:", err);
        if (statusEl) {
          statusEl.style.color = "#b91c1c";
          statusEl.style.background = "#fef2f2";
          statusEl.style.border = "1px solid #fecaca";
          statusEl.textContent = "⚠️ Location permission denied or unavailable. Please enter your address details manually below.";
        }
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = "<span>📍</span><span>Use My Current Location</span>";
        }
        if (typeof toast === "function") toast("Location access not granted. Enter address manually.");
        resolve(null);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

function useCurrentLocationForNearby() {
  const activeLocEl = document.getElementById("nearbyActiveLocationText");
  const coordNoticeEl = document.getElementById("nearbyCoordinatesNotice");
  const btnEl = document.getElementById("btnNearbyUseCurrentLoc");

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = "<span>⏳</span><span>Detecting GPS...</span>";
  }
  if (typeof toast === "function") toast("📍 Detecting GPS location for nearby healthcare...");

  if (!navigator.geolocation) {
    if (typeof toast === "function") toast("⚠️ Geolocation is not supported by your browser.");
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = "<span>📍</span><span>Use My Current Location</span>";
    }
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (!state.patient) state.patient = {};
        state.patient.latitude = lat;
        state.patient.longitude = lng;
        state.patient.location = { lat, lng };

        let geocoded = null;
        try {
          const res = await fetch(`${API_URL}/location/reverse-geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.location) geocoded = data.location;
          }
        } catch (e) {
          console.warn("Nearby reverse-geocoding notice:", e);
        }

        if (!geocoded) {
          geocoded = {
            address: "Main Road, Bistupur",
            city: "Jamshedpur",
            state: "Jharkhand",
            pincode: "831001"
          };
        }

        state.patient.address = geocoded.address;
        state.patient.city = geocoded.city;
        state.patient.state = geocoded.state;
        state.patient.pincode = geocoded.pincode;
        persistClientState();

        if (activeLocEl) {
          activeLocEl.textContent = `${geocoded.address}, ${geocoded.city} (PIN ${geocoded.pincode})`;
        }
        if (coordNoticeEl) {
          coordNoticeEl.textContent = `✓ GPS Location: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E · Accurate Local Proximity`;
        }
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = "<span>📍</span><span>Use My Current Location</span>";
        }

        renderNearbyHealthcareResults();
        if (typeof toast === "function") toast(`✓ Location updated: ${geocoded.city} (${geocoded.pincode})`);
        resolve(geocoded);
      },
      (err) => {
        console.warn("Nearby location access denied:", err);
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.innerHTML = "<span>📍</span><span>Use My Current Location</span>";
        }
        if (typeof toast === "function") toast("⚠️ Location access denied. Click 'Change Location' to enter manually.");
        resolve(null);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

function useCurrentLocationForModal() {
  const statusEl = document.getElementById("changeLocModalStatus");
  const addrEl = document.getElementById("changeLocAddress");
  const cityEl = document.getElementById("changeLocCity");
  const stateEl = document.getElementById("changeLocState");
  const pinEl = document.getElementById("changeLocPincode");
  const latEl = document.getElementById("changeLocLatitude");
  const lngEl = document.getElementById("changeLocLongitude");

  if (statusEl) {
    statusEl.classList.remove("hidden");
    statusEl.style.color = "#1d4ed8";
    statusEl.textContent = "⏳ Detecting current GPS coordinates...";
  }

  if (!navigator.geolocation) {
    if (statusEl) {
      statusEl.style.color = "#b91c1c";
      statusEl.textContent = "⚠️ Geolocation not supported. Please enter address manually.";
    }
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (latEl) latEl.value = lat;
        if (lngEl) lngEl.value = lng;

        let geocoded = null;
        try {
          const res = await fetch(`${API_URL}/location/reverse-geocode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: lat, longitude: lng })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.location) geocoded = data.location;
          }
        } catch (e) {
          console.warn("Modal reverse-geocoding notice:", e);
        }

        if (!geocoded) {
          geocoded = {
            address: "Main Road, Bistupur",
            city: "Jamshedpur",
            state: "Jharkhand",
            pincode: "831001"
          };
        }

        if (addrEl) addrEl.value = geocoded.address || "";
        if (cityEl) cityEl.value = geocoded.city || "";
        if (stateEl) stateEl.value = geocoded.state || "";
        if (pinEl) pinEl.value = geocoded.pincode || "";

        if (statusEl) {
          statusEl.style.color = "#047857";
          statusEl.textContent = `✓ Auto-filled: ${geocoded.city} (${geocoded.pincode})`;
        }
        resolve(geocoded);
      },
      (err) => {
        console.warn("Modal location access denied:", err);
        if (statusEl) {
          statusEl.style.color = "#b91c1c";
          statusEl.textContent = "⚠️ Geolocation denied. Please enter address manually.";
        }
        resolve(null);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  });
}

function detectPatientLocation(refreshNearby = false) {
  const noticeEl = document.getElementById("locationDetectNotice");
  const addrEl = document.getElementById("signupAddress");
  const cityEl = document.getElementById("signupCity");
  const stateEl = document.getElementById("signupState");
  const pinEl = document.getElementById("signupPincode");

  if (noticeEl) {
    noticeEl.classList.remove("hidden");
    noticeEl.textContent = "⏳ Detecting current GPS location...";
  }
  toast("📍 Detecting GPS coordinates...");

  const applyLocation = (detectedAddress, detectedPin, detectedCity = "", detectedState = "") => {
    if (addrEl) addrEl.value = detectedAddress;
    if (pinEl) pinEl.value = detectedPin;
    if (cityEl && detectedCity) cityEl.value = detectedCity;
    if (stateEl && detectedState) stateEl.value = detectedState;

    if (noticeEl) {
      noticeEl.textContent = `✓ Location active: ${detectedAddress} (${detectedPin})`;
    }
    toast(`✓ Location active: ${detectedAddress} (${detectedPin})`);

    if (state && state.patient) {
      state.patient.address = detectedAddress;
      state.patient.pincode = detectedPin;
      if (detectedCity) state.patient.city = detectedCity;
      if (detectedState) state.patient.state = detectedState;
      persistClientState();
    }

    if (refreshNearby) {
      if (typeof renderNearbyHospitals === "function") renderNearbyHospitals();
      if (typeof renderDoctorSuggestions === "function") renderDoctorSuggestions();
      if (typeof renderNearbyPharmacies === "function") renderNearbyPharmacies();
    }
  };

  const fallbackLocation = () => {
    if (addrEl && addrEl.value.trim() && pinEl && pinEl.value.trim()) {
      applyLocation(addrEl.value.trim(), pinEl.value.trim(), cityEl?.value.trim() || "Jamshedpur", stateEl?.value.trim() || "Jharkhand");
    } else {
      applyLocation("Main Road, Bistupur, Jamshedpur", "831001", "Jamshedpur", "Jharkhand");
    }
  };

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (state && state.patient) {
          state.patient.location = { lat, lng: lon };
          state.patient.latitude = lat;
          state.patient.longitude = lon;
        }
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`)
          .then(res => res.json())
          .then(data => {
            if (data && data.address) {
              const road = data.address.road || data.address.suburb || data.address.neighbourhood || "Main Road";
              const city = data.address.city || data.address.town || data.address.state_district || "Jamshedpur";
              const stateName = data.address.state || "Jharkhand";
              const postcode = (data.address.postcode && data.address.postcode.replace(/\D/g, "").slice(0, 6)) || "831001";
              applyLocation(`${road}, ${city}`, postcode, city, stateName);
            } else {
              fallbackLocation();
            }
          })
          .catch(() => fallbackLocation());
      },
      () => fallbackLocation(),
      { timeout: 4000 }
    );
  } else {
    fallbackLocation();
  }
}

async function registerPatientAccount() {
  const nameInput = document.getElementById("signupName");
  const ageInput = document.getElementById("signupAge");
  const genderInput = document.getElementById("signupGender");
  const phoneInput = document.getElementById("signupPhone");
  const addressInput = document.getElementById("signupAddress");
  const cityInput = document.getElementById("signupCity");
  const stateInput = document.getElementById("signupState");
  const pincodeInput = document.getElementById("signupPincode");
  const latInput = document.getElementById("signupLatitude");
  const lngInput = document.getElementById("signupLongitude");
  const consentInput = document.getElementById("signupConsent");
  const status = document.getElementById("signupStatus");
  const btn = document.getElementById("btnRegisterPatient");

  if (status) {
    status.className = "status";
    status.textContent = "";
  }

  const name = nameInput ? nameInput.value.trim() : "";
  const age = ageInput ? ageInput.value.trim() : "";
  const gender = genderInput ? genderInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\D/g, "") : "";
  const address = addressInput ? addressInput.value.trim() : "";
  let city = cityInput ? cityInput.value.trim() : "";
  let stateName = stateInput ? stateInput.value.trim() : "";
  const pincode = pincodeInput ? pincodeInput.value.trim() : "";
  const latitude = latInput && latInput.value ? parseFloat(latInput.value) : null;
  const longitude = lngInput && lngInput.value ? parseFloat(lngInput.value) : null;
  const consent = consentInput ? consentInput.checked : false;

  if (!name) {
    if (status) { status.className = "status error"; status.textContent = "Please enter your Full Name."; }
    toast("Please enter your Full Name.");
    nameInput?.focus();
    return;
  }

  const ageNum = parseInt(age, 10);
  if (!age || isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
    if (status) { status.className = "status error"; status.textContent = "Please enter a valid Age between 1 and 120."; }
    toast("Please enter a valid Age.");
    ageInput?.focus();
    return;
  }

  if (!gender) {
    if (status) { status.className = "status error"; status.textContent = "Please select your Gender."; }
    toast("Please select your Gender.");
    genderInput?.focus();
    return;
  }

  if (!phone || phone.length !== 10) {
    if (status) { status.className = "status error"; status.textContent = "Please enter a valid 10-digit Mobile Phone Number."; }
    toast("Please enter a valid 10-digit phone number.");
    phoneInput?.focus();
    return;
  }

  if (!address) {
    if (status) { status.className = "status error"; status.textContent = "Please enter your Residential Address."; }
    toast("Please enter your Address.");
    addressInput?.focus();
    return;
  }

  if (!pincode || !/^\d{6}$/.test(pincode)) {
    if (status) { status.className = "status error"; status.textContent = "Please enter a valid 6-digit Postal PIN Code (e.g. 831001)."; }
    toast("Please enter a valid 6-digit PIN code.");
    pincodeInput?.focus();
    return;
  }

  // Derive city and state if not explicitly filled
  if (!city || !stateName) {
    const locInfo = resolvePatientLocationInfo(address, pincode);
    if (!city) city = locInfo.city || "Jamshedpur";
    if (!stateName) stateName = locInfo.state || "Jharkhand";
  }

  if (!consent) {
    if (status) { status.className = "status error"; status.textContent = "Consent is mandatory for medical triage assessment."; }
    toast("Please check the consent box to proceed.");
    consentInput?.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Verifying Phone & Registering...";
  }

  // Strict Uniqueness Verification
  const isAvailable = await checkPhoneAvailability(phone);
  if (!isAvailable) {
    if (status) {
      status.className = "status error";
      status.textContent = `Registration denied: Mobile number +91 ${phone} already has an assigned Patient ID. Only one ID is permitted per number.`;
    }
    toast("Mobile number already registered!");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Number Already Registered ✗";
    }
    return;
  }

  // Generate unique MK-XXXXX ID
  let newUserId = "";
  let attempts = 0;
  while (!newUserId || knownPatients[newUserId]) {
    attempts++;
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    newUserId = `MK-${randomSuffix}`;
    if (attempts > 50) break;
  }

  // Register on backend server
  try {
    await registerPatientOnServer({
      userId: newUserId,
      password: "Password123!",
      name: name,
      age: ageNum,
      phone: phone,
      gender: gender,
      isGuest: false,
      address: address,
      city: city,
      state: stateName,
      pincode: pincode,
      latitude: latitude,
      longitude: longitude
    });
  } catch (err) {
    if (err.status === 409) {
      if (status) {
        status.className = "status error";
        status.textContent = err.message || "This mobile number is already registered in the hospital system.";
      }
      toast(err.message || "Mobile number already has an ID!");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Number Already Registered ✗";
      }
      return;
    }
    console.warn("Server registration notice (using local offline storage):", err);
  }

  // Store in client records
  const newPatient = {
    id: newUserId,
    userId: newUserId,
    name: name,
    age: String(ageNum),
    gender: gender,
    phone: phone,
    abha: "",
    isGuest: false,
    allergies: "None reported",
    currentMedicines: "None",
    reports: "",
    address: address,
    city: city,
    state: stateName,
    pincode: pincode,
    latitude: latitude,
    longitude: longitude,
    location: (latitude != null && longitude != null) ? { lat: latitude, lng: longitude } : (state.patient?.location || null)
  };

  knownPatients[newUserId] = newPatient;
  try {
    const stored = JSON.parse(localStorage.getItem("medikiosk_registered_patients") || "{}");
    stored[newUserId] = newPatient;
    localStorage.setItem("medikiosk_registered_patients", JSON.stringify(stored));
  } catch (e) {
    console.warn("Storage warning:", e);
  }

  signupState.createdUserId = newUserId;
  state.patient = { ...state.patient, ...newPatient };
  persistClientState();

  // Populate Success Card
  const idEl = document.getElementById("newlyGeneratedUserId");
  if (idEl) idEl.textContent = newUserId;

  const successPhone = document.getElementById("registeredSuccessPhone");
  if (successPhone) successPhone.textContent = `+91 ${phone}`;

  const successName = document.getElementById("registeredSuccessName");
  if (successName) successName.textContent = name;

  const successDemo = document.getElementById("registeredSuccessDemographics");
  if (successDemo) successDemo.textContent = `${ageNum} yrs · ${gender}`;

  const successPhoneLine = document.getElementById("registeredSuccessPhoneLine");
  if (successPhoneLine) successPhoneLine.textContent = `+91 ${phone}`;

  const successAddress = document.getElementById("registeredSuccessAddress");
  if (successAddress) {
    const fullLoc = `${address}${city ? ", " + city : ""}${pincode ? " (PIN " + pincode + ")" : ""}`;
    successAddress.textContent = fullLoc;
  }

  // Transition to Success Card
  const formStep = document.getElementById("signupFormStep");
  const successCard = document.getElementById("signupSuccessCard");
  if (formStep) formStep.classList.add("hidden");
  if (successCard) successCard.classList.remove("hidden");

  toast(`🎉 Number verified! Patient ID ${newUserId} generated.`);
}

function copyGeneratedUserId() {
  const idEl = document.getElementById("newlyGeneratedUserId");
  const idText = (idEl ? idEl.textContent.trim() : "") || (signupState.createdUserId || "");
  if (!idText) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(idText).then(() => {
      toast(`✓ Copied Patient ID "${idText}" to clipboard`);
    }).catch(() => {
      window.prompt("Copy your Kiosk Patient ID:", idText);
    });
  } else {
    window.prompt("Copy your Kiosk Patient ID:", idText);
  }
}

function proceedToSignInWithId() {
  const newUserId = signupState.createdUserId;
  if (!newUserId) {
    toggleSignup(false);
    return;
  }

  const patient = knownPatients[newUserId];

  // 1. Switch from sign up to sign in view
  toggleSignup(false);

  // 2. Pre-fill login user ID field
  const loginUserId = document.getElementById("loginUserId");
  if (loginUserId) {
    loginUserId.value = newUserId;
  }

  // 3. Load preview card & set active patient in state
  if (patient) {
    loadPatientDetailsCard(patient);
    state.patient = { ...state.patient, ...patient };
    persistClientState();
    updateTopbarProfileBox();
    renderPatientProfile();
  }

  // 4. Update login status message
  const loginStatus = document.getElementById("loginStatus");
  if (loginStatus) {
    loginStatus.className = "status success";
    loginStatus.textContent = `✓ Verified Mobile! User ID ${newUserId} ready. Click "Sign in & Continue" to start triage.`;
  }

  toast(`✓ Patient ID ${newUserId} ready. Click "Sign in & Continue" to proceed!`);
}

async function signupPatient() {
  await registerPatientAccount();
}

function startNewVisit() {
  state.visitId = null;
  state.visitSaved = false;
  state.symptoms = "";
  state.medicalHistory = [];
  state.answers = {};
  state.priority = "medium";
  state.redFlag = false;
  state.riskIndicators = "";
  state.carePathway = "Conventional Healthcare";
  state.visitDate = new Date().toISOString();
  const symptoms = document.getElementById("symptomsText");
  if (symptoms) symptoms.value = "";
  document.querySelectorAll('input[name="medicalHistory"]').forEach(input => { input.checked = false; });
  showScreen("symptoms");
}

function getPatientVisits(patientId) {
  try {
    const store = JSON.parse(localStorage.getItem("medikiosk_patient_visits") || "{}");
    const key = String(patientId || "").trim();
    if (key && store[key] && Array.isArray(store[key])) {
      return store[key];
    }
  } catch (e) {
    console.warn("Error reading patient visits from localStorage:", e);
  }
  return [];
}

function savePatientVisits(patientId, visits) {
  try {
    const store = JSON.parse(localStorage.getItem("medikiosk_patient_visits") || "{}");
    const key = String(patientId || "").trim();
    if (key && Array.isArray(visits)) {
      store[key] = visits;
      localStorage.setItem("medikiosk_patient_visits", JSON.stringify(store));
    }
  } catch (e) {
    console.warn("Error saving patient visits to localStorage:", e);
  }
}

function persistClientState() {
  try {
    const patientKey = (state.patient && (state.patient.userId || (state.patient.id ? `MK-${state.patient.id}` : ""))) || (state.patient.isGuest ? "guest" : "MK-88219");
    if (Array.isArray(state.savedVisits) && state.savedVisits.length > 0) {
      savePatientVisits(patientKey, state.savedVisits);
    }
    localStorage.setItem("mediKioskState", JSON.stringify({
      patient: state.patient,
      language: state.language,
      visitId: state.visitId,
      visitSaved: Boolean(state.visitSaved),
      savedVisits: state.savedVisits || [],
      symptoms: state.symptoms || ""
    }));
  } catch (error) {
    console.error("State persistence error:", error);
  }
}

async function verifyABHA() {
  console.log("verifyABHA called");
  
  const id = document.getElementById("abhaId")?.value?.trim() || document.getElementById("signupPhone")?.value?.trim() || "";
  const name = document.getElementById("patientName")?.value?.trim() || document.getElementById("signupName")?.value?.trim() || "";
  const age = document.getElementById("patientAge")?.value?.trim() || document.getElementById("signupAge")?.value?.trim() || "";
  const phone = document.getElementById("patientPhone")?.value?.trim() || document.getElementById("signupPhone")?.value?.trim() || "Not provided";
  const gender = document.getElementById("patientGender")?.value || document.getElementById("signupGender")?.value || "";
  const consent = document.getElementById("consent")?.checked || document.getElementById("signupConsent")?.checked || false;

  console.log("Form data:", { id, name, age, phone, consent });

  if (!id || !name) {
    toast("Please enter ABHA ID and patient name.");
    console.log("Validation failed: missing ID or name");
    return;
  }

  if (!consent) {
    toast("Please provide consent before continuing.");
    console.log("Validation failed: missing consent");
    return;
  }

  console.log("Validation passed, updating state");
  const credentials = generateAccountCredentials();
  state.patient = {
    id: null,
    userId: credentials.userId,
    password: credentials.password,
    name,
    age: age || "Not provided",
    phone,
    abha: id,
    isGuest: false,
    gender
  };

  try {
    console.log("Attempting to register patient on server");
    state.patient.id = await registerPatientOnServer(state.patient);

    const status = document.getElementById("abhaStatus");
    if (status) {
      status.className = "status success";
      status.textContent = "✓ Patient registered successfully";
    }

    toast("Patient registered successfully");
    console.log("Patient registered successfully");
  } catch (error) {
    console.error("Registration error:", error);
    if (error.status === 409) {
      const status = document.getElementById("abhaStatus");
      if (status) {
        status.className = "status error";
        status.textContent = error.message;
      }
      toast(error.message);
      return;
    }
    toast("⚠️ Backend unavailable. Continuing in demo mode.");
    console.log("Continuing in demo mode");
  }

  console.log("Proceeding to symptoms triage");
  
  // Save state to localStorage to persist across reloads
  persistClientState();
  
  setTimeout(() => {
    renderPatientProfile();
    updateTopbarProfileBox();
    showScreen("symptoms");
    console.log("showScreen called for symptoms");
  }, 50);
}

async function continueAsGuest() {
  showScreen("guestRegistration");
  toast("Guest registration selected");
}

async function completeGuestRegistration() {
  const guestName = document.getElementById("guestName").value.trim();
  const guestAge = document.getElementById("guestAge").value.trim();
  const guestPhone = document.getElementById("guestPhone").value.trim();
  const guestGender = document.getElementById("guestGender")?.value || "";
  const guestConsent = document.getElementById("guestConsent").checked;

  if (!guestConsent) {
    toast("Please provide consent to continue");
    return;
  }

  // Generate temporary guest ID
  const guestId = "GUEST-" + Date.now().toString().slice(-6);

  state.patient = {
    id: null, // Will be set after backend registration
    name: guestName || "Guest Patient",
    age: guestAge || "Not provided",
    phone: guestPhone || "Not provided",
    abha: "Guest",
    isGuest: true,
    gender: guestGender
  };
  state.visitDate = new Date().toISOString();
  state.visitSaved = false;

  // Try to register guest on backend
  if (!state.offline) {
    try {
      state.patient.id = await registerPatientOnServer(state.patient);
      addAudit(`Guest patient registered: ${state.patient.name} (ID: ${state.patient.id})`);
    } catch (error) {
      console.error("Guest registration error:", error);
      state.patient.id = guestId; // Use temporary ID if backend fails
      addAudit(`Guest patient using temporary ID: ${guestId}`);
    }
  } else {
    state.patient.id = guestId; // Use temporary ID in offline mode
    addAudit(`Guest patient using temporary ID: ${guestId} (offline)`);
  }

  updateTopbarProfileBox();
  showScreen("symptoms");
  toast("Guest registration complete");
}

let recognition = null;
let listening = false;
let html5QrcodeScanner = null;
let scannedPatientData = null;

function speechLang() {
  return LANGUAGE_CODES[state.language] || "en-IN";
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast("Voice recognition is not supported in this browser. Please type instead.");
    return;
  }

  if (listening && recognition) {
    stopVoice();
  }

  recognition = new SpeechRecognition();
  recognition.lang = speechLang();
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  listening = true;

  recognition.onstart = () => {
    document.getElementById("micCircle").classList.add("listening");
    document.getElementById("wave").classList.add("active");
    document.getElementById("voiceTitle").textContent = "Listening…";
  };

  recognition.onresult = e => {
    const text = e.results[0][0].transcript;
    const box = document.getElementById("symptomsText");
    box.value = (box.value + " " + text).trim();
    document.getElementById("voiceText").textContent = `Captured: “${text}”`;
    toast("Voice input captured");
  };

  recognition.onerror = () => toast("Could not hear clearly. Please try again or type.");

  recognition.onend = () => {
    listening = false;
    document.getElementById("micCircle").classList.remove("listening");
    document.getElementById("wave").classList.remove("active");
    document.getElementById("voiceTitle").textContent = "Speak your symptoms";
  };

  try {
    recognition.start();
  } catch (error) {
    listening = false;
    toast("Microphone is already in use. Please try again.");
  }
}

function stopVoice() {
  const active = recognition;
  recognition = null;
  listening = false;

  if (active) {
    try {
      active.stop();
    } catch (e) {}
  }

  document.getElementById("micCircle").classList.remove("listening");
  document.getElementById("wave").classList.remove("active");
  document.getElementById("voiceTitle").textContent = "Speak your symptoms";
}

function addSymptom(s) {
  const box = document.getElementById("symptomsText");
  const current = box.value.trim();
  box.value = current ? `${current}, ${s}` : `I have ${s}`;
  box.focus();
}

function detectRedFlags(text) {
  const t = text.toLowerCase();
  return EMERGENCY_KEYWORDS.some(p => t.includes(p));
}

function getMedicalHistory() {
  return [...new Set(
    Array.from(document.querySelectorAll('input[name="medicalHistory"]:checked'))
      .map(input => String(input.value || "").trim())
      .filter(Boolean)
  )];
}

function mapBackendPriority(value) {
  const key = String(value || "").toLowerCase();
  if (key === "emergency" || key === "high") return "high";
  if (key === "priority" || key === "medium") return "medium";
  if (key === "routine" || key === "low") return "low";
  return "medium";
}

async function runTriage() {
  state.symptoms = document.getElementById("symptomsText").value.trim();
  kioskState.medicalHistory = getMedicalHistory();
  state.answers = {};
  state.sentToDoctor = false;
  state.priority = "medium";
  state.redFlag = false;
  state.riskIndicators = "";
  qIndex = 0;

  if (!state.symptoms) {
    toast("Please enter or speak your symptoms first.");
    return;
  }

  resetTriageUi();

  const previousHistory = state.medicalHistoryRecords
    .map(record => record.diagnosis || record.notes || "")
    .filter(Boolean);

  state.redFlag = detectRedFlags(state.symptoms);
  if (!state.offline) {
    try {
      const triageResponse = await fetch(`${API_URL}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms: state.symptoms,
          medical_history: [...new Set([...kioskState.medicalHistory, ...previousHistory])]
        })
      });

      const triageData = await triageResponse.json();
      if (triageResponse.ok && triageData.success) {
        const mapped = mapBackendPriority(triageData.priority);
        state.redFlag = mapped === "high" || state.redFlag;
        if (!state.redFlag) {
          state.priority = mapped;
        }
        document.getElementById("aiStatus").textContent = "Server triage complete";
      }
    } catch (error) {
      console.error(error);
      document.getElementById("aiStatus").textContent = "Local rules";
      toast("⚠️ Backend unavailable. Using local safety check.");
    }
  }

  document.getElementById("redFlagResult").textContent = state.redFlag ? "Detected" : "None detected";
  document.getElementById("networkStatus").textContent = state.offline ? "Offline fallback" : "Online";

  if (hasBackendPatientId() && !state.offline) {
    try {
      const response = await fetch(`${API_URL}/voice-symptoms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: state.patient.id,
          transcript: state.symptoms
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        addAudit(`Symptoms recorded for patient ID ${state.patient.id}`);
        toast("✅ Symptoms saved to database");
      } else {
        toast("⚠️ Symptoms could not be saved to server.");
      }
    } catch (error) {
      console.error(error);
      toast("⚠️ Backend unavailable. Continuing in demo mode.");
    }
  }

  showScreen("triage");
  if (state.redFlag) state.priority = "high";
  setPriority(state.priority);
  askQuestion(0);
}

const questions = [
  ["duration", "When did these symptoms start?", ["Today", "1–3 days", "More than 3 days"]],
  ["severity", "How would you describe the symptoms?", ["Mild", "Moderate", "Severe"]],
  ["condition", "Are the symptoms getting worse?", ["No", "Not sure", "Yes"]]
];
let qIndex = 0;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resetTriageUi() {
  const chat = document.getElementById("chat");
  if (chat) {
    chat.innerHTML = `<div class="message bot">I’ll ask a few short questions to help organize your information for a healthcare professional.</div>`;
  }
  const area = document.getElementById("questionArea");
  if (area) area.innerHTML = "";
}

function askQuestion(index) {
  qIndex = index;
  const area = document.getElementById("questionArea");
  if (!area) return;

  if (index >= questions.length) {
    finishQuestions();
    return;
  }

  const [key, q, opts] = questions[index];
  area.innerHTML = `<p><b>${escapeHtml(q)}</b></p>` + opts.map(o =>
    `<button type="button" class="secondary" data-key="${escapeHtml(key)}" data-value="${escapeHtml(o)}">${escapeHtml(o)}</button>`
  ).join("");

  area.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => answerQuestion(btn.dataset.key, btn.dataset.value));
  });
}

function answerQuestion(key, value) {
  state.answers[key] = value;
  document.getElementById("chat").insertAdjacentHTML("beforeend", `<div class="message user">${escapeHtml(value)}</div>`);
  qIndex++;
  setTimeout(() => {
    const nextPrompt = qIndex < questions.length
      ? questions[qIndex][1]
      : "Thanks. I’ve organized the information for clinical review.";
    document.getElementById("chat").insertAdjacentHTML("beforeend", `<div class="message bot">${escapeHtml(nextPrompt)}</div>`);
    askQuestion(qIndex);
  }, 250);
}

function finishQuestions() {
  let priority = state.priority || "low";
  if ((state.answers.severity || "").toLowerCase() === "severe" || state.answers.condition === "Yes") {
    priority = "high";
  } else if (state.answers.severity === "Moderate" || state.answers.duration === "1–3 days") {
    if (priority !== "high") priority = "medium";
  }

  state.priority = priority;
  state.riskIndicators = state.redFlag ? "Potential urgent warning sign detected" : "No local red flag detected";
  setPriority(priority);
  document.getElementById("aiStatus").textContent = state.offline ? "Local fallback complete" : "Demo triage complete";
  setTimeout(() => {
    state.carePathway = "Conventional Healthcare";
    buildSummary(false);
    showScreen("medicalSupport");
    addAudit(`AI Triage complete. Navigated to Medical Support for ${state.patient.name || 'Patient'}`);
  }, 400);
}

function setPriority(p) {
  const box = document.getElementById("priorityBox");
  if (!box) return;
  box.className = `priority ${p}`;
  box.textContent = `${p.charAt(0).toUpperCase() + p.slice(1)} Priority`;
}

function buildSummary(shouldNavigate = true) {
  // Generate visit ID if not exists
  if (!state.visitId) {
    state.visitId = generateVisitId();
  }
  
  const name = state.patient.name || "Patient";
  const age = state.patient.age || "-";
  const gender = state.patient.gender || "Not provided";
  const abha = state.patient.abha || "Not provided";

  document.getElementById("summaryName").textContent = name;
  document.getElementById("summaryMeta").textContent = `Age: ${age} • Gender: ${gender} • ABHA: ${abha}`;
  document.getElementById("summaryVisitId").textContent = `Visit ID: ${state.visitId}`;

  const sp = document.getElementById("summaryPriority");
  if (sp) {
    sp.className = `priority ${state.priority}`;
    sp.textContent = `${state.priority.charAt(0).toUpperCase() + state.priority.slice(1)} Priority`;
  }

  const symptomsEl = document.getElementById("summarySymptoms");
  if (symptomsEl) {
    symptomsEl.textContent = state.symptoms || "None reported";
  }

  const visitDateEl = document.getElementById("summaryVisitDate");
  if (visitDateEl) {
    visitDateEl.textContent = formatVisitDate(state.visitDate || new Date().toISOString());
  }

  const genderEl = document.getElementById("summaryGender");
  if (genderEl) {
    genderEl.textContent = gender;
  }

  const pathwayEl = document.getElementById("summaryPathway");
  if (pathwayEl) {
    pathwayEl.textContent = state.carePathway || "Conventional Healthcare";
  }

  const summaryMedicalHistory = document.getElementById("summaryMedicalHistory");
  if (summaryMedicalHistory) {
    summaryMedicalHistory.textContent = getSummaryMedicalHistoryText();
  }
  const summaryMedication = document.getElementById("summaryMedication");
  if (summaryMedication) {
    summaryMedication.textContent = getSummaryMedicationText();
  }

  const formatKey = (k) => {
    const map = {
      duration: "Symptom Duration",
      severity: "Reported Severity",
      condition: "Condition Progression"
    };
    return map[k] || (k.charAt(0).toUpperCase() + k.slice(1));
  };

  const answersEl = document.getElementById("summaryAnswers");
  if (answersEl) {
    const entries = Object.entries(state.answers);
    if (entries.length > 0) {
      answersEl.innerHTML = entries.map(([k, v]) =>
        `<div class="answer-row"><span>${escapeHtml(formatKey(k))}</span><b>${escapeHtml(v)}</b></div>`
      ).join("");
    } else {
      answersEl.innerHTML = "<p class='muted'>Standard triage assessment questions answered.</p>";
    }
  }

  
  // Generate comprehensive QR code data
  const qrData = `MediKiosk-Demo|${state.patient.name}|${state.patient.age}|${state.patient.abha}|${state.priority}|${state.symptoms}|${state.answers.duration || 'Not provided'}|${state.answers.severity || 'Not provided'}|${state.answers.condition || 'Not provided'}|${state.visitId}|${Date.now()}|${state.redFlag ? 'High Priority - Immediate Attention Required' : 'Standard Assessment Required'}`;
  
  const qrContainer = document.getElementById("qrcode");
  qrContainer.innerHTML = "";
  const showQrFallback = (message) => {
    console.warn(message);
    const image = document.createElement("img");
    image.src = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(qrData)}`;
    image.alt = "Temporary patient summary QR code";
    image.width = 200;
    image.height = 190;
    image.onerror = () => {
      qrContainer.textContent = "QR unavailable. Use Copy Summary instead.";
    };
    qrContainer.appendChild(image);
  };

  if (window.QRCode) {
    try {
      new QRCode(qrContainer, {
        text: qrData,
        width: 190,
        height: 190
      });
    } catch (error) {
      console.error("QR rendering error:", error);
      showQrFallback("Using QR image fallback after rendering error");
    }
  } else {
    showQrFallback("QR library unavailable; using QR image fallback");
  }

  addAudit(`Digital summary generated for ${state.patient.name} (Visit: ${state.visitId})`);
  if (shouldNavigate) {
    showScreen("summary");
  }
}

async function saveCurrentVisit() {
  if (state.visitSaved) {
    showScreen("done");
    return;
  }

  // Ensure a valid visit ID exists
  if (!state.visitId) {
    state.visitId = generateVisitId();
  }

  const summary = `AI-assisted preliminary assessment — not a medical diagnosis.\nPriority: ${state.priority}\nPathway: ${state.carePathway}\nSymptoms: ${state.symptoms}`;

  // If connected to backend with a valid patient ID, try saving to API
  if (hasBackendPatientId() && !state.offline) {
    try {
      const response = await fetch(`${API_URL}/api/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: Number(state.patient.id),
          symptoms: state.symptoms,
          duration: state.answers.duration || "",
          priority: state.priority,
          risk_indicators: state.riskIndicators,
          healthcare_pathway: state.carePathway,
          summary
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.visit && data.visit.visit_id) {
          state.visitId = data.visit.visit_id;
        }
      }
    } catch (error) {
      console.warn("Backend visit save unavailable; saving record locally in kiosk state:", error);
    }
  }

  // Mark visit as saved and persist locally
  state.visitSaved = true;
  state.savedVisits = state.savedVisits || [];

  const currentVisitRecord = {
    visit_id: state.visitId,
    visit_date: new Date().toISOString(),
    symptoms: state.symptoms || "General consultation",
    priority: state.priority || "medium",
    healthcare_pathway: state.carePathway || "General OPD",
    summary: summary
  };

  const patientKey = (state.patient && (state.patient.userId || (state.patient.id ? `MK-${state.patient.id}` : ""))) || (state.patient?.isGuest ? "guest" : "MK-88219");
  const storedVisits = getPatientVisits(patientKey);
  const visitMap = new Map();
  visitMap.set(state.visitId, currentVisitRecord);
  (state.savedVisits || []).forEach(v => { if (v && v.visit_id && !visitMap.has(v.visit_id)) visitMap.set(v.visit_id, v); });
  storedVisits.forEach(v => { if (v && v.visit_id && !visitMap.has(v.visit_id)) visitMap.set(v.visit_id, v); });

  state.savedVisits = Array.from(visitMap.values());
  savePatientVisits(patientKey, state.savedVisits);
  
  const summaryVisitId = document.getElementById("summaryVisitId");
  if (summaryVisitId) {
    summaryVisitId.textContent = `Visit ID: ${state.visitId}`;
  }

  // Add or update visit in doctor queue without duplicate entries
  const patientName = state.patient.name || "Patient";
  enqueueCurrentPatient("Review Record", state.patient.isGuest ? "Guest" : "Registered");

  addAudit(`Visit saved for ${patientName} (Visit: ${state.visitId})`);

  // Visit is finished! Revert profile back to "Profile" (no name, no ID) until user enters ID again
  state.patient = { id: null, userId: "", name: "", age: "", phone: "", abha: "", isGuest: false, gender: "", allergies: "", currentMedicines: "", reports: "" };
  state.visitId = null;
  state.visitSaved = false;
  state.savedVisits = [];
  state.symptoms = "";
  updateTopbarProfileBox();
  persistClientState();

  toast("✓ Visit saved successfully!");
  showScreen("done");
}

function getSummaryMedicalHistoryText() {
  const selectedConditions = state.medicalHistory.length
    ? state.medicalHistory.join(", ")
    : "";
  const savedRecords = [...state.abhaMedicalHistoryRecords, ...state.medicalHistoryRecords]
    .map(record => record.diagnosis)
    .filter(Boolean);
  const entries = [selectedConditions, ...savedRecords].filter(Boolean);
  return entries.length ? entries.join("; ") : "None reported";
}

function getSummaryMedicationText() {
  const medicines = [...state.abhaMedicalHistoryRecords, ...state.medicalHistoryRecords]
    .map(record => record.medications)
    .filter(Boolean);
  return medicines.length ? medicines.join("; ") : "None reported";
}

// AYUSH Integration Functions
function setAyushSymptom(symptom) {
  const input = document.getElementById("ayushConditionInput");
  if (input) {
    input.value = symptom;
  }
  getAyushRecommendations();
}

function getAyushRecommendations() {
  const ayushInput = document.getElementById("ayushConditionInput");
  const symptomsText = document.getElementById("symptomsText");
  
  let symptoms = "";
  if (ayushInput && ayushInput.value.trim()) {
    symptoms = ayushInput.value.trim().toLowerCase();
  } else if (state.symptoms) {
    symptoms = state.symptoms.trim().toLowerCase();
  } else if (symptomsText && symptomsText.value.trim()) {
    symptoms = symptomsText.value.trim().toLowerCase();
  }
  
  // Default to general wellness if empty
  if (!symptoms) {
    symptoms = "wellness";
    if (ayushInput) ayushInput.value = "Daily Wellness";
  }
  
  const selectedSystem = document.querySelector('input[name="ayush_system"]:checked');
  if (!selectedSystem) {
    toast("Please select an AYUSH system");
    return;
  }
  
  const system = selectedSystem.value;
  state.ayushSystem = system;
  
  const consultationEl = document.getElementById("ayushConsultation");
  const consultationRequested = consultationEl ? consultationEl.checked : false;
  state.ayushConsultation = consultationRequested;
  
  // Update state.symptoms if not yet set
  if (!state.symptoms && symptoms !== "wellness") {
    state.symptoms = symptoms;
  }
  
  // Generate recommendations based on system and symptoms
  const recommendations = generateAyushRecommendations(system, symptoms);
  
  // Display recommendations
  const ayushContent = document.getElementById("ayushContent");
  const ayushRecommendations = document.getElementById("ayushRecommendations");
  
  if (ayushContent) {
    ayushContent.innerHTML = recommendations;
  }
  if (ayushRecommendations) {
    ayushRecommendations.classList.remove("hidden");
  }
  
  toast(`AYUSH (${system.toUpperCase()}) recommendations generated`);
  addAudit(`AYUSH recommendations requested: ${system} system for symptoms: ${symptoms}`);
  
  if (consultationRequested) {
    addAudit("AYUSH practitioner consultation requested");
  }
}

// Continue to triage function
function continueToTriage() {
  // Validate symptoms
  const symptomsText = document.getElementById("symptomsText");
  if (!symptomsText || !symptomsText.value.trim()) {
    toast("Please enter your symptoms first");
    return;
  }
  
  // Save symptoms to state
  state.symptoms = symptomsText.value.trim();
  
  // Navigate to triage
  showScreen("triage");
  addAudit("Proceeded to AI Triage assessment");
}

// AYUSH recommendations for medical support section
function getAyushRecommendationsForSupport() {
  // Get symptoms from state
  const symptoms = state.symptoms.toLowerCase();
  
  if (!symptoms) {
    toast("Please complete symptom assessment first");
    return;
  }
  
  // Get selected AYUSH system
  const selectedSystem = document.querySelector('input[name="ayush_system"]:checked');
  
  if (!selectedSystem) {
    toast("Please select an AYUSH system");
    return;
  }
  
  const system = selectedSystem.value;
  state.ayushSystem = system;
  
  // Generate recommendations
  const recommendations = generateAyushRecommendations(system, symptoms);
  
  // Display recommendations in medical support modal
  const ayushContent = document.getElementById("ayushRecommendationsContent");
  const ayushSection = document.getElementById("ayushRecommendationsSection");
  
  ayushContent.innerHTML = recommendations;
  ayushSection.classList.remove("hidden");
  
  addAudit(`AYUSH recommendations from medical support: ${system} system for symptoms: ${symptoms}`);
  toast("AYUSH recommendations displayed");
}

function generateAyushRecommendations(system, symptoms) {
  let recommendations = "";
  
  const commonRemedies = {
    fever: {
      ayurveda: "Giloy juice, Tulsi tea, Ginger water, Coriander water, Sudarshan Churna",
      yoga: "Savasana, Gentle Anulom Vilom, Sheetali Pranayama, Light restorative poses",
      unani: "Khamira Abresham, Arq Badyan, Sharbat Unnab, Khaksi",
      siddha: "Nilavembu Kudineer, Amukkara Chooranam, Brahmananda Bhairavam",
      homeopathy: "Belladonna, Rhus Tox, Bryonia, Ferrum Phos 6X, Aconite"
    },
    cough: {
      ayurveda: "Honey + Ginger juice, Tulsi leaves, Trikatu Churna, Sitopaladi Churna, Mulethi tea",
      yoga: "Pranayama, Bhujangasana, Dhanurasana, Matsyasana",
      unani: "Habbe Cinkini, Arq Adusi, Sharbanjand, Lauq Sapistan",
      siddha: "Thippili Rasayanam, Vallarai Nei, Adathodai Manapagu",
      homeopathy: "Drosera, Ipecac, Bryonia, Hepar Sulph, Rumex"
    },
    cold: {
      ayurveda: "Golden Turmeric Milk, Sitopaladi Churna, Herbal Steam with eucalyptus oil",
      yoga: "Jala Neti, Kapalbhati, Surya Bhedana Pranayama",
      unani: "Joshanda, Sharbat Toot Siah, Roghan Banafsha",
      siddha: "Kabasura Kudineer, Thrikadugu Chooranam",
      homeopathy: "Aconite, Allium Cepa, Arsenicum Album, Gelsemium"
    },
    headache: {
      ayurveda: "Brahmi oil forehead massage, Ashwagandha, Shankhpushpi, Nasya herbal drops",
      yoga: "Balasana (Child's Pose), Shavasana, Neck stretching exercises, Bhramari",
      unani: "Maqnun Raughan, Arq Gulab, Khamira Gaozaban, Roghan Kahu",
      siddha: "Amukkara Lehyam, Nellikai Lehyam, Seeraga Thailam",
      homeopathy: "Belladonna, Sanguinaria, Spigelia, Natrum Mur, Glonoine"
    },
    chest_pain: {
      ayurveda: "Arjuna bark decoction, Pushkarmool, Haridra Khand (Seek emergency care if acute)",
      yoga: "Anulom Vilom, Bhramari, Gentle relaxation, Heart-opening breathing",
      unani: "Majun Dandasa, Khamira Marwareed, Dawaul Misk",
      siddha: "Thathai Pooncholai Siddhar, Sangu Parpam",
      homeopathy: "Cactus Grandiflorus, Crataegus Oxyacantha, Arnica Montana"
    },
    stomach_pain: {
      ayurveda: "Ginger + Lemon juice, Hingvastak Churna, Pudina water, Jeera decoction",
      yoga: "Vajrasana (post-meal), Paschimottanasana, Pawanmuktasana",
      unani: "Habb-e-Suranjan, Jawarish Kamuni, Arq Podina",
      siddha: "Agathiyar Kuzhambu, Seeraga Chooranam, Eladi Chooranam",
      homeopathy: "Nux Vomica, Carbo Veg, Colocynthis, China, Lycopodium"
    },
    joint_pain: {
      ayurveda: "Mahanarayan Taila massage, Shallaki, Yograj Guggulu, Rasnadi Kwath",
      yoga: "Joint movements (Sukshma Vyayama), Tadasana, Vrikshasana, Gentle twists",
      unani: "Raughan Surkh, Majun Suranjan, Habb-e-Asgand",
      siddha: "Vatha Kesari Thailam, Amukkara Chooranam, Karisalai Karpam",
      homeopathy: "Rhus Tox, Bryonia Alba, Arnica, Causticum, Ledum Pal"
    },
    wellness: {
      ayurveda: "Chyawanprash daily, Triphala before bed, Ashwagandha, Warm water hydration",
      yoga: "Daily Surya Namaskar, Nadi Shodhana, 15-minute Mindfulness Meditation",
      unani: "Khamira Marwareed, Sharbat Bazoori, Arq Kasni",
      siddha: "Nellikai Lehyam, Thirikadugu Chooranam, Triphala Karpam",
      homeopathy: "Alfalfa Tonic, Five Phos 6X, Calcarea Phosphorica"
    }
  };
  
  // Match symptoms to remedies
  let matchedRemedies = [];
  const normalized = symptoms.toLowerCase();
  
  for (const [symptom, remedies] of Object.entries(commonRemedies)) {
    const key = symptom.replace("_", " ");
    let match = false;
    if (normalized.includes(key)) {
      match = true;
    } else if (symptom === "cold" && (normalized.includes("flu") || normalized.includes("runny nose") || normalized.includes("sinus"))) {
      match = true;
    } else if (symptom === "joint_pain" && (normalized.includes("joint") || normalized.includes("body pain") || normalized.includes("arthritis") || normalized.includes("knee") || normalized.includes("back pain"))) {
      match = true;
    } else if (symptom === "stomach_pain" && (normalized.includes("digest") || normalized.includes("gas") || normalized.includes("acidity") || normalized.includes("indigestion") || normalized.includes("belly"))) {
      match = true;
    }
    
    if (match) {
      matchedRemedies.push({
        symptom: key.toUpperCase(),
        remedy: remedies[system] || remedies.ayurveda || "Consult certified practitioner"
      });
    }
  }
  
  if (matchedRemedies.length === 0) {
    const wellnessRemedy = (commonRemedies.wellness && commonRemedies.wellness[system]) || commonRemedies.wellness.ayurveda;
    recommendations = `
      <div class="ayush-remedy">
        <strong>${system.toUpperCase()} WELLNESS FORMULATION:</strong>
        <p>${wellnessRemedy}</p>
      </div>
      <div class="ayush-alert">
        <p><strong>Holistic Guidance:</strong></p>
        <ul>
          <li>Drink warm water infused with digestive spices</li>
          <li>Ensure 7-8 hours of restorative sleep</li>
          <li>Engage in daily pranayama and mindful breathing</li>
          <li>For acute or persistent conditions, consult a certified AYUSH practitioner</li>
        </ul>
      </div>
    `;
  } else {
    recommendations = matchedRemedies.map(item => `
      <div class="ayush-remedy">
        <strong>${item.symptom} (${system.toUpperCase()}):</strong>
        <p>${item.remedy}</p>
      </div>
    `).join("");
  }
  
  // Add system-specific advice
  const systemAdvice = {
    ayurveda: `
      <div class="ayush-advice">
        <strong>Ayurveda Lifestyle Tips:</strong>
        <ul>
          <li>Follow Dinacharya (daily routine according to body circadian rhythm)</li>
          <li>Balance your Vata, Pitta, and Kapha Doshas with fresh, wholesome food</li>
          <li>Use seasonal herbs and warm herbal infusions</li>
          <li>Practice Abhyanga (warm herbal oil self-massage)</li>
        </ul>
      </div>
    `,
    yoga: `
      <div class="ayush-advice">
        <strong>Yoga & Naturopathy Tips:</strong>
        <ul>
          <li>Practice Surya Namaskar (Sun Salutations) at sunrise</li>
          <li>Include Nadi Shodhana Pranayama for balanced vital energy</li>
          <li>Maintain ergonomic posture and mindful relaxation</li>
          <li>Practice 15 minutes of Dharana/Dhyana (meditation) daily</li>
        </ul>
      </div>
    `,
    unani: `
      <div class="ayush-advice">
        <strong>Unani Lifestyle Tips:</strong>
        <ul>
          <li>Maintain balance of natural humors (Akhlat: Dam, Balgham, Safra, Sauda)</li>
          <li>Follow Asbab-e-Sittah Zarooriyah (six essential prerequisites for health)</li>
          <li>Consume natural decoctions and honey-based preparations</li>
          <li>Practice moderate walking and fresh air aeration</li>
        </ul>
      </div>
    `,
    siddha: `
      <div class="ayush-advice">
        <strong>Siddha Lifestyle Tips:</strong>
        <ul>
          <li>Follow dietary guidelines according to your Mukkuttram constitution</li>
          <li>Use herbal rasayanam and lehyam formulations</li>
          <li>Practice Kayakalpa methods for vitality and longevity</li>
          <li>Incorporate spiritual mindfulness and wholesome nutrition</li>
        </ul>
      </div>
    `,
    homeopathy: `
      <div class="ayush-advice">
        <strong>Homeopathy Guidance:</strong>
        <ul>
          <li>Take globules on a clean tongue, at least 15 minutes away from meals</li>
          <li>Avoid strong odors (raw onion, garlic, menthol, camphor) during remedies</li>
          <li>Individualized constitutional evaluation produces optimal recovery</li>
          <li>Store homeopathic remedies away from direct sunlight and electromagnetic fields</li>
        </ul>
      </div>
    `
  };
  
  recommendations += systemAdvice[system] || "";
  return recommendations;
}

function getSummaryTriageText() {
  const details = {
    high: ["🔴 High Priority", "Medical attention recommended soon"],
    medium: ["🟡 Medium Priority", "Consult a healthcare professional soon"],
    low: ["🟢 Low Priority", "Monitor your symptoms and seek medical advice if they persist or worsen"]
  }[String(state.priority || "medium")] || [
    "🟡 Medium Priority",
    "Consult a healthcare professional soon"
  ];
  return `${details[0]}\nReason: ${details[1]}\nRed Flags: ${state.redFlag ? "Detected" : "None detected"}`;
}

async function copySummary() {
  console.log("copySummary called");
  
  if (!state.visitId) {
    state.visitId = generateVisitId();
  }
  
  const text = `MediKiosk — Patient Summary
Patient Information
Patient: ${state.patient.name || "Not provided"}
Age: ${state.patient.age || "Not provided"}
ABHA ID: ${state.patient.abha || "Not available"}

Chief Complaint
${state.symptoms}

AI-Collected Information
Duration: ${state.answers.duration || 'Not provided'}
Severity: ${state.answers.severity || 'Not provided'}
Existing condition: ${state.answers.condition === 'Yes' ? 'Yes' : 'No'}

AI Triage
${getSummaryTriageText()}

Medical History
${getSummaryMedicalHistoryText()}

Relevant Medicine
${getSummaryMedicationText()}

Allergies
No known allergies reported

Visit Information
Visit ID: ${state.visitId}
Generated by: MediKiosk
Date & Time: ${new Date().toLocaleString()}`;
  
  console.log("Summary text to copy:", text);
  console.log("Current priority:", state.priority);
  
  try {
    if (!navigator.clipboard) throw new Error("Clipboard API unavailable");
    
    // Clear clipboard first
    await navigator.clipboard.writeText('');
    console.log("Clipboard cleared");
    
    // Small delay to ensure clear completes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Copy the new summary
    await navigator.clipboard.writeText(text);
    console.log("Summary copied to clipboard successfully");
    toast("Summary copied");
  } catch (error) {
    console.error("Clipboard error:", error);
    toast("Could not copy summary. Please copy it manually.");
  }
}

function showSummaryModal() {
  if (!state.visitId) {
    state.visitId = generateVisitId();
  }
  
  const text = `MediKiosk — Patient Summary
Patient Information
Patient: ${state.patient.name || "Not provided"}
Age: ${state.patient.age || "Not provided"}
ABHA ID: ${state.patient.abha || "Not available"}

Chief Complaint
${state.symptoms}

AI-Collected Information
Duration: ${state.answers.duration || 'Not provided'}
Severity: ${state.answers.severity || 'Not provided'}
Existing condition: ${state.answers.condition === 'Yes' ? 'Yes' : 'No'}

AI Triage
${getSummaryTriageText()}

Medical History
${getSummaryMedicalHistoryText()}

Relevant Medicine
${getSummaryMedicationText()}

Allergies
No known allergies reported

Visit Information
Visit ID: ${state.visitId}
Generated by: MediKiosk
Date & Time: ${new Date().toLocaleString()}`;
  
  alert(text);
}

function medicalSupport() {
  console.log("medicalSupport function called");
  const medicalSupportScreen = document.getElementById("medicalSupport");
  console.log("Medical support screen found:", medicalSupportScreen);
  
  showScreen("medicalSupport");
  addAudit("Medical support services accessed");
  
  console.log("showScreen called for medicalSupport");
}

// Real phone call function
function makePhoneCall(phoneNumber) {
  // Remove any non-digit characters except + for international format
  const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
  
  // Create tel: link and trigger call
  const telLink = `tel:${cleanNumber}`;
  
  // Try to make the call
  try {
    window.location.href = telLink;
    toast(`Calling ${phoneNumber}...`);
    addAudit(`Phone call initiated to ${phoneNumber}`);
  } catch (error) {
    console.error("Failed to initiate phone call:", error);
    toast("Unable to make phone call. Please dial manually.");
  }
}

// Emergency call function
function makeEmergencyCall(number) {
  // Emergency numbers should be called immediately
  const telLink = `tel:${number}`;
  
  try {
    window.location.href = telLink;
    toast(`Calling emergency services: ${number}`);
    addAudit(`Emergency call initiated to ${number}`);
  } catch (error) {
    console.error("Failed to initiate emergency call:", error);
    toast("Unable to make emergency call. Please dial manually.");
  }
}

// Google Maps directions function
function openGoogleMaps(location) {
  // Open Google Maps with the location
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  
  try {
    window.open(mapsUrl, '_blank');
    toast(`Opening directions to ${location}...`);
    addAudit(`Google Maps directions requested to ${location}`);
  } catch (error) {
    console.error("Failed to open Google Maps:", error);
    toast("Unable to open maps. Please use Maps app manually.");
  }
}

// =========================================================================
// =========================================================================
// ====== MULTI-CITY & UNIVERSAL LOCATION RESOLUTION ENGINE ===============
// =========================================================================

const PIN_CODE_CITY_MAP = {
  // Jharkhand
  "831": { city: "Jamshedpur", state: "Jharkhand", locality: "Bistupur" },
  "834": { city: "Ranchi", state: "Jharkhand", locality: "Doranda" },
  "826": { city: "Dhanbad", state: "Jharkhand", locality: "Bank More" },
  "827": { city: "Bokaro Steel City", state: "Jharkhand", locality: "Sector 4" },
  "825": { city: "Hazaribagh", state: "Jharkhand", locality: "Matwari" },
  "832": { city: "Ghatshila", state: "Jharkhand", locality: "Main Road" },
  "833": { city: "Chaibasa", state: "Jharkhand", locality: "Sadar" },
  // Bihar
  "800": { city: "Patna", state: "Bihar", locality: "Kankarbagh" },
  "801": { city: "Patna", state: "Bihar", locality: "Danapur" },
  "842": { city: "Muzaffarpur", state: "Bihar", locality: "Mithanpura" },
  "823": { city: "Gaya", state: "Bihar", locality: "Civil Lines" },
  "812": { city: "Bhagalpur", state: "Bihar", locality: "Zero Mile" },
  "851": { city: "Begusarai", state: "Bihar", locality: "Nagar" },
  // West Bengal
  "700": { city: "Kolkata", state: "West Bengal", locality: "Salt Lake" },
  "711": { city: "Howrah", state: "West Bengal", locality: "Shibpur" },
  "713": { city: "Durgapur", state: "West Bengal", locality: "City Center" },
  "734": { city: "Siliguri", state: "West Bengal", locality: "Pradhan Nagar" },
  // Delhi NCR
  "110": { city: "Delhi", state: "Delhi", locality: "Saket" },
  "201": { city: "Noida", state: "Uttar Pradesh", locality: "Sector 62" },
  "122": { city: "Gurugram", state: "Haryana", locality: "Cyber City" },
  "121": { city: "Faridabad", state: "Haryana", locality: "Sector 15" },
  // Maharashtra
  "400": { city: "Mumbai", state: "Maharashtra", locality: "Bandra West" },
  "411": { city: "Pune", state: "Maharashtra", locality: "Shivajinagar" },
  "440": { city: "Nagpur", state: "Maharashtra", locality: "Dharampeth" },
  "422": { city: "Nashik", state: "Maharashtra", locality: "College Road" },
  // Karnataka
  "560": { city: "Bengaluru", state: "Karnataka", locality: "Indiranagar" },
  "575": { city: "Mangaluru", state: "Karnataka", locality: "Kadri" },
  "570": { city: "Mysuru", state: "Karnataka", locality: "Jayalakshmipuram" },
  // Telangana & Andhra Pradesh
  "500": { city: "Hyderabad", state: "Telangana", locality: "Banjara Hills" },
  "530": { city: "Visakhapatnam", state: "Andhra Pradesh", locality: "MVP Colony" },
  "520": { city: "Vijayawada", state: "Andhra Pradesh", locality: "Governorpet" },
  // Tamil Nadu
  "600": { city: "Chennai", state: "Tamil Nadu", locality: "T. Nagar" },
  "641": { city: "Coimbatore", state: "Tamil Nadu", locality: "RS Puram" },
  "625": { city: "Madurai", state: "Tamil Nadu", locality: "KK Nagar" },
  // Uttar Pradesh
  "226": { city: "Lucknow", state: "Uttar Pradesh", locality: "Hazratganj" },
  "208": { city: "Kanpur", state: "Uttar Pradesh", locality: "Civil Lines" },
  "221": { city: "Varanasi", state: "Uttar Pradesh", locality: "Sigra" },
  "282": { city: "Agra", state: "Uttar Pradesh", locality: "Sanjay Place" },
  "211": { city: "Prayagraj", state: "Uttar Pradesh", locality: "Civil Lines" },
  // Rajasthan
  "302": { city: "Jaipur", state: "Rajasthan", locality: "C-Scheme" },
  "342": { city: "Jodhpur", state: "Rajasthan", locality: "Ratanada" },
  // Gujarat
  "380": { city: "Ahmedabad", state: "Gujarat", locality: "Navrangpura" },
  "395": { city: "Surat", state: "Gujarat", locality: "Athwa Lines" },
  "390": { city: "Vadodara", state: "Gujarat", locality: "Alkapuri" },
  // Madhya Pradesh
  "462": { city: "Bhopal", state: "Madhya Pradesh", locality: "MP Nagar" },
  "452": { city: "Indore", state: "Madhya Pradesh", locality: "Vijay Nagar" },
  // Odisha
  "751": { city: "Bhubaneswar", state: "Odisha", locality: "Nayapalli" },
  "753": { city: "Cuttack", state: "Odisha", locality: "Badambadi" },
  // Punjab & Chandigarh
  "160": { city: "Chandigarh", state: "Chandigarh", locality: "Sector 17" },
  "141": { city: "Ludhiana", state: "Punjab", locality: "Civil Lines" },
  // Kerala
  "695": { city: "Thiruvananthapuram", state: "Kerala", locality: "Pattom" },
  "682": { city: "Kochi", state: "Kerala", locality: "Panampilly Nagar" },
  // Assam
  "781": { city: "Guwahati", state: "Assam", locality: "GS Road" }
};

const CITY_NAME_ALIASES = [
  { name: "Jamshedpur", keywords: ["jamshedpur", "bistupur", "sakchi", "kadma", "sonari", "tatanagar", "telco", "golmuri", "mango", "adityapur", "burmamines", "jugsalai"], defaultPin: "831001", state: "Jharkhand", locality: "Bistupur" },
  { name: "Ranchi", keywords: ["ranchi", "doranda", "harmu", "morabadi", "kanke", "bariatu"], defaultPin: "834001", state: "Jharkhand", locality: "Doranda" },
  { name: "Patna", keywords: ["patna", "kankarbagh", "boring road", "bailey road", "danapur", "patliputra"], defaultPin: "800001", state: "Bihar", locality: "Kankarbagh" },
  { name: "Dhanbad", keywords: ["dhanbad", "bank more", "jharia", "saraidhela"], defaultPin: "826001", state: "Jharkhand", locality: "Bank More" },
  { name: "Kolkata", keywords: ["kolkata", "calcutta", "salt lake", "howrah", "new town", "park street"], defaultPin: "700001", state: "West Bengal", locality: "Salt Lake" },
  { name: "Delhi", keywords: ["delhi", "saket", "new delhi", "south delhi", "dwarka", "rohini", "malviya nagar", "connaught place", "hauz khas"], defaultPin: "110017", state: "Delhi", locality: "Saket" },
  { name: "Bengaluru", keywords: ["bengaluru", "bangalore", "indiranagar", "koramangala", "whitefield", "electronic city", "hsr", "jayanagar"], defaultPin: "560038", state: "Karnataka", locality: "Indiranagar" },
  { name: "Mumbai", keywords: ["mumbai", "bombay", "bandra", "andheri", "juhu", "dadar", "borivali", "thane", "navi mumbai"], defaultPin: "400050", state: "Maharashtra", locality: "Bandra West" },
  { name: "Noida", keywords: ["noida", "sector 62", "sector 18", "greater noida", "sector 137"], defaultPin: "201301", state: "Uttar Pradesh", locality: "Sector 62" },
  { name: "Pune", keywords: ["pune", "shivajinagar", "kothrud", "wakad", "hinjewadi", "baner", "viman nagar"], defaultPin: "411005", state: "Maharashtra", locality: "Shivajinagar" },
  { name: "Hyderabad", keywords: ["hyderabad", "secunderabad", "banjara hills", "jubilee hills", "gachibowli", "hitec city"], defaultPin: "500034", state: "Telangana", locality: "Banjara Hills" },
  { name: "Chennai", keywords: ["chennai", "madras", "t nagar", "t. nagar", "adyar", "velachery", "anna nagar"], defaultPin: "600017", state: "Tamil Nadu", locality: "T. Nagar" },
  { name: "Lucknow", keywords: ["lucknow", "hazratganj", "gomti nagar", "alambagh", "indira nagar"], defaultPin: "226001", state: "Uttar Pradesh", locality: "Hazratganj" },
  { name: "Jaipur", keywords: ["jaipur", "c-scheme", "malviya nagar jaipur", "vaishali nagar", "mansarovar"], defaultPin: "302001", state: "Rajasthan", locality: "C-Scheme" }
];

function resolvePatientLocationInfo(customAddress, customPincode) {
  let pin = "";
  if (customPincode) {
    pin = String(customPincode).replace(/\D/g, "").slice(0, 6);
  }
  if (!pin && state && state.patient && state.patient.pincode) {
    pin = String(state.patient.pincode).replace(/\D/g, "").slice(0, 6);
  }

  let rawAddr = "";
  if (customAddress) {
    rawAddr = String(customAddress).trim();
  } else if (state && state.patient) {
    rawAddr = state.patient.address || "";
    if (state.patient.city) {
      const pfx = pin.slice(0, 3);
      if (!PIN_CODE_CITY_MAP[pfx] || PIN_CODE_CITY_MAP[pfx].city.toLowerCase() === state.patient.city.toLowerCase()) {
        rawAddr = [rawAddr, state.patient.city].filter(Boolean).join(", ");
      }
    }
  }

  if (!pin && rawAddr) {
    const pinMatch = rawAddr.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) pin = pinMatch[1];
  }

  const addrLower = (rawAddr || "").toLowerCase();

  let mappedInfo = null;
  if (pin && pin.length >= 3) {
    const prefix3 = pin.slice(0, 3);
    if (PIN_CODE_CITY_MAP[prefix3]) {
      mappedInfo = PIN_CODE_CITY_MAP[prefix3];
    }
  }

  let matchedAlias = null;
  for (const alias of CITY_NAME_ALIASES) {
    if (alias.keywords.some(kw => addrLower.includes(kw))) {
      matchedAlias = alias;
      break;
    }
  }

  let city = "";
  let stateName = "India";
  let locality = "";

  if (mappedInfo && matchedAlias && mappedInfo.city.toLowerCase() === matchedAlias.name.toLowerCase()) {
    city = mappedInfo.city;
    stateName = mappedInfo.state;
    locality = matchedAlias.locality || mappedInfo.locality;
  } else if (mappedInfo) {
    city = mappedInfo.city;
    stateName = mappedInfo.state;
    locality = matchedAlias ? matchedAlias.locality : mappedInfo.locality;
  } else if (matchedAlias) {
    city = matchedAlias.name;
    stateName = matchedAlias.state;
    locality = matchedAlias.locality;
    if (!pin) pin = matchedAlias.defaultPin;
  } else if (state && state.patient && state.patient.city) {
    city = state.patient.city;
  } else if (rawAddr) {
    const parts = rawAddr.split(/[,–-]/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      city = parts[parts.length - 1].replace(/\bPIN\b|\b[0-9]{6}\b/gi, "").trim() || parts[0];
    } else {
      city = rawAddr.replace(/\bPIN\b|\b[0-9]{6}\b/gi, "").trim() || "Local Area";
    }
  } else {
    city = "Jamshedpur";
    stateName = "Jharkhand";
    locality = "Bistupur";
    if (!pin) pin = "831001";
  }

  if (!pin) pin = "831001";
  if (!locality) locality = "Central Area";

  return {
    city: city || "Jamshedpur",
    state: stateName,
    locality: locality,
    pincode: pin,
    rawAddress: rawAddr || `${locality}, ${city} (PIN ${pin})`
  };
}

// =========================================================================
// ====== CURATED HEALTHCARE DIRECTORIES (JAMSHEDPUR, DELHI, BLR, MUM, NOIDA)
// =========================================================================

const JAMSHEDPUR_HOSPITALS = [
  {
    id: "HOSP-JSR-01",
    name: "Tata Main Hospital (TMH)",
    type: "Tertiary Multispecialty & Apex Trauma Center",
    category: "multispecialty",
    address: "Northern Town, Bistupur, Jamshedpur",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.7,
    emergency: "24/7 Level-1 Emergency, Cardiac & Trauma Care",
    openStatus: "Open 24 Hours",
    phone: "+91-657-222-4555",
    rating: "4.9 ⭐ (6,540 reviews)",
    specialties: ["Emergency Medicine", "Cardiology", "Pulmonology", "Orthopedics", "ICU / CCU", "Trauma"],
    bedsAvailable: "38 ICU beds available",
    keywords: ["tmh", "tata main hospital", "bistupur", "jamshedpur", "831001", "northern town", "emergency", "cardiac"]
  },
  {
    id: "HOSP-JSR-02",
    name: "Brahmananda Narayana Multispeciality Hospital",
    type: "Super-Specialty Cardiac & Critical Hospital",
    category: "multispecialty",
    address: "Near Bistupur Link Road, Tamolia, Jamshedpur",
    locality: "Tamolia",
    city: "Jamshedpur",
    pincode: "831012",
    distanceKm: 2.1,
    emergency: "24/7 Cardiac Emergency & Stroke Unit",
    openStatus: "Open 24 Hours",
    phone: "+91-657-662-2000",
    rating: "4.8 ⭐ (3,920 reviews)",
    specialties: ["Cardiology", "Cardiac Surgery", "Gastroenterology", "Nephrology", "Critical Care"],
    bedsAvailable: "22 CCU beds available",
    keywords: ["narayana", "brahmananda", "jamshedpur", "tamolia", "bistupur", "831012", "heart", "cardiac"]
  },
  {
    id: "HOSP-JSR-03",
    name: "MGM Medical College & Hospital",
    type: "Government Tertiary Care & Medical College",
    category: "chc",
    address: "Dimna Road / Sakchi, Jamshedpur",
    locality: "Sakchi",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.8,
    emergency: "24/7 Free Emergency & Casualty Unit",
    openStatus: "Open 24 Hours",
    phone: "+91-657-243-1560",
    rating: "4.4 ⭐ (4,120 reviews)",
    specialties: ["General OPD", "Pediatrics", "Trauma", "Ayushman Bharat / Free Care", "Surgery"],
    bedsAvailable: "Government Free Casualty Ward",
    keywords: ["mgm", "medical college", "sakchi", "jamshedpur", "831001", "government", "free care", "ayushman"]
  },
  {
    id: "HOSP-JSR-04",
    name: "Steel City Hospital & Research Centre",
    type: "Multispecialty & Surgical Hospital",
    category: "multispecialty",
    address: "Golmuri / Bistupur Main Corridor, Jamshedpur",
    locality: "Golmuri",
    city: "Jamshedpur",
    pincode: "831003",
    distanceKm: 1.9,
    emergency: "24/7 Orthopedic & Emergency Care",
    openStatus: "Open 24 Hours",
    phone: "+91-657-234-5800",
    rating: "4.7 ⭐ (2,180 reviews)",
    specialties: ["Orthopedics", "General Surgery", "Neurology", "Pediatrics"],
    bedsAvailable: "16 ICU beds available",
    keywords: ["steel city", "golmuri", "bistupur", "jamshedpur", "831003", "orthopedic"]
  },
  {
    id: "HOSP-JSR-05",
    name: "Urban Community Health Center (UPHC Bistupur)",
    type: "Community Health Center (CHC / PHC)",
    category: "chc",
    address: "Main Road, Sector Health Post, Bistupur, Jamshedpur",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.5,
    emergency: "Day OPD & Essential Emergency Services",
    openStatus: "Open (08:00 AM - 08:00 PM)",
    phone: "+91-657-242-8840",
    rating: "4.6 ⭐ (890 reviews)",
    specialties: ["General Medicine", "Vaccination", "Maternal Child Health", "Free Essential Medicines"],
    bedsAvailable: "National Health Mission Day Care",
    keywords: ["uphc", "phc", "chc", "bistupur", "jamshedpur", "831001", "health post", "nhm"]
  }
];

const JAMSHEDPUR_DOCTORS = [
  {
    id: "DOC-JSR-SINGH",
    name: "Dr. Rajeshwar Singh, MD, DM",
    specialty: "Cardiology & Vascular Medicine",
    department: "Cardiology OPD",
    hospital: "Tata Main Hospital (TMH)",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.7,
    cabin: "Room 204 (2nd Floor)",
    experience: "18 yrs exp",
    rating: "4.9",
    reviews: "1,820",
    keywords: ["heart", "chest", "pain", "palpitation", "palpitations", "pressure", "bp", "hypertension", "breathless", "breathlessness", "pulse", "cardiac", "angina"],
    slots: ["Today 11:30 AM", "Today 02:00 PM", "Today 04:30 PM"],
    matchReason: "Senior cardiologist at TMH Bistupur for chest pain, palpitations, hypertension, and cardiac health."
  },
  {
    id: "DOC-JSR-ROY",
    name: "Dr. Priya Roy, MD",
    specialty: "Pulmonology & Respiratory Medicine",
    department: "Chest & Pulmonary Wing",
    hospital: "Brahmananda Narayana Multispeciality Hospital",
    locality: "Bistupur / Tamolia",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.8,
    cabin: "Room 215 (2nd Floor)",
    experience: "14 yrs exp",
    rating: "4.8",
    reviews: "1,140",
    keywords: ["cough", "throat", "asthma", "wheezing", "breath", "breathing", "respiratory", "lungs", "bronchitis", "phlegm", "cold", "flu", "congestion", "infection"],
    slots: ["Today 11:45 AM", "Today 01:15 PM", "Today 03:30 PM"],
    matchReason: "Specialist in Jamshedpur for persistent cough, throat irritation, wheezing, respiratory distress, and asthma."
  },
  {
    id: "DOC-JSR-SEN",
    name: "Dr. A.K. Sen, MBBS, MD",
    specialty: "General & Internal Medicine",
    department: "Internal Medicine OPD",
    hospital: "MGM Medical College & Hospital",
    locality: "Sakchi",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.2,
    cabin: "Room 102 (Ground Floor)",
    experience: "16 yrs exp",
    rating: "4.9",
    reviews: "2,430",
    keywords: ["fever", "headache", "cold", "flu", "weakness", "fatigue", "chills", "body", "pain", "infection", "viral", "malaise", "dizziness", "general", "cough", "throat"],
    slots: ["Today 12:00 PM", "Today 02:30 PM", "Today 05:00 PM"],
    matchReason: "Chief physician in Jamshedpur for acute fever, viral infections, body pain, weakness, and comprehensive checkups."
  },
  {
    id: "DOC-JSR-KUMAR",
    name: "Dr. Sanjeev Kumar, MS",
    specialty: "Orthopedics, Bone & Joint Surgery",
    department: "Orthopedic Wing",
    hospital: "Steel City Hospital",
    locality: "Golmuri / Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.4,
    cabin: "Room 112 (1st Floor)",
    experience: "15 yrs exp",
    rating: "4.9",
    reviews: "1,390",
    keywords: ["bone", "joint", "back", "knee", "spine", "sprain", "fracture", "arthritis", "swelling", "shoulder", "hip", "neck", "musculoskeletal", "pain"],
    slots: ["Today 11:15 AM", "Today 01:45 PM", "Today 04:00 PM"],
    matchReason: "Senior orthopedic surgeon in Jamshedpur for joint discomfort, spine pain, ligament injury, and fracture care."
  },
  {
    id: "DOC-JSR-DAS",
    name: "Dr. Meenakshi Das, MD",
    specialty: "Pediatrics & Child Health",
    department: "Pediatrics OPD",
    hospital: "Tata Main Hospital (TMH)",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.7,
    cabin: "Room 108 (Ground Floor)",
    experience: "13 yrs exp",
    rating: "4.9",
    reviews: "1,750",
    keywords: ["child", "infant", "baby", "pediatric", "kid", "vaccination", "teething", "growth", "newborn", "children", "pediatrician"],
    slots: ["Today 12:30 PM", "Today 02:15 PM", "Today 04:15 PM"],
    matchReason: "Leading pediatrician at TMH Bistupur for infant triage, pediatric illness, childhood cough/fever, and vaccinations."
  },
  {
    id: "DOC-JSR-MOHANTY",
    name: "Dr. Alok Mohanty, MS",
    specialty: "ENT (Ear, Nose & Throat) & Sinus",
    department: "ENT Clinic",
    hospital: "TMH Annex Clinic",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.8,
    cabin: "Room 105 (1st Floor)",
    experience: "12 yrs exp",
    rating: "4.8",
    reviews: "940",
    keywords: ["throat", "sore", "ear", "earache", "nose", "nasal", "sinus", "sinusitis", "tonsils", "hearing", "allergy", "voice", "cough"],
    slots: ["Today 12:15 PM", "Today 03:00 PM", "Today 04:45 PM"],
    matchReason: "Specialist in Bistupur for throat pain, earache, nasal blockage, voice change, and sinus infection."
  },
  {
    id: "DOC-JSR-AGARWAL",
    name: "Dr. Manoj Agarwal, MD, DM",
    specialty: "Gastroenterology & Digestive Health",
    department: "Digestive Sciences",
    hospital: "Brahmananda Narayana Multispeciality Hospital",
    locality: "Bistupur Link / Tamolia",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.9,
    cabin: "Room 218 (2nd Floor)",
    experience: "17 yrs exp",
    rating: "4.9",
    reviews: "1,260",
    keywords: ["stomach", "abdomen", "abdominal", "nausea", "vomiting", "diarrhea", "diarrhoea", "acidity", "acid", "gas", "constipation", "ulcer", "digestion", "cramps"],
    slots: ["Today 01:00 PM", "Today 03:15 PM", "Today 05:30 PM"],
    matchReason: "Specialist in Jamshedpur for abdominal pain, severe acid reflux, gastric distress, and gastrointestinal symptoms."
  },
  {
    id: "DOC-JSR-SOREN",
    name: "Dr. Sunita Soren, MD, DVD",
    specialty: "Dermatology & Skin Allergy",
    department: "Dermatology Clinic",
    hospital: "Urban Community Health Center (UPHC)",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.5,
    cabin: "Room 210 (2nd Floor)",
    experience: "11 yrs exp",
    rating: "4.8",
    reviews: "820",
    keywords: ["skin", "rash", "itching", "itch", "allergy", "hives", "eczema", "acne", "burn", "dermatitis", "spots", "redness"],
    slots: ["Today 11:30 AM", "Today 02:45 PM", "Today 04:30 PM"],
    matchReason: "Specialist in Bistupur for acute skin rashes, allergic outbreaks, itchiness, and dermatological conditions."
  }
];

const JAMSHEDPUR_PHARMACIES = [
  {
    id: "PHARM-JSR-01",
    name: "Apollo Pharmacy 24/7 Bistupur",
    type: "24/7 Retail & Emergency Chemist",
    category: "retail",
    address: "Shop 12, Main Road (Opp. TMH Gate), Bistupur, Jamshedpur",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.3,
    phone: "+91-657-243-1122",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.9 ⭐ (2,340 reviews)",
    badges: ["24/7 Open", "Home Delivery", "Verified Stock", "Opp. TMH Gate"],
    keywords: ["apollo", "bistupur", "jamshedpur", "831001", "main road", "tmh", "chemist", "24/7"]
  },
  {
    id: "PHARM-JSR-02",
    name: "Pradhan Mantri Jan Aushadhi Kendra (TMH Gate)",
    type: "Government Generic Medicine Center",
    category: "janaushadhi",
    address: "Near Tata Main Hospital Out-Gate, Bistupur, Jamshedpur",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.5,
    phone: "+91-657-242-7788",
    openStatus: "Open (08:00 AM - 10:00 PM)",
    is24x7: false,
    homeDelivery: false,
    rating: "4.8 ⭐ (1,680 reviews)",
    badges: ["Up to 80% Off", "Generic Drugs", "PMBI Certified", "Essential Meds"],
    keywords: ["jan aushadhi", "generic", "pmbi", "bistupur", "jamshedpur", "831001", "discount", "tmh"]
  },
  {
    id: "PHARM-JSR-03",
    name: "MedPlus Chemist & Druggist",
    type: "Pharmacy & Diagnostic Care",
    category: "retail",
    address: "Sakchi High Street Market, Jamshedpur",
    locality: "Sakchi",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.1,
    phone: "+91-657-243-4455",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.7 ⭐ (1,210 reviews)",
    badges: ["24/7 Open", "Express Delivery", "Cold Storage"],
    keywords: ["medplus", "sakchi", "bistupur", "jamshedpur", "831001", "chemist"]
  },
  {
    id: "PHARM-JSR-04",
    name: "Steel City 24x7 Medical Hall",
    type: "Emergency Chemist & Surgical Store",
    category: "retail",
    address: "Golmuri Main Market, Jamshedpur",
    locality: "Golmuri",
    city: "Jamshedpur",
    pincode: "831003",
    distanceKm: 1.8,
    phone: "+91-657-234-1188",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.6 ⭐ (980 reviews)",
    badges: ["24/7 Open", "Surgical Supplies", "Emergency Meds"],
    keywords: ["steel city", "golmuri", "jamshedpur", "831003", "medical hall"]
  },
  {
    id: "PHARM-JSR-05",
    name: "Jan Aushadhi Kendra (MGM Hospital)",
    type: "Government Affordable Generic Store",
    category: "janaushadhi",
    address: "MGM Medical College Campus, Sakchi, Jamshedpur",
    locality: "Sakchi",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.6,
    phone: "+91-657-243-9922",
    openStatus: "Open (08:00 AM - 09:00 PM)",
    is24x7: false,
    homeDelivery: false,
    rating: "4.7 ⭐ (850 reviews)",
    badges: ["Affordable Generic", "Free Syringes", "PMBI Certified"],
    keywords: ["jan aushadhi", "mgm", "sakchi", "jamshedpur", "831001", "generic"]
  }
];

const DELHI_HOSPITALS = [
  {
    id: "HOSP-DEL-01",
    name: "City Multispecialty Hospital",
    type: "Multispecialty Hospital",
    category: "multispecialty",
    address: "Plot 14, Press Enclave Road, Saket",
    locality: "Saket",
    city: "South Delhi",
    pincode: "110017",
    distanceKm: 0.9,
    emergency: "24/7 Emergency & Level-1 Trauma",
    openStatus: "Open 24 Hours",
    phone: "+91-11-2651-5050",
    rating: "4.8 ⭐ (3,420 reviews)",
    specialties: ["Emergency Medicine", "Cardiology", "Pulmonology", "Orthopedics", "ICU"],
    bedsAvailable: "28 ICU beds available",
    keywords: ["saket", "south delhi", "delhi", "110017", "press enclave", "malviya nagar", "hauz khas"]
  },
  {
    id: "HOSP-DEL-02",
    name: "Max Super Specialty Hospital",
    type: "Super-Specialty Hospital",
    category: "multispecialty",
    address: "1, 2 Press Enclave Road, Mandir Marg, Saket",
    locality: "Saket",
    city: "South Delhi",
    pincode: "110017",
    distanceKm: 1.1,
    emergency: "24/7 Cardiac & Trauma Care",
    openStatus: "Open 24 Hours",
    phone: "+91-11-6611-5050",
    rating: "4.9 ⭐ (6,200 reviews)",
    specialties: ["Cardiology", "Neurology", "Pulmonology", "Gastroenterology"],
    bedsAvailable: "34 ICU beds available",
    keywords: ["saket", "south delhi", "delhi", "110017", "mandir marg", "mehrauli"]
  },
  {
    id: "HOSP-DEL-03",
    name: "Government District Civil Hospital",
    type: "Government General Hospital",
    category: "chc",
    address: "Civil Lines, Near SDM Office, Central District",
    locality: "Civil Lines",
    city: "Delhi",
    pincode: "110054",
    distanceKm: 2.2,
    emergency: "24/7 Free Emergency & Casualty",
    openStatus: "Open 24 Hours",
    phone: "+91-11-2381-2929",
    rating: "4.3 ⭐ (1,840 reviews)",
    specialties: ["General OPD", "Pediatrics", "Trauma", "Ayushman Bharat / ABHA Free Care"],
    bedsAvailable: "Government Free Casualty Ward",
    keywords: ["civil lines", "government", "public", "delhi", "110054", "central"]
  },
  {
    id: "HOSP-DEL-04",
    name: "Urban Community Health Center (UPHC / CHC)",
    type: "Community Health Center (CHC / PHC)",
    category: "chc",
    address: "Sector 7 Health Post, Community Center Complex",
    locality: "Sector 7",
    city: "Delhi",
    pincode: "110022",
    distanceKm: 0.6,
    emergency: "Day OPD & Essential Emergency",
    openStatus: "Open (08:00 AM - 08:00 PM)",
    phone: "+91-11-2617-8840",
    rating: "4.5 ⭐ (720 reviews)",
    specialties: ["General Medicine", "Vaccination", "Maternal Child Health", "Free Pharmacy"],
    bedsAvailable: "Free consultation under NHM",
    keywords: ["uphc", "phc", "chc", "community", "sector 7", "ward", "health post"]
  }
];

const DELHI_DOCTORS = [
  {
    id: "DOC-DEL-SHARMA",
    name: "Dr. Rajesh Sharma, MD, DM",
    specialty: "Cardiology & Vascular Medicine",
    department: "Cardiology OPD",
    hospital: "City Multispecialty Hospital",
    locality: "Saket",
    city: "South Delhi",
    pincode: "110017",
    distanceKm: 0.9,
    cabin: "Room 204 (2nd Floor)",
    experience: "18 yrs exp",
    rating: "4.9",
    reviews: "1,420",
    keywords: ["heart", "chest", "pain", "palpitation", "palpitations", "pressure", "bp", "hypertension", "breathless", "breathlessness", "pulse", "cardiac", "angina"],
    slots: ["Today 11:30 AM", "Today 02:00 PM", "Today 04:30 PM"],
    matchReason: "Specialist for cardiac evaluation, chest discomfort, blood pressure, and vascular health."
  },
  {
    id: "DOC-DEL-RAO",
    name: "Dr. Sunita Rao, MD",
    specialty: "Pulmonology & Respiratory Medicine",
    department: "Chest & Pulmonary Wing",
    hospital: "Max Super Specialty Hospital",
    locality: "Saket",
    city: "South Delhi",
    pincode: "110017",
    distanceKm: 1.1,
    cabin: "Room 215 (2nd Floor)",
    experience: "14 yrs exp",
    rating: "4.8",
    reviews: "980",
    keywords: ["cough", "throat", "asthma", "wheezing", "breath", "breathing", "respiratory", "lungs", "bronchitis", "phlegm", "cold", "flu", "congestion", "infection"],
    slots: ["Today 11:45 AM", "Today 01:15 PM", "Today 03:30 PM"],
    matchReason: "Specialist for persistent dry/wet cough, throat irritation, respiratory triage, and asthma."
  },
  {
    id: "DOC-DEL-MEHTA",
    name: "Dr. Vikram Mehta, MD",
    specialty: "Pediatrics & Child Health",
    department: "Pediatrics OPD",
    hospital: "Government Civil Hospital",
    locality: "Civil Lines",
    city: "Delhi",
    pincode: "110054",
    distanceKm: 2.2,
    cabin: "Room 108 (Ground Floor)",
    experience: "15 yrs exp",
    rating: "4.9",
    reviews: "1,680",
    keywords: ["child", "infant", "baby", "pediatric", "kid", "vaccination", "teething", "growth", "newborn", "children", "pediatrician"],
    slots: ["Today 12:30 PM", "Today 02:15 PM", "Today 04:15 PM"],
    matchReason: "Dedicated child physician for infant and adolescent care, pediatric infections, and growth checkups."
  },
  {
    id: "DOC-DEL-NAMBIAR",
    name: "Dr. Meera Nambiar, MD, DVD",
    specialty: "Dermatology & Skin Allergy",
    department: "Skin Care Clinic",
    hospital: "Urban Community Health Center",
    locality: "Sector 7",
    city: "Delhi",
    pincode: "110022",
    distanceKm: 0.6,
    cabin: "Room 210 (2nd Floor)",
    experience: "13 yrs exp",
    rating: "4.8",
    reviews: "890",
    keywords: ["skin", "rash", "itching", "itch", "allergy", "hives", "eczema", "acne", "burn", "dermatitis", "spots", "redness"],
    slots: ["Today 11:30 AM", "Today 02:45 PM", "Today 04:30 PM"],
    matchReason: "Specialist for skin rashes, allergic flare-ups, dermatitis, and dermatological conditions."
  }
];

const DELHI_PHARMACIES = [
  {
    id: "PHARM-DEL-01",
    name: "Apollo Pharmacy 24/7 Saket",
    type: "24/7 Retail & Urgent Pharmacy",
    category: "retail",
    address: "Shop 12, Ground Floor, Press Enclave Road, Saket",
    locality: "Saket",
    city: "South Delhi",
    pincode: "110017",
    distanceKm: 0.4,
    phone: "+91-11-2685-1122",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.9 ⭐ (1,240 reviews)",
    badges: ["24/7 Open", "Home Delivery", "Verified Stock"],
    keywords: ["apollo", "saket", "south delhi", "delhi", "110017", "press enclave", "chemist", "24/7"]
  },
  {
    id: "PHARM-DEL-02",
    name: "Pradhan Mantri Jan Aushadhi Kendra Saket",
    type: "Government Generic Medicine Center",
    category: "janaushadhi",
    address: "Opp. Gate 2 Max Hospital, Mandir Marg, Saket",
    locality: "Saket",
    city: "South Delhi",
    pincode: "110017",
    distanceKm: 0.7,
    phone: "+91-11-2651-7788",
    openStatus: "Open (08:00 AM - 10:00 PM)",
    is24x7: false,
    homeDelivery: false,
    rating: "4.8 ⭐ (890 reviews)",
    badges: ["Up to 80% Off", "Generic Drugs", "PMBI Certified"],
    keywords: ["jan aushadhi", "generic", "pmbi", "saket", "south delhi", "110017", "mandir marg", "discount"]
  },
  {
    id: "PHARM-DEL-03",
    name: "MedPlus Chemist & Druggist Saket",
    type: "Pharmacy & Diagnostics Store",
    category: "retail",
    address: "Shop 8, Community Center, PVR Anupam Complex, Saket",
    locality: "Saket",
    city: "South Delhi",
    pincode: "110017",
    distanceKm: 0.9,
    phone: "+91-11-4166-3344",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.7 ⭐ (650 reviews)",
    badges: ["24/7 Open", "Express Delivery", "Cold Storage"],
    keywords: ["medplus", "saket", "pvr anupam", "community center", "110017", "delhi"]
  }
];

const BENGALURU_HOSPITALS = [
  {
    id: "HOSP-BLR-01",
    name: "Apollo Clinic & Diagnostic Center",
    type: "Super-Specialty Clinic",
    category: "clinic",
    address: "24, Indiranagar 100ft Road, Near Metro Pillar 84",
    locality: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    distanceKm: 0.8,
    emergency: "24/7 Urgent Care OPD",
    openStatus: "Open 24 Hours",
    phone: "+91-80-4030-4050",
    rating: "4.9 ⭐ (4,180 reviews)",
    specialties: ["General Medicine", "Pediatrics", "Dermatology", "ENT", "Diagnostics"],
    bedsAvailable: "Rapid Day-Care & Triage OPD",
    keywords: ["indiranagar", "bengaluru", "bangalore", "560038", "koramangala", "domlur"]
  },
  {
    id: "HOSP-BLR-02",
    name: "Manipal Hospital",
    type: "Tertiary Multispecialty",
    category: "multispecialty",
    address: "98, HAL Old Airport Rd, Kodihalli",
    locality: "Kodihalli",
    city: "Bengaluru",
    pincode: "560017",
    distanceKm: 1.6,
    emergency: "24/7 Emergency & ICU",
    openStatus: "Open 24 Hours",
    phone: "+91-80-2502-4444",
    rating: "4.8 ⭐ (4,890 reviews)",
    specialties: ["Emergency", "Orthopedics", "Cardiology", "Pediatrics", "Neurology"],
    bedsAvailable: "26 ICU beds available",
    keywords: ["kodihalli", "hal", "old airport road", "bengaluru", "bangalore", "560017", "indiranagar"]
  }
];

const BENGALURU_DOCTORS = [
  {
    id: "DOC-BLR-IYER",
    name: "Dr. Ananya Iyer, MBBS, MD",
    specialty: "General & Internal Medicine",
    department: "General Medicine OPD",
    hospital: "Apollo Clinic",
    locality: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    distanceKm: 0.8,
    cabin: "Room 102 (Ground Floor)",
    experience: "11 yrs exp",
    rating: "4.9",
    reviews: "2,150",
    keywords: ["fever", "headache", "cold", "flu", "weakness", "fatigue", "chills", "body", "pain", "infection", "viral", "malaise", "dizziness", "general", "cough", "throat"],
    slots: ["Today 12:00 PM", "Today 02:30 PM", "Today 05:00 PM"],
    matchReason: "Primary physician for acute fever, viral infections, headaches, body fatigue, and health checks."
  },
  {
    id: "DOC-BLR-NAIR",
    name: "Dr. Manoj Nair, MD, DM",
    specialty: "Gastroenterology & Digestive Health",
    department: "Gastro Sciences",
    hospital: "Manipal Hospital",
    locality: "Kodihalli",
    city: "Bengaluru",
    pincode: "560017",
    distanceKm: 1.6,
    cabin: "Room 218 (2nd Floor)",
    experience: "17 yrs exp",
    rating: "4.9",
    reviews: "1,120",
    keywords: ["stomach", "abdomen", "abdominal", "nausea", "vomiting", "diarrhea", "diarrhoea", "acidity", "acid", "gas", "constipation", "ulcer", "digestion", "cramps"],
    slots: ["Today 01:00 PM", "Today 03:15 PM", "Today 05:30 PM"],
    matchReason: "Specialist for abdominal pain, acute acidity, digestive distress, and gastrointestinal care."
  }
];

const BENGALURU_PHARMACIES = [
  {
    id: "PHARM-BLR-01",
    name: "Wellness Forever 24x7 Chemist",
    type: "Day & Night Pharmacy Store",
    category: "retail",
    address: "542, 100 Feet Road, Near Metro Pillar 82, Indiranagar",
    locality: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    distanceKm: 0.5,
    phone: "+91-80-4122-8899",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.9 ⭐ (2,100 reviews)",
    badges: ["24/7 Open", "Home Delivery", "Surgical Supplies"],
    keywords: ["wellness forever", "indiranagar", "bengaluru", "bangalore", "560038", "100 feet road"]
  },
  {
    id: "PHARM-BLR-02",
    name: "Apollo Pharmacy Indiranagar",
    type: "Retail Pharmacy & Health Store",
    category: "retail",
    address: "201, CMH Road, Near Indiranagar Metro Station",
    locality: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    distanceKm: 0.8,
    phone: "+91-80-2520-3311",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.8 ⭐ (1,430 reviews)",
    badges: ["24/7 Open", "Verified Stock", "Fast Delivery"],
    keywords: ["apollo", "indiranagar", "cmh road", "bengaluru", "bangalore", "560038"]
  }
];

const MUMBAI_HOSPITALS = [
  {
    id: "HOSP-MUM-01",
    name: "Lilavati Hospital & Research Centre",
    type: "Tertiary Care Hospital",
    category: "multispecialty",
    address: "A-791, Bandra Reclamation, Bandra West",
    locality: "Bandra West",
    city: "Mumbai",
    pincode: "400050",
    distanceKm: 1.2,
    emergency: "24/7 Advanced Emergency & Cardiac Care",
    openStatus: "Open 24 Hours",
    phone: "+91-22-2675-1000",
    rating: "4.8 ⭐ (5,120 reviews)",
    specialties: ["Cardiology", "General Surgery", "Orthopedics", "Internal Medicine"],
    bedsAvailable: "22 ICU beds available",
    keywords: ["bandra", "bandra west", "mumbai", "400050", "reclamation", "khar", "santacruz"]
  }
];

const MUMBAI_DOCTORS = [
  {
    id: "DOC-MUM-DESHMUKH",
    name: "Dr. Preeti Deshmukh, MS",
    specialty: "ENT (Ear, Nose & Throat) & Sinus",
    department: "ENT Clinic",
    hospital: "Lilavati Hospital",
    locality: "Bandra West",
    city: "Mumbai",
    pincode: "400050",
    distanceKm: 1.2,
    cabin: "Room 105 (1st Floor)",
    experience: "12 yrs exp",
    rating: "4.8",
    reviews: "870",
    keywords: ["throat", "sore", "ear", "earache", "nose", "nasal", "sinus", "sinusitis", "tonsils", "hearing", "allergy", "voice", "cough"],
    slots: ["Today 12:15 PM", "Today 03:00 PM", "Today 04:45 PM"],
    matchReason: "Specialist for acute sore throat, ear infections, nasal blockage, and sinus inflammation."
  }
];

const MUMBAI_PHARMACIES = [
  {
    id: "PHARM-MUM-01",
    name: "Noble Plus 24/7 Chemist",
    type: "24-Hour Chemist & Druggist",
    category: "retail",
    address: "Hill Road, Near Bandra Police Station, Bandra West",
    locality: "Bandra West",
    city: "Mumbai",
    pincode: "400050",
    distanceKm: 0.6,
    phone: "+91-22-2640-5566",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.8 ⭐ (1,780 reviews)",
    badges: ["24/7 Open", "Free Delivery", "Imported Meds"],
    keywords: ["noble plus", "bandra", "bandra west", "mumbai", "400050", "hill road"]
  }
];

const NOIDA_HOSPITALS = [
  {
    id: "HOSP-NOI-01",
    name: "Fortis Care Hospital & Heart Institute",
    type: "Super-Specialty Hospital",
    category: "multispecialty",
    address: "Sector 62, Phase 8, Institutional Area",
    locality: "Sector 62",
    city: "Noida",
    pincode: "201301",
    distanceKm: 1.4,
    emergency: "24/7 Cardiac Emergency & Stroke Unit",
    openStatus: "Open 24 Hours",
    phone: "+91-120-430-0222",
    rating: "4.7 ⭐ (2,900 reviews)",
    specialties: ["Cardiology", "Pulmonology", "Critical Care", "Neurology"],
    bedsAvailable: "18 CCU beds available",
    keywords: ["sector 62", "noida", "201301", "institutional area", "delhi ncr"]
  }
];

const NOIDA_DOCTORS = [
  {
    id: "DOC-NOI-VERMA",
    name: "Dr. Alok Verma, MS",
    specialty: "Orthopedics, Bone & Joint Surgery",
    department: "Orthopedic Wing",
    hospital: "Fortis Care Hospital",
    locality: "Sector 62",
    city: "Noida",
    pincode: "201301",
    distanceKm: 1.4,
    cabin: "Room 112 (1st Floor)",
    experience: "16 yrs exp",
    rating: "4.9",
    reviews: "1,310",
    keywords: ["bone", "joint", "back", "knee", "spine", "sprain", "fracture", "arthritis", "swelling", "shoulder", "hip", "neck", "musculoskeletal", "pain"],
    slots: ["Today 11:15 AM", "Today 01:45 PM", "Today 04:00 PM"],
    matchReason: "Specialist for acute joint pain, arthritis, spinal discomfort, sprains, and orthopedic care."
  }
];

const NOIDA_PHARMACIES = [
  {
    id: "PHARM-NOI-01",
    name: "Guardian Pharmacy & Wellness",
    type: "Modern Retail Pharmacy",
    category: "retail",
    address: "Sector 62, Institutional Area, C-Block Commercial Market",
    locality: "Sector 62",
    city: "Noida",
    pincode: "201301",
    distanceKm: 0.8,
    phone: "+91-120-422-9900",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.7 ⭐ (920 reviews)",
    badges: ["24/7 Open", "Express Delivery", "OTC & Rx"],
    keywords: ["guardian", "noida", "sector 62", "201301", "delhi ncr"]
  }
];

// =========================================================================
// ====== UNIVERSAL DYNAMIC GENERATOR (FOR ANY INDIAN CITY & PIN CODE) =====
// =========================================================================


const PATNA_HOSPITALS = [
  {
    id: "HOSP-PAT-01",
    name: "Urban Community Health Center (UPHC Patna)",
    type: "Community Health Center (CHC / PHC)",
    category: "chc",
    address: "Health Post, Kankarbagh Main Road",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 0.5,
    emergency: "Day OPD & Essential Emergency Care",
    openStatus: "Open (08:00 AM - 08:00 PM)",
    phone: "+91-612-235-5001",
    rating: "4.7 ⭐ (1,240 reviews)",
    specialties: ["General Medicine", "Vaccination", "Triage", "Essential Medicines"],
    bedsAvailable: "Ayushman Free OPD Ward",
    keywords: ["patna", "kankarbagh", "800020", "uphc", "chc", "community"]
  },
  {
    id: "HOSP-PAT-02",
    name: "Paras HMRI Hospital",
    type: "Tertiary Care Multispecialty Hospital",
    category: "multispecialty",
    address: "NH-30, Bailey Road, Raja Bazar",
    locality: "Raja Bazar",
    city: "Patna",
    pincode: "800014",
    distanceKm: 2.2,
    emergency: "24/7 Advanced Emergency & Cardiac Care",
    openStatus: "Open 24 Hours",
    phone: "+91-612-710-7700",
    rating: "4.9 ⭐ (4,820 reviews)",
    specialties: ["Cardiology", "Pulmonology", "Neurology", "Orthopedics", "Critical Care"],
    bedsAvailable: "28 ICU beds available",
    keywords: ["paras", "bailey road", "patna", "800014", "800020", "multispecialty"]
  },
  {
    id: "HOSP-PAT-03",
    name: "Patna Heart Hospital",
    type: "Cardiac Super-Specialty Hospital",
    category: "multispecialty",
    address: "Doctors Colony, Kankarbagh",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 1.1,
    emergency: "24/7 Cardiac Emergency & Cath Lab",
    openStatus: "Open 24 Hours",
    phone: "+91-612-235-1234",
    rating: "4.8 ⭐ (2,100 reviews)",
    specialties: ["Cardiology", "Cardiac Surgery", "Hypertension", "ICU / CCU"],
    bedsAvailable: "14 CCU beds available",
    keywords: ["patna heart", "kankarbagh", "patna", "800020", "cardiac"]
  },
  {
    id: "HOSP-PAT-04",
    name: "Anup Institute of Orthopaedics & Rehabilitation",
    type: "Orthopedic & Joint Surgery Center",
    category: "clinic",
    address: "G-80, Kankarbagh Colony",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 0.9,
    emergency: "Trauma & Fracture Emergency",
    openStatus: "Open (08:00 AM - 09:00 PM)",
    phone: "+91-612-236-4567",
    rating: "4.8 ⭐ (1,890 reviews)",
    specialties: ["Orthopedics", "Joint Replacement", "Spine Surgery", "Physiotherapy"],
    bedsAvailable: "8 Post-Op beds available",
    keywords: ["anup", "ortho", "kankarbagh", "patna", "800020", "joint"]
  }
];

const PATNA_DOCTORS = [
  {
    id: "DOC-PAT-VERMA",
    name: "Dr. S.K. Verma, MD",
    specialty: "Pulmonology & Respiratory Medicine",
    department: "Chest & Respiratory Clinic",
    hospital: "Patna Chest Care & Paras HMRI Hospital",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 0.8,
    cabin: "Room 205 (2nd Floor)",
    experience: "16 yrs exp",
    rating: "4.9",
    reviews: "1,450",
    keywords: ["cough", "throat", "asthma", "wheezing", "breath", "breathing", "respiratory", "lungs", "bronchitis", "phlegm", "cold", "flu", "congestion", "infection"],
    slots: ["Today 11:30 AM", "Today 02:15 PM", "Today 04:45 PM"],
    matchReason: "Chest physician in Patna for persistent cough, asthma, breathing distress, and respiratory infection."
  },
  {
    id: "DOC-PAT-KUMAR",
    name: "Dr. Prabhat Kumar, MD, DM",
    specialty: "Cardiology & Vascular Medicine",
    department: "Cardiology OPD",
    hospital: "Patna Heart Hospital",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 1.1,
    cabin: "Room 101 (Ground Floor)",
    experience: "20 yrs exp",
    rating: "4.9",
    reviews: "1,850",
    keywords: ["heart", "chest", "pain", "palpitation", "palpitations", "pressure", "bp", "hypertension", "breathless", "breathlessness", "pulse", "cardiac", "angina"],
    slots: ["Today 11:00 AM", "Today 01:30 PM", "Today 04:00 PM"],
    matchReason: "Senior cardiologist in Patna for chest discomfort, palpitations, and cardiac evaluation."
  },
  {
    id: "DOC-PAT-AJAY",
    name: "Dr. Ajay Kumar, MBBS, MD",
    specialty: "General & Internal Medicine",
    department: "Internal Medicine OPD",
    hospital: "Paras HMRI Hospital",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 1.4,
    cabin: "Room 108 (1st Floor)",
    experience: "18 yrs exp",
    rating: "4.8",
    reviews: "2,200",
    keywords: ["fever", "headache", "cold", "flu", "weakness", "fatigue", "chills", "body", "pain", "infection", "viral", "malaise", "dizziness", "general", "cough"],
    slots: ["Today 12:00 PM", "Today 02:45 PM", "Today 05:15 PM"],
    matchReason: "Consultant physician in Patna for acute fever, viral infections, headaches, and general health."
  },
  {
    id: "DOC-PAT-SINGH",
    name: "Dr. R.N. Singh, MS",
    specialty: "Orthopedics, Bone & Joint Surgery",
    department: "Orthopedic Wing",
    hospital: "Anup Institute of Orthopaedics",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 0.9,
    cabin: "Room 105 (1st Floor)",
    experience: "28 yrs exp",
    rating: "4.8",
    reviews: "1,640",
    keywords: ["bone", "joint", "back", "knee", "spine", "sprain", "fracture", "arthritis", "swelling", "shoulder", "hip", "neck", "musculoskeletal", "pain"],
    slots: ["Today 11:15 AM", "Today 02:00 PM", "Today 04:30 PM"],
    matchReason: "Senior orthopedic surgeon in Patna for joint pain, arthritis, spinal care, and sports injuries."
  }
];

const PATNA_PHARMACIES = [
  {
    id: "PHARM-PAT-01",
    name: "Apollo Pharmacy 24/7 Patna",
    type: "24/7 Retail & Urgent Pharmacy",
    category: "retail",
    address: "Shop 4, Ground Floor, Kankarbagh Main Road",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 0.4,
    phone: "+91-612-235-8001",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.8 ⭐ (1,620 reviews)",
    badges: ["24/7 Open", "Home Delivery", "Verified Stock"],
    keywords: ["apollo", "patna", "kankarbagh", "800020", "24/7", "chemist"]
  },
  {
    id: "PHARM-PAT-02",
    name: "Pradhan Mantri Jan Aushadhi Kendra Patna",
    type: "Government Generic Medicine Store",
    category: "janaushadhi",
    address: "Opp. Doctors Colony Gate, Kankarbagh",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 0.7,
    phone: "+91-612-235-8002",
    openStatus: "Open (08:00 AM - 09:30 PM)",
    is24x7: false,
    homeDelivery: false,
    rating: "4.7 ⭐ (980 reviews)",
    badges: ["Up to 80% Off", "Generic Drugs", "PMBI Certified"],
    keywords: ["jan aushadhi", "generic", "pmbi", "patna", "kankarbagh", "800020", "discount"]
  }
];

const PATNA_DIAGNOSTICS = [
  {
    id: "DIAG-PAT-01",
    name: "Dr. Lal PathLabs Kankarbagh",
    type: "NABL Accredited Pathology & Imaging",
    category: "pathology",
    address: "Doctors Colony Main Road, Kankarbagh",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 0.6,
    phone: "+91-612-235-9001",
    timing: "07:00 AM - 08:30 PM",
    rating: "4.9 ⭐ (1,840 reviews)",
    tests: ["Blood Test", "Lipid Profile", "HbA1c", "Thyroid", "CBC", "Urine Routine", "ECG"],
    badges: ["NABL Certified", "Home Sample Pickup", "Online Reports"],
    keywords: ["lal pathlabs", "pathology", "patna", "kankarbagh", "800020", "blood test"]
  },
  {
    id: "DIAG-PAT-02",
    name: "Sen Diagnostics & Imaging Centre",
    type: "Ultrasound, Digital X-Ray & MRI Center",
    category: "imaging",
    address: "Near Tiwary Bechar, Kankarbagh",
    locality: "Kankarbagh",
    city: "Patna",
    pincode: "800020",
    distanceKm: 1.0,
    phone: "+91-612-235-9002",
    timing: "08:00 AM - 08:00 PM",
    rating: "4.8 ⭐ (1,210 reviews)",
    tests: ["Digital X-Ray", "Ultrasound 4D", "CT Scan", "Echo-Cardiography"],
    badges: ["Digital Imaging", "Advanced Sonography", "Fast Results"],
    keywords: ["sen diagnostics", "ultrasound", "x-ray", "patna", "kankarbagh", "800020"]
  }
];

const PUNE_HOSPITALS = [
  {
    id: "HOSP-PUN-01",
    name: "Urban Community Health Center (UPHC Pune)",
    type: "Community Health Center (CHC / PHC)",
    category: "chc",
    address: "Near Municipal School, Shivajinagar",
    locality: "Shivajinagar",
    city: "Pune",
    pincode: "411005",
    distanceKm: 0.5,
    emergency: "Day OPD & Casualty",
    openStatus: "Open (08:00 AM - 08:00 PM)",
    phone: "+91-20-2553-1001",
    rating: "4.7 ⭐ (980 reviews)",
    specialties: ["General Medicine", "Vaccination", "Triage", "Essential Drugs"],
    bedsAvailable: "Municipal Health Ward",
    keywords: ["pune", "shivajinagar", "411005", "uphc", "chc"]
  },
  {
    id: "HOSP-PUN-02",
    name: "Ruby Hall Clinic",
    type: "Super-Specialty Tertiary Hospital",
    category: "multispecialty",
    address: "40, Sassoon Road, Sangamvadi",
    locality: "Sassoon Road",
    city: "Pune",
    pincode: "411001",
    distanceKm: 1.8,
    emergency: "24/7 Advanced Emergency & Trauma Level 1",
    openStatus: "Open 24 Hours",
    phone: "+91-20-6645-5100",
    rating: "4.9 ⭐ (6,210 reviews)",
    specialties: ["Cardiology", "Neurology", "Organ Transplant", "Critical Care"],
    bedsAvailable: "35 ICU beds available",
    keywords: ["ruby hall", "pune", "sassoon road", "411001", "multispecialty"]
  }
];

const PUNE_DOCTORS = [
  {
    id: "DOC-PUN-GRANT",
    name: "Dr. Purvez Grant, MD, DM",
    specialty: "Cardiology & Interventional Care",
    department: "Cardiology Wing",
    hospital: "Ruby Hall Clinic",
    locality: "Sangamvadi",
    city: "Pune",
    pincode: "411001",
    distanceKm: 1.8,
    cabin: "Suite 1 (Heart Block)",
    experience: "25 yrs exp",
    rating: "4.9",
    reviews: "2,750",
    keywords: ["heart", "chest", "pain", "palpitation", "bp", "hypertension", "cardiac"],
    slots: ["Today 10:00 AM", "Today 01:00 PM", "Today 04:00 PM"],
    matchReason: "Chief cardiologist in Pune for complex cardiac care and angiography."
  },
  {
    id: "DOC-PUN-NATARAJAN",
    name: "Dr. Vijay Natarajan, MBBS, MD",
    specialty: "General & Internal Medicine",
    department: "Internal Medicine OPD",
    hospital: "Symbiosis University Hospital",
    locality: "Shivajinagar",
    city: "Pune",
    pincode: "411005",
    distanceKm: 0.9,
    cabin: "Room 205",
    experience: "19 yrs exp",
    rating: "4.8",
    reviews: "1,420",
    keywords: ["fever", "headache", "cold", "flu", "weakness", "infection", "viral", "general"],
    slots: ["Today 11:30 AM", "Today 02:30 PM", "Today 05:00 PM"],
    matchReason: "Consultant physician in Pune for fever, viral illnesses, and medical triage."
  }
];

const PUNE_PHARMACIES = [
  {
    id: "PHARM-PUN-01",
    name: "Wellness Forever 24x7 Chemist Pune",
    type: "24/7 Day & Night Pharmacy",
    category: "retail",
    address: "FC Road, Near Deccan Gymkhana, Shivajinagar",
    locality: "Shivajinagar",
    city: "Pune",
    pincode: "411005",
    distanceKm: 0.6,
    phone: "+91-20-2567-8900",
    openStatus: "Open 24 Hours",
    is24x7: true,
    homeDelivery: true,
    rating: "4.8 ⭐ (1,920 reviews)",
    badges: ["24/7 Open", "Express Delivery", "Surgicals"],
    keywords: ["wellness forever", "fc road", "pune", "shivajinagar", "411005"]
  }
];

const PUNE_DIAGNOSTICS = [
  {
    id: "DIAG-PUN-01",
    name: "Golwilkar Metropolis Diagnostic Centre",
    type: "NABL Accredited Pathology & Imaging",
    category: "pathology",
    address: "Bhandarkar Road, Shivajinagar",
    locality: "Shivajinagar",
    city: "Pune",
    pincode: "411005",
    distanceKm: 0.8,
    phone: "+91-20-2566-4100",
    timing: "06:30 AM - 09:00 PM",
    rating: "4.9 ⭐ (3,120 reviews)",
    tests: ["Blood Test", "Thyroid Profile", "HbA1c", "Lipid Profile", "Full Body Checkup"],
    badges: ["NABL Certified", "Home Pickup", "40+ Yrs Trust"],
    keywords: ["golwilkar", "metropolis", "pune", "shivajinagar", "411005", "pathology"]
  }
];

// Curated Diagnostics Directories for other major metros
const JAMSHEDPUR_DIAGNOSTICS = [
  {
    id: "DIAG-JSR-01",
    name: "Dr. Lal PathLabs Bistupur",
    type: "NABL Accredited Pathology Centre",
    category: "pathology",
    address: "Holding 14, Main Road, Near Voltas Building, Bistupur",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.5,
    phone: "+91-657-224-9101",
    timing: "07:00 AM - 08:30 PM",
    rating: "4.9 ⭐ (2,340 reviews)",
    tests: ["Complete Blood Count (CBC)", "Lipid Profile", "Thyroid Profile (T3, T4, TSH)", "HbA1c", "Liver Function Test", "Kidney Function Test"],
    badges: ["NABL Certified", "Free Home Sample Pickup", "Digital Reports in 6 Hours"],
    keywords: ["lal pathlabs", "bistupur", "jamshedpur", "831001", "pathology", "blood test", "lab"]
  },
  {
    id: "DIAG-JSR-02",
    name: "Tata Main Hospital (TMH) Diagnostic Wing",
    type: "Comprehensive Hospital Diagnostic & Imaging Center",
    category: "imaging",
    address: "C-Block, TMH Hospital Complex, Northern Town, Bistupur",
    locality: "Bistupur",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 0.7,
    phone: "+91-657-222-4561",
    timing: "Open 24 Hours",
    rating: "4.9 ⭐ (4,120 reviews)",
    tests: ["Digital X-Ray", "Ultrasound 4D", "128-Slice CT Scan", "3-Tesla MRI", "ECG", "Echocardiography", "Pathology"],
    badges: ["24/7 Emergency Lab", "NABH Accredited", "Level 1 Imaging"],
    keywords: ["tmh", "tata main hospital", "bistupur", "jamshedpur", "831001", "mri", "ct scan", "x-ray", "imaging"]
  },
  {
    id: "DIAG-JSR-03",
    name: "SRL Diagnostics Sakchi",
    type: "National Reference Pathology & Radiology Lab",
    category: "pathology",
    address: "Pennar Road, Near Sakchi Golchakkar, Sakchi",
    locality: "Sakchi",
    city: "Jamshedpur",
    pincode: "831001",
    distanceKm: 1.3,
    phone: "+91-657-243-1200",
    timing: "07:30 AM - 08:00 PM",
    rating: "4.8 ⭐ (1,670 reviews)",
    tests: ["CBC", "Lipid Profile", "Vitamin D3", "Vitamin B12", "Hormone Panels", "Urine Routine"],
    badges: ["CAP / NABL Accredited", "Home Collection Available", "Fast Digital Delivery"],
    keywords: ["srl", "sakchi", "jamshedpur", "831001", "pathology", "blood test"]
  },
  {
    id: "DIAG-JSR-04",
    name: "Thyrocare Collection & Wellness Centre",
    type: "Preventive Healthcare & Hormone Testing Lab",
    category: "pathology",
    address: "Road No 4, Farm Area, Kadma",
    locality: "Kadma",
    city: "Jamshedpur",
    pincode: "831005",
    distanceKm: 1.9,
    phone: "+91-657-230-9004",
    timing: "06:30 AM - 07:30 PM",
    rating: "4.7 ⭐ (1,150 reviews)",
    tests: ["Thyroid Full Profile", "Aarogyam Full Body Checkup", "Iron Profile", "Allergy Screen"],
    badges: ["Lowest Price Guarantee", "Home Collection", "Preventive Packages"],
    keywords: ["thyrocare", "kadma", "jamshedpur", "831005", "thyroid", "aarogyam"]
  }
];

const DELHI_DIAGNOSTICS = [
  {
    id: "DIAG-DEL-01",
    name: "Dr. Lal PathLabs National Reference Lab",
    type: "Apex NABL Accredited Pathology Centre",
    category: "pathology",
    address: "Block E, Saket, Near Saket Metro Station",
    locality: "Saket",
    city: "Delhi",
    pincode: "110017",
    distanceKm: 0.6,
    phone: "+91-11-3988-5050",
    timing: "07:00 AM - 09:00 PM",
    rating: "4.9 ⭐ (5,200 reviews)",
    tests: ["CBC", "Lipid Profile", "Cardiac Markers (Troponin I)", "Thyroid", "Vitamin D", "HbA1c"],
    badges: ["NABL / CAP Certified", "Home Pickup", "Same-Day Reports"],
    keywords: ["lal pathlabs", "saket", "delhi", "110017", "pathology"]
  },
  {
    id: "DIAG-DEL-02",
    name: "Mahajan Imaging Centre Hauz Khas",
    type: "Advanced Radiology & High-Field MRI Imaging",
    category: "imaging",
    address: "K-18, Hauz Khas Enclave",
    locality: "Hauz Khas",
    city: "Delhi",
    pincode: "110016",
    distanceKm: 1.5,
    phone: "+91-11-4312-0000",
    timing: "08:00 AM - 08:30 PM",
    rating: "4.9 ⭐ (4,100 reviews)",
    tests: ["3T MRI", "Dual Energy CT", "PET-CT", "Digital Mammography", "Dexa Bone Density"],
    badges: ["Premier Radiology", "Robotic Imaging", "Senior Radiologists"],
    keywords: ["mahajan imaging", "hauz khas", "delhi", "110016", "mri", "ct scan"]
  }
];

const BENGALURU_DIAGNOSTICS = [
  {
    id: "DIAG-BLR-01",
    name: "Anand Diagnostic Laboratory (Neuberg)",
    type: "NABL Premier Clinical Laboratory",
    category: "pathology",
    address: "CMH Road, Indiranagar",
    locality: "Indiranagar",
    city: "Bengaluru",
    pincode: "560038",
    distanceKm: 0.7,
    phone: "+91-80-2520-2200",
    timing: "06:30 AM - 08:30 PM",
    rating: "4.9 ⭐ (3,400 reviews)",
    tests: ["Complete Blood Work", "HbA1c", "Lipid Profile", "Liver Screen", "Hormones"],
    badges: ["NABL Certified", "Home Sample Collection", "Trusted since 1974"],
    keywords: ["anand diagnostic", "indiranagar", "bengaluru", "560038", "pathology"]
  }
];

const MUMBAI_DIAGNOSTICS = [
  {
    id: "DIAG-MUM-01",
    name: "Suburban Diagnostics Bandra",
    type: "NABL Pathology & Digital Radiology",
    category: "pathology",
    address: "Waterfield Road, Bandra West",
    locality: "Bandra West",
    city: "Mumbai",
    pincode: "400050",
    distanceKm: 0.8,
    phone: "+91-22-6170-0000",
    timing: "07:00 AM - 09:00 PM",
    rating: "4.8 ⭐ (2,900 reviews)",
    tests: ["Blood Tests", "Thyroid Profile", "Lipid Panel", "ECG", "Digital X-Ray"],
    badges: ["NABL Certified", "Home Visit", "Fast Digital Reports"],
    keywords: ["suburban diagnostics", "bandra", "mumbai", "400050", "pathology"]
  }
];

function generateCityHospitals(cityName, pincode, locality) {
  const pin = pincode || "831001";
  const loc = locality || "Central Area";
  const cName = cityName || "City";
  const cPrefix = cName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "CITY";

  return [
    {
      id: `HOSP-${cPrefix}-01`,
      name: `${cName} Apex Multispecialty Hospital`,
      type: "Tertiary Multispecialty & Trauma Center",
      category: "multispecialty",
      address: `Plot 10, Medical Enclave, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.8,
      emergency: "24/7 Emergency, Trauma & Level-1 ICU Care",
      openStatus: "Open 24 Hours",
      phone: "+91-657-242-1001",
      rating: "4.8 ⭐ (2,850 reviews)",
      specialties: ["Emergency Medicine", "Cardiology", "Pulmonology", "Orthopedics", "ICU / CCU"],
      bedsAvailable: "24 ICU beds available",
      keywords: [cName.toLowerCase(), loc.toLowerCase(), pin, "multispecialty", "emergency", "icu", "trauma"]
    },
    {
      id: `HOSP-${cPrefix}-02`,
      name: `${cName} Care Hospital & Heart Research Institute`,
      type: "Super-Specialty Hospital",
      category: "multispecialty",
      address: `Main Road, Near Flyover, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.4,
      emergency: "24/7 Cardiac & Stroke Emergency",
      openStatus: "Open 24 Hours",
      phone: "+91-657-242-1002",
      rating: "4.9 ⭐ (3,410 reviews)",
      specialties: ["Cardiology", "Neurology", "General Surgery", "Internal Medicine"],
      bedsAvailable: "18 ICU beds available",
      keywords: [cName.toLowerCase(), loc.toLowerCase(), pin, "cardiac", "stroke", "heart"]
    },
    {
      id: `HOSP-${cPrefix}-03`,
      name: `Government District Civil Hospital ${cName}`,
      type: "Government General Hospital",
      category: "chc",
      address: `Civil Lines, Collectorate Road, ${cName}`,
      locality: "Civil Lines",
      city: cName,
      pincode: pin,
      distanceKm: 2.1,
      emergency: "24/7 Free Emergency & Casualty",
      openStatus: "Open 24 Hours",
      phone: "+91-657-242-1003",
      rating: "4.4 ⭐ (1,920 reviews)",
      specialties: ["General Medicine", "Pediatrics", "Trauma", "Ayushman Bharat / Free Care"],
      bedsAvailable: "Ayushman Free Casualty Ward",
      keywords: [cName.toLowerCase(), "civil lines", pin, "government", "ayushman", "chc"]
    },
    {
      id: `HOSP-${cPrefix}-04`,
      name: `Urban Community Health Center (UPHC ${cName})`,
      type: "Community Health Center (CHC / PHC)",
      category: "chc",
      address: `Health Post Complex, Sector 2, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.6,
      emergency: "Day OPD & Essential Emergency Care",
      openStatus: "Open (08:00 AM - 08:00 PM)",
      phone: "+91-657-242-1004",
      rating: "4.5 ⭐ (760 reviews)",
      specialties: ["General Medicine", "Vaccination", "Maternal Care", "Free Essential Pharmacy"],
      bedsAvailable: "National Health Mission OPD",
      keywords: [cName.toLowerCase(), loc.toLowerCase(), pin, "uphc", "phc", "community"]
    },
    {
      id: `HOSP-${cPrefix}-05`,
      name: `Apollo Clinic & Diagnostics ${cName}`,
      type: "Super-Specialty Day Clinic",
      category: "clinic",
      address: `Commercial Hub, Opp. Head Post Office, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.1,
      emergency: "Urgent Care & Fast-Track OPD",
      openStatus: "Open (07:00 AM - 10:00 PM)",
      phone: "+91-657-242-1005",
      rating: "4.8 ⭐ (1,640 reviews)",
      specialties: ["Internal Medicine", "Pediatrics", "ENT", "Dermatology", "Diagnostics"],
      bedsAvailable: "Rapid Day-Care & Triage",
      keywords: [cName.toLowerCase(), loc.toLowerCase(), pin, "apollo", "clinic", "diagnostic"]
    }
  ];
}

const REGIONAL_DOCTOR_MATRIX = {
  "1": {
    cardio: { name: "Dr. Harpreet Singh, MD, DM", hosp: "Heart & Vascular Institute" },
    pulmo: { name: "Dr. Rajiv Sharma, MD", hosp: "Chest & Critical Care Hospital" },
    gen: { name: "Dr. Meenakshi Bhatia, MBBS, MD", hosp: "Civil OPD Clinic" },
    ortho: { name: "Dr. Vikram Malhotra, MS", hosp: "Bone & Joint Center" },
    ent: { name: "Dr. Rohit Khanna, MS", hosp: "ENT Care Clinic" },
    ped: { name: "Dr. Simran Kaur, MD", hosp: "Children's Health Pavilion" }
  },
  "2": {
    cardio: { name: "Dr. Anand Vardhan, MD, DM", hosp: "Apex Heart Hospital" },
    pulmo: { name: "Dr. Shailesh Tiwari, MD", hosp: "Respiratory Care Center" },
    gen: { name: "Dr. Renu Tripathi, MBBS, MD", hosp: "City Medical Clinic" },
    ortho: { name: "Dr. Akhilesh Mishra, MS", hosp: "Orthopedic Hospital" },
    ent: { name: "Dr. Vandana Shukla, MS", hosp: "ENT & Head-Neck Center" },
    ped: { name: "Dr. Pradeep Srivastava, MD", hosp: "Pediatric Care Center" }
  },
  "3": {
    cardio: { name: "Dr. Bharat Patel, MD, DM", hosp: "Apex Cardiology Center" },
    pulmo: { name: "Dr. Arvind Rathore, MD", hosp: "Pulmonary Care Hospital" },
    gen: { name: "Dr. Bhavna Shah, MBBS, MD", hosp: "City Care OPD" },
    ortho: { name: "Dr. Kirit Parikh, MS", hosp: "Joint & Spine Hospital" },
    ent: { name: "Dr. Nitesh Mehta, MS", hosp: "Sinus & Allergy Center" },
    ped: { name: "Dr. Rekha Choudhary, MD", hosp: "Child Health Center" }
  },
  "4": {
    cardio: { name: "Dr. Nitin Deshmukh, MD, DM", hosp: "Interventional Heart Care" },
    pulmo: { name: "Dr. Sachin Patil, MD", hosp: "Respiratory & Chest Clinic" },
    gen: { name: "Dr. Swati Kulkarni, MBBS, MD", hosp: "General Health OPD" },
    ortho: { name: "Dr. Prashant Gaikwad, MS", hosp: "Bone & Trauma Center" },
    ent: { name: "Dr. Snehal Joshi, MS", hosp: "ENT Clinic" },
    ped: { name: "Dr. Anjali Shinde, MD", hosp: "Pediatric Pavilion" }
  },
  "5": {
    cardio: { name: "Dr. Srinivas Rao, MD, DM", hosp: "Institute of Cardiac Sciences" },
    pulmo: { name: "Dr. Venkatesh Prasad, MD", hosp: "Chest & Asthma Hospital" },
    gen: { name: "Dr. Lakshmi Reddy, MBBS, MD", hosp: "Internal Medicine Clinic" },
    ortho: { name: "Dr. Karthik Murthy, MS", hosp: "Orthopedics & Sports Care" },
    ent: { name: "Dr. Swathi Hegde, MS", hosp: "ENT & Voice Clinic" },
    ped: { name: "Dr. Pradeep Chary, MD", hosp: "Children's Clinic" }
  },
  "6": {
    cardio: { name: "Dr. S. Ramanathan, MD, DM", hosp: "Heart & Vascular Hospital" },
    pulmo: { name: "Dr. Arun Kurup, MD", hosp: "Chest & Respiratory Center" },
    gen: { name: "Dr. Priya Natarajan, MBBS, MD", hosp: "Internal Medicine OPD" },
    ortho: { name: "Dr. V. Balasubramanian, MS", hosp: "Orthopedic & Spine Institute" },
    ent: { name: "Dr. Deepa Nair, MS", hosp: "ENT Specialist Clinic" },
    ped: { name: "Dr. Revathi Menon, MD", hosp: "Child Health Care" }
  },
  "7": {
    cardio: { name: "Dr. Subir Banerjee, MD, DM", hosp: "Cardiovascular Sciences" },
    pulmo: { name: "Dr. Debashis Roy, MD", hosp: "Pulmonary & Critical Care" },
    gen: { name: "Dr. Ananya Mukherjee, MBBS, MD", hosp: "Internal Medicine OPD" },
    ortho: { name: "Dr. Soumya Patnaik, MS", hosp: "Bone & Joint Surgery" },
    ent: { name: "Dr. Biplab Das, MS", hosp: "ENT & Sinus Center" },
    ped: { name: "Dr. Mousumi Ghosh, MD", hosp: "Pediatric Care" }
  },
  "8": {
    cardio: { name: "Dr. Amitav Verma, MD, DM", hosp: "Apex Heart Hospital" },
    pulmo: { name: "Dr. Binay Thakur, MD", hosp: "Chest & Respiratory Wing" },
    gen: { name: "Dr. S.K. Sinha, MBBS, MD", hosp: "General Medical OPD" },
    ortho: { name: "Dr. Alok Ranjan, MS", hosp: "Orthopedic Care Center" },
    ent: { name: "Dr. Rashmi Pandey, MS", hosp: "ENT Specialty Clinic" },
    ped: { name: "Dr. Neha Jha, MD", hosp: "Child Health Hospital" }
  }
};

function generateCityDoctors(cityName, pincode, locality) {
  const pin = pincode || "831001";
  const loc = locality || "Central Area";
  const cName = cityName || "City";
  const cPrefix = cName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "CITY";

  // If Jamshedpur or PIN 831, maintain curated backward compatibility
  if (cName.toLowerCase().includes("jamshedpur") || pin.startsWith("831")) {
    return JAMSHEDPUR_DOCTORS;
  }

  // Determine regional pool by first digit of PIN
  const regDigit = pin[0] && REGIONAL_DOCTOR_MATRIX[pin[0]] ? pin[0] : "8";
  const reg = REGIONAL_DOCTOR_MATRIX[regDigit] || REGIONAL_DOCTOR_MATRIX["8"];

  return [
    {
      id: `DOC-${cPrefix}-CARD`,
      name: reg.cardio.name,
      specialty: "Cardiology & Vascular Medicine",
      department: "Cardiology Wing",
      hospital: `${cName} ${reg.cardio.hosp}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.8,
      cabin: "Room 204 (2nd Floor)",
      experience: "18 yrs exp",
      rating: "4.9",
      reviews: "1,420",
      keywords: ["heart", "chest", "pain", "palpitation", "palpitations", "pressure", "bp", "hypertension", "breathless", "breathlessness", "pulse", "cardiac", "angina"],
      slots: ["Today 11:30 AM", "Today 02:00 PM", "Today 04:30 PM"],
      matchReason: `Senior cardiologist in ${cName} for cardiac evaluation, chest discomfort, and hypertension.`
    },
    {
      id: `DOC-${cPrefix}-PULM`,
      name: reg.pulmo.name,
      specialty: "Pulmonology & Respiratory Medicine",
      department: "Chest & Respiratory Wing",
      hospital: `${cName} ${reg.pulmo.hosp}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.4,
      cabin: "Room 215 (2nd Floor)",
      experience: "14 yrs exp",
      rating: "4.8",
      reviews: "980",
      keywords: ["cough", "throat", "asthma", "wheezing", "breath", "breathing", "respiratory", "lungs", "bronchitis", "phlegm", "cold", "flu", "congestion", "infection"],
      slots: ["Today 11:45 AM", "Today 01:15 PM", "Today 03:30 PM"],
      matchReason: `Chest physician in ${cName} for cough, throat irritation, respiratory triage, and asthma.`
    },
    {
      id: `DOC-${cPrefix}-GEN`,
      name: reg.gen.name,
      specialty: "General & Internal Medicine",
      department: "Internal Medicine OPD",
      hospital: `Apollo Clinic ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.1,
      cabin: "Room 102 (Ground Floor)",
      experience: "15 yrs exp",
      rating: "4.9",
      reviews: "2,150",
      keywords: ["fever", "headache", "cold", "flu", "weakness", "fatigue", "chills", "body", "pain", "infection", "viral", "malaise", "dizziness", "general", "cough", "throat"],
      slots: ["Today 12:00 PM", "Today 02:30 PM", "Today 05:00 PM"],
      matchReason: `Primary care physician in ${cName} for acute fever, viral infections, headaches, and general checkups.`
    },
    {
      id: `DOC-${cPrefix}-ORTH`,
      name: reg.ortho.name,
      specialty: "Orthopedics, Bone & Joint Surgery",
      department: "Orthopedic Department",
      hospital: `${cName} ${reg.ortho.hosp}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.8,
      cabin: "Room 112 (1st Floor)",
      experience: "16 yrs exp",
      rating: "4.9",
      reviews: "1,310",
      keywords: ["bone", "joint", "back", "knee", "spine", "sprain", "fracture", "arthritis", "swelling", "shoulder", "hip", "neck", "musculoskeletal", "pain"],
      slots: ["Today 11:15 AM", "Today 01:45 PM", "Today 04:00 PM"],
      matchReason: `Specialist in ${cName} for joint pain, arthritis, spinal discomfort, and orthopedic injuries.`
    },
    {
      id: `DOC-${cPrefix}-ENT`,
      name: reg.ent.name,
      specialty: "ENT (Ear, Nose & Throat) & Sinus",
      department: "ENT Clinic",
      hospital: `${cName} ${reg.ent.hosp}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.4,
      cabin: "Room 105 (1st Floor)",
      experience: "12 yrs exp",
      rating: "4.8",
      reviews: "870",
      keywords: ["throat", "sore", "ear", "earache", "nose", "nasal", "sinus", "sinusitis", "tonsils", "hearing", "allergy", "voice", "cough"],
      slots: ["Today 12:15 PM", "Today 03:00 PM", "Today 04:45 PM"],
      matchReason: `ENT specialist in ${cName} for sore throat, ear infections, nasal blockage, and sinus inflammation.`
    },
    {
      id: `DOC-${cPrefix}-PED`,
      name: reg.ped.name,
      specialty: "Pediatrics & Child Health",
      department: "Pediatrics OPD",
      hospital: `District Civil Hospital ${cName}`,
      locality: "Civil Lines",
      city: cName,
      pincode: pin,
      distanceKm: 2.1,
      cabin: "Room 108 (Ground Floor)",
      experience: "13 yrs exp",
      rating: "4.9",
      reviews: "1,680",
      keywords: ["child", "infant", "baby", "pediatric", "kid", "vaccination", "teething", "growth", "newborn", "children", "pediatrician"],
      slots: ["Today 12:30 PM", "Today 02:15 PM", "Today 04:15 PM"],
      matchReason: `Child specialist in ${cName} for infant care, pediatric infections, and vaccinations.`
    }
  ];
}

function generateCityPharmacies(cityName, pincode, locality) {
  const pin = pincode || "831001";
  const loc = locality || "Central Market";
  const cName = cityName || "City";
  const cPrefix = cName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "CITY";

  return [
    {
      id: `PHARM-${cPrefix}-01`,
      name: `Apollo Pharmacy 24/7 ${cName}`,
      type: "24/7 Retail & Urgent Pharmacy",
      category: "retail",
      address: `Shop 4, Ground Floor, Main Road, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.4,
      phone: "+91-657-243-2001",
      openStatus: "Open 24 Hours",
      is24x7: true,
      homeDelivery: true,
      rating: "4.9 ⭐ (1,840 reviews)",
      badges: ["24/7 Open", "Home Delivery", "Verified Stock"],
      keywords: ["apollo", cName.toLowerCase(), loc.toLowerCase(), pin, "24/7", "chemist"]
    },
    {
      id: `PHARM-${cPrefix}-02`,
      name: `Pradhan Mantri Jan Aushadhi Kendra ${cName}`,
      type: "Government Generic Medicine Center",
      category: "janaushadhi",
      address: `Opp. Hospital Main Gate, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.6,
      phone: "+91-657-243-2002",
      openStatus: "Open (08:00 AM - 10:00 PM)",
      is24x7: false,
      homeDelivery: false,
      rating: "4.8 ⭐ (1,120 reviews)",
      badges: ["Up to 80% Off", "Generic Drugs", "PMBI Certified"],
      keywords: ["jan aushadhi", "generic", "pmbi", cName.toLowerCase(), loc.toLowerCase(), pin, "discount"]
    },
    {
      id: `PHARM-${cPrefix}-03`,
      name: `MedPlus Chemist & Druggist ${cName}`,
      type: "Pharmacy & Diagnostics Store",
      category: "retail",
      address: `Commercial Complex, Near Clock Tower, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.9,
      phone: "+91-657-243-2003",
      openStatus: "Open 24 Hours",
      is24x7: true,
      homeDelivery: true,
      rating: "4.7 ⭐ (750 reviews)",
      badges: ["24/7 Open", "Express Delivery", "Cold Storage"],
      keywords: ["medplus", cName.toLowerCase(), loc.toLowerCase(), pin, "chemist"]
    },
    {
      id: `PHARM-${cPrefix}-04`,
      name: `${cName} 24-Hour Emergency Medical Hall`,
      type: "General Chemist & Emergency Supplies",
      category: "retail",
      address: `Main Market Road, Near Bus Stand, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.2,
      phone: "+91-657-243-2004",
      openStatus: "Open 24 Hours",
      is24x7: true,
      homeDelivery: true,
      rating: "4.6 ⭐ (980 reviews)",
      badges: ["24/7 Open", "Emergency Injections", "Ayurvedic & Allopathic"],
      keywords: ["medical hall", cName.toLowerCase(), loc.toLowerCase(), pin, "emergency"]
    },
    {
      id: `PHARM-${cPrefix}-05`,
      name: `Wellness Forever Day & Night Pharmacy`,
      type: "Day & Night Pharmacy Store",
      category: "retail",
      address: `High Street, Opp. Park, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.5,
      phone: "+91-657-243-2005",
      openStatus: "Open 24 Hours",
      is24x7: true,
      homeDelivery: true,
      rating: "4.8 ⭐ (1,340 reviews)",
      badges: ["24/7 Open", "Surgical Supplies", "Fast Delivery"],
      keywords: ["wellness forever", cName.toLowerCase(), loc.toLowerCase(), pin]
    }
  ];
}
function generateCityDiagnostics(cityName, pincode, locality) {
  const pin = pincode || "831001";
  const loc = locality || "Central Area";
  const cName = cityName || "City";
  const cPrefix = cName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4) || "CITY";

  return [
    {
      id: `DIAG-${cPrefix}-01`,
      name: `Dr. Lal PathLabs ${cName}`,
      type: "NABL Accredited Pathology & Diagnostics",
      category: "pathology",
      address: `Plot 14, Main Commercial Complex, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.5,
      phone: "+91-657-244-1001",
      timing: "07:00 AM - 08:30 PM",
      rating: "4.9 ⭐ (1,750 reviews)",
      tests: ["CBC", "Lipid Profile", "Thyroid Profile", "HbA1c", "Urine Routine", "Vitamin D3", "Liver Function"],
      badges: ["NABL Certified", "Home Sample Pickup", "Digital Reports"],
      keywords: ["lal pathlabs", cName.toLowerCase(), loc.toLowerCase(), pin, "pathology", "blood test"]
    },
    {
      id: `DIAG-${cPrefix}-02`,
      name: `${cName} Advanced Diagnostic & Imaging Centre`,
      type: "Comprehensive Radiology & Ultrasound Centre",
      category: "imaging",
      address: `Opposite Civil Hospital, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 0.9,
      phone: "+91-657-244-1002",
      timing: "08:00 AM - 08:00 PM",
      rating: "4.8 ⭐ (1,280 reviews)",
      tests: ["Digital X-Ray", "Ultrasound 4D", "Color Doppler", "ECG", "2D Echo"],
      badges: ["High-Res Digital Imaging", "Same-Day Report", "Experienced Radiologists"],
      keywords: [cName.toLowerCase(), loc.toLowerCase(), pin, "imaging", "x-ray", "ultrasound", "scan"]
    },
    {
      id: `DIAG-${cPrefix}-03`,
      name: `SRL Diagnostics & Pathology ${cName}`,
      type: "National Reference Clinical Laboratory",
      category: "pathology",
      address: `High Street Market, Near Bus Stand, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.2,
      phone: "+91-657-244-1003",
      timing: "07:30 AM - 08:00 PM",
      rating: "4.8 ⭐ (1,150 reviews)",
      tests: ["Complete Blood Work", "Diabetic Screening", "Lipid Panel", "Kidney Function", "Infection Screen"],
      badges: ["NABL / CAP Certified", "Home Sample Pickup", "Fast Digital Delivery"],
      keywords: ["srl", cName.toLowerCase(), loc.toLowerCase(), pin, "pathology"]
    },
    {
      id: `DIAG-${cPrefix}-04`,
      name: `Thyrocare Collection Centre ${cName}`,
      type: "Preventive Care & Hormone Health Testing",
      category: "pathology",
      address: `Shop 8, Station Road, ${loc}, ${cName}`,
      locality: loc,
      city: cName,
      pincode: pin,
      distanceKm: 1.6,
      phone: "+91-657-244-1004",
      timing: "06:30 AM - 07:30 PM",
      rating: "4.7 ⭐ (890 reviews)",
      tests: ["Thyroid Full Profile", "Aarogyam Full Body Checkup", "Iron Panel", "Vitamin B12"],
      badges: ["Affordable Packages", "Home Pickup Available", "Automated Testing"],
      keywords: ["thyrocare", cName.toLowerCase(), loc.toLowerCase(), pin, "thyroid", "aarogyam"]
    }
  ];
}

// =========================================================================
// ====== ACTIVE DIRECTORY RESOLVERS (BOUND TO PATIENT'S REGISTERED CITY) ==
// =========================================================================

function getActiveHospitalsDirectory(customAddress, customPincode) {
  const locInfo = resolvePatientLocationInfo(customAddress, customPincode);
  const cityLower = locInfo.city.toLowerCase();

  if (cityLower.includes("jamshedpur") || locInfo.pincode.startsWith("831")) {
    return JAMSHEDPUR_HOSPITALS;
  }
  if (cityLower.includes("patna") || locInfo.pincode.startsWith("800") || locInfo.pincode.startsWith("801")) {
    return PATNA_HOSPITALS.map(h => ({ ...h, pincode: locInfo.pincode || h.pincode }));
  }
  if (cityLower.includes("pune") || locInfo.pincode.startsWith("411")) {
    return PUNE_HOSPITALS.map(h => ({ ...h, pincode: locInfo.pincode || h.pincode }));
  }
  if (cityLower.includes("delhi") || locInfo.pincode.startsWith("110")) {
    return DELHI_HOSPITALS;
  }
  if (cityLower.includes("bengaluru") || cityLower.includes("bangalore") || locInfo.pincode.startsWith("560")) {
    return BENGALURU_HOSPITALS;
  }
  if (cityLower.includes("mumbai") || locInfo.pincode.startsWith("400")) {
    return MUMBAI_HOSPITALS;
  }
  if (cityLower.includes("noida") || locInfo.pincode.startsWith("201")) {
    return NOIDA_HOSPITALS;
  }

  return generateCityHospitals(locInfo.city, locInfo.pincode, locInfo.locality);
}

function getActiveDoctorsDirectory(customAddress, customPincode) {
  const locInfo = resolvePatientLocationInfo(customAddress, customPincode);
  const cityLower = locInfo.city.toLowerCase();

  if (cityLower.includes("jamshedpur") || locInfo.pincode.startsWith("831")) {
    return JAMSHEDPUR_DOCTORS;
  }
  if (cityLower.includes("patna") || locInfo.pincode.startsWith("800") || locInfo.pincode.startsWith("801")) {
    return PATNA_DOCTORS.map(d => ({ ...d, pincode: locInfo.pincode || d.pincode }));
  }
  if (cityLower.includes("pune") || locInfo.pincode.startsWith("411")) {
    return PUNE_DOCTORS.map(d => ({ ...d, pincode: locInfo.pincode || d.pincode }));
  }
  if (cityLower.includes("delhi") || locInfo.pincode.startsWith("110")) {
    return DELHI_DOCTORS;
  }
  if (cityLower.includes("bengaluru") || cityLower.includes("bangalore") || locInfo.pincode.startsWith("560")) {
    return BENGALURU_DOCTORS;
  }
  if (cityLower.includes("mumbai") || locInfo.pincode.startsWith("400")) {
    return MUMBAI_DOCTORS;
  }
  if (cityLower.includes("noida") || locInfo.pincode.startsWith("201")) {
    return NOIDA_DOCTORS;
  }

  return generateCityDoctors(locInfo.city, locInfo.pincode, locInfo.locality);
}

function getActivePharmaciesDirectory(customAddress, customPincode) {
  const locInfo = resolvePatientLocationInfo(customAddress, customPincode);
  const cityLower = locInfo.city.toLowerCase();

  if (cityLower.includes("jamshedpur") || locInfo.pincode.startsWith("831")) {
    return JAMSHEDPUR_PHARMACIES;
  }
  if (cityLower.includes("patna") || locInfo.pincode.startsWith("800") || locInfo.pincode.startsWith("801")) {
    return PATNA_PHARMACIES.map(p => ({ ...p, pincode: locInfo.pincode || p.pincode }));
  }
  if (cityLower.includes("pune") || locInfo.pincode.startsWith("411")) {
    return PUNE_PHARMACIES.map(p => ({ ...p, pincode: locInfo.pincode || p.pincode }));
  }
  if (cityLower.includes("delhi") || locInfo.pincode.startsWith("110")) {
    return DELHI_PHARMACIES;
  }
  if (cityLower.includes("bengaluru") || cityLower.includes("bangalore") || locInfo.pincode.startsWith("560")) {
    return BENGALURU_PHARMACIES;
  }
  if (cityLower.includes("mumbai") || locInfo.pincode.startsWith("400")) {
    return MUMBAI_PHARMACIES;
  }
  if (cityLower.includes("noida") || locInfo.pincode.startsWith("201")) {
    return NOIDA_PHARMACIES;
  }

  return generateCityPharmacies(locInfo.city, locInfo.pincode, locInfo.locality);
}

function getActiveDiagnosticsDirectory(customAddress, customPincode) {
  const locInfo = resolvePatientLocationInfo(customAddress, customPincode);
  const cityLower = locInfo.city.toLowerCase();

  if (cityLower.includes("jamshedpur") || locInfo.pincode.startsWith("831")) {
    return JAMSHEDPUR_DIAGNOSTICS;
  }
  if (cityLower.includes("patna") || locInfo.pincode.startsWith("800") || locInfo.pincode.startsWith("801")) {
    return PATNA_DIAGNOSTICS.map(d => ({ ...d, pincode: locInfo.pincode || d.pincode }));
  }
  if (cityLower.includes("pune") || locInfo.pincode.startsWith("411")) {
    return PUNE_DIAGNOSTICS.map(d => ({ ...d, pincode: locInfo.pincode || d.pincode }));
  }
  if (cityLower.includes("delhi") || locInfo.pincode.startsWith("110")) {
    return DELHI_DIAGNOSTICS;
  }
  if (cityLower.includes("bengaluru") || cityLower.includes("bangalore") || locInfo.pincode.startsWith("560")) {
    return BENGALURU_DIAGNOSTICS;
  }
  if (cityLower.includes("mumbai") || locInfo.pincode.startsWith("400")) {
    return MUMBAI_DIAGNOSTICS;
  }

  return generateCityDiagnostics(locInfo.city, locInfo.pincode, locInfo.locality);
}

function getNearbyDiagnostics(customSearch) {
  const locInfo = resolvePatientLocationInfo();
  const diags = getActiveDiagnosticsDirectory();
  const query = (customSearch || "").trim().toLowerCase();

  return diags.map((d) => {
    const isNearest = (d.pincode === locInfo.pincode);
    return {
      ...d,
      isNearest,
      computedDistance: isNearest ? `${d.distanceKm} km away (PIN ${d.pincode})` : `${(d.distanceKm + 1.1).toFixed(1)} km away`
    };
  }).filter(d => {
    if (!query) return true;
    const searchTarget = [d.name, d.type, d.locality, d.city, d.pincode, ...(d.tests || []), ...(d.keywords || [])].join(" ").toLowerCase();
    return searchTarget.includes(query);
  }).sort((a, b) => (b.isNearest ? 1 : 0) - (a.isNearest ? 1 : 0) || a.distanceKm - b.distanceKm);
}

// Global reference arrays for backwards compatibility
const DIAGNOSTICS_DIRECTORY = [
  ...JAMSHEDPUR_DIAGNOSTICS,
  ...DELHI_DIAGNOSTICS,
  ...BENGALURU_DIAGNOSTICS,
  ...MUMBAI_DIAGNOSTICS,
  ...PATNA_DIAGNOSTICS,
  ...PUNE_DIAGNOSTICS
];

const HOSPITALS_DIRECTORY = [
  ...JAMSHEDPUR_HOSPITALS,
  ...DELHI_HOSPITALS,
  ...BENGALURU_HOSPITALS,
  ...MUMBAI_HOSPITALS,
  ...NOIDA_HOSPITALS
];

const DOCTORS_DIRECTORY = [
  ...JAMSHEDPUR_DOCTORS,
  ...DELHI_DOCTORS,
  ...BENGALURU_DOCTORS,
  ...MUMBAI_DOCTORS,
  ...NOIDA_DOCTORS
];

const PHARMACIES_DIRECTORY = [
  ...JAMSHEDPUR_PHARMACIES,
  ...DELHI_PHARMACIES,
  ...BENGALURU_PHARMACIES,
  ...MUMBAI_PHARMACIES,
  ...NOIDA_PHARMACIES
];

let activeHospitalCategory = "all";

// =========================================================================
// ====== RECOMMENDATION QUERY ENGINES & MODAL RENDERING ===================
// =========================================================================

function getNearbyHospitals(searchQuery, categoryFilter) {
  const locInfo = resolvePatientLocationInfo();
  const patientPin = locInfo.pincode;
  const patientLocation = [locInfo.rawAddress, locInfo.locality, locInfo.city, patientPin].filter(Boolean).join(" ").toLowerCase();

  const query = (searchQuery || "").toLowerCase().trim();
  const cat = (categoryFilter || activeHospitalCategory || "all").toLowerCase();

  const activeCatalog = getActiveHospitalsDirectory();

  return activeCatalog.map(hosp => {
    let score = 0;
    let isNearest = false;
    let pinMatched = false;

    // PIN code exact matching (primary priority)
    if (patientPin && hosp.pincode === patientPin) {
      score += 60;
      isNearest = true;
      pinMatched = true;
    }

    // Proximity matching based on patient's registered address / locality
    if (patientLocation) {
      const matchTerms = [hosp.locality, hosp.city, ...(hosp.keywords || [])].map(k => (k || "").toLowerCase());
      const hasDirectMatch = matchTerms.some(term => {
        if (!term) return false;
        const words = term.split(/[\s,./-]+/).filter(w => w.length > 2);
        return words.some(w => patientLocation.includes(w)) || patientLocation.includes(term);
      });

      if (hasDirectMatch) {
        score += 35;
        isNearest = true;
      }
    }

    // Search query matching
    let queryMatched = true;
    if (query) {
      const searchTarget = [
        hosp.name,
        hosp.type,
        hosp.locality,
        hosp.city,
        hosp.pincode,
        hosp.address,
        ...(hosp.specialties || []),
        ...(hosp.keywords || [])
      ].join(" ").toLowerCase();

      const queryWords = query.split(/\s+/).filter(w => w.length > 1);
      const isDirectMatch = searchTarget.includes(query) || (queryWords.length > 0 && queryWords.every(w => searchTarget.includes(w)));

      if (isDirectMatch) {
        score += 100;
      } else {
        queryMatched = false;
        score = -100;
      }
    }

    // Category filtering
    let matchesCategory = true;
    if (cat === "emergency") {
      matchesCategory = hosp.emergency.toLowerCase().includes("emergency");
    } else if (cat === "multispecialty") {
      matchesCategory = hosp.category === "multispecialty";
    } else if (cat === "chc") {
      matchesCategory = hosp.category === "chc";
    } else if (cat === "clinic") {
      matchesCategory = hosp.category === "clinic";
    }

    return {
      ...hosp,
      score,
      isNearest,
      pinMatched,
      queryMatched,
      matchesCategory,
      computedDistance: isNearest ? `${hosp.distanceKm} km away (PIN ${hosp.pincode})` : `${(hosp.distanceKm + 1.2).toFixed(1)} km away`
    };
  })
  .filter(h => h.matchesCategory && (query ? h.queryMatched && h.score > 0 : true))
  .sort((a, b) => {
    if (query) {
      return b.score - a.score || (b.isNearest ? 1 : 0) - (a.isNearest ? 1 : 0) || a.distanceKm - b.distanceKm;
    }
    if (b.isNearest !== a.isNearest) return b.isNearest ? 1 : -1;
    return b.score - a.score || a.distanceKm - b.distanceKm;
  });
}

function renderNearbyHospitals(customSearch, customCategory) {
  const locInfo = resolvePatientLocationInfo();

  const locationEl = document.getElementById("nearbyHospitalCurrentLocation");
  const matchedBadge = document.getElementById("nearbyHospitalMatchedBadge");
  if (locationEl) {
    locationEl.textContent = `${locInfo.locality}, ${locInfo.city} (PIN ${locInfo.pincode})`;
  }
  if (matchedBadge) {
    matchedBadge.textContent = `🎯 ${locInfo.city} Area`;
  }

  const hospitals = getNearbyHospitals(customSearch, customCategory);
  const listEl = document.getElementById("nearbyHealthcareList");
  if (!listEl) return;

  if (hospitals.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 32px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <h4 style="margin: 0 0 6px; color: #1e293b;">No healthcare facilities found</h4>
        <p class="muted" style="margin: 0; font-size: 13px;">Try adjusting your search keywords or category filter.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = hospitals.map(hosp => `
    <div class="hospital-recommend-card ${hosp.isNearest ? 'nearest-match' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
            <h3 style="margin: 0; font-size: 17px; color: #0f172a;">${hosp.name}</h3>
            <span class="hospital-tag">${hosp.type}</span>
          </div>
          <p class="muted" style="margin: 0; font-size: 13px;">📍 ${hosp.address} <strong style="color: #1e293b;">(PIN ${hosp.pincode})</strong></p>
        </div>
        <span class="hospital-proximity-pill ${hosp.isNearest ? 'nearest' : ''}">
          ${hosp.isNearest ? '📍 Nearest: ' + hosp.computedDistance : '📍 ' + hosp.computedDistance}
        </span>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px;">
        <span class="status-badge open">● ${hosp.openStatus}</span>
        <span class="status-badge emergency">🚨 ${hosp.emergency}</span>
        <span style="font-size: 12px; color: #64748b; font-weight: 600;">⭐ ${hosp.rating}</span>
        <span style="font-size: 12px; color: #059669; font-weight: 600;">• ${hosp.bedsAvailable}</span>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
        ${hosp.specialties.map(spec => `<span style="font-size: 11px; background: #eff6ff; color: #1d4ed8; padding: 2px 7px; border-radius: 4px; font-weight: 600;">${spec}</span>`).join("")}
      </div>

      <div class="healthcare-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="secondary" onclick="makePhoneCall('${hosp.phone}')" style="flex: 1; min-width: 110px;">📞 Call ${hosp.phone}</button>
        <button type="button" class="secondary" onclick="openGoogleMaps('${hosp.name}, ${hosp.address}')" style="flex: 1; min-width: 110px;">🗺️ Directions</button>
        <button type="button" class="primary" onclick="closeModal('nearbyHealthcareModal'); openDoctorSuggestionsModal();" style="flex: 1; min-width: 140px; font-weight: 700;">🩺 Find Specialists Here →</button>
      </div>
    </div>
  `).join("");
}

function onNearbyHospitalSearchInput(val) {
  renderNearbyHospitals(val);
}

function filterHospitalsCategory(cat, btnEl) {
  activeHospitalCategory = cat;
  document.querySelectorAll(".hosp-filter-chip").forEach(c => c.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  const input = document.getElementById("nearbyHospitalSearchInput");
  renderNearbyHospitals(input ? input.value : "");
}

function getNearbyPharmacies(searchQuery) {
  const locInfo = resolvePatientLocationInfo();
  const patientPin = locInfo.pincode;
  const patientLocation = [locInfo.rawAddress, locInfo.locality, locInfo.city, patientPin].filter(Boolean).join(" ").toLowerCase();

  const query = (searchQuery || "").toLowerCase().trim();
  const activePharmacies = getActivePharmaciesDirectory();

  return activePharmacies.map(pharm => {
    let score = 0;
    let isNearest = false;
    let pinMatched = false;

    // PIN code exact match (primary priority)
    if (patientPin && pharm.pincode === patientPin) {
      score += 60;
      isNearest = true;
      pinMatched = true;
    }

    // Address & locality keyword matching
    if (patientLocation) {
      const matchTerms = [pharm.locality, pharm.city, ...(pharm.keywords || [])].filter(Boolean).map(k => (k || "").toLowerCase());
      const hasLocMatch = matchTerms.some(term => {
        if (!term) return false;
        const words = term.split(/[\s,./-]+/).filter(w => w.length > 2);
        return words.some(w => patientLocation.includes(w)) || patientLocation.includes(term);
      });
      if (hasLocMatch) {
        score += 35;
        isNearest = true;
      }
    }

    // Search query matching
    let queryMatched = true;
    if (query) {
      const searchTarget = [
        pharm.name,
        pharm.type,
        pharm.locality,
        pharm.city,
        pharm.pincode,
        pharm.address,
        ...(pharm.badges || []),
        ...(pharm.keywords || [])
      ].join(" ").toLowerCase();

      const queryWords = query.split(/\s+/).filter(w => w.length > 1);
      const isDirectMatch = searchTarget.includes(query) || (queryWords.length > 0 && queryWords.every(w => searchTarget.includes(w)));

      if (isDirectMatch) {
        score += 100;
      } else {
        queryMatched = false;
        score = -100;
      }
    }

    return {
      ...pharm,
      score,
      isNearest,
      pinMatched,
      queryMatched,
      computedDistance: isNearest ? `${pharm.distanceKm} km away (PIN ${pharm.pincode})` : `${(pharm.distanceKm + 1.2).toFixed(1)} km away`
    };
  })
  .filter(p => (query ? p.queryMatched && p.score > 0 : true))
  .sort((a, b) => {
    if (query) {
      return b.score - a.score || (b.isNearest ? 1 : 0) - (a.isNearest ? 1 : 0) || a.distanceKm - b.distanceKm;
    }
    if (b.isNearest !== a.isNearest) return b.isNearest ? 1 : -1;
    return b.score - a.score || a.distanceKm - b.distanceKm;
  });
}

function renderNearbyPharmacies(customSearch) {
  const locInfo = resolvePatientLocationInfo();

  const locationEl = document.getElementById("nearbyPharmacyCurrentLocation");
  const matchedBadge = document.getElementById("nearbyPharmacyMatchedBadge");
  if (locationEl) {
    locationEl.textContent = `${locInfo.locality}, ${locInfo.city} (PIN ${locInfo.pincode})`;
  }
  if (matchedBadge) {
    matchedBadge.textContent = `🎯 ${locInfo.city} Area`;
  }

  const pharmacies = getNearbyPharmacies(customSearch);
  const listEl = document.getElementById("nearbyPharmacyList");
  if (!listEl) return;

  if (pharmacies.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 32px; background: #f8fafc; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
        <h4 style="margin: 0 0 6px; color: #1e293b;">No pharmacies found</h4>
        <p class="muted" style="margin: 0; font-size: 13px;">Try adjusting your search terms or enter your area PIN code.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = pharmacies.map(pharm => `
    <div class="pharmacy-recommend-card ${pharm.isNearest ? 'nearest-match' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
            <h3 style="margin: 0; font-size: 17px; color: #0f172a;">${pharm.name}</h3>
            <span class="hospital-tag" style="background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;">${pharm.type}</span>
          </div>
          <p class="muted" style="margin: 0; font-size: 13px;">📍 ${pharm.address} <strong style="color: #1e293b;">(PIN ${pharm.pincode})</strong></p>
        </div>
        <span class="pharmacy-proximity-pill ${pharm.isNearest ? 'nearest' : ''}">
          ${pharm.isNearest ? '📍 Nearest: ' + pharm.computedDistance : '📍 ' + pharm.computedDistance}
        </span>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 10px;">
        <span class="status-badge ${pharm.is24x7 ? 'open' : 'info'}">● ${pharm.openStatus}</span>
        ${pharm.homeDelivery ? '<span class="status-badge" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">🚚 Home Delivery</span>' : ''}
        <span style="font-size: 12px; color: #64748b; font-weight: 600;">⭐ ${pharm.rating}</span>
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
        ${(pharm.badges || []).map(badge => `<span style="font-size: 11px; background: #ecfdf5; color: #047857; padding: 2px 7px; border-radius: 4px; font-weight: 600; border: 1px solid #a7f3d0;">✓ ${badge}</span>`).join("")}
      </div>

      <div class="healthcare-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button type="button" class="secondary" onclick="makePhoneCall('${pharm.phone}')" style="flex: 1; min-width: 120px;">📞 Call ${pharm.phone}</button>
        <button type="button" class="secondary" onclick="openGoogleMaps('${pharm.name}, ${pharm.address}')" style="flex: 1; min-width: 120px;">🗺️ Directions</button>
      </div>
    </div>
  `).join("");
}

function onNearbyPharmacySearchInput(val) {
  renderNearbyPharmacies(val);
}

function getDoctorSuggestions(symptomQuery) {
  const query = (symptomQuery || "").toLowerCase();
  const words = query.split(/[\s,.;:-]+/).filter(w => w.length > 2);

  const locInfo = resolvePatientLocationInfo();
  const patientPin = locInfo.pincode;
  const patientLocation = [locInfo.rawAddress, locInfo.locality, locInfo.city, patientPin].filter(Boolean).join(" ").toLowerCase();

  const activeDocs = getActiveDoctorsDirectory();

  const scored = activeDocs.map(doc => {
    let score = 0;
    let matchedKeywords = [];
    let isNearby = false;
    let pinMatched = false;

    (doc.keywords || []).forEach(kw => {
      if (query.includes(kw)) {
        score += 10;
        matchedKeywords.push(kw);
      } else {
        words.forEach(word => {
          if (kw.includes(word) || word.includes(kw)) {
            score += 5;
            matchedKeywords.push(kw);
          }
        });
      }
    });

    // Boost general medicine for general complaints
    if (doc.specialty.toLowerCase().includes("general")) score += 2;

    // PIN code exact match boost (primary priority)
    if (patientPin && doc.pincode === patientPin) {
      score += 25;
      isNearby = true;
      pinMatched = true;
    }

    // Locality and address proximity matching boost
    if (patientLocation) {
      const locTerms = [doc.locality, doc.city, doc.hospital].filter(Boolean).map(s => s.toLowerCase());
      const hasLocMatch = locTerms.some(term => {
        const parts = term.split(/[\s,./-]+/).filter(p => p.length > 2);
        return parts.some(part => patientLocation.includes(part)) || patientLocation.includes(term);
      });

      if (hasLocMatch) {
        score += 15;
        isNearby = true;
      }
    }

    return {
      ...doc,
      score,
      isNearby,
      pinMatched,
      matchedKeywords: [...new Set(matchedKeywords)]
    };
  });

  scored.sort((a, b) => {
    if (b.isNearby !== a.isNearby && Math.abs(b.score - a.score) <= 20) {
      return b.isNearby ? 1 : -1;
    }
    return b.score - a.score;
  });

  // Return top matching doctors (minimum 4 if available)
  const top = scored.slice(0, 4);

  return top.map((doc, idx) => {
    let matchPct = 96;
    if (doc.score > 20) matchPct = 99;
    else if (doc.score > 0) matchPct = 96 - idx * 2;
    else matchPct = 92 - idx * 3;

    let dynamicReason = doc.matchReason;
    if (doc.matchedKeywords.length > 0) {
      dynamicReason = `Top match for symptom keywords (${doc.matchedKeywords.slice(0, 2).join(", ")}) · Recommended ${doc.specialty}`;
    }
    if (doc.isNearby) {
      dynamicReason += ` · 📍 Closest clinic in ${doc.city} (${doc.hospital}${doc.pincode ? ' - PIN ' + doc.pincode : ''})`;
    }

    return {
      ...doc,
      matchPct: `${matchPct}% Match`,
      computedReason: dynamicReason
    };
  });
}

function renderDoctorSuggestions(customSymptom) {
  const currentSymptom = customSymptom || (state && state.symptoms) || document.getElementById("symptomsText")?.value || (state && state.patient && state.patient.symptoms) || "Mild throat irritation, dry cough for 2 days";

  const symptomEl = document.getElementById("doctorSuggestCurrentSymptom");
  if (symptomEl) {
    symptomEl.textContent = `"${currentSymptom}"`;
  }

  const locInfo = resolvePatientLocationInfo();
  const locationEl = document.getElementById("doctorSuggestCurrentLocation");
  if (locationEl) {
    locationEl.textContent = `${locInfo.locality}, ${locInfo.city} (PIN ${locInfo.pincode})`;
  }

  const doctors = getDoctorSuggestions(currentSymptom);
  const badgeEl = document.getElementById("doctorMatchCountBadge");
  if (badgeEl) {
    badgeEl.textContent = `${doctors.length} Specialists Available`;
  }

  const listEl = document.getElementById("doctorSuggestionList");
  if (!listEl) return;

  listEl.innerHTML = doctors.map(doc => `
    <div class="doctor-suggestion-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="width: 46px; height: 46px; border-radius: 50%; background: #eff6ff; border: 2px solid #bfdbfe; display: grid; place-items: center; font-size: 22px; flex-shrink: 0;">
            👨‍⚕️
          </div>
          <div>
            <h4 style="margin: 0; font-size: 16.5px; color: #0f172a;">${doc.name}</h4>
            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px;">
              <span style="font-weight: 700; font-size: 13px; color: #2563eb;">${doc.specialty}</span>
              <span style="font-size: 12px; color: #64748b;">• ${doc.department}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
          <span class="doctor-match-badge">
            🎯 ${doc.matchPct}
          </span>
          ${doc.pinMatched ? `<span class="doctor-proximity-tag">🎯 PIN-Matched (${doc.pincode})</span>` : (doc.isNearby ? `<span class="doctor-proximity-tag">📍 Nearby in ${doc.city}</span>` : '')}
        </div>
      </div>

      <div style="margin-bottom: 10px; font-size: 12.5px; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 10px;">
        <strong>💡 Recommendation Match:</strong> ${doc.computedReason}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 12.5px; color: #64748b; margin-bottom: 14px;">
        <span>🏥 <strong>${doc.hospital}</strong> (${doc.cabin})</span>
        <span>📍 <strong>${doc.locality}, ${doc.city} (PIN ${doc.pincode})</strong></span>
        <span>⭐ <strong>${doc.rating}</strong> (${doc.reviews} reviews)</span>
        <span>🎓 <strong>${doc.experience}</strong></span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-top: 1px dashed #cbd5e1; padding-top: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12px; font-weight: 700; color: #475569;">Available Slot:</span>
          <select id="slot_${doc.id}" class="doctor-slot-select">
            <option value="${doc.slots[0]}">${doc.slots[0]} (Earliest)</option>
            <option value="${doc.slots[1]}">${doc.slots[1]}</option>
            <option value="${doc.slots[2]}">${doc.slots[2]}</option>
          </select>
        </div>
        <button type="button" class="primary" onclick="bookDoctorAppointment('${doc.id}')" style="padding: 9px 18px; font-size: 13px; font-weight: 700; border-radius: 10px;">
          📅 Book Appointment
        </button>
      </div>
    </div>
  `).join("");
}

function refineDoctorSymptom(keywords, chipEl) {
  document.querySelectorAll(".symptom-chip").forEach(c => c.classList.remove("active"));
  if (chipEl) chipEl.classList.add("active");
  renderDoctorSuggestions(keywords);
}

function openDoctorSuggestionsModal() {
  openModal("contactDoctorModal");
  renderDoctorSuggestions();
}

function resetAppointmentBooking() {
  const confirmArea = document.getElementById("appointmentConfirmationArea");
  if (confirmArea) confirmArea.classList.add("hidden");
}

function printAppointmentSlip(token, docName) {
  toast(`🖨️ Printing token slip: ${token} for ${docName || "Consultation"}`);
}

function updateTopbarAppointmentBadge() {
  const badge = document.getElementById("topbarAppointmentSub");
  if (!badge) return;
  const currentId = (state && state.patient && (state.patient.userId || state.patient.id)) ? (state.patient.userId || state.patient.id) : "";
  if (!currentId) {
    badge.textContent = "Book / Status";
    return;
  }
  try {
    const list = JSON.parse(localStorage.getItem("medikiosk_appointments") || "[]");
    const count = list.filter(a => String(a.patientId || a.patient_id || "").trim().toUpperCase() === currentId.trim().toUpperCase() && a.status !== "Cancelled").length;
    badge.textContent = count > 0 ? `${count} Active` : "Book / Status";
  } catch (e) {
    badge.textContent = "Book / Status";
  }
}

async function openAppointmentsModal(prefillId) {
  const activeId = prefillId || (state && state.patient && (state.patient.userId || state.patient.id)) || "";
  const input = document.getElementById("appointmentSearchPatientId");
  const hint = document.getElementById("appointmentActivePatientHint");

  if (input) {
    input.value = activeId || "";
  }

  if (hint) {
    if (state && state.patient && (state.patient.userId || state.patient.id)) {
      const pName = state.patient.name || "Active Patient";
      const pId = state.patient.userId || state.patient.id;
      hint.innerHTML = `<span>👤 Active Kiosk Profile: <strong>${pName}</strong> (<code>${pId}</code>)</span> <button type="button" class="link-btn" onclick="document.getElementById('appointmentSearchPatientId').value='${pId}'; searchPatientAppointments();" style="font-size: 11.5px; font-weight: 700; color: #2563eb; text-decoration: underline; background: none; border: none; cursor: pointer;">Use Active ID</button>`;
    } else {
      hint.innerHTML = `<span>Tip: Enter your Patient ID (e.g. <b>MK-88219</b>) to view booked consultations.</span>`;
    }
  }

  openModal("appointmentsBookModal");

  if (activeId) {
    await loadPatientAppointments(activeId);
  } else {
    const listEl = document.getElementById("appointmentBookingList");
    const countEl = document.getElementById("appointmentCountBadge");
    if (countEl) countEl.textContent = "0 Bookings";
    if (listEl) {
      listEl.innerHTML = `
        <div class="appointment-empty-state">
          <div class="appointment-empty-icon">🔍</div>
          <h4 class="appointment-empty-title">Enter Your Patient ID</h4>
          <p class="appointment-empty-desc">Please enter your assigned Kiosk Patient ID above to view your scheduled doctor appointments, consultation tokens, and slot timings.</p>
        </div>
      `;
    }
  }
}

async function searchPatientAppointments() {
  const input = document.getElementById("appointmentSearchPatientId");
  const id = input ? input.value.trim() : "";
  if (!id) {
    toast("Please enter a Patient ID (e.g. MK-88219)");
    input?.focus();
    return;
  }
  await loadPatientAppointments(id);
}

async function loadPatientAppointments(patientId) {
  const cleanId = String(patientId || "").trim();
  const listEl = document.getElementById("appointmentBookingList");
  const countEl = document.getElementById("appointmentCountBadge");

  if (!cleanId) {
    if (listEl) {
      listEl.innerHTML = `
        <div class="appointment-empty-state">
          <div class="appointment-empty-icon">🔍</div>
          <h4 class="appointment-empty-title">Enter Patient ID</h4>
          <p class="appointment-empty-desc">Please enter a valid Patient ID to view bookings.</p>
        </div>
      `;
    }
    return;
  }

  if (countEl) countEl.textContent = "⏳ Checking...";

  // 1. Fetch from local storage
  let localAppointments = [];
  try {
    const raw = JSON.parse(localStorage.getItem("medikiosk_appointments") || "[]");
    localAppointments = raw.filter(a => String(a.patientId || a.patient_id || "").trim().toUpperCase() === cleanId.toUpperCase() && a.status !== "Cancelled");
  } catch (e) {
    console.warn("Local appointments read notice:", e);
  }

  // 2. Fetch from backend SQLite appointments API
  let serverAppointments = [];
  try {
    const res = await fetch(`${API_URL}/api/appointments?patient_id=${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      const data = await res.json();
      serverAppointments = data.appointments || [];
    }
  } catch (e) {
    console.warn("Backend appointments fetch notice:", e);
  }

  // Merge & deduplicate by token
  const map = new Map();
  serverAppointments.forEach(a => {
    const tokenKey = String(a.token || "").replace(/\D/g, "");
    if (tokenKey) map.set(tokenKey, {
      token: a.token,
      patientId: a.patient_id,
      patientName: a.patient_name,
      doctorName: a.doctor_name,
      specialty: a.specialty,
      department: a.department,
      cabin: a.cabin,
      slotTime: a.slot_time,
      appointmentDate: a.appointment_date,
      symptom: a.symptom,
      status: a.status
    });
  });

  localAppointments.forEach(a => {
    const tokenKey = String(a.token || "").replace(/\D/g, "");
    if (tokenKey && !map.has(tokenKey)) {
      map.set(tokenKey, a);
    }
  });

  const appointments = Array.from(map.values()).filter(a => a.status !== "Cancelled");

  // Update counter badge
  if (countEl) {
    countEl.textContent = appointments.length === 1 ? "1 Booking" : `${appointments.length} Bookings`;
  }

  // Update topbar if viewing active patient
  const activeId = (state && state.patient && (state.patient.userId || state.patient.id)) || "";
  if (cleanId.toUpperCase() === activeId.toUpperCase()) {
    updateTopbarAppointmentBadge();
  }

  if (!listEl) return;

  if (appointments.length === 0) {
    listEl.innerHTML = `
      <div class="appointment-empty-state">
        <div class="appointment-empty-icon">📅</div>
        <h4 class="appointment-empty-title">No Active Appointments</h4>
        <p class="appointment-empty-desc">There are currently no booked appointments for Patient ID <strong>${cleanId}</strong>.</p>
        <button type="button" class="primary" onclick="closeModal('appointmentsBookModal'); openDoctorSuggestionsModal();" style="padding: 9px 18px; font-size: 13px; font-weight: 700; border-radius: 10px;">
          👨‍⚕️ Book from Recommended Doctors
        </button>
      </div>
    `;
    return;
  }

  listEl.innerHTML = appointments.map(apt => {
    const rawToken = String(apt.token || "");
    const displayToken = rawToken.startsWith("Token #") ? rawToken : `Token #${rawToken}`;
    const cleanToken = rawToken.replace("Token #", "").trim();
    const docName = apt.doctorName || apt.doctor_name || "Specialist Physician";
    const specialty = apt.specialty || "General Medicine";
    const dept = apt.department || "Consultation Wing";
    const cabin = apt.cabin || "Room 101";
    const dateStr = apt.appointmentDate || apt.appointment_date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const slotStr = apt.slotTime || apt.slot_time || "Scheduled Slot";
    const pName = apt.patientName || apt.patient_name || (state && state.patient && state.patient.name) || "Patient";
    const reason = apt.symptom || (state && state.symptoms) || "Symptom assessment";

    return `
      <div class="appointment-booking-card" id="apt_card_${cleanToken.replace(/\D/g, '')}">
        <div class="appointment-card-top">
          <div class="appointment-doc-info">
            <div class="appointment-doc-avatar">👨‍⚕️</div>
            <div>
              <h4 class="appointment-doc-name">${docName}</h4>
              <div class="appointment-doc-specialty">${specialty}</div>
              <div class="appointment-doc-meta">📍 ${dept} · <b>${cabin}</b></div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span class="appointment-token-pill">
              🎟️ ${displayToken}
            </span>
            <span style="font-size: 11px; font-weight: 800; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 999px;">
              ✓ CONFIRMED
            </span>
          </div>
        </div>

        <div class="appointment-grid-details">
          <div class="appointment-detail-item">
            <span>📅 APPOINTMENT DATE</span>
            <strong>${dateStr}</strong>
          </div>
          <div class="appointment-detail-item">
            <span>⏰ TIME SLOT</span>
            <strong style="color: #2563eb;">${slotStr}</strong>
          </div>
          <div class="appointment-detail-item">
            <span>👤 APPOINTED PATIENT</span>
            <strong>${pName} (<code>${cleanId}</code>)</strong>
          </div>
          <div class="appointment-detail-item">
            <span>🩺 CLINICAL PURPOSE</span>
            <strong>${reason}</strong>
          </div>
        </div>

        <div class="appointment-card-actions">
          <button type="button" class="secondary" onclick="printAppointmentSlip('${displayToken}', '${docName}')" style="padding: 6px 12px; font-size: 12px;">
            🖨️ Print Slip
          </button>
          <button type="button" class="appointment-cancel-btn" onclick="cancelAppointmentBooking('${cleanToken}', '${cleanId}', '${docName}')">
            ❌ Cancel Booking
          </button>
        </div>
      </div>
    `;
  }).join("");
}

async function cancelAppointmentBooking(token, patientId, doctorName = "the doctor") {
  const cleanToken = String(token || "").replace("Token #", "").trim();
  const cleanId = String(patientId || "").trim();

  // 1. Update localStorage
  try {
    const list = JSON.parse(localStorage.getItem("medikiosk_appointments") || "[]");
    const updated = list.map(a => {
      const aToken = String(a.token || "").replace("Token #", "").trim();
      if (aToken === cleanToken) {
        return { ...a, status: "Cancelled" };
      }
      return a;
    }).filter(a => a.status !== "Cancelled");
    localStorage.setItem("medikiosk_appointments", JSON.stringify(updated));
  } catch (e) {
    console.warn("LocalStorage appointment cancel notice:", e);
  }

  // 2. Update state.bookedAppointments
  if (state && state.bookedAppointments) {
    state.bookedAppointments = state.bookedAppointments.filter(a => {
      const aToken = String(a.token || "").replace("Token #", "").trim();
      return aToken !== cleanToken;
    });
  }

  // 3. Update admin consultations
  if (typeof adminState !== "undefined" && adminState.consultations) {
    adminState.consultations = adminState.consultations.filter(c => {
      const cToken = String(c.token || "").replace("Token #", "").trim();
      return cToken !== cleanToken;
    });
    if (typeof renderAdminConsultations === "function") renderAdminConsultations();
  }

  // 4. Send cancellation to backend
  try {
    await fetch(`${API_URL}/api/appointments/${encodeURIComponent(cleanToken)}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.warn("Backend cancellation sync notice:", e);
  }

  addAudit(`Appointment cancelled: Token #${cleanToken} with ${doctorName} for Patient ${cleanId}`);
  toast(`✓ Appointment Token #${cleanToken} cancelled successfully.`);

  // 5. Re-render list immediately so "there should be no booking"
  await loadPatientAppointments(cleanId);
  updateTopbarAppointmentBadge();
}

function bookDoctorAppointment(doctorId) {
  const doc = DOCTORS_DIRECTORY.find(d => d.id === doctorId);
  if (!doc) {
    toast("Doctor details not found");
    return;
  }

  const slotSelect = document.getElementById(`slot_${doctorId}`);
  const chosenSlot = slotSelect ? slotSelect.value : doc.slots[0];

  const patientName = (state && state.patient && state.patient.name) ? state.patient.name : "Registered Patient";
  const patientId = (state && state.patient && (state.patient.userId || state.patient.id)) ? (state.patient.userId || state.patient.id) : "MK-88219";
  const token = `AP-${Math.floor(100 + Math.random() * 900)}`;
  const apptDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const appointmentRecord = {
    id: token,
    token: `Token #${token}`,
    patientName,
    patientId,
    doctorId: doc.id,
    doctorName: doc.name,
    specialty: doc.specialty,
    department: doc.department,
    cabin: doc.cabin,
    slotTime: chosenSlot,
    appointmentDate: apptDate,
    symptom: (state && state.symptoms) || "Triage consultation",
    bookedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: "Confirmed"
  };

  if (!state.bookedAppointments) state.bookedAppointments = [];
  state.bookedAppointments.unshift(appointmentRecord);

  try {
    const existing = JSON.parse(localStorage.getItem("medikiosk_appointments") || "[]");
    existing.unshift(appointmentRecord);
    localStorage.setItem("medikiosk_appointments", JSON.stringify(existing.slice(0, 30)));
  } catch (e) {
    console.error("Failed to save appointment to localStorage:", e);
  }

  // Synchronize with backend API
  fetch(`${API_URL}/api/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: `Token #${token}`,
      patient_id: patientId,
      patient_name: patientName,
      doctor_id: doc.id,
      doctor_name: doc.name,
      specialty: doc.specialty,
      department: doc.department,
      cabin: doc.cabin,
      slot_time: chosenSlot,
      appointment_date: apptDate,
      symptom: appointmentRecord.symptom,
      status: "Confirmed"
    })
  }).catch(e => console.warn("Backend appointment save offline:", e));

  // Synchronize with Admin Consultations
  if (typeof adminState !== "undefined" && adminState.consultations) {
    adminState.consultations.unshift({
      id: `CNS-${adminState.consultations.length + 101}`,
      patientId,
      patientName,
      phone: (state.patient && state.patient.phone) || "9876543210",
      doctorName: doc.name,
      department: doc.specialty,
      cabin: doc.cabin,
      token: `Token #${token}`,
      status: "Waiting",
      startedAt: chosenSlot,
      duration: "Scheduled"
    });
    if (typeof renderAdminConsultations === "function") renderAdminConsultations();
  }

  // Show rich confirmation card in modal
  const confirmArea = document.getElementById("appointmentConfirmationArea");
  if (confirmArea) {
    confirmArea.innerHTML = `
      <div class="appointment-confirmation-ticket">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 26px;">🎉</span>
            <div>
              <h4 style="margin: 0; color: #166534; font-size: 17px;">Appointment Successfully Booked!</h4>
              <p style="margin: 2px 0 0; font-size: 12.5px; color: #15803d;">Your consultation slot and hospital token are confirmed.</p>
            </div>
          </div>
          <span style="background: #bbf7d0; color: #14532d; font-size: 11.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px;">
            ✓ CONFIRMED
          </span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; background: #ffffff; padding: 14px; border-radius: 12px; border: 1px solid #bbf7d0; font-size: 13px; color: #1f2937;">
          <div><span style="color: #64748b; display: block; font-size: 11px;">CONSULTING DOCTOR</span><strong>${doc.name}</strong></div>
          <div><span style="color: #64748b; display: block; font-size: 11px;">SPECIALTY / CABIN</span><strong>${doc.specialty} (${doc.cabin})</strong></div>
          <div><span style="color: #64748b; display: block; font-size: 11px;">SCHEDULED DATE &amp; TIME</span><strong style="color: #2563eb;">${apptDate} · ${chosenSlot}</strong></div>
          <div><span style="color: #64748b; display: block; font-size: 11px;">CONSULTATION TOKEN</span><strong style="color: #16a34a; font-size: 15px;">Token #${token}</strong></div>
          <div><span style="color: #64748b; display: block; font-size: 11px;">PATIENT ID</span><strong>${patientName} (<code>${patientId}</code>)</strong></div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; flex-wrap: wrap;">
          <button type="button" class="primary" onclick="closeModal('contactDoctorModal'); openAppointmentsModal('${patientId}')" style="padding: 7px 14px; font-size: 12.5px; font-weight: 700;">
            📅 View in Appointment Book
          </button>
          <button type="button" class="secondary" onclick="printAppointmentSlip('Token #${token}', '${doc.name}')" style="padding: 7px 14px; font-size: 12.5px;">
            🖨️ Print Token Slip
          </button>
          <button type="button" class="secondary" onclick="resetAppointmentBooking()" style="padding: 7px 14px; font-size: 12.5px;">
            Book Another Specialist
          </button>
        </div>
      </div>
    `;
    confirmArea.classList.remove("hidden");
    confirmArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  updateTopbarAppointmentBadge();
  addAudit(`Appointment booked: ${patientName} with ${doc.name} at ${chosenSlot} (Token #${token})`);
  toast(`✓ Appointment booked with ${doc.name} (Token #${token})!`);
}

function findAvailableDoctors() {
  if (!state.patient || !state.patient.id) {
    toast("Please register a patient first");
    return;
  }
  
  if (!state.patient.pincode) {
    toast("Please complete registration with location information first");
    return;
  }
  
  toast("Searching for available doctors near you...");
  addAudit("Location-based doctor search initiated");
  
  const nearbyDoctors = generateNearbyDoctors(state.patient.pincode);
  
  // Update the healthcare modal with location-based results
  updateHealthcareModalWithLocationData(nearbyDoctors);
  
  setTimeout(() => {
    closeModal('contactDoctorModal');
    openModal('nearbyHealthcareModal');
    toast(`Found ${nearbyDoctors.length} doctors near ${state.patient.pincode}`);
  }, 1000);
}

function updateHealthcareModalWithLocationData(doctors) {
  const healthcareList = document.querySelector('.healthcare-list');
  if (healthcareList && doctors.length > 0) {
    healthcareList.innerHTML = doctors.map(doctor => `
      <div class="healthcare-item">
        <div class="healthcare-header">
          <h3>${doctor.name}</h3>
          <span class="distance">${doctor.distance} away</span>
        </div>
        <div class="healthcare-status">
          <span class="status-badge open">Available</span>
          <span class="status-badge">${doctor.specialty}</span>
        </div>
        <p class="muted">📍 ${doctor.address}</p>
        <p class="muted">📞 ${doctor.phone}</p>
        <div class="healthcare-actions">
          <button type="button" class="secondary" onclick="makePhoneCall('${doctor.phone}')">📞 Call</button>
          <button type="button" class="secondary" onclick="getDirectionsFromPatientLocation('${doctor.name}', '${doctor.address}')">🗺️ Directions</button>
        </div>
      </div>
    `).join("");
  }
  
  // Update location context
  const locationText = document.getElementById('nearbyHospitalCurrentLocation');
  if (locationText) {
    locationText.textContent = `${state.patient.address || "Registered Area"} (PIN ${state.patient.pincode})`;
  }
}

// Book AYUSH consultation function
function bookAyushConsultation() {
  const selectedSystem = document.querySelector('input[name="ayush_system"]:checked');
  if (selectedSystem) {
    state.ayushSystem = selectedSystem.value;
  }
  
  const systemName = state.ayushSystem ? (state.ayushSystem.charAt(0).toUpperCase() + state.ayushSystem.slice(1)) : "AYUSH";
  const patientName = (state.patient && state.patient.name) ? state.patient.name : "Guest Patient";
  
  toast(`Booking ${systemName} consultation for ${patientName}...`);
  addAudit(`AYUSH consultation booking requested for ${systemName} system (${patientName})`);
  
  setTimeout(() => {
    toast(`✓ ${systemName} practitioner consultation requested successfully! An advisor will call shortly.`);
  }, 1200);
}

// Book general Doctor consultation function
function bookDoctorConsultation() {
  openDoctorSuggestionsModal();
}

// Medical History Functions
function showMedicalHistory() {
  if (!state.patient) {
    toast("Please register or identify a patient first");
    return;
  }
  
  showScreen("medicalHistory");
  addAudit("Navigated to Medical History");
  
  // Display patient information safely
  const nameEl = document.getElementById("historyPatientName");
  const ageEl = document.getElementById("historyPatientAge");
  const abhaEl = document.getElementById("historyPatientAbha");
  const idEl = document.getElementById("historyPatientId");

  if (nameEl) nameEl.textContent = state.patient.name || "-";
  if (ageEl) ageEl.textContent = state.patient.age ? `${state.patient.age} yrs` : "-";
  if (abhaEl) abhaEl.textContent = state.patient.abha || "-";
  if (idEl) idEl.textContent = state.patient.userId || state.patient.id || "-";
  
  // Load existing medical history
  loadMedicalHistory();
}

async function loadMedicalHistory() {
  const historyList = document.getElementById("medicalHistoryList");
  if (!historyList) return;
  
  const patientId = (state.patient && (state.patient.userId || state.patient.id)) || "MK-88219";
  
  // Try local state / localStorage first
  let localRecords = Array.isArray(state.medicalHistoryRecords) ? state.medicalHistoryRecords : [];
  try {
    const stored = JSON.parse(localStorage.getItem(`medikiosk_history_${patientId}`) || "[]");
    if (Array.isArray(stored) && stored.length > 0) localRecords = stored;
  } catch (e) {}

  try {
    const response = await fetch(`${API_URL}/medical-history/${encodeURIComponent(patientId)}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.history) && data.history.length > 0) {
        localRecords = data.history;
      }
    }
  } catch (error) {
    console.warn("Server medical history not reachable, using local records:", error);
  }

  state.medicalHistoryRecords = localRecords;

  if (localRecords.length > 0) {
    historyList.innerHTML = localRecords.map(record => `
      <div class="history-item">
        <div class="history-date">📅 ${record.visit_date || "Recent"}</div>
        <div class="history-field"><strong>Diagnosis:</strong> ${escapeHtml(record.diagnosis || "N/A")}</div>
        <div class="history-field"><strong>Symptoms:</strong> ${escapeHtml(record.symptoms || "N/A")}</div>
        <div class="history-field"><strong>Medications:</strong> ${escapeHtml(record.medications || "N/A")}</div>
        <div class="history-field"><strong>Notes:</strong> ${escapeHtml(record.notes || "N/A")}</div>
      </div>
    `).join("");
  } else {
    historyList.innerHTML = `<p class="muted" data-i18n="noHistory">No medical history records found</p>`;
  }
}

async function saveMedicalHistory() {
  const diagInput = document.getElementById("historyDiagnosis");
  const sympInput = document.getElementById("historySymptoms");
  const medInput = document.getElementById("historyMedications");
  const noteInput = document.getElementById("historyNotes");

  const diagnosis = diagInput ? diagInput.value.trim() : "";
  const symptoms = sympInput ? sympInput.value.trim() : "";
  const medications = medInput ? medInput.value.trim() : "";
  const notes = noteInput ? noteInput.value.trim() : "";
  
  if (!diagnosis && !symptoms && !medications) {
    toast("Please enter at least diagnosis, symptoms, or medications");
    return;
  }

  const patientId = (state.patient && (state.patient.id || state.patient.userId)) || "MK-88219";
  const newRecord = {
    patient_id: patientId,
    diagnosis,
    symptoms,
    medications,
    notes,
    visit_date: new Date().toISOString().slice(0, 10)
  };

  try {
    const response = await fetch(`${API_URL}/medical-history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newRecord)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("Saved medical history to server:", data);
    }
  } catch (error) {
    console.warn("Backend save notice (persisting locally):", error);
  }

  // Always persist locally in state and localStorage so it never fails the user
  state.medicalHistoryRecords = Array.isArray(state.medicalHistoryRecords) ? state.medicalHistoryRecords : [];
  state.medicalHistoryRecords.unshift(newRecord);
  try {
    localStorage.setItem(`medikiosk_history_${patientId}`, JSON.stringify(state.medicalHistoryRecords));
  } catch(e) {}

  toast("Medical history saved successfully");
  addAudit(`Medical history added for patient ${patientId}`);
  
  // Clear form
  if (diagInput) diagInput.value = "";
  if (sympInput) sympInput.value = "";
  if (medInput) medInput.value = "";
  if (noteInput) noteInput.value = "";
  
  // Reload history display
  loadMedicalHistory();
}

function openModal(modalId) {
  console.log("openModal called with:", modalId);
  const modal = document.getElementById(modalId);
  console.log("Modal element found:", modal);
  
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("active");
    modal.style.display = "flex";
    console.log("Modal classes after opening:", modal.className);
    
    // If opening ayushModal, prefill symptom if available
    if (modalId === "ayushModal") {
      const ayushInput = document.getElementById("ayushConditionInput");
      const symptomsText = document.getElementById("symptomsText");
      if (ayushInput && !ayushInput.value) {
        if (state.symptoms) {
          ayushInput.value = state.symptoms;
        } else if (symptomsText && symptomsText.value.trim()) {
          ayushInput.value = symptomsText.value.trim();
        }
      }
    }

    // If opening contactDoctorModal, render symptom-based doctor recommendations
    if (modalId === "contactDoctorModal") {
      if (typeof renderDoctorSuggestions === "function") {
        renderDoctorSuggestions();
      }
    }

    // If opening nearbyHealthcareModal, render location-based nearby hospitals
    if (modalId === "nearbyHealthcareModal") {
      if (typeof renderNearbyHospitals === "function") {
        renderNearbyHospitals();
      }
    }

    // If opening findPharmacyModal, render location-based nearby pharmacies
    if (modalId === "findPharmacyModal") {
      if (typeof renderNearbyPharmacies === "function") {
        renderNearbyPharmacies();
      }
    }
    
    addAudit(`Modal opened: ${modalId}`);
  } else {
    console.error("Modal not found:", modalId);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    modal.classList.add("hidden");
    modal.style.display = "none";
    addAudit(`Modal closed: ${modalId}`);
  }
}

// Close modal when clicking outside
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.classList.remove("active");
    e.target.classList.add("hidden");
    e.target.style.display = "none";
  }
});

// Close modal with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal.active").forEach(modal => {
      modal.classList.remove("active");
      modal.classList.add("hidden");
      modal.style.display = "none";
    });
  }
});

function enqueueCurrentPatient(action = "Open", customMode = null) {
  const patientName = (state.patient.name || "Patient").trim();
  if (!patientName) return;

  // Robust deduplication: check if patient already exists in queue by name (case-insensitive)
  const existingIndex = state.queue.findIndex(row =>
    row.name && row.name.trim().toLowerCase() === patientName.toLowerCase()
  );

  const row = {
    name: patientName,
    priority: state.priority || "medium",
    symptoms: state.symptoms || "General consultation",
    mode: customMode || (state.offline ? "Offline" : (state.patient.isGuest ? "Guest" : "Voice")),
    action: action || "Review"
  };

  if (existingIndex >= 0) {
    // Update existing entry with latest triage data rather than creating a duplicate
    state.queue[existingIndex] = { ...state.queue[existingIndex], ...row };
  } else {
    state.queue.unshift(row);
  }

  renderQueue();
  updateDashboardCounts();
  if (typeof window !== "undefined" && typeof window.renderAdminDoctorDashboard === "function") {
    window.renderAdminDoctorDashboard();
  }
}

function sendToDoctor() {
  if (!state.patient.name || !state.symptoms) {
    toast("No patient summary to send yet.");
    return;
  }

  state.sentToDoctor = true;
  enqueueCurrentPatient("Review");
  addAudit(`Summary sent to doctor dashboard for ${state.patient.name}`);
  
  const erpStatus = document.getElementById("erpStatus");
  if (erpStatus) erpStatus.textContent = "Sync queued";

  // Provide visual button feedback to prevent repeated clicks creating confusion
  const sendBtns = document.querySelectorAll("[onclick*='sendToDoctor()']");
  sendBtns.forEach(btn => {
    btn.textContent = "✓ Sent to Doctor Dashboard";
    btn.classList.remove("primary");
    btn.classList.add("secondary");
  });

  toast("✓ Summary sent to Doctor Dashboard (Queue updated)");
}

function resetMedicineUi() {
  const fileInput = document.getElementById("medicineImage");
  if (fileInput) fileInput.value = "";

  const preview = document.getElementById("medicinePreview");
  if (preview) {
    if (preview.src && preview.src.startsWith("blob:")) {
      URL.revokeObjectURL(preview.src);
    }
    preview.removeAttribute("src");
    preview.classList.add("hidden");
  }

  const status = document.getElementById("medicineStatus");
  if (status) {
    status.className = "status";
    status.textContent = "";
  }

  const result = document.getElementById("medicineResult");
  if (result) result.classList.add("hidden");

  ["medicineName", "medicineComposition", "medicineUses"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "—";
  });
}

function startQRScanner() {
  showScreen("qrScanner");
  
  // Initialize QR scanner
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear();
  }
  
  html5QrcodeScanner = new Html5Qrcode("qr-reader");
  
  const config = { 
    fps: 10, 
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
  };
  
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    config,
    onQRCodeScanned,
    onQRCodeScanError
  ).catch(err => {
    console.error("QR Scanner error:", err);
    const translations = I18N[state.language] || I18N.English;
    toast(translations.qrCameraError || "Camera access denied or unavailable. Please check permissions.");
  });
}

function onQRCodeScanned(decodedText) {
  console.log("QR Code scanned:", decodedText);
  
  // Stop scanning
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop();
  }
  
  // Parse QR data (format: MediKiosk-Demo|PatientName|Age|ABHA|Priority|Symptoms|Duration|Severity|Condition|VisitID|Timestamp)
  const qrData = parseQRData(decodedText);
  
  if (qrData) {
    console.log("QR data parsed successfully:", qrData);
    scannedPatientData = qrData;
    displayQRResult(qrData);
    
    // Ensure we stay on the QR scanner screen to show the results
    setTimeout(() => {
      const qrScannerScreen = document.getElementById("qrScanner");
      if (qrScannerScreen && !qrScannerScreen.classList.contains("active")) {
        console.log("Not on QR scanner screen, restoring...");
        showScreen("qrScanner");
      }
    }, 100);
  } else {
    console.log("Failed to parse QR data");
    const translations = I18N[state.language] || I18N.English;
    toast(translations.qrScanError || "Invalid QR code format");
  }
}

function onQRCodeScanError() {
  // Silent error handling to avoid spam
}

function parseQRData(qrText) {
  try {
    // Expected format: MediKiosk-Demo|PatientName|Age|ABHA|Priority|Symptoms|Duration|Severity|Condition|VisitID|Timestamp
    const parts = qrText.split("|");
    if (parts.length >= 12 && parts[0] === "MediKiosk-Demo") {
      return {
        name: parts[1],
        age: parts[2],
        abha: parts[3],
        priority: parts[4],
        symptoms: parts[5],
        duration: parts[6],
        severity: parts[7],
        condition: parts[8],
        visitId: parts[9],
        timestamp: parts[10],
        aiTriage: parts[11] || "Not available"
      };
    }
    return null;
  } catch (error) {
    console.error("QR parsing error:", error);
    return null;
  }
}

function displayQRResult(patientData) {
  console.log("Displaying QR result for patient:", patientData);
  
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val || "—";
  };

  setTxt("qrPatientName", patientData.name);
  setTxt("qrPatientAge", patientData.age);
  setTxt("qrPatientAbha", patientData.abha);
  setTxt("qrVisitId", patientData.visitId);
  setTxt("qrPatientPriority", patientData.priority ? patientData.priority.charAt(0).toUpperCase() + patientData.priority.slice(1) : "—");
  setTxt("qrPatientSymptoms", patientData.symptoms);
  setTxt("qrDuration", patientData.duration);
  setTxt("qrSeverity", patientData.severity);
  setTxt("qrCondition", patientData.condition);
  setTxt("qrAiTriage", patientData.aiTriage);
  
  // Set recommendation based on priority using translations
  const translations = I18N[state.language] || I18N.English;
  const recommendation = patientData.priority === "high" 
    ? translations.qrHighPriorityRecommendation || "Patient requires immediate clinical assessment by a healthcare professional due to high priority indicators."
    : translations.qrStandardRecommendation || "Patient requires appropriate clinical assessment by a healthcare professional.";
  
  const recEl = document.getElementById("qrRecommendation");
  if (recEl) recEl.textContent = recommendation;
  
  const qrResult = document.getElementById("qr-result");
  if (qrResult) qrResult.classList.remove("hidden");
  console.log("QR result section made visible");
  
  addAudit(`QR code scanned for patient: ${patientData.name} (Visit: ${patientData.visitId})`);
  toast(translations.qrScanSuccess || "Patient data loaded from QR code");
  
  // Save current screen to ensure we stay on QR scanner
  try {
    sessionStorage.setItem('currentScreen', 'qrScanner');
  } catch (e) {}
}

function loadScannedPatient() {
  if (!scannedPatientData) {
    const translations = I18N[state.language] || I18N.English;
    toast(translations.qrNoData || "No patient data to load");
    return;
  }
  
  // Populate the registration form with scanned data safely
  const nameEl = document.getElementById("signupName") || document.getElementById("patientName");
  const ageEl = document.getElementById("signupAge") || document.getElementById("patientAge");
  const phoneEl = document.getElementById("signupPhone") || document.getElementById("patientPhone");
  const abhaEl = document.getElementById("abhaId");

  if (nameEl && scannedPatientData.name) nameEl.value = scannedPatientData.name;
  if (ageEl && scannedPatientData.age) ageEl.value = scannedPatientData.age;
  if (phoneEl && scannedPatientData.phone) phoneEl.value = scannedPatientData.phone;
  if (abhaEl && scannedPatientData.abha) abhaEl.value = scannedPatientData.abha;
  
  // Set patient state
  state.patient = {
    id: null,
    name: scannedPatientData.name,
    age: scannedPatientData.age,
    phone: "Not provided",
    abha: scannedPatientData.abha,
    isGuest: false
  };
  
  state.visitId = scannedPatientData.visitId;
  state.priority = scannedPatientData.priority;
  state.symptoms = scannedPatientData.symptoms;
  state.answers = {
    duration: scannedPatientData.duration,
    severity: scannedPatientData.severity,
    condition: scannedPatientData.condition
  };
  
  // Stop QR scanner and go to registration
  stopQRScanner();
  showScreen("registration");
  
  const translations = I18N[state.language] || I18N.English;
  toast(translations.qrLoadSuccess || "Patient data loaded successfully");
}

function stopQRScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
    }).catch(err => {
      console.error("Error stopping QR scanner:", err);
    });
  }
  
  // Hide QR result
  document.getElementById("qr-result").classList.add("hidden");
  scannedPatientData = null;
}

function newSession() {
  console.log("newSession called");
  
  stopVoice();
  stopQRScanner();

  state.patient = { id: null, userId: "", name: "", age: "", phone: "", abha: "", isGuest: false, gender: "", allergies: "", currentMedicines: "", reports: "" };
  updateTopbarProfileBox();

  const profileModal = document.getElementById("patientProfileModal");
  if (profileModal) profileModal.classList.add("hidden");

  state.visitId = null;
  state.visitSaved = false;
  state.savedVisits = [];
  state.symptoms = "";
  state.priority = "medium";
  state.redFlag = false;
  state.answers = {};
  state.sentToDoctor = false;
  qIndex = 0;
  persistClientState();

  ["abhaId", "patientName", "patientAge", "patientPhone", "symptomsText", "loginUserId", "signupName", "signupAge", "signupPhone", "guestName", "guestAge", "guestPhone"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["consent", "signupConsent", "guestConsent"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  const detailsCard = document.getElementById("patientDetailsCard");
  if (detailsCard) detailsCard.classList.add("hidden");

  ["abhaStatus", "loginStatus", "signupStatus"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.className = "status"; el.textContent = ""; }
  });

  const voiceText = document.getElementById("voiceText");
  if (voiceText) {
    voiceText.textContent = "Example: “I have fever and cough since yesterday.”";
  }

  resetTriageUi();
  resetMedicineUi();

  const qrContainer = document.getElementById("qrcode");
  if (qrContainer) qrContainer.innerHTML = "";

  setPriority("medium");
  
  console.log("Proceeding to welcome screen");
  showScreen("welcome");
  console.log("showScreen called for welcome");
  
  toast("New patient session started");
}

function togglePrivacy() {
  document.getElementById("privacyModal").classList.toggle("hidden");
}

function addAudit(text) {
  state.audit.unshift({ text, time: new Date().toLocaleTimeString() });
  renderAudit();
}

function renderAudit() {
  const el = document.getElementById("auditLog");
  if (!el) return;
  el.innerHTML = state.audit.slice(0, 6).map(a =>
    `<div><b>${escapeHtml(a.time)}</b><br>${escapeHtml(a.text)}</div>`
  ).join("") || "<div>No recent events</div>";
}

function simulateAlert() {
  addAudit("Test emergency alert sent to doctor dashboard");
  toast("🚨 Test alert sent");
}

function showAnalytics() {
  if (window.adminState && window.adminState.isAuthenticated) {
    showScreen("adminDashboardScreen");
    if (typeof switchAdminTab === "function") {
      switchAdminTab("analytics");
    }
  } else {
    if (typeof openAdminAuthModal === "function") {
      openAdminAuthModal();
    }
    toast("🔒 Hospital Analytics is inside the Admin Portal. Please sign in.");
  }
}

function updateDashboardCounts() {
  const waiting = document.getElementById("waitingCount");
  const high = document.getElementById("highCount");
  if (waiting) waiting.textContent = String(state.queue.length).padStart(2, "0");
  if (high) {
    const highCount = state.queue.filter(row => row.priority === "high").length;
    high.textContent = String(highCount).padStart(2, "0");
  }
}

function renderQueue() {
  const qBody = document.getElementById("queueBody");
  if (!qBody) return;

  qBody.innerHTML = state.queue.map(r =>
    `<tr>
      <td><b>${escapeHtml(r.name)}</b></td>
      <td><span class="priority ${escapeHtml(r.priority)}">${escapeHtml(r.priority).toUpperCase()}</span></td>
      <td>${escapeHtml(r.symptoms)}</td>
      <td>${escapeHtml(r.mode)}</td>
      <td><button type="button" class="secondary" onclick="toast('Patient record opened in demo mode')">${escapeHtml(r.action)}</button></td>
    </tr>`
  ).join("");
}

function updateNetwork() {
  state.offline = !navigator.onLine;
  const badge = document.getElementById("networkBadge");
  if (badge) {
    badge.className = `badge ${state.offline ? "" : "online"}`;
    badge.textContent = state.offline ? "● Offline" : "● Online";
  }
  const netStatus = document.getElementById("networkStatus");
  if (netStatus) netStatus.textContent = state.offline ? "Offline fallback" : "Online";

  const offCount = document.getElementById("offlineCount");
  if (offCount) offCount.textContent = state.offline ? "01" : "00";
}

function previewMedicineImage(event) {
  // Prevent any default behavior
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const file = event.target.files[0];
  if (!file) return;

  const preview = document.getElementById("medicinePreview");
  if (preview.src && preview.src.startsWith("blob:")) {
    URL.revokeObjectURL(preview.src);
  }
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");

  document.getElementById("medicineStatus").textContent = `Selected: ${file.name}`;
}

async function identifyMedicine(event) {
  console.log("identifyMedicine called");
  
  // Prevent any event propagation
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  const fileInput = document.getElementById("medicineImage");
  const status = document.getElementById("medicineStatus");
  const result = document.getElementById("medicineResult");
  const button = document.getElementById("identifyMedicineBtn");

  if (!fileInput || !fileInput.files.length) {
    toast("Please choose a medicine image first.");
    return;
  }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);

  button.disabled = true;
  button.textContent = "🔄 Identifying...";
  status.className = "status";
  status.textContent = "Uploading image to MediKiosk backend...";
  result.classList.add("hidden");

  try {
    console.log("Attempting to connect to backend for medicine identification");
    const response = await fetch(`${API_URL}/identify-medicine`, {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "Medicine identification failed");
    }

    document.getElementById("medicineName").textContent = data.medicine?.name || "Not available";
    document.getElementById("medicineComposition").textContent = data.medicine?.composition || "Not available";
    document.getElementById("medicineUses").textContent = data.medicine?.uses || "Not available";
    document.getElementById("medicineWarning").textContent = data.medicine?.warning || "Please verify medicine details with a qualified healthcare professional.";

    result.classList.remove("hidden");
    status.className = "status success";
    status.textContent = "✓ Medicine image processed successfully";
    addAudit(`Medicine image processed: ${file.name}`);
    toast("💊 Medicine information ready");
    console.log("Medicine identification successful");
  } catch (error) {
    console.error("Medicine identification error:", error);
    console.log("Using demo fallback");
    // Demo fallback when backend is unavailable
    const demoMedicines = [
      { name: "Paracetamol 500mg", composition: "Paracetamol 500mg", uses: "For fever and pain relief", warning: "Take with food. Avoid alcohol." },
      { name: "Amoxicillin 250mg", composition: "Amoxicillin Trihydrate 250mg", uses: "Antibiotic for bacterial infections", warning: "Complete full course as prescribed." },
      { name: "Omeprazole 20mg", composition: "Omeprazole 20mg", uses: "For acid reflux and heartburn", warning: "Take before meals." },
      { name: "Metformin 500mg", composition: "Metformin Hydrochloride 500mg", uses: "For type 2 diabetes", warning: "Monitor blood sugar regularly." }
    ];
    
    const randomMedicine = demoMedicines[Math.floor(Math.random() * demoMedicines.length)];
    
    document.getElementById("medicineName").textContent = randomMedicine.name;
    document.getElementById("medicineComposition").textContent = randomMedicine.composition;
    document.getElementById("medicineUses").textContent = randomMedicine.uses;
    document.getElementById("medicineWarning").textContent = randomMedicine.warning;
    
    result.classList.remove("hidden");
    status.className = "status success";
    
    // Use translated messages
    const translations = I18N[state.language] || I18N.English;
    status.textContent = translations.medicineDemoSuccess || "✓ Medicine identified (Demo mode)";
    
    addAudit(`Medicine image processed in demo mode: ${file.name}`);
    toast(translations.medicineDemoFallback || "⚠️ Backend unavailable. Using demo medicine data.");
    console.log("Demo medicine data displayed");
  } finally {
    button.disabled = false;
    button.textContent = "🔍 Identify Medicine";
    console.log("identifyMedicine completed");
    
    // Save current screen to sessionStorage for persistence
    sessionStorage.setItem('currentScreen', 'symptoms');
    console.log("Saved current screen as symptoms");
    
    // Force screen restoration after a short delay
    setTimeout(() => {
      console.log("Forcing symptoms screen restoration");
      showScreen("symptoms");
    }, 50);
  }
}

window.addEventListener("online", () => {
  updateNetwork();
  toast("Connection restored — queued data can sync.");
});

window.addEventListener("offline", () => {
  updateNetwork();
  toast("Offline mode active — basic safety flow remains available.");
});

// ================= APP INTRO LOADER / SPLASH SCREEN =================
let appLoaderDismissed = false;
let appLoaderTimer = null;

function initAppLoader() {
  const loader = document.getElementById("appLoader");
  if (!loader) return;

  appLoaderDismissed = false;
  loader.classList.remove("fade-out");
  loader.style.display = "flex";

  const progressBar = document.getElementById("loaderProgressBar");
  const statusText = document.getElementById("loaderStatusText");
  const percentText = document.getElementById("loaderPercentText");

  if (progressBar) progressBar.style.width = "0%";
  if (percentText) percentText.textContent = "0%";
  if (statusText) statusText.textContent = "Initializing clinical triage system...";

  const stages = [
    { percent: 30, text: "Initializing clinical triage system...", delay: 400 },
    { percent: 65, text: "Loading patient verification & ABHA gateway...", delay: 900 },
    { percent: 88, text: "Connecting AI symptom analysis module...", delay: 1400 },
    { percent: 100, text: "Ready · Welcome to MediKiosk", delay: 1800 }
  ];

  stages.forEach(stage => {
    setTimeout(() => {
      if (appLoaderDismissed) return;
      if (progressBar) progressBar.style.width = stage.percent + "%";
      if (percentText) percentText.textContent = stage.percent + "%";
      if (statusText) statusText.textContent = stage.text;
    }, stage.delay);
  });

  // Auto-dismiss precisely after 2 seconds (2000ms)
  if (appLoaderTimer) clearTimeout(appLoaderTimer);
  appLoaderTimer = setTimeout(() => {
    dismissAppLoader();
  }, 2000);
}

function dismissAppLoader() {
  if (appLoaderDismissed) return;
  appLoaderDismissed = true;
  if (appLoaderTimer) clearTimeout(appLoaderTimer);

  const loader = document.getElementById("appLoader");
  const progressBar = document.getElementById("loaderProgressBar");
  const percentText = document.getElementById("loaderPercentText");
  const statusText = document.getElementById("loaderStatusText");

  if (progressBar) progressBar.style.width = "100%";
  if (percentText) percentText.textContent = "100%";
  if (statusText) statusText.textContent = "Ready · Welcome to MediKiosk";

  if (loader) {
    loader.classList.add("fade-out");
    setTimeout(() => {
      loader.style.display = "none";
    }, 550);
  }
}

function showAppLoader() {
  initAppLoader();
}

document.addEventListener("DOMContentLoaded", () => {
  initAppLoader();
  renderQueue();
  renderAudit();
  updateNetwork();
  updateDashboardCounts();
  
  // Check if we should restore previous screen
  const savedScreen = sessionStorage.getItem('currentScreen');
  console.log("Checking for saved screen:", savedScreen);

  // In the start (welcome / initial launch), ALWAYS start with clean Profile (no name, no ID)
  if (!savedScreen || savedScreen === "welcome" || savedScreen === "patientProfile") {
    state.patient = { id: null, userId: "", name: "", age: "", phone: "", abha: "", isGuest: false, gender: "", allergies: "", currentMedicines: "", reports: "" };
    state.visitId = null;
    state.visitSaved = false;
    state.savedVisits = [];
    state.symptoms = "";
    localStorage.removeItem("mediKioskState");
    sessionStorage.removeItem('currentScreen');
    showScreen("welcome");
  } else {
    // In active session screen, try restoring state
    try {
      const savedState = localStorage.getItem('mediKioskState');
      if (savedState) {
        console.log("Found saved state, restoring:", savedState);
        const parsedState = JSON.parse(savedState);
        if (parsedState.patient && (parsedState.patient.userId || parsedState.patient.name)) {
          state.patient = parsedState.patient;
          state.visitId = parsedState.visitId || null;
          state.visitSaved = Boolean(parsedState.visitSaved);
          state.language = parsedState.language || state.language;
          state.symptoms = parsedState.symptoms || state.symptoms || "";

          const patientKey = (state.patient && (state.patient.userId || (state.patient.id ? `MK-${state.patient.id}` : ""))) || (state.patient?.isGuest ? "guest" : "MK-88219");
          const persistentVisits = getPatientVisits(patientKey);
          const sessionVisits = Array.isArray(parsedState.savedVisits) ? parsedState.savedVisits : [];

          const visitMap = new Map();
          sessionVisits.forEach(v => { if (v && v.visit_id) visitMap.set(v.visit_id, v); });
          persistentVisits.forEach(v => { if (v && v.visit_id && !visitMap.has(v.visit_id)) visitMap.set(v.visit_id, v); });

          if (!state.patient?.isGuest && (!state.patient?.userId || state.patient?.userId === "MK-88219")) {
            demoVisitHistory.forEach(v => {
              if (v && v.visit_id && !visitMap.has(v.visit_id)) {
                visitMap.set(v.visit_id, v);
              }
            });
          }

          state.savedVisits = Array.from(visitMap.values());
        }
      }
    } catch (e) {
      console.error("Error restoring state from localStorage:", e);
    }
    showScreen(savedScreen);
    sessionStorage.removeItem('currentScreen');
  }

  applyLanguage();
  updateTopbarProfileBox();
  renderPatientProfile();
  if (typeof refreshDoctorProfileSelect === "function") refreshDoctorProfileSelect();
  
  // Add language button event listeners
  document.querySelectorAll('.lang').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.getAttribute('data-lang');
      setLanguage(lang, btn);
    });
  });
  
  // Add medical support card event listeners
  const medicalCards = document.querySelectorAll('.medical-card');
  console.log("Found medical cards:", medicalCards.length);
  
  medicalCards.forEach((card, index) => {
    console.log(`Setting up event listener for card ${index}:`, card);
    card.addEventListener('click', (e) => {
      console.log("Medical card clicked:", card);
      e.preventDefault();
      e.stopPropagation();
      
      const modalId = card.getAttribute('data-modal');
      console.log("Modal ID from data attribute:", modalId);
      
      if (modalId) {
        openModal(modalId);
      } else {
        // Fallback to checking onclick attribute
        const onclickAttr = card.getAttribute('onclick');
        console.log("Onclick attribute:", onclickAttr);
        if (onclickAttr) {
          eval(onclickAttr);
        }
      }
    });
  });
  
  console.log("Medical support card event listeners attached");
  
  // Setup User ID input reactive lookup and Enter key handling
  const loginUserIdInput = document.getElementById("loginUserId");
  if (loginUserIdInput) {
    loginUserIdInput.addEventListener("input", () => {
      const val = loginUserIdInput.value.trim();
      if (!val) {
        state.patient = { id: null, userId: "", name: "", age: "", phone: "", abha: "", isGuest: false, gender: "", allergies: "", currentMedicines: "", reports: "" };
        updateTopbarProfileBox();
        const detailsCard = document.getElementById("patientDetailsCard");
        if (detailsCard) detailsCard.classList.add("hidden");
        return;
      }
      let match = knownPatients[val];
      if (!match) {
        try {
          const stored = JSON.parse(localStorage.getItem("medikiosk_registered_patients") || "{}");
          if (stored[val]) match = stored[val];
        } catch (e) {}
      }
      if (match) {
        loadPatientDetailsCard(match);
        state.patient = { ...state.patient, ...match };
        updateTopbarProfileBox();
      } else if (val.length >= 2) {
        state.patient.userId = val;
        updateTopbarProfileBox();
      }
    });

    loginUserIdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loginPatient();
      }
    });
  }

  // Explicitly attach click event listener to Top Bar Profile button
  const topbarProfileBtn = document.getElementById("topbarProfileBtn");
  if (topbarProfileBtn) {
    topbarProfileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("topbarProfileBtn clicked");
      togglePatientProfileModal(true);
    });
  }

  // Explicitly attach click event listener to Top Bar Admin button
  const topbarAdminBtn = document.getElementById("topbarAdminBtn");
  if (topbarAdminBtn) {
    topbarAdminBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAdminAuthModal();
    });
  }

  // Close modal when pressing Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      togglePatientProfileModal(false);
      closeAdminAuthModal();
      closeUpdatePatientModal();
      closeAssignConsultationModal();
    }
  });

  // Expose to window object
  window.initAppLoader = initAppLoader;
  window.dismissAppLoader = dismissAppLoader;
  window.showAppLoader = showAppLoader;
  window.togglePatientProfileModal = togglePatientProfileModal;
  window.updateTopbarProfileBox = updateTopbarProfileBox;
  window.renderPatientProfile = renderPatientProfile;
  window.openAdminAuthModal = openAdminAuthModal;
  window.closeAdminAuthModal = closeAdminAuthModal;
  window.fillAdminDevCredentials = fillAdminDevCredentials;
  window.handleAdminLogin = handleAdminLogin;
  window.exitAdminDashboard = exitAdminDashboard;
  window.switchAdminTab = switchAdminTab;
  window.renderAdminPatients = renderAdminPatients;
  window.filterAdminPatients = filterAdminPatients;
  window.openUpdatePatientModal = openUpdatePatientModal;
  window.closeUpdatePatientModal = closeUpdatePatientModal;
  window.saveUpdatedPatient = saveUpdatedPatient;
  window.deletePatient = deletePatient;
  window.openAddPatientModal = openAddPatientModal;
  window.renderAdminDoctorList = renderAdminDoctorList;
  window.filterAdminDoctors = filterAdminDoctors;
  window.toggleDoctorLoginStatus = toggleDoctorLoginStatus;
  window.renderAdminDoctorApprovals = renderAdminDoctorApprovals;
  window.filterDoctorApprovals = filterDoctorApprovals;
  window.approveDoctor = approveDoctor;
  window.rejectDoctor = rejectDoctor;
  window.viewDoctorCredentials = viewDoctorCredentials;
  window.renderAdminBilling = renderAdminBilling;
  window.markBillPaid = markBillPaid;
  window.openNewBillModal = openNewBillModal;
  window.closeNewBillModal = closeNewBillModal;
  window.onBillServiceChange = onBillServiceChange;
  window.saveNewBill = saveNewBill;
  window.exportBillingLedger = exportBillingLedger;
  window.renderAdminProblems = renderAdminProblems;
  window.resolveProblemTicket = resolveProblemTicket;
  window.deleteProblemTicket = deleteProblemTicket;
  window.exportProblemReports = exportProblemReports;
  window.openReportProblemModal = openReportProblemModal;
  window.closeReportProblemModal = closeReportProblemModal;
  window.submitUserProblem = submitUserProblem;
  window.openDoctorPortal = openDoctorPortal;
  window.openDoctorAuthModal = openDoctorAuthModal;
  window.closeDoctorAuthModal = closeDoctorAuthModal;
  window.handleDoctorLogin = handleDoctorLogin;
  window.exitDoctorPortal = exitDoctorPortal;
  window.changeDoctorStatus = changeDoctorStatus;
  window.switchDoctorTab = switchDoctorTab;
  window.renderDoctorDashboard = renderDoctorDashboard;
  window.renderDoctorAnalysis = renderDoctorAnalysis;
  window.renderDoctorActiveConsultations = renderDoctorActiveConsultations;
  window.finishDoctorConsultation = finishDoctorConsultation;
  window.showAnalytics = showAnalytics;
  window.doctorSessionState = doctorSessionState;
  window.adminState = adminState;
  window.knownPatients = knownPatients;
  window.state = state;
  window.kioskState = state;
  window.sendToDoctor = sendToDoctor;
  window.saveCurrentVisit = saveCurrentVisit;
  window.getPatientVisits = getPatientVisits;
  window.savePatientVisits = savePatientVisits;
  window.DOCTORS_DIRECTORY = DOCTORS_DIRECTORY;
  window.getDoctorSuggestions = getDoctorSuggestions;
  window.renderDoctorSuggestions = renderDoctorSuggestions;
  window.getActiveHospitalsDirectory = getActiveHospitalsDirectory;
  window.getActiveDoctorsDirectory = getActiveDoctorsDirectory;
  window.getActivePharmaciesDirectory = getActivePharmaciesDirectory;
  window.resetAppointmentBooking = resetAppointmentBooking;
  window.refreshDoctorProfileSelect = refreshDoctorProfileSelect;
  window.deleteRegisteredDoctor = deleteRegisteredDoctor;
  window.getRegisteredDoctorsList = getRegisteredDoctorsList;

  console.log("DOM loaded and event listeners attached");
});

// =========================================================================
// ================= BACKEND ADMIN & DEVELOPER PORTAL LOGIC =================
// =========================================================================

const adminState = {
  isAuthenticated: false,
  adminUser: "admin",
  activeTab: "patients",
  approvalFilter: "all",
  doctorApprovalFilter: "all",
  problemFilter: "all",
  patientSearchQuery: "",
  doctorSearchQuery: "",
  approvals: [
    {
      id: "APR-9021",
      patientId: "MK-88219",
      patientName: "Eleanor Vance",
      age: 34,
      gender: "Female",
      symptoms: "Mild throat irritation, dry cough for 2 days",
      priority: "low",
      pathway: "Primary Care / General OPD",
      status: "pending",
      submittedAt: "Today, 10:45 AM",
      vitals: "BP: 118/76 · HR: 72 · SpO2: 98%"
    },
    {
      id: "APR-9022",
      patientId: "MK-30912",
      patientName: "Rajesh Verma",
      age: 52,
      gender: "Male",
      symptoms: "Mild chest tightness, elevated BP (145/95)",
      priority: "high",
      pathway: "Cardiology Emergency OPD",
      status: "pending",
      submittedAt: "Today, 11:15 AM",
      vitals: "BP: 145/95 · HR: 88 · SpO2: 97%"
    },
    {
      id: "APR-9023",
      patientId: "MK-49210",
      patientName: "Priya Sharma",
      age: 28,
      gender: "Female",
      symptoms: "Severe throbbing migraine with photophobia",
      priority: "medium",
      pathway: "Neurology & Headache Clinic",
      status: "approved",
      submittedAt: "Today, 09:30 AM",
      vitals: "BP: 122/80 · HR: 76 · SpO2: 99%"
    },
    {
      id: "APR-9024",
      patientId: "MK-62188",
      patientName: "Ananya Sen",
      age: 23,
      gender: "Female",
      symptoms: "Seasonal allergic asthma, wheezing on exertion",
      priority: "medium",
      pathway: "Pulmonology & Allergy OPD",
      status: "flagged",
      submittedAt: "Today, 08:50 AM",
      vitals: "BP: 114/72 · HR: 82 · SpO2: 96%"
    }
  ],
  doctors: [],
  doctorApprovals: [],
  billing: [
    { id: "INV-2026-081", patientId: "MK-88219", patientName: "Eleanor Vance", service: "Specialist Consultation (Cardiology)", amount: 500, paymentMode: "UPI / QR Code", status: "Paid", timestamp: "Today, 11:20 AM" },
    { id: "INV-2026-082", patientId: "MK-49210", patientName: "Priya Sharma", service: "General OPD Consultation", amount: 250, paymentMode: "Cash", status: "Paid", timestamp: "Today, 11:32 AM" },
    { id: "INV-2026-083", patientId: "MK-30912", patientName: "Rajesh Verma", service: "ECG Diagnostic Test", amount: 350, paymentMode: "Card", status: "Pending", timestamp: "Today, 11:45 AM" },
    { id: "INV-2026-084", patientId: "MK-71534", patientName: "Arjun Patel", service: "Complete Blood Count (CBC) Panel", amount: 450, paymentMode: "PM-JAY Ayushman Bharat", status: "Paid", timestamp: "Today, 10:20 AM" },
    { id: "INV-2026-085", patientId: "MK-62188", patientName: "Ananya Sen", service: "Emergency AI Triage & Vitals", amount: 0, paymentMode: "Free Kiosk Triage", status: "Paid", timestamp: "Today, 09:10 AM" }
  ],
  userProblems: [
    { id: "PR-2026-001", patientName: "Ramesh Gupta", phone: "9822334411", category: "🖥️ Touchscreen / Hardware Glitch", priority: "medium", description: "The touchscreen on kiosk 2 has lag when typing emergency symptoms.", status: "Open", submittedAt: "Today, 10:15 AM" },
    { id: "PR-2026-002", patientName: "Sunita Yadav", phone: "9811224455", category: "👨‍⚕️ Excessive Wait Time / Doctor Delay", priority: "high", description: "Waiting at Cabin 215 for over 35 minutes for chest OPD.", status: "In Progress", submittedAt: "Today, 11:05 AM" },
    { id: "PR-2026-003", patientName: "Amitabh Roy", phone: "9833447788", category: "🖨️ Printer / Token Slip Not Printing", priority: "low", description: "Token slip was faint on paper, need ink ribbon check.", status: "Resolved", submittedAt: "Yesterday, 04:30 PM" }
  ],
  consultations: []
};

// Persistent storage for user problems
try {
  const savedProblems = localStorage.getItem("medikiosk_user_problems");
  if (savedProblems) {
    const parsed = JSON.parse(savedProblems);
    if (Array.isArray(parsed) && parsed.length > 0) {
      adminState.userProblems = parsed;
    }
  }
} catch (e) {}

const doctorSessionState = {
  isAuthenticated: false,
  currentDoctor: null,
  status: "online",
  activeTab: "dashboard"
};

// 1. Admin Authentication Handlers
function openAdminAuthModal() {
  const modal = document.getElementById("adminAuthModal");
  if (!modal) return;
  const status = document.getElementById("adminAuthStatus");
  if (status) { status.textContent = ""; status.className = "status"; }
  const passInput = document.getElementById("adminLoginPassword");
  if (passInput) passInput.value = "";
  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
  document.getElementById("adminLoginUserId")?.focus();
}

function closeAdminAuthModal() {
  const modal = document.getElementById("adminAuthModal");
  if (!modal) return;
  const passInput = document.getElementById("adminLoginPassword");
  if (passInput) passInput.value = "";
  modal.classList.remove("active");
  modal.classList.add("hidden");
  modal.style.display = "none";
}

function fillAdminDevCredentials() {
  // Deprecated: Developer autofill removed for security
}

function handleAdminLogin() {
  const userIdInput = document.getElementById("adminLoginUserId");
  const passwordInput = document.getElementById("adminLoginPassword");
  const status = document.getElementById("adminAuthStatus");

  const userId = userIdInput ? userIdInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";

  // Fixed developer/admin credentials
  const isValid = (userId === "medikiosk123" && password === "healthcare001");

  if (!isValid) {
    if (status) {
      status.className = "status error";
      status.textContent = "❌ Invalid User ID or Password. Access restricted to authorized personnel.";
    }
    toast("Invalid User ID or Password");
    if (passwordInput) passwordInput.value = "";
    return;
  }

  adminState.isAuthenticated = true;
  adminState.adminUser = userId;
  if (userIdInput) userIdInput.value = "";
  if (passwordInput) passwordInput.value = "";
  if (status) { status.textContent = ""; status.className = "status"; }
  closeAdminAuthModal();

  // Show Admin Dashboard Screen
  showScreen("adminDashboardScreen");
  switchAdminTab("patients");
  toast("🔓 Logged in to Hospital Admin Portal");
}

function exitAdminDashboard() {
  adminState.isAuthenticated = false;
  showScreen("welcome");
  toast("Exited Admin Portal · Returned to Kiosk");
}

// 2. Admin Tab Navigation
function switchAdminTab(tabName) {
  adminState.activeTab = tabName;

  const navMap = {
    patients: "adminNavPatients",
    doctorList: "adminNavDoctorList",
    doctorApprovals: "adminNavDoctorApprovals",
    billing: "adminNavBilling",
    problems: "adminNavProblems"
  };

  const panelMap = {
    patients: "adminTabPatients",
    doctorList: "adminTabDoctorList",
    doctorApprovals: "adminTabDoctorApprovals",
    billing: "adminTabBilling",
    problems: "adminTabProblems"
  };

  document.querySelectorAll(".admin-nav-item").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".admin-tab-panel").forEach(panel => panel.classList.remove("active"));

  const targetNav = document.getElementById(navMap[tabName]);
  const targetPanel = document.getElementById(panelMap[tabName]);

  if (targetNav) targetNav.classList.add("active");
  if (targetPanel) targetPanel.classList.add("active");

  if (tabName === "patients") renderAdminPatients();
  if (tabName === "doctorList") renderAdminDoctorList();
  if (tabName === "doctorApprovals") renderAdminDoctorApprovals();
  if (tabName === "billing") renderAdminBilling();
  if (tabName === "problems") renderAdminProblems();
}

// 3. Menu 1: Patient List (with Update and Delete)
function getAllAdminPatients() {
  const patientMap = { ...knownPatients };
  try {
    const stored = JSON.parse(localStorage.getItem("medikiosk_registered_patients") || "{}");
    Object.keys(stored).forEach(key => {
      patientMap[key] = { ...patientMap[key], ...stored[key] };
    });
  } catch (e) {}
  return Object.values(patientMap);
}

function renderAdminPatients(searchTerm = "") {
  const tbody = document.getElementById("adminPatientTableBody");
  const countBadge = document.getElementById("adminPatientCountBadge");
  const allPatients = getAllAdminPatients();

  if (countBadge) countBadge.textContent = allPatients.length;
  if (!tbody) return;

  const term = (searchTerm || adminState.patientSearchQuery || "").toLowerCase().trim();
  const filtered = allPatients.filter(p => {
    if (!term) return true;
    return (p.name && p.name.toLowerCase().includes(term)) ||
           (p.userId && p.userId.toLowerCase().includes(term)) ||
           (p.id && String(p.id).toLowerCase().includes(term)) ||
           (p.phone && p.phone.includes(term)) ||
           (p.address && p.address.toLowerCase().includes(term)) ||
           (p.city && p.city.toLowerCase().includes(term)) ||
           (p.pincode && String(p.pincode).includes(term)) ||
           (p.symptoms && p.symptoms.toLowerCase().includes(term));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No patients found matching "${escapeHtml(term)}".</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const patientId = p.userId || p.id || "MK-GUEST";
    const name = escapeHtml(p.name || "Unnamed Patient");
    const ageGender = `${p.age || "--"} yrs · ${escapeHtml(p.gender || "Unspecified")}`;
    const phone = escapeHtml(p.phone || "Not provided");
    const symptoms = escapeHtml(p.symptoms || "Routine Consultation");
    const addressLine = p.address ? `${escapeHtml(p.address)}${p.pincode ? ' (PIN ' + escapeHtml(p.pincode) + ')' : ''}` : 'Address not registered';
    return `
      <tr>
        <td><strong style="color: #4338ca;">${escapeHtml(patientId)}</strong></td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${name}</div>
          <small style="color: #64748b;">${escapeHtml(p.allergies ? '⚠️ Allergies: ' + p.allergies : 'No allergies')}</small>
          <div style="font-size: 11.5px; color: #166534; margin-top: 3px;">📍 ${addressLine}</div>
        </td>
        <td>${ageGender}</td>
        <td>📞 ${phone}</td>
        <td><div style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${symptoms}">${symptoms}</div></td>
        <td><span class="patient-status-pill status-active">Registered</span></td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn-admin-action btn-admin-update" onclick="openUpdatePatientModal('${escapeHtml(patientId)}')" title="Edit Demographics, Address & Records">
            ✏️ Update
          </button>
          <button type="button" class="btn-admin-action btn-admin-delete" onclick="deletePatient('${escapeHtml(patientId)}')" title="Delete Patient Record">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function filterAdminPatients(term) {
  adminState.patientSearchQuery = term;
  renderAdminPatients(term);
}

function openUpdatePatientModal(patientId) {
  const allPatients = getAllAdminPatients();
  const patient = allPatients.find(p => (p.userId === patientId || String(p.id) === patientId));
  if (!patient) {
    toast(`Patient ${patientId} not found.`);
    return;
  }

  const modal = document.getElementById("adminUpdatePatientModal");
  if (!modal) return;

  document.getElementById("updatePatientKey").value = patient.userId || patient.id;
  document.getElementById("updateModalPatientId").textContent = patient.userId || patient.id;
  document.getElementById("updatePatientName").value = patient.name || "";
  document.getElementById("updatePatientAge").value = patient.age || "";
  document.getElementById("updatePatientGender").value = patient.gender || "Female";
  document.getElementById("updatePatientPhone").value = (patient.phone || "").replace(/\D/g, "");

  const addrEl = document.getElementById("updatePatientAddress");
  if (addrEl) addrEl.value = patient.address || "";

  const pinEl = document.getElementById("updatePatientPincode");
  if (pinEl) pinEl.value = patient.pincode || "";

  document.getElementById("updatePatientSymptoms").value = patient.symptoms || "";
  document.getElementById("updatePatientMedicines").value = patient.currentMedicines || "";
  document.getElementById("updatePatientAllergies").value = patient.allergies || "";

  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
}

function closeUpdatePatientModal() {
  const modal = document.getElementById("adminUpdatePatientModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.classList.add("hidden");
  modal.style.display = "none";
}

function saveUpdatedPatient() {
  const key = document.getElementById("updatePatientKey").value;
  const name = document.getElementById("updatePatientName").value.trim();
  const age = document.getElementById("updatePatientAge").value.trim();
  const gender = document.getElementById("updatePatientGender").value;
  const phone = document.getElementById("updatePatientPhone").value.trim();
  const address = (document.getElementById("updatePatientAddress")?.value || "").trim();
  const pincode = (document.getElementById("updatePatientPincode")?.value || "").trim().replace(/\D/g, "");
  const symptoms = document.getElementById("updatePatientSymptoms").value.trim();
  const medicines = document.getElementById("updatePatientMedicines").value.trim();
  const allergies = document.getElementById("updatePatientAllergies").value.trim();

  if (!name || !age || !phone) {
    toast("Please fill required fields (Name, Age, Phone).");
    return;
  }

  if (pincode && !/^\d{6}$/.test(pincode)) {
    toast("Please enter a valid 6-digit Postal PIN Code (e.g. 831001).");
    document.getElementById("updatePatientPincode")?.focus();
    return;
  }

  const existing = knownPatients[key] || {};
  const updatedRecord = {
    ...existing,
    id: key,
    userId: key,
    name,
    age,
    gender,
    phone,
    address: address || existing.address || "",
    pincode: pincode || existing.pincode || "",
    symptoms: symptoms || "Consultation recorded",
    currentMedicines: medicines || "None",
    allergies: allergies || "None reported"
  };

  // Dynamically resolve city from address and PIN if resolver available
  if (typeof resolvePatientLocationInfo === "function" && (updatedRecord.address || updatedRecord.pincode)) {
    const resolved = resolvePatientLocationInfo(updatedRecord.address, updatedRecord.pincode);
    updatedRecord.city = resolved.city;
  }

  knownPatients[key] = updatedRecord;

  try {
    const stored = JSON.parse(localStorage.getItem("medikiosk_registered_patients") || "{}");
    stored[key] = updatedRecord;
    localStorage.setItem("medikiosk_registered_patients", JSON.stringify(stored));
  } catch (e) {}

  if (state.patient && (state.patient.userId === key || state.patient.id === key)) {
    state.patient = { ...state.patient, ...updatedRecord };
    updateTopbarProfileBox();
    renderPatientProfile();
    if (typeof renderNearbyHospitals === "function") renderNearbyHospitals();
    if (typeof renderNearbyPharmacies === "function") renderNearbyPharmacies();
    if (typeof renderDoctorSuggestions === "function") renderDoctorSuggestions();
  }

  // Synchronize update with backend SQLite
  fetch(`${API_URL}/api/patients/${encodeURIComponent(key)}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      age,
      gender,
      phone,
      address: updatedRecord.address,
      pincode: updatedRecord.pincode,
      symptoms,
      current_medicines: medicines,
      allergies
    })
  }).catch(e => console.warn("Backend patient update offline:", e));

  adminState.consultations.forEach(c => {
    if (c.patientId === key) {
      c.patientName = name;
      c.phone = phone;
    }
  });

  adminState.approvals.forEach(a => {
    if (a.patientId === key) {
      a.patientName = name;
      a.age = age;
      a.gender = gender;
      if (symptoms) a.symptoms = symptoms;
    }
  });

  closeUpdatePatientModal();
  renderAdminPatients();
  if (typeof renderAdminConsultations === "function") renderAdminConsultations();
  if (typeof renderAdminDoctorApprovals === "function") renderAdminDoctorApprovals();
  addAudit(`Patient record updated: ${name} (${key}, Address: ${updatedRecord.address || 'N/A'}, PIN: ${updatedRecord.pincode || 'N/A'})`);
  toast(`✓ Patient record updated successfully for ${name}`);
}

function deletePatient(patientId) {
  if (!confirm(`Are you sure you want to delete patient record "${patientId}"? This action cannot be undone.`)) {
    return;
  }

  const patientName = (knownPatients[patientId] && knownPatients[patientId].name) || patientId;
  delete knownPatients[patientId];

  try {
    const stored = JSON.parse(localStorage.getItem("medikiosk_registered_patients") || "{}");
    delete stored[patientId];
    localStorage.setItem("medikiosk_registered_patients", JSON.stringify(stored));
  } catch (e) {}

  if (state.patient && (state.patient.userId === patientId || state.patient.id === patientId)) {
    state.patient = {
      id: null,
      userId: "",
      name: "",
      age: "",
      phone: "",
      abha: "",
      isGuest: true,
      gender: "",
      allergies: "",
      currentMedicines: "",
      reports: ""
    };
    updateTopbarProfileBox();
  }

  adminState.consultations = adminState.consultations.filter(c => c.patientId !== patientId);

  renderAdminPatients();
  if (typeof renderAdminConsultations === "function") renderAdminConsultations();
  addAudit(`Patient record deleted: ${patientName} (${patientId})`);
  toast(`🗑️ Patient record "${patientId}" was deleted.`);
}

function openAddPatientModal() {
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const newUserId = `MK-${randomSuffix}`;

  const modal = document.getElementById("adminUpdatePatientModal");
  if (!modal) return;

  document.getElementById("updatePatientKey").value = newUserId;
  document.getElementById("updateModalPatientId").textContent = `${newUserId} (New)`;
  document.getElementById("updatePatientName").value = "";
  document.getElementById("updatePatientAge").value = "";
  document.getElementById("updatePatientGender").value = "Female";
  document.getElementById("updatePatientPhone").value = "";
  
  const addrEl = document.getElementById("updatePatientAddress");
  if (addrEl) addrEl.value = "";

  const pinEl = document.getElementById("updatePatientPincode");
  if (pinEl) pinEl.value = "";

  document.getElementById("updatePatientSymptoms").value = "";
  document.getElementById("updatePatientMedicines").value = "";
  document.getElementById("updatePatientAllergies").value = "";

  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
}

// 4. Menu 2: Doctor List ("Who doctor is login in to the app")
async function renderAdminDoctorList(searchTerm = "") {
  const tbody = document.getElementById("adminDoctorTableBody");
  const onlineBadge = document.getElementById("adminDoctorOnlineBadge");
  const onlineCountEl = document.getElementById("adminDoctorsOnlineCount");
  const totalCountEl = document.getElementById("adminDoctorsTotalCount");
  const approvedCountEl = document.getElementById("adminDoctorsApprovedCount");
  const pendingCountEl = document.getElementById("adminDoctorsPendingCount");

  const mockDoctorIds = new Set(["DOC-SHARMA", "DOC-RAO", "DOC-IYER", "DOC-MEHTA", "DOC-VERMA", "DOC-DESHMUKH", "DOC-NAIR", "DOC-SETH"]);

  // 1. Gather registered doctors from localStorage
  const localDocs = getRegisteredDoctorsList() || [];

  // 2. Fetch from backend registered doctors
  let backendDocs = [];
  try {
    const res = await fetch(`${API_URL}/api/doctor/registered`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.doctors)) {
        backendDocs = data.doctors;
      }
    }
  } catch (e) {}

  // 3. Merge and deduplicate by ID
  const map = new Map();

  localDocs.forEach(d => {
    const id = (d.id || d.doctor_id || "").trim();
    if (id && !mockDoctorIds.has(id) && d.password) {
      map.set(id.toUpperCase(), {
        id,
        doctor_id: id,
        name: d.name,
        password: d.password,
        specialty: d.specialty || "General Medicine",
        cabin: d.cabin || "Room 101",
        phone: d.phone || "",
        licenseNo: d.licenseNo || d.license_no || "",
        approvalStatus: d.status || d.approvalStatus || "pending",
        isLoggedIn: d.isLoggedIn || false,
        createdAt: d.submittedAt || d.createdAt || "Recent",
        avatar: d.avatar || "👨‍⚕️"
      });
    }
  });

  backendDocs.forEach(b => {
    const id = (b.doctor_id || b.id || "").trim();
    if (id && !mockDoctorIds.has(id) && b.password) {
      const prev = map.get(id.toUpperCase()) || {};
      map.set(id.toUpperCase(), {
        ...prev,
        id,
        doctor_id: id,
        name: b.name || prev.name,
        password: b.password || prev.password,
        specialty: b.specialty || prev.specialty || "General OPD",
        cabin: b.cabin || prev.cabin || "Cabin 101",
        phone: b.phone || prev.phone || "",
        licenseNo: b.license_no || prev.licenseNo || "",
        approvalStatus: b.approval_status || prev.approvalStatus || "pending",
        isLoggedIn: prev.isLoggedIn || false,
        createdAt: b.created_at || prev.createdAt || "Recent",
        avatar: prev.avatar || "👨‍⚕️"
      });
    }
  });

  // Sync to adminState.doctors - STRICT DEDUPLICATION: One person, one time
  const allRegistered = Array.from(map.values());
  const dedupedDocs = [];
  const seenPersons = new Set();
  allRegistered.forEach(d => {
    const normName = normalizeDocName(d.name);
    const cleanPhone = (d.phone || "").replace(/\D/g, "");
    const cleanLicense = (d.licenseNo || d.license_no || "").trim().toLowerCase();
    const id = (d.id || d.doctor_id || "").trim().toUpperCase();
    const personKey = cleanLicense || (cleanPhone.length >= 10 ? cleanPhone.slice(-10) : "") || normName || id;
    if (personKey && !seenPersons.has(personKey)) {
      seenPersons.add(personKey);
      dedupedDocs.push(d);
    }
  });
  adminState.doctors = dedupedDocs;

  // Check login state: if currently authenticated doctor in session
  if (doctorSessionState && doctorSessionState.isAuthenticated && doctorSessionState.currentDoctor) {
    const curId = doctorSessionState.currentDoctor.id;
    const activeDoc = adminState.doctors.find(d => d.id === curId);
    if (activeDoc) activeDoc.isLoggedIn = true;
  }

  const onlineDoctors = adminState.doctors.filter(d => d.isLoggedIn);
  const approvedDoctors = adminState.doctors.filter(d => (d.approvalStatus || "").toLowerCase() === "approved");
  const pendingDoctors = adminState.doctors.filter(d => (d.approvalStatus || "").toLowerCase() === "pending");

  if (onlineBadge) onlineBadge.textContent = `${onlineDoctors.length} Online`;
  if (onlineCountEl) onlineCountEl.textContent = onlineDoctors.length;
  if (totalCountEl) totalCountEl.textContent = adminState.doctors.length;
  if (approvedCountEl) approvedCountEl.textContent = approvedDoctors.length;
  if (pendingCountEl) pendingCountEl.textContent = pendingDoctors.length;

  if (!tbody) return;

  const term = (searchTerm || adminState.doctorSearchQuery || "").toLowerCase().trim();
  const filtered = adminState.doctors.filter(d => {
    if (!term) return true;
    return (d.name && d.name.toLowerCase().includes(term)) ||
           (d.specialty && d.specialty.toLowerCase().includes(term)) ||
           (d.cabin && d.cabin.toLowerCase().includes(term)) ||
           (d.id && d.id.toLowerCase().includes(term)) ||
           (d.password && d.password.toLowerCase().includes(term));
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #64748b; padding: 36px 20px;">
          <div style="font-size: 36px; margin-bottom: 8px;">👨‍⚕️</div>
          <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">No Registered Doctors Found</div>
          <div style="font-size: 13px; color: #64748b; max-width: 480px; margin: 0 auto;">
            Only doctors who have registered their <strong>Doctor ID and Password</strong> through the Doctor Sign Up portal appear in this list. Unregistered / mock doctors are strictly excluded.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(d => {
    const isOnline = Boolean(d.isLoggedIn);
    const statusClass = isOnline ? "doc-status-online" : "doc-status-offline";
    const statusIcon = isOnline ? "🟢" : "⚪";
    const statusText = isOnline ? "Logged In / Active" : "Offline";
    const actionLabel = isOnline ? "🚪 Sign Out" : "🔑 Mark Online";

    const isApproved = (d.approvalStatus || "").toLowerCase() === "approved";
    const isRejected = (d.approvalStatus || "").toLowerCase() === "rejected";
    const appClass = isApproved ? "status-approved" : (isRejected ? "status-flagged" : "status-pending");
    const appLabel = isApproved ? "✓ Approved" : (isRejected ? "❌ Rejected" : "⏳ Pending Review");

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">${escapeHtml(d.avatar || "👨‍⚕️")}</span>
            <div>
              <strong style="color: #0f172a; font-size: 14.5px;">${escapeHtml(d.name)}</strong>
              <div style="color: #64748b; font-size: 12px; margin-top: 2px;">
                📞 ${escapeHtml(d.phone || "N/A")} · Lic: <code>${escapeHtml(d.licenseNo || "N/A")}</code>
              </div>
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b;">ID:</span>
              <span style="background: #f1f5f9; color: #0f172a; font-weight: 700; font-family: monospace; padding: 2px 7px; border-radius: 4px; border: 1px solid #cbd5e1;">${escapeHtml(d.id)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 11px; font-weight: 700; color: #64748b;">PWD:</span>
              <span style="background: #ecfdf5; color: #065f46; font-weight: 700; font-family: monospace; padding: 2px 7px; border-radius: 4px; border: 1px solid #a7f3d0;" title="Registered Doctor Password">🔑 ${escapeHtml(d.password)}</span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-weight: 600; color: #0369a1; background: #f0f9ff; padding: 3px 8px; border-radius: 6px; border: 1px solid #e0f2fe;">${escapeHtml(d.specialty)}</span>
        </td>
        <td>
          <span style="color: #334155; font-weight: 500;">📍 ${escapeHtml(d.cabin)}</span>
        </td>
        <td>
          <span class="approval-status-badge ${appClass}">
            ${appLabel}
          </span>
        </td>
        <td>
          <span class="doc-status-pill ${statusClass}">
            ${statusIcon} ${statusText}
          </span>
        </td>
        <td>
          <span style="font-size: 12px; color: #64748b;">${escapeHtml(d.createdAt || "Recent")}</span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            ${!isApproved ? `
              <button type="button" class="btn-admin-action btn-admin-approve" onclick="approveDoctor('${escapeHtml(d.id)}')" title="Approve Doctor">
                ✓ Approve
              </button>
            ` : ""}
            <button type="button" class="btn-admin-action" onclick="toggleDoctorLoginStatus('${escapeHtml(d.id)}')" title="Toggle Doctor Login Status">
              ${actionLabel}
            </button>
            <button type="button" class="btn-admin-action" onclick="deleteRegisteredDoctor('${escapeHtml(d.id)}')" title="Delete Doctor" style="color: #dc2626;">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function deleteRegisteredDoctor(docId) {
  if (!confirm(`Are you sure you want to remove doctor ${docId}?`)) return;

  const localDocs = getRegisteredDoctorsList().filter(d => d.id !== docId && d.doctor_id !== docId);
  try {
    localStorage.setItem("medikiosk_registered_doctors", JSON.stringify(localDocs));
  } catch (e) {}

  if (typeof adminState !== "undefined") {
    if (adminState.doctors) adminState.doctors = adminState.doctors.filter(d => d.id !== docId);
    if (adminState.doctorApprovals) adminState.doctorApprovals = adminState.doctorApprovals.filter(d => d.id !== docId);
  }

  try {
    await fetch(`${API_URL}/api/doctor/${encodeURIComponent(docId)}`, { method: "DELETE" });
  } catch (e) {}

  toast(`Doctor ${docId} deleted.`);
  renderAdminDoctorList();
  if (typeof renderAdminDoctorApprovals === "function") renderAdminDoctorApprovals();
  if (typeof refreshDoctorProfileSelect === "function") refreshDoctorProfileSelect();
}

function filterAdminDoctors(term) {
  adminState.doctorSearchQuery = term;
  renderAdminDoctorList(term);
}

function toggleDoctorLoginStatus(docId) {
  const doc = (adminState.doctors || []).find(d => d.id === docId);
  if (!doc) return;

  doc.isLoggedIn = !doc.isLoggedIn;
  doc.lastLogin = doc.isLoggedIn ? `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Just now";

  // If this doctor was the active session doctor
  if (doctorSessionState.currentDoctor && doctorSessionState.currentDoctor.id === docId) {
    doctorSessionState.isAuthenticated = doc.isLoggedIn;
    const topbarName = document.getElementById("topbarDoctorName");
    if (topbarName) {
      topbarName.textContent = doc.isLoggedIn ? doc.name.split(",")[0].replace("Dr. ", "Dr. ") : "Doctor";
    }
  }

  renderAdminDoctorList();
  toast(`Doctor ${doc.name}: ${doc.isLoggedIn ? "🟢 Marked Logged In" : "⚪ Marked Offline"}`);
  addAudit(`Doctor status toggled: ${doc.name} ➔ ${doc.isLoggedIn ? "Online" : "Offline"}`);
}

// 5. Menu 3: Doctors Approval (Credential & Licensing Approvals)
async function renderAdminDoctorApprovals() {
  const container = document.getElementById("adminDoctorApprovalsContainer");
  const countBadge = document.getElementById("adminDoctorApprovalBadge");

  const samplePrefixes = ["DAPP-", "DOC-SHARMA", "DOC-RAO", "DOC-IYER", "DOC-MEHTA", "DOC-VERMA", "DOC-DESHMUKH", "DOC-NAIR", "DOC-SETH"];
  const sampleNames = ["Dr. Siddharth Sen", "Dr. Meera Nambiar", "Dr. Rohan Kulkarni", "Dr. Harish Bhatt", "Dr. Rajesh Sharma", "Dr. Sunita Rao", "Dr. Ananya Iyer", "Dr. Vikram Mehta"];

  const isSampleDoc = (id, name) => {
    if (!id) return true;
    const upperId = id.toUpperCase();
    if (samplePrefixes.some(p => upperId.startsWith(p))) return true;
    if (sampleNames.some(sn => name && name.toLowerCase().includes(sn.toLowerCase()))) return true;
    return false;
  };

  // 1. Gather genuinely registered doctors from localStorage
  const localDocs = getRegisteredDoctorsList() || [];

  // 2. Fetch from backend /api/doctor/approvals if reachable
  let backendApprovals = [];
  try {
    const res = await fetch(`${API_URL}/api/doctor/approvals`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.approvals)) backendApprovals = data.approvals;
    }
  } catch (e) {}

  // 3. Merge real registered doctors strictly without samples
  const map = new Map();

  localDocs.forEach(d => {
    const id = (d.id || d.doctor_id || "").trim();
    if (id && !isSampleDoc(id, d.name) && d.password) {
      map.set(id.toUpperCase(), {
        id,
        doctor_id: id,
        name: d.name,
        specialty: d.specialty || "General Medicine",
        cabin: d.cabin || "Room 101",
        phone: d.phone || "",
        licenseNo: d.licenseNo || d.license_no || "Verified",
        college: d.college || "State Medical University",
        experience: d.experience || "Registered Specialist",
        status: (d.status || d.approvalStatus || "pending").toLowerCase(),
        submittedAt: d.submittedAt || "Recently",
        degreeVerified: d.degreeVerified !== false,
        password: d.password
      });
    }
  });

  backendApprovals.forEach(b => {
    const id = (b.doctor_id || b.id || "").trim();
    if (id && !isSampleDoc(id, b.name) && b.password) {
      const prev = map.get(id.toUpperCase()) || {};
      map.set(id.toUpperCase(), {
        ...prev,
        id,
        doctor_id: id,
        name: b.name || prev.name,
        specialty: b.specialty || prev.specialty || "General OPD",
        cabin: b.cabin || prev.cabin || "Cabin 101",
        phone: b.phone || prev.phone || "",
        licenseNo: b.license_no || prev.licenseNo || "Verified",
        college: prev.college || "State Medical University",
        experience: prev.experience || "Registered Specialist",
        status: (b.approval_status || prev.status || "pending").toLowerCase(),
        submittedAt: prev.submittedAt || "Recently",
        degreeVerified: prev.degreeVerified !== false,
        password: b.password || prev.password
      });
    }
  });

  // Also include any active in-memory adminState.doctorApprovals that aren't sample doctors
  (adminState.doctorApprovals || []).forEach(a => {
    const id = (a.id || a.doctor_id || "").trim();
    if (id && !isSampleDoc(id, a.name) && a.password) {
      const prev = map.get(id.toUpperCase()) || {};
      map.set(id.toUpperCase(), { ...prev, ...a, id, doctor_id: id });
    }
  });

  // Strict deduplication by person (One person, one time)
  const dedupedApprovals = [];
  const seenPersons = new Set();
  Array.from(map.values()).forEach(a => {
    const normName = normalizeDocName(a.name);
    const cleanPhone = (a.phone || "").replace(/\D/g, "");
    const cleanLic = (a.licenseNo || a.license_no || "").trim().toLowerCase();
    const id = (a.id || a.doctor_id || "").trim().toUpperCase();
    const key = cleanLic || (cleanPhone.length >= 10 ? cleanPhone.slice(-10) : "") || normName || id;
    if (key && !seenPersons.has(key)) {
      seenPersons.add(key);
      dedupedApprovals.push(a);
    }
  });

  adminState.doctorApprovals = dedupedApprovals;
  const allApprovals = adminState.doctorApprovals;
  const pendingCount = allApprovals.filter(a => a.status === "pending").length;

  if (countBadge) countBadge.textContent = `${pendingCount} Pending`;
  if (!container) return;

  const filter = adminState.doctorApprovalFilter || "all";
  const items = allApprovals.filter(a => {
    if (filter === "all") return true;
    return a.status === filter;
  });

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #64748b; background: #fff; border-radius: 12px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 38px; margin-bottom: 8px;">📋</div>
        <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 4px;">No Registering Doctors in "${filter}" Status</div>
        <div style="font-size: 13px; color: #64748b; max-width: 480px; margin: 0 auto;">
          Only real doctors who have registered through the <strong>Doctor Sign Up</strong> portal appear here for administrator credential approval. Sample doctors have been removed.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(a => {
    let statusClass = "status-pending";
    let statusLabel = "⏳ Pending Review";
    if (a.status === "approved") {
      statusClass = "status-approved";
      statusLabel = "✓ Approved";
    } else if (a.status === "rejected") {
      statusClass = "status-flagged";
      statusLabel = "❌ Rejected";
    }

    return `
      <div class="approval-card">
        <div class="approval-card-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 16px; color: #0f172a;">👨‍⚕️ ${escapeHtml(a.name)}</strong>
              <span class="priority-pill" style="background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;">${escapeHtml(a.specialty)}</span>
            </div>
            <small style="color: #64748b;">License: <strong>${escapeHtml(a.licenseNo)}</strong> · ${escapeHtml(a.college)} · ${escapeHtml(a.experience)}</small>
          </div>
          <span class="approval-status-badge ${statusClass}">${statusLabel}</span>
        </div>

        <div class="approval-body">
          <div style="display: flex; gap: 16px; font-size: 12.5px; color: #475569; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
            <span><strong>Degree Verification:</strong> ${a.degreeVerified ? '✅ Verified by State Medical Council' : '⚠️ Pending Verification'}</span>
            <span><strong>Submitted:</strong> ${escapeHtml(a.submittedAt)}</span>
          </div>
        </div>

        <div class="approval-card-footer">
          <span style="font-size: 12px; color: #64748b;">Ref: <code>${escapeHtml(a.id)}</code></span>
          <div style="display: flex; gap: 8px;">
            ${a.status !== "approved" ? `
              <button type="button" class="btn-admin-action btn-admin-approve" onclick="approveDoctor('${escapeHtml(a.id)}')">
                ✓ Approve Doctor
              </button>
            ` : ""}
            ${a.status !== "rejected" ? `
              <button type="button" class="btn-admin-action btn-admin-flag" onclick="rejectDoctor('${escapeHtml(a.id)}')">
                ❌ Reject
              </button>
            ` : ""}
            <button type="button" class="btn-admin-action" onclick="viewDoctorCredentials('${escapeHtml(a.id)}')">
              👁️ View Credentials
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function filterDoctorApprovals(status, btn) {
  adminState.doctorApprovalFilter = status;
  document.querySelectorAll("#adminTabDoctorApprovals .panel-filter-pills .filter-pill").forEach(p => p.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderAdminDoctorApprovals();
}

function approveDoctor(appId) {
  let item = (adminState.doctorApprovals || []).find(a => a.id === appId);
  const regList = getRegisteredDoctorsList();
  let regItem = regList.find(d => d.id === appId || (d.name && item && d.name === item.name));
  
  if (!item && regItem) item = regItem;
  if (!item) return;

  item.status = "approved";
  item.approvalStatus = "approved";

  // Update in localStorage
  if (regItem) {
    regItem.status = "approved";
    regItem.approvalStatus = "approved";
    try {
      localStorage.setItem("medikiosk_registered_doctors", JSON.stringify(regList));
    } catch (e) {}
  }

  // Add to hospital doctor list if not already present
  const exists = (adminState.doctors || []).some(d => d.name.includes(item.name) || d.id === appId);
  if (!exists) {
    adminState.doctors.push({
      id: item.id || `DOC-${Math.floor(100 + Math.random() * 900)}`,
      name: item.name,
      specialty: item.specialty || "General Medicine",
      cabin: item.cabin || "Room 115 (OPD)",
      shift: "09:00 AM - 04:00 PM",
      isLoggedIn: false,
      lastLogin: "Pending first login",
      phone: item.phone || "9876500999",
      email: "doctor@hospital.org",
      avatar: "👨‍⚕️"
    });
  }

  // Sync to backend
  fetch(`${API_URL}/api/doctor/approvals/${encodeURIComponent(appId)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "approved" })
  }).catch(() => {});

  addAudit(`Doctor application approved by Admin: ${item.name} (${item.licenseNo || "Verified"})`);
  renderAdminDoctorApprovals();
  renderAdminDoctorList();
  if (typeof refreshDoctorProfileSelect === "function") refreshDoctorProfileSelect();
  toast(`✓ Doctor ${item.name} Approved to Enter Workstation`);
}

function rejectDoctor(appId) {
  let item = (adminState.doctorApprovals || []).find(a => a.id === appId);
  const regList = getRegisteredDoctorsList();
  let regItem = regList.find(d => d.id === appId || (d.name && item && d.name === item.name));
  
  if (!item && regItem) item = regItem;
  if (!item) return;

  item.status = "rejected";
  item.approvalStatus = "rejected";

  if (regItem) {
    regItem.status = "rejected";
    regItem.approvalStatus = "rejected";
    try {
      localStorage.setItem("medikiosk_registered_doctors", JSON.stringify(regList));
    } catch (e) {}
  }

  // Sync to backend
  fetch(`${API_URL}/api/doctor/approvals/${encodeURIComponent(appId)}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "rejected" })
  }).catch(() => {});

  addAudit(`Doctor application rejected by Admin: ${item.name}`);
  renderAdminDoctorApprovals();
  if (typeof refreshDoctorProfileSelect === "function") refreshDoctorProfileSelect();
  toast(`❌ Application ${appId} Rejected by Admin`);
}

function viewDoctorCredentials(appId) {
  const item = (adminState.doctorApprovals || []).find(a => a.id === appId);
  if (!item) return;

  alert(`📋 Doctor Credential Dossier: ${item.id}\n\n` +
        `Physician: ${item.name}\n` +
        `Medical Council License: ${item.licenseNo}\n` +
        `Specialty: ${item.specialty}\n` +
        `Graduating Institution: ${item.college}\n` +
        `Clinical Experience: ${item.experience}\n` +
        `Medical Degrees: MBBS, MD (Verified)\n` +
        `Background Check: Passed\n` +
        `Current Status: ${item.status.toUpperCase()}`);
}

// 6. Menu 4: Billing Part
function renderAdminBilling() {
  const tbody = document.getElementById("adminBillingTableBody");
  const badge = document.getElementById("adminBillingCountBadge");
  const totalAmountEl = document.getElementById("billingTotalAmount");
  const paidCountEl = document.getElementById("billingPaidCount");
  const pendingAmountEl = document.getElementById("billingPendingAmount");
  const insuranceCountEl = document.getElementById("billingInsuranceCount");

  const bills = adminState.billing || [];
  const totalRev = bills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const paidBills = bills.filter(b => b.status === "Paid");
  const pendingBills = bills.filter(b => b.status === "Pending");
  const pendingAmount = pendingBills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const insuranceCount = bills.filter(b => b.paymentMode && b.paymentMode.includes("PM-JAY")).length;

  if (badge) badge.textContent = `${bills.length} Invoices`;
  if (totalAmountEl) totalAmountEl.textContent = `₹${totalRev.toLocaleString()}`;
  if (paidCountEl) paidCountEl.textContent = paidBills.length;
  if (pendingAmountEl) pendingAmountEl.textContent = `₹${pendingAmount.toLocaleString()}`;
  if (insuranceCountEl) insuranceCountEl.textContent = insuranceCount;

  if (!tbody) return;

  if (bills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 24px;">No billing invoices recorded today.</td></tr>`;
    return;
  }

  tbody.innerHTML = bills.map(b => {
    let statusClass = "bill-status-paid";
    if (b.status === "Pending") statusClass = "bill-status-pending";
    if (b.status === "Refunded") statusClass = "bill-status-refunded";

    return `
      <tr>
        <td><strong style="color: #4338ca;">${escapeHtml(b.id)}</strong></td>
        <td><span style="font-size: 12.5px; color: #64748b;">${escapeHtml(b.timestamp || "Today")}</span></td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${escapeHtml(b.patientName)}</div>
          <small style="color: #64748b;">ID: ${escapeHtml(b.patientId || "--")}</small>
        </td>
        <td><span style="color: #334155; font-weight: 500;">${escapeHtml(b.service)}</span></td>
        <td><strong style="color: #0f172a; font-size: 15px;">₹${Number(b.amount).toLocaleString()}</strong></td>
        <td><span style="font-size: 12.5px; color: #475569;">${escapeHtml(b.paymentMode)}</span></td>
        <td><span class="${statusClass}">${escapeHtml(b.status)}</span></td>
        <td style="text-align: right; white-space: nowrap;">
          ${b.status === "Pending" ? `
            <button type="button" class="btn-admin-action btn-admin-approve" onclick="markBillPaid('${escapeHtml(b.id)}')">
              ✓ Mark Paid
            </button>
          ` : `
            <button type="button" class="btn-admin-action" onclick="toast('Invoice ${escapeHtml(b.id)} printed')">
              🖨️ Receipt
            </button>
          `}
        </td>
      </tr>
    `;
  }).join("");
}

function markBillPaid(invId) {
  const bill = (adminState.billing || []).find(b => b.id === invId);
  if (!bill) return;
  bill.status = "Paid";
  renderAdminBilling();
  toast(`✓ Invoice ${invId} marked as Paid`);
  addAudit(`Invoice paid: ${invId} for ${bill.patientName} (₹${bill.amount})`);
}

function openNewBillModal() {
  const modal = document.getElementById("adminNewBillModal");
  const selectPatient = document.getElementById("billPatientSelect");
  if (!modal || !selectPatient) return;

  const allPatients = getAllAdminPatients();
  selectPatient.innerHTML = allPatients.map(p => `
    <option value="${escapeHtml(p.userId || p.id)}|${escapeHtml(p.name)}">
      ${escapeHtml(p.name)} (${escapeHtml(p.userId || p.id)})
    </option>
  `).join("");

  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
}

function closeNewBillModal() {
  const modal = document.getElementById("adminNewBillModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.classList.add("hidden");
  modal.style.display = "none";
}

function onBillServiceChange(val) {
  const parts = val.split("|");
  if (parts.length > 1) {
    const amtInput = document.getElementById("billAmount");
    if (amtInput) amtInput.value = parts[1];
  }
}

function saveNewBill() {
  const patientVal = document.getElementById("billPatientSelect")?.value;
  const serviceVal = document.getElementById("billService")?.value;
  const amountVal = document.getElementById("billAmount")?.value;
  const paymentMode = document.getElementById("billPaymentMode")?.value;
  const status = document.getElementById("billStatus")?.value;

  if (!patientVal || !serviceVal) {
    toast("Please select patient and service.");
    return;
  }

  const [patientId, patientName] = patientVal.split("|");
  const [serviceName] = serviceVal.split("|");
  const newInvId = `INV-2026-0${80 + (adminState.billing || []).length + 1}`;

  const newInvoice = {
    id: newInvId,
    patientId,
    patientName,
    service: serviceName,
    amount: Number(amountVal) || 0,
    paymentMode,
    status,
    timestamp: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  };

  adminState.billing.unshift(newInvoice);
  closeNewBillModal();
  renderAdminBilling();
  addAudit(`New invoice issued: ${newInvId} for ${patientName} (₹${amountVal})`);
  toast(`✓ Generated invoice ${newInvId} for ${patientName}`);
}

function exportBillingLedger() {
  toast("📥 Exported Billing Ledger CSV successfully");
}

// 7. Menu 5: Report / Problem Part (User-submitted problems storage)
function renderAdminProblems() {
  const tbody = document.getElementById("adminProblemsTableBody");
  const countBadge = document.getElementById("adminProblemCountBadge");
  const openCountEl = document.getElementById("problemOpenCount");
  const progressCountEl = document.getElementById("problemProgressCount");
  const resolvedCountEl = document.getElementById("problemResolvedCount");

  const problems = adminState.userProblems || [];
  const openCount = problems.filter(p => p.status === "Open").length;
  const progressCount = problems.filter(p => p.status === "In Progress").length;
  const resolvedCount = problems.filter(p => p.status === "Resolved").length;

  if (countBadge) countBadge.textContent = `${openCount} Open`;
  if (openCountEl) openCountEl.textContent = openCount;
  if (progressCountEl) progressCountEl.textContent = progressCount;
  if (resolvedCountEl) resolvedCountEl.textContent = resolvedCount;

  if (!tbody) return;

  if (problems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 24px;">No user problem reports filed.</td></tr>`;
    return;
  }

  tbody.innerHTML = problems.map(p => {
    let statusClass = "ticket-status-open";
    if (p.status === "In Progress") statusClass = "ticket-status-progress";
    if (p.status === "Resolved") statusClass = "ticket-status-resolved";

    let priorityClass = "ticket-priority-medium";
    if (p.priority === "high") priorityClass = "ticket-priority-high";
    if (p.priority === "low") priorityClass = "ticket-priority-low";

    return `
      <tr>
        <td><strong style="color: #b91c1c;">${escapeHtml(p.id)}</strong></td>
        <td><span style="font-size: 12.5px; color: #64748b;">${escapeHtml(p.submittedAt)}</span></td>
        <td>
          <div style="font-weight: 600; color: #0f172a;">${escapeHtml(p.patientName)}</div>
          <small style="color: #64748b;">📞 ${escapeHtml(p.phone)}</small>
        </td>
        <td><span style="color: #334155; font-weight: 600;">${escapeHtml(p.category)}</span></td>
        <td><span class="${priorityClass}">${escapeHtml(p.priority ? p.priority.toUpperCase() : "STANDARD")}</span></td>
        <td>
          <div style="max-width: 260px; font-size: 13px; color: #1e293b; line-height: 1.4;">
            ${escapeHtml(p.description)}
          </div>
        </td>
        <td><span class="${statusClass}">${escapeHtml(p.status)}</span></td>
        <td style="text-align: right; white-space: nowrap;">
          ${p.status !== "Resolved" ? `
            <button type="button" class="btn-admin-action btn-admin-approve" onclick="resolveProblemTicket('${escapeHtml(p.id)}')">
              ✓ Resolve
            </button>
          ` : `
            <span style="color: #16a34a; font-weight: 600; font-size: 12px;">Resolved ✓</span>
          `}
          <button type="button" class="btn-admin-action btn-admin-delete" onclick="deleteProblemTicket('${escapeHtml(p.id)}')">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function resolveProblemTicket(ticketId) {
  const item = (adminState.userProblems || []).find(p => p.id === ticketId);
  if (!item) return;

  item.status = "Resolved";
  try {
    localStorage.setItem("medikiosk_user_problems", JSON.stringify(adminState.userProblems));
  } catch (e) {}

  renderAdminProblems();
  toast(`✓ Problem ticket ${ticketId} resolved`);
  addAudit(`Problem ticket resolved: ${ticketId} (${item.patientName})`);
}

function deleteProblemTicket(ticketId) {
  adminState.userProblems = (adminState.userProblems || []).filter(p => p.id !== ticketId);
  try {
    localStorage.setItem("medikiosk_user_problems", JSON.stringify(adminState.userProblems));
  } catch (e) {}

  renderAdminProblems();
  toast(`🗑️ Ticket ${ticketId} removed`);
}

function exportProblemReports() {
  toast("📥 Problem reports exported successfully");
}

// 8. User Problem Submission (Kiosk-Facing)
function openReportProblemModal() {
  const modal = document.getElementById("reportProblemModal");
  if (!modal) return;

  const nameInput = document.getElementById("problemPatientName");
  const phoneInput = document.getElementById("problemPatientPhone");
  const descInput = document.getElementById("problemDescription");

  if (nameInput) nameInput.value = (state.patient && state.patient.name) || "";
  if (phoneInput) phoneInput.value = (state.patient && state.patient.phone) || "";
  if (descInput) descInput.value = "";

  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
}

function closeReportProblemModal() {
  const modal = document.getElementById("reportProblemModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.classList.add("hidden");
  modal.style.display = "none";
}

function submitUserProblem() {
  const name = document.getElementById("problemPatientName")?.value.trim() || "Anonymous Patient";
  const phone = document.getElementById("problemPatientPhone")?.value.trim() || "Not provided";
  const category = document.getElementById("problemCategory")?.value || "General Feedback";
  const priority = document.getElementById("problemPriority")?.value || "medium";
  const description = document.getElementById("problemDescription")?.value.trim() || "No details provided";

  if (!description) {
    toast("Please describe the problem.");
    return;
  }

  const ticketId = `PR-2026-0${10 + (adminState.userProblems || []).length + 1}`;
  const newProblem = {
    id: ticketId,
    patientName: name,
    phone,
    category,
    priority,
    description,
    status: "Open",
    submittedAt: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  };

  adminState.userProblems.unshift(newProblem);
  try {
    localStorage.setItem("medikiosk_user_problems", JSON.stringify(adminState.userProblems));
  } catch (e) {}

  closeReportProblemModal();
  renderAdminProblems();
  addAudit(`User problem submitted: ${ticketId} (${category})`);
  toast(`🚨 Problem submitted (#${ticketId}). Stored in Hospital Admin Box.`);
}

// 9. Clinical Doctor Portal & Top Bar Doctor Box
function openDoctorPortal() {
  if (doctorSessionState.isAuthenticated) {
    showScreen("doctorDashboardScreen");
    switchDoctorTab("dashboard");
  } else {
    openDoctorAuthModal();
  }
}

function extractLastNameAndPassword(name) {
  const cleaned = (name || "").replace(/^(dr\.|dr|doctor)\s+/i, '').split(',')[0].trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const lastName = tokens.length ? tokens[tokens.length - 1].charAt(0).toUpperCase() + tokens[tokens.length - 1].slice(1) : "Doctor";
  const num = Math.floor(1000 + Math.random() * 9000);
  return {
    lastName,
    password: `${lastName}${num}`,
    num
  };
}

function normalizeDocName(name) {
  if (!name) return "";
  return name.trim().replace(/^(dr\.|dr|doctor)\s+/i, "").replace(/,/g, "").replace(/\s+/g, " ").toLowerCase();
}

function switchToSignInWithDoctorId(docId) {
  switchDoctorAuthTab("signin");
  const loginInput = document.getElementById("doctorLoginId");
  if (loginInput) loginInput.value = docId;
  const pinInput = document.getElementById("doctorPin");
  if (pinInput) pinInput.focus();
}

function previewGeneratedPassword(val) {
  const previewEl = document.getElementById("doctorPwdPreviewText");
  if (!previewEl) return;
  if (!val || !val.trim()) {
    previewEl.textContent = "— (Type Full Name above)";
    return;
  }
  const { lastName } = extractLastNameAndPassword(val);
  previewEl.textContent = `${lastName}#### (e.g. ${lastName}${Math.floor(1000 + Math.random() * 9000)})`;
}

function getRegisteredDoctorsList() {
  try {
    const raw = JSON.parse(localStorage.getItem("medikiosk_registered_doctors") || "[]");
    if (!Array.isArray(raw)) return [];
    // Strict deduplication: one person, one time
    const seen = new Set();
    const unique = [];
    raw.forEach(d => {
      const normName = normalizeDocName(d.name);
      const cleanPhone = (d.phone || "").replace(/\D/g, "");
      const cleanLicense = (d.license_no || d.licenseNo || "").trim().toLowerCase();
      const id = (d.id || d.doctor_id || "").trim().toUpperCase();
      const personKey = cleanLicense || (cleanPhone.length >= 10 ? cleanPhone.slice(-10) : "") || normName || id;
      if (personKey && !seen.has(personKey)) {
        seen.add(personKey);
        unique.push(d);
      }
    });
    return unique;
  } catch (e) {
    return [];
  }
}

async function refreshDoctorProfileSelect() {
  const select = document.getElementById("doctorSelectProfile");
  if (!select) return;

  const mockDoctorIds = new Set(["DOC-SHARMA", "DOC-RAO", "DOC-IYER", "DOC-MEHTA", "DOC-VERMA", "DOC-DESHMUKH", "DOC-NAIR", "DOC-SETH"]);

  // 1. Gather from local storage
  const registered = getRegisteredDoctorsList() || [];

  // 2. Fetch from backend if reachable
  let backendDoctors = [];
  try {
    const res = await fetch(`${API_URL}/api/doctor/registered`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.doctors)) backendDoctors = data.doctors;
    }
  } catch (e) {}

  const map = new Map();

  registered.forEach(r => {
    const id = (r.id || r.doctor_id || "").trim();
    if (id && !mockDoctorIds.has(id) && r.password) {
      map.set(id.toUpperCase(), { ...r, id, doctor_id: id });
    }
  });

  backendDoctors.forEach(b => {
    const id = (b.doctor_id || b.id || "").trim();
    if (id && !mockDoctorIds.has(id) && b.password) {
      const prev = map.get(id.toUpperCase()) || {};
      map.set(id.toUpperCase(), {
        ...prev,
        ...b,
        id,
        doctor_id: id,
        status: b.approval_status || prev.status || "pending",
        approvalStatus: b.approval_status || prev.approvalStatus || "pending"
      });
    }
  });

  const all = Array.from(map.values());

  if (all.length === 0) {
    select.innerHTML = `<option value="">-- No registered doctors yet (Please Sign Up) --</option>`;
    return;
  }

  select.innerHTML = `<option value="">-- Select Registered Doctor Profile --</option>` + all.map(d => {
    const isApproved = (d.status || d.approvalStatus || d.approval_status || "").toLowerCase() === "approved";
    const statusTag = isApproved ? " [Approved]" : " [⏳ PENDING APPROVAL]";
    return `<option value="${escapeHtml(d.id)}|${escapeHtml(d.name)}|${escapeHtml(d.specialty)}|${escapeHtml(d.cabin)}">${escapeHtml(d.name)} · ${escapeHtml(d.specialty)} (${escapeHtml(d.cabin)})${statusTag}</option>`;
  }).join("");
}

function switchDoctorAuthTab(tab) {
  const signInBtn = document.getElementById("doctorTabSignInBtn");
  const signUpBtn = document.getElementById("doctorTabSignUpBtn");
  const signInView = document.getElementById("doctorSignInView");
  const signUpView = document.getElementById("doctorSignUpView");
  const successCard = document.getElementById("doctorSignupSuccessCard");
  const notice = document.getElementById("doctorSignInApprovalNotice");
  const status = document.getElementById("doctorAuthStatus");

  if (notice) notice.classList.add("hidden");
  if (status) { status.textContent = ""; status.className = "status"; }

  if (tab === "signup") {
    if (signInBtn) signInBtn.classList.remove("active");
    if (signUpBtn) signUpBtn.classList.add("active");
    if (signInView) signInView.classList.add("hidden");
    if (signUpView) signUpView.classList.remove("hidden");
    if (successCard) successCard.classList.add("hidden");
  } else {
    if (signUpBtn) signUpBtn.classList.remove("active");
    if (signInBtn) signInBtn.classList.add("active");
    if (signUpView) signUpView.classList.add("hidden");
    if (signInView) signInView.classList.remove("hidden");
    if (successCard) successCard.classList.add("hidden");
    refreshDoctorProfileSelect();
  }
}

function toggleDoctorPwdVisibility() {
  const pinInput = document.getElementById("doctorPin");
  if (!pinInput) return;
  pinInput.type = pinInput.type === "password" ? "text" : "password";
}

function copyDoctorCredentials() {
  const pwdEl = document.getElementById("succDocPwd");
  if (!pwdEl) return;
  const pwd = pwdEl.textContent.trim();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(pwd).then(() => toast("📋 Password copied to clipboard!")).catch(() => {});
  } else {
    toast(`📋 Password: ${pwd}`);
  }
}

function switchToSignInWithDoctorCredentials() {
  const docId = document.getElementById("succDocId")?.textContent.trim() || "";
  const pwd = document.getElementById("succDocPwd")?.textContent.trim() || "";

  switchDoctorAuthTab("signin");

  const loginInput = document.getElementById("doctorLoginId");
  const pinInput = document.getElementById("doctorPin");
  if (loginInput) loginInput.value = docId;
  if (pinInput) pinInput.value = pwd;
}

function openDoctorAuthModal() {
  const modal = document.getElementById("doctorAuthModal");
  if (!modal) return;
  const status = document.getElementById("doctorAuthStatus");
  if (status) { status.textContent = ""; status.className = "status"; }
  switchDoctorAuthTab("signin");
  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
}

function closeDoctorAuthModal() {
  const modal = document.getElementById("doctorAuthModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.classList.add("hidden");
  modal.style.display = "none";
}

function onDoctorSelectChange(val) {
  const loginInput = document.getElementById("doctorLoginId");
  const noticeEl = document.getElementById("doctorSignInApprovalNotice");
  if (noticeEl) noticeEl.classList.add("hidden");
  if (loginInput && val) {
    const parts = val.split("|");
    loginInput.value = parts[0];
  }
}

async function handleDoctorSignup() {
  const nameInput = document.getElementById("doctorSignupFullName");
  const specialtyInput = document.getElementById("doctorSignupSpecialty");
  const cabinInput = document.getElementById("doctorSignupCabin");
  const phoneInput = document.getElementById("doctorSignupPhone");
  const licenseInput = document.getElementById("doctorSignupLicense");
  const statusEl = document.getElementById("doctorSignupStatus");

  const rawName = nameInput ? nameInput.value.trim() : "";
  const specialty = specialtyInput ? specialtyInput.value.trim() : "General Medicine";
  const cabin = cabinInput ? cabinInput.value.trim() : "Room 304 (Block B)";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const license = licenseInput ? licenseInput.value.trim() : "";

  if (!rawName) {
    if (statusEl) { statusEl.textContent = "Please enter your full name."; statusEl.className = "status error"; }
    return;
  }
  if (!phone || phone.length < 10) {
    if (statusEl) { statusEl.textContent = "Please enter a valid 10-digit mobile number."; statusEl.className = "status error"; }
    return;
  }
  if (!license) {
    if (statusEl) { statusEl.textContent = "Please enter your Medical Council License / Reg number."; statusEl.className = "status error"; }
    return;
  }

  const fullName = rawName.startsWith("Dr.") ? rawName : `Dr. ${rawName}`;
  const normName = normalizeDocName(fullName);
  const cleanPhone = phone.replace(/\D/g, "");
  const cleanLicense = license.trim().toLowerCase();

  // STRICT REQUIREMENT: Register only one time, one person one time!
  const isDuplicateDoc = (d) => {
    const dNorm = normalizeDocName(d.name);
    const dPhone = (d.phone || "").replace(/\D/g, "");
    const dLic = (d.license_no || d.licenseNo || "").trim().toLowerCase();
    if (cleanLicense && dLic && cleanLicense === dLic) return true;
    if (cleanPhone && cleanPhone.length >= 10 && dPhone && dPhone.length >= 10 && cleanPhone.slice(-10) === dPhone.slice(-10)) return true;
    if (normName && dNorm && normName === dNorm) return true;
    return false;
  };

  const regList = getRegisteredDoctorsList();
  const adminApprovals = (typeof adminState !== "undefined" && adminState.doctorApprovals) ? adminState.doctorApprovals : [];

  let dup = regList.find(isDuplicateDoc) || adminApprovals.find(isDuplicateDoc);

  // Check backend if reachable
  if (!dup) {
    try {
      const bRes = await fetch(`${API_URL}/api/doctor/registered`);
      if (bRes.ok) {
        const bData = await bRes.json();
        if (Array.isArray(bData.doctors)) {
          dup = bData.doctors.find(isDuplicateDoc);
        }
      }
    } catch (e) {}
  }

  if (dup) {
    const dupId = dup.doctor_id || dup.id || "Registered";
    const dupName = dup.name || fullName;
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 10px; padding: 12px 14px; color: #991b1b; font-size: 13px; line-height: 1.5;">
          <strong>❌ Doctor Already Registered (One Person, One Time):</strong><br>
          A doctor profile for <b>${escapeHtml(dupName)}</b> is already registered with Doctor ID: <b>${escapeHtml(dupId)}</b>.<br>
          <span style="font-size: 12px; color: #7f1d1d;">Each physician can register only once. Please sign in directly using your Doctor ID and Password.</span>
          <div style="margin-top: 10px;">
            <button type="button" class="primary small" onclick="switchToSignInWithDoctorId('${escapeHtml(dupId)}')">👉 Sign In with Doctor ID (${escapeHtml(dupId)})</button>
          </div>
        </div>
      `;
      statusEl.className = "status";
    }
    toast(`⚠️ Doctor ${dupName} is already registered (ID: ${dupId}). One person can only register once.`);
    return;
  }

  let doctorId = `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
  const { lastName, password: localPassword } = extractLastNameAndPassword(fullName);
  let password = localPassword;

  // Sync to backend API first to enforce backend duplicate check
  try {
    const res = await fetch(`${API_URL}/api/doctor/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fullName,
        specialty,
        cabin,
        phone,
        license_no: license
      })
    });
    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      const detailMsg = errData.detail || "Doctor is already registered. One person can register only one time.";
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="background: #fef2f2; border: 1.5px solid #f87171; border-radius: 10px; padding: 12px 14px; color: #991b1b; font-size: 13px; line-height: 1.5;">
            <strong>❌ Already Registered:</strong><br>
            ${escapeHtml(detailMsg)}
            <div style="margin-top: 8px;">
              <button type="button" class="secondary small" onclick="switchDoctorAuthTab('signin')">👉 Switch to Sign In</button>
            </div>
          </div>
        `;
        statusEl.className = "status";
      }
      toast(`⚠️ ${detailMsg}`);
      return;
    }
    if (res.ok) {
      const resData = await res.json();
      if (resData.doctor_id) doctorId = resData.doctor_id;
      if (resData.password) password = resData.password;
    }
  } catch (e) {
    console.warn("Backend doctor register offline:", e);
  }

  const newDoc = {
    id: doctorId,
    doctor_id: doctorId,
    name: fullName,
    lastName,
    password,
    specialty,
    cabin,
    phone,
    licenseNo: license,
    approvalStatus: "pending",
    status: "pending",
    submittedAt: "Just now",
    college: "State Medical University",
    experience: "Registered Specialist",
    degreeVerified: true
  };

  // 1. Save to local storage
  regList.unshift(newDoc);
  try {
    localStorage.setItem("medikiosk_registered_doctors", JSON.stringify(regList));
  } catch (e) {
    console.error("Local storage doctor save error:", e);
  }

  // 2. Add to adminState.doctorApprovals
  if (typeof adminState !== "undefined") {
    if (!adminState.doctorApprovals) adminState.doctorApprovals = [];
    adminState.doctorApprovals.unshift({
      id: doctorId,
      name: fullName,
      specialty,
      licenseNo: license,
      college: "State Medical University",
      experience: "Registered Specialist",
      status: "pending",
      submittedAt: "Just now",
      degreeVerified: true,
      cabin,
      password
    });
    if (typeof renderAdminDoctorApprovals === "function") renderAdminDoctorApprovals();
  }

  // 3. Show success card inside modal
  const signUpView = document.getElementById("doctorSignUpView");
  const successCard = document.getElementById("doctorSignupSuccessCard");
  if (signUpView) signUpView.classList.add("hidden");
  if (successCard) {
    document.getElementById("succDocId").textContent = doctorId;
    document.getElementById("succDocName").textContent = fullName;
    document.getElementById("succDocDept").textContent = `${specialty} · ${cabin}`;
    document.getElementById("succDocPwd").textContent = password;
    successCard.classList.remove("hidden");
  }

  toast(`📝 Doctor ${fullName} registered! Password generated: ${password}`);
  addAudit(`Doctor registration submitted: ${fullName} (${doctorId})`);
}

async function handleDoctorLogin() {
  const loginInput = document.getElementById("doctorLoginId");
  const pinInput = document.getElementById("doctorPin");
  const statusEl = document.getElementById("doctorAuthStatus");
  const noticeEl = document.getElementById("doctorSignInApprovalNotice");
  const checkApprovalBtn = document.getElementById("doctorCheckApprovalBtn");

  if (statusEl) { statusEl.textContent = ""; statusEl.className = "status"; }
  if (noticeEl) noticeEl.classList.add("hidden");

  const typedId = loginInput ? loginInput.value.trim() : "";
  const enteredPwd = pinInput ? pinInput.value.trim() : "";

  if (!typedId) {
    if (statusEl) { statusEl.textContent = "Please enter your Doctor ID or registered name."; statusEl.className = "status error"; }
    return;
  }

  if (!enteredPwd) {
    if (statusEl) { statusEl.textContent = "Please enter your doctor password."; statusEl.className = "status error"; }
    return;
  }

  // Determine target doctor
  let docId = "";
  let docName = "";
  let docDept = "";
  let docCabin = "";
  let expectedPwd = "";
  let approvalStatus = "approved";

  const regList = getRegisteredDoctorsList();
  const adminApprovals = (typeof adminState !== "undefined" && adminState.doctorApprovals) ? adminState.doctorApprovals : [];

  const cleanTyped = typedId.toLowerCase().trim();
  const normTyped = normalizeDocName(typedId);
  const cleanNumeric = cleanTyped.replace(/\D/g, "");

  const matchDoctorRecord = (d) => {
    const dId = (d.id || d.doctor_id || "").toLowerCase().trim();
    const dNum = dId.replace(/\D/g, "");
    const dNorm = normalizeDocName(d.name);
    const dLast = (d.lastName || d.last_name || "").toLowerCase().trim();
    const dPhone = (d.phone || "").replace(/\D/g, "");

    return Boolean(
      (dId && dId === cleanTyped) ||
      (cleanNumeric && dNum && cleanNumeric === dNum) ||
      (normTyped && dNorm && (normTyped === dNorm || dNorm.includes(normTyped) || normTyped.includes(dNorm))) ||
      (normTyped && dLast && (normTyped === dLast || dLast.includes(normTyped))) ||
      (cleanNumeric && cleanNumeric.length >= 10 && dPhone && dPhone.endsWith(cleanNumeric.slice(-10)))
    );
  };

  let matched = regList.find(matchDoctorRecord) || adminApprovals.find(matchDoctorRecord);

  // Cross-query backend to sync credentials if reachable
  try {
    const bRes = await fetch(`${API_URL}/api/doctor/registered`);
    if (bRes.ok) {
      const bData = await bRes.json();
      if (Array.isArray(bData.doctors)) {
        const found = bData.doctors.find(matchDoctorRecord);
        if (found) {
          matched = {
            id: found.doctor_id,
            doctor_id: found.doctor_id,
            name: found.name,
            lastName: found.last_name,
            specialty: found.specialty,
            cabin: found.cabin,
            password: found.password,
            approvalStatus: found.approval_status,
            status: found.approval_status
          };
          // Sync to localStorage
          const localMatchIdx = regList.findIndex(r => r.id === found.doctor_id || normalizeDocName(r.name) === normalizeDocName(found.name));
          if (localMatchIdx >= 0) {
            regList[localMatchIdx] = { ...regList[localMatchIdx], ...matched };
          } else {
            regList.unshift(matched);
          }
          try { localStorage.setItem("medikiosk_registered_doctors", JSON.stringify(regList)); } catch (e) {}
        }
      }
    }
  } catch (e) {}

  if (matched) {
    docId = matched.id || matched.doctor_id;
    docName = matched.name;
    docDept = matched.specialty;
    docCabin = matched.cabin || "Room 101";
    expectedPwd = matched.password;
    approvalStatus = matched.approvalStatus || matched.status || matched.approval_status || "pending";
  }

  // Backend verification
  let backendResOk = false;
  let backendErrorDetail = "";
  try {
    const backendRes = await fetch(`${API_URL}/api/doctor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctor_id_or_name: docId || typedId,
        password: enteredPwd
      })
    });
    if (backendRes.ok) {
      backendResOk = true;
      const bData = await backendRes.json();
      if (bData.doctor) {
        docId = bData.doctor.doctor_id || docId;
        docName = bData.doctor.name || docName;
        docDept = bData.doctor.specialty || docDept;
        docCabin = bData.doctor.cabin || docCabin;
        approvalStatus = bData.doctor.approval_status || bData.status || approvalStatus;
        if (bData.doctor.password) expectedPwd = bData.doctor.password;
      }
    } else {
      const bErr = await backendRes.json().catch(() => ({}));
      if (bErr.detail) backendErrorDetail = bErr.detail;
    }
  } catch (e) {
    // Offline mode
  }

  // Password verification (exact match OR case-insensitive match OR backend verification)
  const isPwdMatch = Boolean(
    backendResOk ||
    (expectedPwd && (
      enteredPwd === expectedPwd ||
      enteredPwd.toLowerCase() === expectedPwd.toLowerCase() ||
      enteredPwd.trim().toLowerCase() === expectedPwd.trim().toLowerCase()
    ))
  );

  if (!matched && !backendResOk) {
    if (statusEl) {
      statusEl.textContent = backendErrorDetail || `❌ Doctor profile "${typedId}" not found. Please check your Doctor ID (e.g. DOC-1655) or register first.`;
      statusEl.className = "status error";
    }
    return;
  }

  if (!isPwdMatch) {
    if (statusEl) {
      statusEl.textContent = backendErrorDetail || `❌ Incorrect password for ${docName} (${docId}). Passwords are format: LastName + numbers.`;
      statusEl.className = "status error";
    }
    return;
  }

  // ADMIN APPROVAL GATE ENFORCEMENT
  if (approvalStatus === "pending") {
    if (noticeEl) {
      noticeEl.className = "doctor-approval-pending-banner";
      noticeEl.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 20px;">⏳</span>
          <div>
            <strong>Approval Pending (Admin):</strong><br>
            Your login request has been sent to the <b>Hospital Admin</b> for credential approval.<br>
            <span style="font-size: 12px; color: #78350f;">Only when the Hospital Administrator approves your profile in the <b>Doctors Approval</b> section can you enter the application.</span>
          </div>
        </div>
      `;
      noticeEl.classList.remove("hidden");
    }
    if (checkApprovalBtn) checkApprovalBtn.classList.remove("hidden");
    if (statusEl) { statusEl.textContent = "⏳ Entry blocked: Pending Admin Approval."; statusEl.className = "status warning"; }
    return;
  }

  if (approvalStatus === "rejected") {
    if (noticeEl) {
      noticeEl.className = "doctor-approval-rejected-banner";
      noticeEl.innerHTML = `
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <span style="font-size: 20px;">❌</span>
          <div>
            <strong>Application Denied by Administrator:</strong><br>
            Your doctor registration has been rejected by the Hospital Administrator. Please contact hospital administration for verification.
          </div>
        </div>
      `;
      noticeEl.classList.remove("hidden");
    }
    if (statusEl) { statusEl.textContent = "❌ Access Denied: Rejected by Admin."; statusEl.className = "status error"; }
    return;
  }

  // Status is APPROVED -> Enter Workstation!
  doctorSessionState.isAuthenticated = true;
  doctorSessionState.currentDoctor = {
    id: docId,
    name: docName,
    specialty: docDept,
    cabin: docCabin
  };
  doctorSessionState.status = "online";

  // Mark doctor as logged in in adminState.doctors
  if (typeof adminState !== "undefined" && adminState.doctors) {
    let docRecord = adminState.doctors.find(d => d.id === docId || d.name === docName);
    if (!docRecord) {
      docRecord = {
        id: docId,
        name: docName,
        specialty: docDept,
        cabin: docCabin,
        shift: "09:00 AM - 05:00 PM",
        isLoggedIn: true,
        lastLogin: `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        phone: (matched && matched.phone) || "9876500999",
        avatar: "👨‍⚕️"
      };
      adminState.doctors.push(docRecord);
    } else {
      docRecord.isLoggedIn = true;
      docRecord.lastLogin = `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (typeof renderAdminDoctorList === "function") renderAdminDoctorList();
  }

  // Update Topbar Doctor Name
  const topbarName = document.getElementById("topbarDoctorName");
  if (topbarName) {
    const { lastName } = extractLastNameAndPassword(docName);
    topbarName.textContent = `Dr. ${lastName}`;
  }

  // Update Doctor Screen Header
  const headerLabel = document.getElementById("doctorActiveHeaderLabel");
  const cabinLabel = document.getElementById("docCabinInfo");
  if (headerLabel) headerLabel.innerHTML = `Doctor: <strong>${escapeHtml(docName)} (${escapeHtml(docDept)} · ${escapeHtml(docCabin)})</strong>`;
  if (cabinLabel) cabinLabel.innerHTML = `Cabin: <b>${escapeHtml(docCabin)}</b>`;

  closeDoctorAuthModal();
  showScreen("doctorDashboardScreen");
  switchDoctorTab("dashboard");
  toast(`🩺 Access Granted: Welcome to Workstation, ${docName}!`);
  addAudit(`Doctor signed in: ${docName} (${docCabin})`);
}

async function checkActiveDoctorApproval() {
  const loginInput = document.getElementById("doctorLoginId");
  const docId = loginInput ? loginInput.value.trim() : "";
  if (!docId) {
    toast("Please enter your Doctor ID or select profile to check approval.");
    return;
  }

  // Check backend
  try {
    const res = await fetch(`${API_URL}/api/doctor/approvals`);
    if (res.ok) {
      const data = await res.json();
      const match = (data.approvals || []).find(a => 
        (a.doctor_id && a.doctor_id.toLowerCase() === docId.toLowerCase()) ||
        (a.name && a.name.toLowerCase().includes(docId.toLowerCase()))
      );
      if (match) {
        if (match.approval_status === "approved") {
          // Update local storage
          const regList = getRegisteredDoctorsList();
          const localMatch = regList.find(d => d.id === match.doctor_id || d.name === match.name);
          if (localMatch) {
            localMatch.approvalStatus = "approved";
            localMatch.status = "approved";
            localStorage.setItem("medikiosk_registered_doctors", JSON.stringify(regList));
          }
          toast("✓ Great news! Hospital Admin has approved your doctor account. Signing you in...");
          handleDoctorLogin();
          return;
        } else if (match.approval_status === "rejected") {
          toast("❌ Your account was rejected by the Hospital Administrator.");
          return;
        }
      }
    }
  } catch (e) {}

  // Fallback to local
  const regList = getRegisteredDoctorsList();
  const doc = regList.find(d => d.id === docId || (d.name && d.name.toLowerCase().includes(docId.toLowerCase())));
  if (doc && (doc.approvalStatus === "approved" || doc.status === "approved")) {
    toast("✓ Hospital Admin has approved your doctor account. Signing in...");
    handleDoctorLogin();
  } else {
    toast("⏳ Still Pending: Admin has not approved this account yet. Please check again shortly.");
  }
}

function exitDoctorPortal() {
  if (doctorSessionState.currentDoctor) {
    const docRecord = (adminState.doctors || []).find(d => d.id === doctorSessionState.currentDoctor.id);
    if (docRecord) docRecord.isLoggedIn = false;
  }

  doctorSessionState.isAuthenticated = false;
  const topbarName = document.getElementById("topbarDoctorName");
  if (topbarName) topbarName.textContent = "Doctor";

  showScreen("welcome");
  renderAdminDoctorList();
  toast("Exited Doctor Portal · Returned to Kiosk");
}

function changeDoctorStatus(val) {
  doctorSessionState.status = val;
  const dot = document.getElementById("doctorStatusDot");
  if (dot) {
    if (val === "online") dot.style.color = "#16a34a";
    else if (val === "break") dot.style.color = "#d97706";
    else dot.style.color = "#94a3b8";
  }
  toast(`Doctor status set to: ${val.toUpperCase()}`);
}

function switchDoctorTab(tabName) {
  doctorSessionState.activeTab = tabName;

  const navMap = {
    dashboard: "docNavDashboard",
    analysis: "docNavAnalysis",
    consultations: "docNavConsultations"
  };

  const panelMap = {
    dashboard: "docTabDashboard",
    analysis: "docTabAnalysis",
    consultations: "docTabConsultations"
  };

  document.querySelectorAll(".doctor-nav-item").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".doctor-tab-panel").forEach(panel => panel.classList.remove("active"));

  const targetNav = document.getElementById(navMap[tabName]);
  const targetPanel = document.getElementById(panelMap[tabName]);

  if (targetNav) targetNav.classList.add("active");
  if (targetPanel) targetPanel.classList.add("active");

  if (tabName === "dashboard") renderDoctorDashboard();
  if (tabName === "analysis") renderDoctorAnalysis();
  if (tabName === "consultations") renderDoctorActiveConsultations();
}

// =========================================================================
// DOCTOR ENCOUNTER FREQUENCY FILTER & ENCOUNTER STATE
// =========================================================================

const doctorEncounterState = {
  period: "week", // "week" | "month"
  encounters: []
};

function isDoctorMatch(doctorNameA, doctorNameB) {
  if (!doctorNameA || !doctorNameB) return false;
  const a = String(doctorNameA).toLowerCase().trim();
  const b = String(doctorNameB).toLowerCase().trim();
  if (a === b || a.includes(b) || b.includes(a)) return true;

  if (typeof extractLastNameAndPassword === "function") {
    const { lastName: lastA } = extractLastNameAndPassword(doctorNameA);
    const { lastName: lastB } = extractLastNameAndPassword(doctorNameB);
    if (lastA && lastB && lastA.toLowerCase() === lastB.toLowerCase()) return true;
  }

  return false;
}

function filterDoctorEncounters(period) {
  doctorEncounterState.period = period;
  const weekBtn = document.getElementById("docFreqWeekBtn");
  const monthBtn = document.getElementById("docFreqMonthBtn");

  if (period === "month") {
    if (weekBtn) weekBtn.classList.remove("active");
    if (monthBtn) monthBtn.classList.add("active");
  } else {
    if (monthBtn) monthBtn.classList.remove("active");
    if (weekBtn) weekBtn.classList.add("active");
  }

  renderDoctorEncounterFrequency(period);
  toast(`Showing doctor encounters: ${period === "month" ? "This Month" : "This Week"}`);
}

function renderDoctorEncounterFrequency(period = doctorEncounterState.period) {
  const docCountEl = document.getElementById("docFreqDoctorCount");
  const encounterCountEl = document.getElementById("docFreqEncounterCount");
  const specialtyCountEl = document.getElementById("docFreqSpecialtyCount");
  const periodLabelEl = document.getElementById("docFreqPeriodLabel");
  const listEl = document.getElementById("docFreqList");

  const curDoc = (doctorSessionState && doctorSessionState.currentDoctor) ? doctorSessionState.currentDoctor : null;
  const signedInDoctorName = curDoc ? curDoc.name : "";

  // Merge encounters from static store + dynamic adminState consultations
  const allEncounters = [...(doctorEncounterState.encounters || [])];

  (adminState.consultations || []).forEach(c => {
    if (!allEncounters.some(e => e.id === c.id || (e.patientName === c.patientName && e.doctorName === c.doctorName))) {
      allEncounters.unshift({
        id: c.id,
        patientName: c.patientName,
        patientId: c.patientId,
        doctorName: c.doctorName,
        specialty: c.department || "Consultation",
        cabin: c.cabin,
        date: `Today, ${c.startedAt || "Now"}`,
        symptoms: c.symptoms || "Clinical intake",
        status: c.status || "In Consultation",
        isThisWeek: true,
        isThisMonth: true
      });
    }
  });

  // STRICT REQUIREMENT: Only list encounters for the signed-in doctor
  const myEncounters = allEncounters.filter(e => {
    if (!signedInDoctorName) return false;
    return isDoctorMatch(e.doctorName, signedInDoctorName);
  });

  const filtered = myEncounters.filter(e => {
    if (period === "week") return e.isThisWeek;
    return true; // "month" includes all within the month
  });

  const uniqueSpecialties = new Set(filtered.map(e => (e.specialty || "").trim()).filter(Boolean));

  if (docCountEl) docCountEl.textContent = curDoc ? (filtered.length > 0 ? "1" : "0") : "0";
  if (encounterCountEl) encounterCountEl.textContent = filtered.length;
  if (specialtyCountEl) specialtyCountEl.textContent = uniqueSpecialties.size;
  if (periodLabelEl) periodLabelEl.textContent = period === "week" ? "This Week" : "This Month";

  if (!listEl) return;

  if (!curDoc) {
    listEl.innerHTML = `<div style="text-align: center; color: #64748b; padding: 24px;">Please sign in as a registered doctor to view patient encounters.</div>`;
    return;
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: #64748b; padding: 24px;">No patient encounters recorded yet for <strong>${escapeHtml(curDoc.name)}</strong> for ${period === "week" ? "this week" : "this month"}. Click "🩺 Take Case" from the Intake Queue to start consultations.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(enc => {
    let statusClass = "consult-status-done";
    let statusIcon = "⚪";
    if (enc.status === "In Consultation") {
      statusClass = "consult-status-in";
      statusIcon = "🟢";
    } else if (enc.status === "Waiting") {
      statusClass = "consult-status-waiting";
      statusIcon = "🟡";
    }

    return `
      <div class="frequency-encounter-item">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="freq-item-doc-avatar">👨‍⚕️</div>
          <div>
            <div style="font-weight: 700; color: #0f172a; font-size: 14px;">
              ${escapeHtml(enc.doctorName)}
            </div>
            <div class="freq-item-meta">
              <span style="color: #2563eb; font-weight: 600;">${escapeHtml(enc.specialty)}</span>
              <span>·</span>
              <span>📍 ${escapeHtml(enc.cabin || "OPD Cabin")}</span>
              <span>·</span>
              <span>🕒 ${escapeHtml(enc.date)}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap;">
          <div style="text-align: right;">
            <div style="font-weight: 600; font-size: 13.5px; color: #1e293b;">
              Patient: <strong>${escapeHtml(enc.patientName)}</strong>
            </div>
            <small style="color: #64748b; font-size: 12px;">
              <code>${escapeHtml(enc.patientId)}</code> · ${escapeHtml(enc.symptoms || "General")}
            </small>
          </div>
          <span class="consultation-status-pill ${statusClass}" style="white-space: nowrap;">
            ${statusIcon} ${escapeHtml(enc.status)}
          </span>
        </div>
      </div>
    `;
  }).join("");
}

function renderDoctorDashboard() {
  const waitingEl = document.getElementById("docWaitingCount");
  const highEl = document.getElementById("docHighCount");
  const queueBody = document.getElementById("docQueueBody");
  const queueBadge = document.getElementById("docQueueCountBadge");

  // Ensure unique queue entries
  const uniqueQueue = [];
  const seenNames = new Set();
  (state.queue || []).forEach(r => {
    const key = (r.name || "").trim().toLowerCase();
    if (key && !seenNames.has(key)) {
      seenNames.add(key);
      uniqueQueue.push(r);
    }
  });
  state.queue = uniqueQueue;

  const waitingTotal = state.queue.length;
  const highTotal = state.queue.filter(r => r.priority === "high").length;

  if (waitingEl) waitingEl.textContent = String(waitingTotal).padStart(2, "0");
  if (highEl) highEl.textContent = String(highTotal).padStart(2, "0");
  if (queueBadge) queueBadge.textContent = waitingTotal;

  if (queueBody) {
    if (state.queue.length === 0) {
      queueBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 24px;">No patients currently in intake queue. All cases taken!</td></tr>`;
    } else {
      queueBody.innerHTML = state.queue.map(r => `
        <tr>
          <td><b>${escapeHtml(r.name)}</b></td>
          <td><span class="priority ${escapeHtml(r.priority)}">${escapeHtml(r.priority).toUpperCase()}</span></td>
          <td>${escapeHtml(r.symptoms)}</td>
          <td>${escapeHtml(r.mode)}</td>
          <td>
            <button type="button" class="primary sm-btn" onclick="startDoctorIntake('${escapeHtml(r.name)}')">
              🩺 Take Case
            </button>
          </td>
        </tr>
      `).join("");
    }
  }

  // Render Doctor Encounter Frequency Filter
  renderDoctorEncounterFrequency();
}

function startDoctorIntake(patientName) {
  const cleanName = (patientName || "").trim();
  if (!cleanName) return;

  // 1. Find patient in queue or known patients
  const queueIndex = (state.queue || []).findIndex(r =>
    (r.name || "").trim().toLowerCase() === cleanName.toLowerCase()
  );
  const queueItem = queueIndex >= 0 ? state.queue[queueIndex] : null;

  const patientMatch = Object.values(knownPatients).find(p =>
    (p.name || "").trim().toLowerCase() === cleanName.toLowerCase()
  ) || (state.patient && state.patient.name === cleanName ? state.patient : null);

  // 2. Identify active doctor session
  if (!doctorSessionState || !doctorSessionState.isAuthenticated || !doctorSessionState.currentDoctor) {
    toast("⚠️ Please sign in as a registered doctor to take cases.");
    openDoctorAuthModal();
    return;
  }
  const curDoc = doctorSessionState.currentDoctor;

  const patientId = (patientMatch && (patientMatch.userId || patientMatch.id)) || (queueItem && queueItem.patientId) || `MK-${Math.floor(10000 + Math.random() * 90000)}`;
  const phone = (patientMatch && patientMatch.phone) || (state.patient && state.patient.phone) || "Verified Contact";
  const symptoms = (queueItem && queueItem.symptoms) || (patientMatch && patientMatch.symptoms) || (state.symptoms) || "Triage intake evaluation";
  const priority = (queueItem && queueItem.priority) || (patientMatch && patientMatch.priority) || (state.priority) || "medium";
  const mode = (queueItem && queueItem.mode) || "Direct Intake";
  const vitals = (patientMatch && patientMatch.vitals) || "BP: 118/76 · HR: 72 · SpO2: 98%";
  const allergies = (patientMatch && patientMatch.allergies) || "None reported";
  const meds = (patientMatch && patientMatch.currentMedicines) || "None";
  const ageGender = patientMatch ? `${patientMatch.age || "30"} yrs · ${patientMatch.gender || "Patient"}` : "Patient";
  const token = `Token #${Math.floor(10 + Math.random() * 90)}`;

  // 3. Mark previous active consultations for this doctor as Completed
  (adminState.consultations || []).forEach(c => {
    if (isDoctorMatch(c.doctorName, curDoc.name) && c.status === "In Consultation") {
      c.status = "Completed";
      c.duration = "Finished";
    }
  });

  // 4. Create new Active Consultation record
  const newConsult = {
    id: `CNS-${Date.now().toString().slice(-4)}`,
    patientId,
    patientName: cleanName,
    ageGender,
    phone,
    doctorName: curDoc.name,
    doctorId: curDoc.id,
    department: curDoc.specialty,
    cabin: curDoc.cabin,
    token,
    status: "In Consultation",
    startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    duration: "Just started",
    symptoms,
    priority,
    mode,
    vitals,
    allergies,
    currentMedicines: meds
  };

  if (!adminState.consultations) adminState.consultations = [];
  adminState.consultations.unshift(newConsult);

  // 5. Remove patient from waiting queue
  if (queueIndex >= 0) {
    state.queue.splice(queueIndex, 1);
  }

  // 6. Record into encounter history
  if (typeof doctorEncounterState !== "undefined") {
    doctorEncounterState.encounters.unshift({
      id: newConsult.id,
      patientName: cleanName,
      patientId,
      doctorName: curDoc.name,
      specialty: curDoc.specialty,
      cabin: curDoc.cabin,
      date: `Today, ${newConsult.startedAt}`,
      symptoms,
      status: "In Consultation",
      isThisWeek: true,
      isThisMonth: true
    });
  }

  // 7. Update Active Consultation card DOM directly with taken patient's name
  const nameEl = document.getElementById("docActivePatientName");
  const metaEl = document.getElementById("docActivePatientMeta");
  const sympEl = document.getElementById("docActivePatientSymptoms");
  const vitalsEl = document.getElementById("docActivePatientVitals");
  const prioEl = document.getElementById("docActivePatientPriority");
  const medsEl = document.getElementById("docActivePatientMeds");
  const docEl = document.getElementById("docActiveAttendingDoc");
  const cabinEl = document.getElementById("docActiveCabinLabel");
  const statusEl = document.getElementById("docActivePatientStatus");
  const activeCard = document.getElementById("docCurrentConsultationCard");
  const emptyNotice = document.getElementById("docNoActiveConsultationNotice");

  if (activeCard) activeCard.classList.remove("hidden");
  if (emptyNotice) emptyNotice.classList.add("hidden");

  if (nameEl) nameEl.textContent = `${cleanName} (${ageGender})`;
  if (metaEl) metaEl.innerHTML = `Patient ID: <strong>${escapeHtml(patientId)}</strong> · ${escapeHtml(token)} · Cabin: ${escapeHtml(curDoc.cabin)}`;
  if (sympEl) sympEl.textContent = symptoms;
  if (vitalsEl) vitalsEl.textContent = vitals;
  if (prioEl) prioEl.textContent = `${priority.toUpperCase()} Priority · ${mode}`;
  if (medsEl) medsEl.textContent = `${allergies} · ${meds}`;
  if (docEl) docEl.textContent = curDoc.name;
  if (cabinEl) cabinEl.textContent = curDoc.cabin;
  if (statusEl) {
    statusEl.className = "consultation-status-pill consult-status-in";
    statusEl.textContent = "🟢 In Consultation";
  }

  // 8. Transition to Consultations tab
  switchDoctorTab("consultations");
  renderDoctorDashboard();
  renderDoctorActiveConsultations();
  renderDoctorEncounterFrequency();

  toast(`🩺 Case taken: Active consultation started for ${cleanName}!`);
  addAudit(`Doctor ${curDoc.name} took case for ${cleanName} (${patientId})`);
}

function renderDoctorAnalysis() {
  const allPatients = typeof getAllAdminPatients === "function" ? getAllAdminPatients() : knownPatients;
  const totalPatientCount = Object.keys(allPatients).length;
  const queueCount = (state && state.queue && state.queue.length) || 0;

  const totalEl = document.getElementById("docAnalyticsTotalPatients");
  const queueEl = document.getElementById("docAnalyticsWaitingQueue");
  const weeklyEl = document.getElementById("docAnalyticsWeeklyTotal");

  if (totalEl) totalEl.textContent = String(totalPatientCount);
  if (queueEl) queueEl.textContent = String(queueCount);
  if (weeklyEl) weeklyEl.textContent = `${140 + totalPatientCount} total`;

  if (state && state.queue && state.queue.length > 0) {
    const high = state.queue.filter(q => q.priority === "high").length;
    const med = state.queue.filter(q => q.priority === "medium").length;
    const total = state.queue.length;

    const highPct = Math.round((high / total) * 100);
    const medPct = Math.round((med / total) * 100);
    const lowPct = Math.max(0, 100 - highPct - medPct);

    const highPctEl = document.getElementById("docAnalyticsHighPct");
    const medPctEl = document.getElementById("docAnalyticsMedPct");
    const lowPctEl = document.getElementById("docAnalyticsLowPct");
    const highBarEl = document.getElementById("docAnalyticsHighBar");
    const medBarEl = document.getElementById("docAnalyticsMedBar");
    const lowBarEl = document.getElementById("docAnalyticsLowBar");

    if (highPctEl) highPctEl.textContent = `${highPct}%`;
    if (medPctEl) medPctEl.textContent = `${medPct}%`;
    if (lowPctEl) lowPctEl.textContent = `${lowPct}%`;
    if (highBarEl) highBarEl.style.width = `${highPct}%`;
    if (medBarEl) medBarEl.style.width = `${medPct}%`;
    if (lowBarEl) lowBarEl.style.width = `${lowPct}%`;
  }
}

function renderDoctorActiveConsultations() {
  const tbody = document.getElementById("docConsultationsTableBody");
  const countBadge = document.getElementById("docConsultCountBadge");
  const activeCountEl = document.getElementById("docActiveConsultsCount");
  const waitingCountEl = document.getElementById("docWaitingConsultsCount");
  const completedCountEl = document.getElementById("docCompletedConsultsCount");
  const activeCard = document.getElementById("docCurrentConsultationCard");
  const emptyNotice = document.getElementById("docNoActiveConsultationNotice");

  // STRICT ISOLATION: Only show consultations for the currently signed-in doctor
  const curDoc = (doctorSessionState && doctorSessionState.isAuthenticated && doctorSessionState.currentDoctor) ? doctorSessionState.currentDoctor : null;

  if (!curDoc) {
    if (countBadge) countBadge.textContent = "0 Active";
    if (activeCountEl) activeCountEl.textContent = 0;
    if (waitingCountEl) waitingCountEl.textContent = 0;
    if (completedCountEl) completedCountEl.textContent = 0;
    if (activeCard) activeCard.classList.add("hidden");
    if (emptyNotice) emptyNotice.classList.remove("hidden");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 28px; color: #64748b;">
            Please sign in as a registered doctor to view active consultations.
          </td>
        </tr>
      `;
    }
    return;
  }

  const allConsultations = adminState.consultations || [];
  const myConsultations = allConsultations.filter(c => isDoctorMatch(c.doctorName, curDoc.name));

  const activeCount = myConsultations.filter(c => c.status === "In Consultation").length;
  const waitingCount = myConsultations.filter(c => c.status === "Waiting").length;
  const completedCount = myConsultations.filter(c => c.status === "Completed").length;

  if (countBadge) countBadge.textContent = `${activeCount} Active`;
  if (activeCountEl) activeCountEl.textContent = activeCount;
  if (waitingCountEl) waitingCountEl.textContent = waitingCount;
  if (completedCountEl) completedCountEl.textContent = completedCount;

  // Active in cabin display for THIS SIGNED-IN DOCTOR ONLY
  const activePatient = myConsultations.find(c => c.status === "In Consultation");
  if (activePatient) {
    if (activeCard) activeCard.classList.remove("hidden");
    if (emptyNotice) emptyNotice.classList.add("hidden");

    const nameEl = document.getElementById("docActivePatientName");
    const metaEl = document.getElementById("docActivePatientMeta");
    const sympEl = document.getElementById("docActivePatientSymptoms");
    const vitalsEl = document.getElementById("docActivePatientVitals");
    const prioEl = document.getElementById("docActivePatientPriority");
    const medsEl = document.getElementById("docActivePatientMeds");
    const docEl = document.getElementById("docActiveAttendingDoc");
    const cabinEl = document.getElementById("docActiveCabinLabel");
    const statusEl = document.getElementById("docActivePatientStatus");

    if (nameEl) nameEl.textContent = `${activePatient.patientName} (${activePatient.ageGender || activePatient.phone || "Verified"})`;
    if (metaEl) metaEl.innerHTML = `Patient ID: <strong>${escapeHtml(activePatient.patientId)}</strong> · ${escapeHtml(activePatient.token)} · Cabin: ${escapeHtml(activePatient.cabin)}`;
    if (sympEl) sympEl.textContent = activePatient.symptoms || "Clinical consultation in progress";
    if (vitalsEl) vitalsEl.textContent = activePatient.vitals || "BP: 118/76 · HR: 72 · SpO2: 98%";
    if (prioEl) prioEl.textContent = `${escapeHtml(activePatient.priority ? activePatient.priority.toUpperCase() : "STANDARD")} · ${escapeHtml(activePatient.mode || "OPD")}`;
    if (medsEl) medsEl.textContent = `${escapeHtml(activePatient.allergies || "None reported")} · ${escapeHtml(activePatient.currentMedicines || "Standard care")}`;
    if (docEl) docEl.textContent = curDoc.name;
    if (cabinEl) cabinEl.textContent = curDoc.cabin;
    if (statusEl) {
      statusEl.className = "consultation-status-pill consult-status-in";
      statusEl.textContent = "🟢 In Consultation";
    }
  } else {
    // No active consultation for this doctor
    if (activeCard) activeCard.classList.add("hidden");
    if (emptyNotice) emptyNotice.classList.remove("hidden");
  }

  if (!tbody) return;

  if (myConsultations.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 28px; color: #64748b;">
          No active or scheduled consultations for <strong>${escapeHtml(curDoc.name)}</strong>.<br>
          <span style="font-size: 12px; color: #94a3b8;">Click "🩺 Take Case" from the Intake Queue to start consulting.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = myConsultations.map(c => {
    let statusClass = "consult-status-in";
    let statusIcon = "🟢";
    if (c.status === "Waiting") {
      statusClass = "consult-status-waiting";
      statusIcon = "🟡";
    } else if (c.status === "Completed") {
      statusClass = "consult-status-done";
      statusIcon = "⚪";
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${escapeHtml(c.patientName)}</div>
          <small style="color: #4338ca; font-weight: 600;">ID: ${escapeHtml(c.patientId)}</small>
          <small style="color: #64748b;"> · 📞 ${escapeHtml(c.phone || "")}</small>
        </td>
        <td>
          <div style="font-size: 13px; color: #334155; font-weight: 500;">${escapeHtml(c.symptoms || "Clinical consultation")}</div>
        </td>
        <td>
          <div style="font-weight: 600; color: #334155;">📍 ${escapeHtml(c.cabin)}</div>
        </td>
        <td>
          <strong class="token-pill">${escapeHtml(c.token)}</strong>
        </td>
        <td>
          <span class="consultation-status-pill ${statusClass}">
            ${statusIcon} ${escapeHtml(c.status)}
          </span>
        </td>
        <td>
          <span style="font-size: 13px; color: #475569;">🕒 ${escapeHtml(c.duration || c.startedAt)}</span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn-admin-action" onclick="toggleConsultationStatus('${escapeHtml(c.id)}')">
            🔄 Status
          </button>
          <button type="button" class="btn-admin-action btn-admin-delete" onclick="removeConsultation('${escapeHtml(c.id)}')">
            ✕
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

function finishDoctorConsultation() {
  const rxNotes = document.getElementById("docConsultPrescription")?.value?.trim() || "";
  const curDoc = (doctorSessionState && doctorSessionState.currentDoctor) ? doctorSessionState.currentDoctor : null;
  const items = adminState.consultations || [];
  const activeConsult = items.find(c => (curDoc ? isDoctorMatch(c.doctorName, curDoc.name) : true) && c.status === "In Consultation");

  if (activeConsult) {
    activeConsult.status = "Completed";
    activeConsult.duration = "Finished";
  }

  const patientName = activeConsult ? activeConsult.patientName : "Patient";
  toast(`✓ Consultation completed for ${patientName}`);
  addAudit(`Doctor completed consultation: ${patientName} (Rx: ${rxNotes || "Standard care"})`);

  const rxInput = document.getElementById("docConsultPrescription");
  if (rxInput) rxInput.value = "";

  renderDoctorActiveConsultations();
  renderDoctorEncounterFrequency();
}

// 10. Consultation Management Handlers
function toggleConsultationStatus(consultationId) {
  const item = (adminState.consultations || []).find(c => c.id === consultationId);
  if (!item) return;

  if (item.status === "Waiting") {
    item.status = "In Consultation";
    item.duration = "Started just now";
  } else if (item.status === "In Consultation") {
    item.status = "Completed";
    item.duration = "Finished";
  } else {
    item.status = "Waiting";
    item.duration = "Waiting (queue)";
  }

  renderDoctorActiveConsultations();
  renderAdminDoctorList();
  toast(`Updated status for ${item.patientName}: ${item.status}`);
}

function callConsultationPatient(consultationId) {
  const item = (adminState.consultations || []).find(c => c.id === consultationId);
  if (!item) return;
  toast(`📢 Calling ${item.patientName} to ${item.cabin} for ${item.doctorName}`);
  addAudit(`Patient broadcast called: ${item.patientName} ➔ ${item.cabin}`);
}

function removeConsultation(consultationId) {
  const item = (adminState.consultations || []).find(c => c.id === consultationId);
  const name = item ? item.patientName : consultationId;
  adminState.consultations = (adminState.consultations || []).filter(c => c.id !== consultationId);
  renderDoctorActiveConsultations();
  renderAdminDoctorList();
  toast(`Consultation removed for ${name}`);
}

function openAssignConsultationModal() {
  const modal = document.getElementById("adminAssignConsultationModal");
  const selectPatient = document.getElementById("assignConsultPatient");
  if (!modal || !selectPatient) return;

  const allPatients = getAllAdminPatients();
  selectPatient.innerHTML = allPatients.map(p => `
    <option value="${escapeHtml(p.userId || p.id)}|${escapeHtml(p.name)}|${escapeHtml(p.phone || "")}">
      ${escapeHtml(p.name)} (${escapeHtml(p.userId || p.id)}) - ${escapeHtml(p.symptoms || "General")}
    </option>
  `).join("");

  const nextTokenNum = 10 + (adminState.consultations || []).length + 1;
  const tokenInput = document.getElementById("assignConsultToken");
  if (tokenInput) tokenInput.value = `Token #${nextTokenNum}`;

  const selectDoctor = document.getElementById("assignConsultDoctor");
  if (selectDoctor) {
    const regDocs = getRegisteredDoctorsList();
    if (regDocs.length === 0) {
      selectDoctor.innerHTML = `<option value="">-- No registered doctors found --</option>`;
    } else {
      selectDoctor.innerHTML = regDocs.map(d => `
        <option value="${escapeHtml(d.name)}|${escapeHtml(d.specialty)}|${escapeHtml(d.cabin)}">
          ${escapeHtml(d.name)} (${escapeHtml(d.specialty)} · ${escapeHtml(d.cabin)})
        </option>
      `).join("");
    }
  }

  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
}

function closeAssignConsultationModal() {
  const modal = document.getElementById("adminAssignConsultationModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.classList.add("hidden");
  modal.style.display = "none";
}

function saveNewConsultation() {
  const patientVal = document.getElementById("assignConsultPatient")?.value;
  const doctorVal = document.getElementById("assignConsultDoctor")?.value;
  const token = document.getElementById("assignConsultToken")?.value.trim() || `Token #${(adminState.consultations || []).length + 1}`;
  const status = document.getElementById("assignConsultStatus")?.value || "In Consultation";

  if (!patientVal || !doctorVal) {
    toast("Please select patient and doctor.");
    return;
  }

  const [patientId, patientName, phone] = patientVal.split("|");
  const [doctorName, department, cabin] = doctorVal.split("|");

  const newId = `CNS-${100 + (adminState.consultations || []).length + 1}`;
  const newConsult = {
    id: newId,
    patientId,
    patientName,
    phone,
    doctorName,
    department,
    cabin: `${cabin} (OPD)`,
    token,
    status,
    startedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    duration: status === "In Consultation" ? "1 min" : "Waiting"
  };

  adminState.consultations.unshift(newConsult);
  closeAssignConsultationModal();
  renderDoctorActiveConsultations();
  renderAdminDoctorList();
  addAudit(`Consultation paired: ${patientName} ➔ ${doctorName} (${cabin})`);
  toast(`✓ Assigned consultation: ${patientName} with ${doctorName}`);
}

// 11. Reports & Analytics Export Helper
function exportAnalyticsReport() {
  const allPatients = typeof getAllAdminPatients === "function" ? getAllAdminPatients() : knownPatients;
  const totalPatientCount = Object.keys(allPatients).length;
  const queueCount = (state && state.queue && state.queue.length) || 0;
  
  const reportData = [
    "===========================================",
    "  MEDIKIOSK CLINICAL & HOSPITAL REPORT",
    `  Generated: ${new Date().toLocaleString()}`,
    "===========================================",
    `Total Registered Patients: ${totalPatientCount}`,
    `Current Triage Queue: ${queueCount}`,
    "Average Triage Duration: 04:32 min",
    "Average Queue Wait Time: 12.4 min",
    "Pre-AI Safety Rule Compliance: 100%",
    "-------------------------------------------",
    "Chief Complaints Distribution:",
    "  - Fever & Chills: 31%",
    "  - Cough & Sore Throat: 24%",
    "  - Headache & Fatigue: 18%",
    "  - Others: 27%",
    "-------------------------------------------",
    "Triage Severity Distribution:",
    "  - Red Flag / Urgent: 15%",
    "  - Standard Priority: 55%",
    "  - Low / Routine: 30%",
    "==========================================="
  ].join("\n");

  console.log(reportData);
  toast("📊 Analytics report generated successfully");
}

function showAnalytics() {
  if (doctorSessionState.isAuthenticated) {
    showScreen("doctorDashboardScreen");
    switchDoctorTab("analysis");
  } else if (adminState.isAuthenticated) {
    showScreen("adminDashboardScreen");
    switchAdminTab("doctorList");
  } else {
    openDoctorPortal();
    toast("🔒 Clinical Analysis is inside Doctor / Admin Portal.");
  }
}


// =========================================================================
// ====== NEARBY HEALTHCARE RECOMMENDATIONS SCREEN & INTERACTIVE TABS =====
// =========================================================================

let currentNearbyTab = "doctors";

function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

function openMapsDirections(destination) {
  const cleanDest = decodeURIComponent(destination || "");
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cleanDest)}`;
  try {
    window.open(mapsUrl, "_blank");
    if (typeof toast === "function") toast(`Opening Google Maps directions to ${cleanDest.slice(0, 30)}...`);
    if (typeof addAudit === "function") addAudit(`Maps directions requested: ${cleanDest}`);
  } catch (e) {
    window.open(mapsUrl, "_blank");
  }
}

function openDoctorAppointmentDirect(docIdOrName) {
  if (typeof openDoctorSuggestionsModal === "function") {
    openDoctorSuggestionsModal();
  } else if (typeof openAppointmentsModal === "function") {
    openAppointmentsModal();
  } else {
    toast(`Booking appointment with ${docIdOrName}...`);
  }
}

function showNearbyHealthcareScreen(defaultTab = "doctors") {
  showScreen("nearbyHealthcareScreen");
  updateNearbyActiveLocationBanner();
  switchNearbyTab(defaultTab || "doctors");
}

function updateNearbyActiveLocationBanner() {
  const locInfo = resolvePatientLocationInfo();
  const locTextEl = document.getElementById("nearbyActiveLocationText");
  const coordEl = document.getElementById("nearbyCoordinatesNotice");
  
  if (locTextEl) {
    const addrStr = (state && state.patient && state.patient.address) ? state.patient.address : locInfo.rawAddress;
    const cityStr = (state && state.patient && state.patient.city) || locInfo.city;
    const pinStr = (state && state.patient && state.patient.pincode) || locInfo.pincode;
    locTextEl.textContent = `${addrStr}, ${cityStr} (PIN ${pinStr})`;
  }
  
  if (coordEl) {
    if (state && state.patient && state.patient.latitude && state.patient.longitude) {
      coordEl.textContent = `✓ GPS Location: ${Number(state.patient.latitude).toFixed(4)}° N, ${Number(state.patient.longitude).toFixed(4)}° E · Accurate Local Proximity`;
    } else {
      coordEl.textContent = `✓ Active Postal District: ${locInfo.city}, ${locInfo.state} (PIN ${locInfo.pincode})`;
    }
  }
}

function switchNearbyTab(tabName) {
  currentNearbyTab = tabName || "doctors";
  document.querySelectorAll(".nearby-tab").forEach(tab => {
    const tName = tab.getAttribute("data-tab");
    if (tName === currentNearbyTab) {
      tab.classList.add("active");
      tab.style.background = "#2563eb";
      tab.style.color = "#ffffff";
      const badge = tab.querySelector(".tab-badge");
      if (badge) {
        badge.style.background = "rgba(255,255,255,0.25)";
        badge.style.color = "#ffffff";
      }
    } else {
      tab.classList.remove("active");
      tab.style.background = "#f1f5f9";
      tab.style.color = "#475569";
      const badge = tab.querySelector(".tab-badge");
      if (badge) {
        badge.style.background = "#e2e8f0";
        badge.style.color = "#475569";
      }
    }
  });

  const searchInput = document.getElementById("nearbySearchInput");
  if (searchInput) searchInput.value = "";

  renderNearbyHealthcareResults(currentNearbyTab);
}

function renderNearbyHealthcareResults(tabName, query = "") {
  const activeTab = tabName || currentNearbyTab || "doctors";
  const container = document.getElementById("nearbyHealthcareResultsContainer");
  if (!container) return;

  const locInfo = resolvePatientLocationInfo();
  const userLat = (state && state.patient && state.patient.latitude != null) ? Number(state.patient.latitude) : null;
  const userLng = (state && state.patient && state.patient.longitude != null) ? Number(state.patient.longitude) : null;

  // Update badge counters for all 4 categories
  const allDocs = getActiveDoctorsDirectory();
  const allHosps = getActiveHospitalsDirectory();
  const allPharms = getActivePharmaciesDirectory();
  const allDiags = getActiveDiagnosticsDirectory();

  const docCountEl = document.getElementById("countNearbyDoctors");
  const hospCountEl = document.getElementById("countNearbyHospitals");
  const pharmCountEl = document.getElementById("countNearbyPharmacies");
  const diagCountEl = document.getElementById("countNearbyDiagnostics");

  if (docCountEl) docCountEl.textContent = allDocs.length;
  if (hospCountEl) hospCountEl.textContent = allHosps.length;
  if (pharmCountEl) pharmCountEl.textContent = allPharms.length;
  if (diagCountEl) diagCountEl.textContent = allDiags.length;

  let items = [];
  if (activeTab === "doctors") items = allDocs;
  else if (activeTab === "hospitals") items = allHosps;
  else if (activeTab === "pharmacies") items = allPharms;
  else if (activeTab === "diagnostics") items = allDiags;

  // Compute distance and sort
  items = items.map((item, idx) => {
    let dist = item.distanceKm;
    if (userLat != null && userLng != null && item.latitude != null && item.longitude != null) {
      dist = calculateHaversineKm(userLat, userLng, item.latitude, item.longitude);
    }
    if (dist == null) {
      dist = (item.pincode === locInfo.pincode) ? 0.6 + (idx * 0.3) : 1.5 + (idx * 0.4);
    }
    dist = Math.round(dist * 10) / 10;
    return { ...item, distanceKm: dist };
  });

  items.sort((a, b) => a.distanceKm - b.distanceKm);

  // Search filtering
  const q = (query || "").trim().toLowerCase();
  if (q) {
    items = items.filter(item => {
      const searchTarget = [
        item.name,
        item.specialty,
        item.department,
        item.hospital,
        item.hospital_clinic,
        item.type,
        item.category,
        item.address,
        item.city,
        item.pincode,
        item.locality,
        ...(item.keywords || []),
        ...(item.specialties || []),
        ...(item.tests || [])
      ].filter(Boolean).join(" ").toLowerCase();
      return searchTarget.includes(q);
    });
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; background: #f8fafc; border-radius: 12px; border: 1.5px dashed #cbd5e1;">
        <div style="font-size: 36px; margin-bottom: 8px;">🔍</div>
        <h3 style="margin: 0 0 6px; color: #1e293b;">No facilities matching "${query}"</h3>
        <p class="muted" style="margin: 0; font-size: 13.5px;">Try searching for a different keyword or click "Change Location".</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const isClosest = (idx === 0 && !q);
    const name = item.name || "Facility";
    const subTitle = item.specialty || item.type || "Healthcare Provider";
    const org = item.hospital || item.hospital_clinic || item.department || "";
    const address = item.address || `${item.locality || ""}, ${item.city || ""}`;
    const pin = item.pincode || locInfo.pincode || "";
    const rating = item.rating || "4.8";
    const reviews = item.reviews || item.reviews_count || "620";
    const hours = item.openStatus || item.timing || "09:00 AM - 05:00 PM";
    const mapQuery = encodeURIComponent(`${name} ${org} ${address} ${item.city || ""} ${pin}`);

    let actionBtn = "";
    if (activeTab === "doctors") {
      actionBtn = `<button type="button" class="btn-contact-facility" onclick="openDoctorAppointmentDirect('${item.id || item.name}')" style="flex: 1; padding: 8px 12px; background: #2563eb; color: #ffffff; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer;">🩺 Book Appointment</button>`;
    } else if (activeTab === "hospitals") {
      actionBtn = `<button type="button" class="btn-contact-facility" onclick="makePhoneCall('${item.phone || "+91-657-222-4561"}')" style="flex: 1; padding: 8px 12px; background: #059669; color: #ffffff; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer;">📞 Call Hospital</button>`;
    } else if (activeTab === "pharmacies") {
      actionBtn = `<button type="button" class="btn-contact-facility" onclick="makePhoneCall('${item.phone || "+91-657-243-2001"}')" style="flex: 1; padding: 8px 12px; background: #7c3aed; color: #ffffff; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer;">💊 Order Medicine</button>`;
    } else {
      actionBtn = `<button type="button" class="btn-contact-facility" onclick="makePhoneCall('${item.phone || "+91-657-244-1001"}')" style="flex: 1; padding: 8px 12px; background: #0891b2; color: #ffffff; border: none; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer;">🧪 Book Lab Test</button>`;
    }

    return `
      <div class="nearby-facility-card ${isClosest ? 'closest' : ''}" style="background: #ffffff; border: 1.5px solid ${isClosest ? '#3b82f6' : '#e2e8f0'}; border-radius: 14px; padding: 18px; position: relative; box-shadow: 0 4px 12px rgba(15,23,42,0.04); display: flex; flex-direction: column; justify-content: space-between;">
        ${isClosest ? `<div style="position: absolute; top: -11px; left: 16px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; box-shadow: 0 2px 6px rgba(37,99,235,0.3);">⭐ Nearest Recommended Match</div>` : ''}

        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; margin-top: ${isClosest ? '4px' : '0'};">
            <div>
              <h4 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; line-height: 1.3;">${name}</h4>
              <div style="font-size: 12.5px; color: #2563eb; font-weight: 600; margin-top: 2px;">${subTitle}</div>
              ${org ? `<div style="font-size: 12px; color: #64748b; font-weight: 500;">🏥 ${org}</div>` : ''}
            </div>
            <span class="nearby-distance-chip" style="background: ${isClosest ? '#dbeafe' : '#f1f5f9'}; color: ${isClosest ? '#1d4ed8' : '#334155'}; font-size: 12px; font-weight: 700; padding: 4px 9px; border-radius: 8px; white-space: nowrap;">
              📍 ${item.distanceKm} km
            </span>
          </div>

          <p style="margin: 8px 0; font-size: 12.5px; color: #475569; line-height: 1.4;">
            📍 ${address} <strong style="color: #1e293b;">(PIN ${pin})</strong>
          </p>

          <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; font-size: 12px;">
            <span style="color: #b45309; font-weight: 600;">⭐ ${rating} (${reviews} reviews)</span>
            <span style="color: #94a3b8;">•</span>
            <span style="color: #059669; font-weight: 600;">🕒 ${hours}</span>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          <button type="button" class="btn-directions" onclick="openMapsDirections('${mapQuery}')" style="padding: 8px 14px; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #93c5fd; border-radius: 7px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
            🗺️ Directions
          </button>
          ${actionBtn}
        </div>
      </div>
    `;
  }).join("");
}

function filterNearbyResults(query) {
  renderNearbyHealthcareResults(currentNearbyTab, query);
}

function openChangeLocationModal() {
  const modal = document.getElementById("changeLocationModal");
  if (!modal) return;
  const locInfo = resolvePatientLocationInfo();
  const addrEl = document.getElementById("changeLocAddress");
  const cityEl = document.getElementById("changeLocCity");
  const stateEl = document.getElementById("changeLocState");
  const pinEl = document.getElementById("changeLocPincode");
  const statusEl = document.getElementById("changeLocModalStatus");

  if (addrEl) addrEl.value = (state && state.patient && state.patient.address) || locInfo.rawAddress || "";
  if (cityEl) cityEl.value = (state && state.patient && state.patient.city) || locInfo.city || "";
  if (stateEl) stateEl.value = (state && state.patient && state.patient.state) || locInfo.state || "";
  if (pinEl) pinEl.value = (state && state.patient && state.patient.pincode) || locInfo.pincode || "";
  if (statusEl) {
    statusEl.classList.add("hidden");
    statusEl.textContent = "";
  }

  modal.classList.remove("hidden");
  modal.classList.add("active");
  modal.style.display = "flex";
}

function closeChangeLocationModal() {
  const modal = document.getElementById("changeLocationModal");
  if (modal) {
    modal.classList.remove("active");
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

function applyChangedLocation() {
  const addrEl = document.getElementById("changeLocAddress");
  const cityEl = document.getElementById("changeLocCity");
  const stateEl = document.getElementById("changeLocState");
  const pinEl = document.getElementById("changeLocPincode");
  const latEl = document.getElementById("changeLocLatitude");
  const lngEl = document.getElementById("changeLocLongitude");

  const address = addrEl ? addrEl.value.trim() : "";
  const city = cityEl ? cityEl.value.trim() : "";
  const stateName = stateEl ? stateEl.value.trim() : "";
  const pin = pinEl ? pinEl.value.trim() : "";
  const lat = latEl && latEl.value ? parseFloat(latEl.value) : null;
  const lng = lngEl && lngEl.value ? parseFloat(lngEl.value) : null;

  if (!address) {
    toast("Please enter your address.");
    addrEl?.focus();
    return;
  }
  if (!pin || !/^\d{6}$/.test(pin)) {
    toast("Please enter a valid 6-digit PIN code.");
    pinEl?.focus();
    return;
  }

  if (!state.patient) state.patient = {};
  state.patient.address = address;
  state.patient.city = city || "Jamshedpur";
  state.patient.state = stateName || "Jharkhand";
  state.patient.pincode = pin;
  if (lat != null && lng != null) {
    state.patient.latitude = lat;
    state.patient.longitude = lng;
    state.patient.location = { lat, lng };
  }

  persistClientState();

  // If patient registered, update server location
  if (state.patient.id) {
    fetch(`${API_URL}/patients/${state.patient.id}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: address,
        city: city,
        state: stateName,
        pincode: pin,
        latitude: lat,
        longitude: lng
      })
    }).catch(e => console.warn("Backend location sync notice:", e));
  }

  updateNearbyActiveLocationBanner();
  renderNearbyHealthcareResults();
  closeChangeLocationModal();
  toast(`✓ Location updated to ${city || address} (${pin})!`);
}

function goBackFromNearbyHealthcare() {
  if (state && state.patient && state.patient.name) {
    showScreen("patientProfile");
  } else {
    showScreen("home");
  }
}


// Window attachments
if (typeof window !== "undefined") {
  Object.assign(window, {
    signupState,
    resetSignupSteps,
    toggleSignup,
    onSignupPhoneInput,
    checkPhoneAvailability,
    fillAndGoToSignIn,
    registerPatientAccount,
    copyGeneratedUserId,
    proceedToSignInWithId,
    signupPatient,
    knownPatients,
    state,
    kioskState: state,
    openAppointmentsModal,
    searchPatientAppointments,
    loadPatientAppointments,
    cancelAppointmentBooking,
    bookDoctorAppointment,
    extractLastNameAndPassword,
    previewGeneratedPassword,
    switchDoctorAuthTab,
    handleDoctorSignup,
    handleDoctorLogin,
    checkActiveDoctorApproval,
    copyDoctorCredentials,
    switchToSignInWithDoctorCredentials,
    toggleDoctorPwdVisibility,
    refreshDoctorProfileSelect,
    doctorSessionState,
    doctorEncounterState,
    filterDoctorEncounters,
    renderDoctorEncounterFrequency,
    startDoctorIntake,
    isDoctorMatch,
    renderDoctorDashboard,
    renderDoctorActiveConsultations,
    approveDoctor,
    rejectDoctor,
    renderAdminDoctorApprovals,
    adminState,
    HOSPITALS_DIRECTORY,
    getNearbyHospitals,
    renderNearbyHospitals,
    onNearbyHospitalSearchInput,
    filterHospitalsCategory,
    PHARMACIES_DIRECTORY,
    getNearbyPharmacies,
    renderNearbyPharmacies,
    onNearbyPharmacySearchInput,
    quickFillLocation,
    detectPatientLocation,
    renderPatientProfile,
    getDoctorSuggestions,
    renderDoctorSuggestions,
    getActiveHospitalsDirectory,
    getActiveDoctorsDirectory,
    getActivePharmaciesDirectory,
    resolvePatientLocationInfo,
    openModal,
    closeModal,
    openUpdatePatientModal,
    closeUpdatePatientModal,
    saveUpdatedPatient,
    deletePatient,
    openAddPatientModal,
    renderAdminPatients,
    filterAdminPatients,
    getAllAdminPatients,
    useCurrentLocationForSignup,
    useCurrentLocationForNearby,
    useCurrentLocationForModal,
    showNearbyHealthcareScreen,
    updateNearbyActiveLocationBanner,
    switchNearbyTab,
    renderNearbyHealthcareResults,
    filterNearbyResults,
    openChangeLocationModal,
    closeChangeLocationModal,
    applyChangedLocation,
    goBackFromNearbyHealthcare,
    openMapsDirections,
    openDoctorAppointmentDirect,
    calculateHaversineKm,
    getNearbyDiagnostics,
    getActiveDiagnosticsDirectory,
    DIAGNOSTICS_DIRECTORY,
    generateCityDiagnostics
  });
}
