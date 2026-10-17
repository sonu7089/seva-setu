# SevaSetu (सेवासेतु) — Phased Implementation Plan

> **Architecture:** Next.js (App Router) + TypeScript + Tailwind CSS + SQLite (`better-sqlite3`) + Gemma 4 API + Web Speech API + Google Calendar API  
> **Goal:** Build a rock-solid, demo-ready, open-source healthcare application for Hacktoberfest 2026 in 5 structured phases.

---

## Phase 1: Project Foundation, SQLite Database & Gemma 4 Engine
**Objective:** Scaffold the Next.js application, set up automatic local SQLite persistence for Nurse Bay ↔ Doctor ↔ Patient handoffs, and wire up the multi-provider Gemma 4 client.

### Deliverables:
1. **Next.js + Tailwind CSS + TypeScript Setup:**
   * Clean clinical theme with bilingual typography support (English + Hindi Devanagari).
   * Top navigation switching seamlessly between **1. Pre-Visit Bay (Patient/Nurse)**, **2. Doctor Console**, and **3. Post-Visit Prescription & Calendar**.
2. **SQLite Database Layer (`src/lib/db.ts` using `better-sqlite3`):**
   * Auto-creates `data/sevasetu.db` on first run (zero manual migration steps required for Hacktoberfest contributors).
   * **Tables:**
     * `visits`: Stores patient token/ID, name, age, gender, bay vitals, raw Hindi/English voice/text transcript, text follow-up Q&A JSON, and generated Doctor SOAP Brief JSON.
     * `prescriptions`: Stores scanned prescription metadata, extracted medications JSON (including `whatIsItUsedFor` and confirmed `daysOfDosage`), and active Google Calendar sync status.
     * `calendar_events`: Tracks active scheduled medicine event IDs so old prescription reminders are cleanly removed when a new prescription is scheduled.
3. **Gemma 4 Multi-Provider Adapter (`src/lib/gemma.ts`):**
   * Supports **Google AI Studio API (`GOOGLE_API_KEY`)** for Gemma 4 text & vision calls.
   * Supports **Local Ollama / OpenAI-compatible endpoint** as an alternative.
   * Includes **Built-in Resilient Demo Fallbacks** so every feature works even offline.

---

## Phase 2: "Before Your Visit" — Bilingual Voice/Text Bay Intake & Text Follow-Ups
**Objective:** Allow the patient or nurse at the bay to record symptoms via Voice or Text in Hindi or English, complete text-only follow-up questions, and save the structured brief to SQLite for the doctor.

### Deliverables:
1. **Patient / Nurse Bay Intake Form (`src/components/PreVisitBay.tsx`):**
   * **Role Toggle:** *Nurse at Triage Bay* (includes quick Vitals entry: BP, Temp, Pulse, SpO2) vs. *Patient Self-Check-In*.
   * **Language Selector:** **Hindi (`hi-IN`)** and **English (`en-IN`)**.
   * **Dual Input Mode:**
     * **Voice Input:** Live microphone recording using Web Speech API (`hi-IN` / `en-IN`) with real-time transcript preview.
     * **Text Input:** Direct bilingual text area + 1-click sample scenarios (in both Hindi and English) for fast testing.
2. **Gemma 4 Text-Only Follow-Up Generator (`/api/gemma/previsit-followups`):**
   * Analyzes the initial symptom transcript and generates **3 to 4 targeted, generic clinical intake questions** (duration, severity, triggers, existing medical conditions/allergies).
   * **Strictly Text UI:** Renders follow-ups as readable text cards (Hindi + English) with quick-tap answer chips and custom text input.
3. **Doctor Decision-Support Brief Generator (`/api/gemma/previsit-brief` & Doctor View):**
   * Compiles the initial input + text follow-up answers into a **15-Second Doctor SOAP Brief** and saves it to SQLite.
   * **Doctor View:** Shows the live queue of patients from SQLite so the doctor can open a patient's pre-visit brief immediately and skip repetitive generic questions.

---

