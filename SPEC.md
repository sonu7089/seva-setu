# SevaSetu (सेवासेतु) — Detailed Product & Technical Specification

> **Hacktoberfest 2026 Project Specification**  
> **Project Name:** **SevaSetu (सेवासेतु)** — *Sevā* (Compassionate Care/Service) + *Setu* (Bridge)  
> **Core Value Proposition:** *Save doctor & patient time before the visit with bilingual (Hindi/English) voice-or-text clinical intake, and turn scanned prescriptions after the visit into clear medicine guides and automated Google Calendar schedules.*  
> **AI Engine:** Gemma 4 API (Bilingual NLU, Clinical Follow-Up Generation & Prescription Vision/OCR)  
> **Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Web Speech API, Google Calendar API

---

## 1. Executive Summary & Value Proposition

### The Problem
1. **Before the Consultation (Inefficient Intake):**
   * In busy clinics and hospitals, doctors spend the majority of a 5-minute consultation asking generic, repetitive baseline questions (*"Since how many days?", "Is the fever continuous?", "What medicines did you take?"*) that do not require a doctor's specialized medical judgment.
   * Language barriers between Hindi-speaking patients and English medical records slow down nurse bay triage even further.
2. **After the Consultation (Prescription Confusion & Missed Doses):**
   * Patients leave with physical prescriptions containing medical abbreviations (`OD`, `BD`, `TDS`, `HS`, `PC`, `AC`) and unfamiliar drug names.
   * Patients often don't know **what each medicine is actually used for**, forget to take doses on time, or keep getting reminders from an older prescription after their doctor changes their treatment.

### The Value We Add
* **For Doctors:** Saves 3–4 minutes per consultation by offloading generic, structured history-taking to an AI-guided pre-visit intake—handing the doctor a ready-to-scan clinical brief for faster decision-making.
* **For Nurses & Triage Bays:** Allows nurses at the bay (or patients directly) to record symptoms rapidly via **Voice or Text in Hindi or English**, followed by targeted **text-only follow-up questions**.
* **For Patients:** Eliminates manual typing after the visit by **scanning the prescription**, clearly explains **what every medicine is used for** in the UI, asks for **dosage days manually if missing**, and syncs a **smart Google Calendar schedule** that automatically removes outdated medicine events when a new prescription is added.

---

## 2. Sanskrit-Inspired Naming Options

| Candidate Name | Sanskrit Root | Deep Meaning & Connection to Care |
| :--- | :--- | :--- |
| **Suśrūṣā (Sushrusha / सुश्रूषा)** | *Su* (well/deeply) + *Śrū* (to listen) | In classical Ayurveda (*Charaka Samhita*), *Suśrūṣā* denotes **attentive listening and devoted nursing care**. Reflects listening to the patient's voice in Hindi/English and guiding their recovery. |
| **ĀrogyaSūtra (आरोग्यसूत्र)** | *Ārogya* (health/freedom from disease) + *Sūtra* (guiding thread) | The continuous thread of care linking pre-visit triage with post-visit adherence. |
| **Upacāra (Upachara / उपचार)** | *Upa* (near/towards) + *Cāra* (care/service/remedy) | Classical Sanskrit term for **attentive medical care, nursing service, and therapy**. |
| **CikitsāMitra (चिकित्सामित्र)** | *Cikitsā* (healing/clinical care) + *Mitra* (friend/ally) | A trusted clinical assistant for the doctor, nurse, and patient. |
| **PrāṇaSetu (प्राणसेतु)** | *Prāṇa* (vital breath/life) + *Setu* (bridge) | A bridge connecting patient communication and treatment adherence. |

---

## 3. Core Functional Workflows

### Workflow 1: Before Your Visit — Bilingual Bay Intake & Text Follow-Ups

#### 1.1 Dual-Modality Input (Voice or Text | Hindi or English)
* **Who Uses It:** Either the **patient** (via kiosk/phone in waiting area) or the **nurse at the clinical triage bay**.
* **Input Modes:**
  1. **Voice Input (`hi-IN` & `en-IN` / `en-US`):** Uses browser speech recognition / audio capture so patients or nurses can speak naturally in **Hindi**, **English**, or mixed **Hinglish** (e.g., *"पेशेंट को तीन दिन से तेज़ बुखार और सूखी खांसी है, रात को ज़्यादा होती है"* or *"Patient has high fever and dry cough for 3 days, worse at night"*).
  2. **Text Input:** Direct typing in Hindi or English, plus optional vital signs input by the nurse at the bay (BP, Temperature, SpO2, Pulse, Weight).

