# SevaSetu (सेवासेतु) — Quick Project Brief

> **Meaning:** *Sevā* (Compassionate Care & Service) + *Setu* (Bridge) — *A Bridge of Care between Patients, Nurses, and Doctors.*  
> **One-Line Pitch:** *Save doctors from asking generic intake questions before the visit, and help patients scan prescriptions into smart Google Calendar medicine schedules after the visit.*  
> **Built for:** Hacktoberfest 2026 | **Powered by:** Gemma 4 API (Text, Bilingual Hindi/English & Prescription Vision)

---

## Sanskrit-Inspired Name Ideas (Deep Meaning in Care & Healing)

| Name | Sanskrit Root & Meaning | Why It Fits This System |
| :--- | :--- | :--- |
| **1. Suśrūṣā (Sushrusha / सुश्रूषा)** | Derived from *Su* (good/well) + *Śrū* (to listen intently). In Ayurveda (Charaka Samhita), *Suśrūṣā* means **attentive listening, devoted nursing care, and desire to heal**. | Captures both listening to the patient's voice at the clinic bay and caring for their recovery schedule at home. |
| **2. Upacāra (Upachara / उपचार)** | Means **service, attendance, nursing care, and medical treatment/remedy**. | Simple, memorable, and widely understood across India as "treatment & care." |
| **3. ĀrogyaSetu / ĀrogyaSūtra (आरोग्यसूत्र)** | *Ārogya* (disease-free health/wellbeing) + *Sūtra* (connecting thread / guiding rule). | Represents the **continuous thread** connecting the nurse/patient pre-visit bay with post-visit recovery at home. |
| **4. PrāṇaDhārā (प्राणधारा)** | *Prāṇa* (vital life force) + *Dhārā* (continuous flow / stream). | Symbolizes a smooth, uninterrupted flow of care from the waiting room to daily medicine adherence. |
| **5.SevāSetu (सेवासेतु)** | *Sevā* (compassionate care/service) + *Setu* (bridge). | A bridge of care between patients, nurses, and doctors. |
| **6. CikitsāMitra (ChikitsaMitra / चिकित्सामित्र)** | *Cikitsā* (medical care/healing) + *Mitra* (trusted friend/companion). | Positioned as a trusted companion for both the clinic bay and the patient at home. |

---

## The Problem We Solve
1. **Before the Visit (Wasted Doctor Time on Generic Questions):** Doctors spend 60–70% of a short consultation asking routine, repetitive intake questions (*"When did the fever start?", "What medicines are you taking?", "Any allergies?"*) that do not require a doctor's specialized clinical expertise.
2. **After the Visit (Forgotten Doses & Unclear Prescriptions):** Patients walk out with handwritten or printed prescriptions, struggle to remember what each medicine is actually for, forget dose timings, or keep following outdated medicine reminders from previous visits.

---

## How the System Works (2 Simple Workflows)

### Workflow 1: Before Your Visit (Patient or Nurse at Clinic Bay)
* **Dual Input Mode (Voice or Text in Hindi or English):**
  * The **patient** (or a **nurse at the triage bay**) enters initial symptoms and basic details using **Voice** or **Text** in **Hindi or English**.
* **Text-Only Smart Follow-Up Questions:**
  * **Gemma 4** analyzes what was shared and displays a focused set of **text follow-up questions** covering standard preliminary history (onset, duration, severity, triggers, existing conditions) that doesn't need the doctor's direct time.
* **Doctor Decision-Support Summary:**
  * Generates a clean, structured **Pre-Visit Clinical Summary** for the doctor before the patient even walks into the room—so the doctor starts straight at high-level clinical decision-making.

### Workflow 2: After Your Visit (Prescription Scan & Smart Google Calendar)
* **Scan Prescription (or Enter Manually):**
  * Instead of typing medicines manually, the patient simply **scans/uploads a photo of their prescription** (with manual entry still available as a backup).
* **Missing Dosage Days Prompt:**
  * If the prescription does not clearly mention **how many days** a medicine must be taken, the UI automatically prompts the patient/nurse to **enter the number of dosage days manually** before scheduling.
* **Know What Every Medicine Is Used For:**
  * For every prescribed medicine, Gemma 4 displays a clear, plain-language card in the UI showing **what the medicine is used for**, how it works, dosage frequency (`OD`, `BD`, `TDS`, `SOS`), and food timing (before/after meals).
* **Smart Google Calendar Scheduling (Auto-Replaces Old Schedule):**
  * With one click, the app creates **smart Google Calendar reminders** for each medicine dose across the prescribed days.
  * **Automatic Old Event Cleanup:** Whenever a new prescription is scheduled, **old medicine calendar events are automatically removed** and replaced by the new schedule—preventing outdated reminders or accidental double-dosing without cluttering the UI.

---

## The Value We Add

### 1. For Doctors — Reclaiming Clinical Time
* Eliminates 3–4 minutes of repetitive baseline questioning per patient.
* Doctors receive a structured pre-visit intake brief at the start of the consultation, allowing them to focus 100% of their time on physical examination, diagnosis, and complex clinical judgment.

### 2. For Nurses & Clinic Triage Bays — Faster, Standardized Intake
* Nurses at the bay—or patients waiting in line—can speak naturally in **Hindi or English**.
* Standardizes intake quality across busy outpatient departments (OPDs) even when staff are stretched thin.

### 3. For Patients & Families — Clarity & Effortless Adherence
* **No Language Barrier:** Speak or type in Hindi or English during intake.
* **Understand Your Treatment:** Clearly see in the UI **what each medicine is used for** in simple language instead of guessing from cryptic strip names.
* **Zero-Effort Reminders:** Scan the prescription once, confirm any missing dosage days, and let smart **Google Calendar** sync handle daily dose timings—automatically clearing out old prescription events so there is never confusion.