## Phase 3: "After Your Visit" — Prescription Scanner, Missing Days Prompt & Medicine Purpose UI
**Objective:** Let patients scan their prescription image (or enter manually), prompt manually if dosage days are unclear, and clearly explain what each medicine is used for.

### Deliverables:
1. **Prescription Scanner & Upload Component (`src/components/PrescriptionScanner.tsx`):**
   * Drag-and-drop / camera photo upload for prescriptions (`JPG`, `PNG`, `WEBP`) + pre-loaded sample prescription images for instant demoing.
   * Manual medicine row entry/edit fallback.
2. **Gemma 4 Vision Prescription Parser (`/api/gemma/parse-prescription`):**
   * Uses Gemma 4 multimodal vision to extract:
     * Medicine name & strength (`Tab Pantoprazole 40mg`, `Tab Azithromycin 500mg`, etc.)
     * Frequency shorthand (`OD`, `BD`, `TDS`, `SOS`, `HS`) + food timing (`Before Food` / `After Food`).
     * **`daysOfDosage` (`number | null`):** Explicitly sets `null` if the number of days is missing, cut off, or unclear on the prescription.
     * **`whatIsItUsedFor` (English & Hindi):** Plain-language explanation of what the medicine treats and why the doctor prescribed it.
3. **Interactive Missing Dosage Days Prompt:**
   * Any medicine with `daysOfDosage === null` displays an amber **"Dosage Days Required"** banner with a manual number input (*"How many days did the doctor ask you to take this medicine?"*).
   * Blocks calendar sync until all medicines have confirmed dosage days.
4. **"What Is This Medicine Used For?" UI Cards:**
   * Clean, reassuring patient cards showing the medicine's purpose in plain English & Hindi, food relation badge, and daily time slots.

---

## Phase 4: Smart Google Calendar Sync & Automatic Old Event Cleanup
**Objective:** Schedule the confirmed prescription into Google Calendar and automatically delete old medicine calendar events when a new prescription is added.

### Deliverables:
1. **Google Calendar Sync Engine (`/api/calendar/sync`):**
   * **Step 1 — Remove Old Prescription Events:**
     * Queries Google Calendar for upcoming events tagged with `privateExtendedProperty="app=sevasetu-rx"` (and updates SQLite `calendar_events`) and deletes all old active medicine events so there is never an outdated reminder or accidental double-dose.
   * **Step 2 — Insert New Smart Medicine Events:**
     * Generates recurring daily events for each medicine across its confirmed `daysOfDosage` at smart meal-aligned times (e.g., `07:30 AM` Before Breakfast, `09:00 AM` After Breakfast, `02:00 PM` After Lunch, `09:00 PM` After Dinner).
     * Includes the plain-language *"What this medicine is used for"* inside the Google Calendar event description.
2. **Dual Calendar Mode (Live Google OAuth + Instant Interactive Calendar Preview & `.ics` Export):**
   * Supports real Google Calendar API sync via OAuth token / credentials.
   * Also includes an **in-app visual Google Calendar Week/Day Simulator** + `.ics` download so judges and Hacktoberfest contributors can visually watch old prescription events get wiped and replaced by the new prescription schedule in real time, even without logging into a personal Google account.

---

## Phase 5: Hacktoberfest 2026 Open-Source Polish & Demo Readiness
**Objective:** Make the repository a magnet for Hacktoberfest PR contributions and ensure a flawless 60-second presentation demo.

### Deliverables:
1. **`src/community-packs/` Open-Source Modules:**
   * Modular JSON/TS packs for **Common Intake Complaints (Hindi/English)**, **Medicine Purpose Dictionary**, and **Sample Prescriptions**.
2. **`CONTRIBUTING.md` & Issue Templates:**
   * Step-by-step instructions for fellow Hacktoberfest participants to submit PRs in under 15 minutes.
3. **End-to-End Verification & Demo Polish:**
   * Pre-seeded SQLite demo data + 1-click **"Load Live Demo Flow"** button covering a full Hindi/English Bay Intake → Doctor Brief → Prescription Scan (with missing dosage days prompt) → Google Calendar Replacement.