#### 1.2 Text-Only Smart Follow-Up Questions (Saving Doctor Time)
* **Gemma 4 Intake Analyzer** evaluates the initial voice/text input and identifies which standard preliminary questions still need answers so the doctor doesn't have to ask them.
* **Strict Modality Rule:** Follow-up questions are always rendered **as Text on screen** (with quick-tap options + short text input) for fast, quiet completion at the bay.
* **Scope of Questions:** Covers routine, non-diagnostic history questions (symptom duration, pattern, aggravating factors, basic medical history, allergies) that save the doctor's time without crossing into clinical diagnosis.

#### 1.3 Doctor Decision-Support Brief
* Once follow-ups are answered, Gemma 4 generates a concise **Pre-Visit Clinical Brief** for the doctor:
  * **Chief Complaint & Timeline** (normalized into clear clinical English, with original Hindi/English transcript preserved).
  * **Bay Vitals & Key History Answers** (positives & negatives from the text follow-ups).
  * **Red Flag / Triage Priority Indicator** for the nurse bay (`Routine`, `Priority`, `Urgent`).

---

### Workflow 2: After Your Visit — Prescription Scanner, Medicine Explainer & Smart Google Calendar

#### 2.1 Prescription Scanning (Vision OCR) + Manual Fallback
* **Primary Input — Scan Prescription:**
  * User uploads or snaps a photo of their prescription (`JPG`, `PNG`, `WEBP`, or PDF/image capture).
  * **Gemma 4 Vision / Multimodal API** extracts every prescribed medication, strength, frequency shorthand (`OD`, `BD`, `TDS`, `QID`, `HS`, `SOS`), food timing (`AC` / before food, `PC` / after food), and duration (days).
* **Secondary Input — Manual Entry / Edit:**
  * Users can also manually add or edit extracted medication rows at any time.

#### 2.2 Missing Dosage Days Detection & Manual Prompt
* Prescriptions frequently omit or obscure the exact number of days for one or more medicines (or write unclear shorthand).
* **Mandatory Validation Rule:**
  * When Gemma 4 parses the scanned prescription, any medication where the **duration in days is missing or ambiguous** (`days === null` or `confidence < threshold`) is highlighted in the UI with a required **"Enter Days of Dosage"** input field.
  * The user is prompted to confirm or enter the number of days manually before calendar events are generated.

#### 2.3 "What Is This Medicine Used For?" — Patient UI Cards
* For every extracted medication, Gemma 4 generates a clear, patient-friendly **Medicine Purpose Card** in the UI:
  * **Medicine Name & Strength:** e.g., `Tab Pantoprazole 40mg`
  * **What It Is Used For (Plain Purpose):** e.g., *"Reduces stomach acid and protects against acidity or stomach irritation."* (Available in English & Hindi).
  * **When & How to Take:** e.g., *"Once daily in the morning, 30 minutes before breakfast."*
  * **Duration:** e.g., *"5 Days"* (either extracted from scan or entered manually via the prompt).
  * **Key Precaution:** Simple practical note (e.g., *"Swallow whole with water; do not crush"*).

#### 2.4 Smart Google Calendar Scheduling (With Automatic Old Event Removal)
* **Smart Time Slot Mapping:**
  * Maps medical shorthand + food rules into concrete daily time slots (customizable by patient):
    * `Morning (Before Food / AC)` → `07:30 AM`
    * `Morning (After Food / PC)` → `09:00 AM`
    * `Afternoon (After Lunch)` → `02:00 PM`
    * `Evening` → `06:00 PM`
    * `Night (Before Dinner)` → `08:00 PM`
    * `Night (After Dinner / Bedtime / HS)` → `09:30 PM`
* **Automatic Cleanup of Old Prescription Events (Prevents Double-Dosing):**
  * All calendar events created by our system carry an app metadata tag (`extendedProperties.private.app = "sevasetu-rx"`).
  * When a **new prescription** is scheduled into Google Calendar, the integration **automatically queries and deletes upcoming medicine events from the previous prescription** before inserting the new prescription's events.
  * This guarantees the patient's Google Calendar only ever has the current active prescription—preventing accidental double-dosing without requiring a complex manual diff UI.
  * Also supports `.ics` (iCalendar) one-click export/sync alongside Google Calendar OAuth/API integration.

---

## 4. Technical Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        BEFORE YOUR VISIT (Bay / Patient)                   │
│  [Voice (Hindi/English)] or [Text (Hindi/English)] + [Optional Bay Vitals] │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Gemma 4 Intake Engine (/api/gemma/previsit)                               │
│  1. Transcribes / normalizes Hindi & English input                         │
│  2. Generates 3-4 TEXT-ONLY generic follow-up questions                    │
│  3. Compiles Doctor Decision-Support Brief (saves 3-4 mins of consult)     │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                         AFTER YOUR VISIT (Patient)                         │
│  [Scan Prescription Image/Photo] (or Manual Entry)                         │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Gemma 4 Prescription Vision Engine (/api/gemma/postvisit)                 │
│  1. Extracts meds, dosage, frequency, food timing & duration (days)        │
│  2. Explains "What is this medicine used for?" in plain UI cards           │
│  3. Flags any medicine with missing/unclear days -> Prompts User in UI     │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  Smart Google Calendar Sync (/api/calendar/sync)                           │
│  1. Removes old active prescription events from Google Calendar            │
│  2. Creates new smart recurring medicine events for the confirmed days     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. TypeScript Data Contracts

### 5.1 Phase 1: Pre-Visit Intake & Follow-Up Schema
```typescript
export interface PreVisitInput {
  entryBy: "patient" | "nurse_bay";
  inputMode: "voice" | "text";
  language: "hi" | "en" | "hinglish";
  rawTranscript: string;
  patientInfo: {
    name?: string;
    age: string;
    gender: string;
    vitals?: {
      bp?: string;
      temp?: string;
      pulse?: string;
      spo2?: string;
    };
  };
}

export interface TextFollowUpQuestion {
  id: string;
  questionEn: string;
  questionHi: string;
  quickOptionsEn: string[];
  quickOptionsHi: string[];
  answer?: string;
}

export interface DoctorIntakeBrief {
  chiefComplaint: string;
  symptomTimeline: string[];
  followUpSummary: Array<{
    question: string;
    answer: string;
  }>;
  vitalsSummary?: string;
  triagePriority: "Routine" | "Priority" | "Urgent";
  timeSavedNote: string;
}
```

### 5.2 Phase 2: Scanned Prescription & Smart Calendar Schema
```typescript
export interface ExtractedMedication {
  id: string;
  name: string;
  dosage: string;
  frequencyCode: string;          // e.g., "BD", "TDS", "OD", "HS"
  frequencyPlain: string;         // e.g., "Twice daily (Morning & Night)"
  foodRelation: "before_food" | "after_food" | "with_food" | "anytime";
  whatIsItUsedForEn: string;      // Plain-English explanation shown in UI
  whatIsItUsedForHi: string;      // Plain-Hindi explanation shown in UI
  precautionNote: string;
  daysOfDosage: number | null;    // null if unclear on Rx -> triggers manual UI prompt!
  isDaysConfirmed: boolean;
  recommendedTimes: string[];     // e.g., ["08:00", "20:00"]
}

export interface CalendarSyncPayload {
  replacePreviousPrescription: boolean; // Always true by default: removes old Rx events
  patientTimezone: string;
  startDate: string;                    // YYYY-MM-DD
  medications: ExtractedMedication[];
}
```

---

## 6. Hacktoberfest 2026 Open-Source Contribution Tracks

To make the repository welcoming for fellow Hacktoberfest contributors:
1. **`src/community-packs/intake-templates/`:** Add generic pre-visit question sets for common complaints (Fever, Cough/Cold, Stomach Pain, Joint Pain, Headache, Skin Rash) in English & Hindi.
2. **`src/community-packs/medicine-knowledge/`:** Contribute plain-language *"What is this medicine used for?"* descriptions in Hindi, English, and other Indian languages.
3. **`src/community-packs/sample-prescriptions/`:** Add anonymized sample prescriptions for testing OCR/Vision extraction and missing-dosage-days edge cases.
4. **Calendar & Accessibility Enhancements:** Improve Google Calendar event formatting, voice recognition accuracy for Hindi medical terms, and nurse bay keyboard shortcuts.
