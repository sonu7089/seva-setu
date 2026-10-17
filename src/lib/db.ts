import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  BayVitals,
  CalendarEventRecord,
  DoctorIntakeBrief,
  EntryByRole,
  ExtractedMedication,
  InputModality,
  IntakeLanguage,
  PrescriptionRecord,
  TextFollowUpQuestion,
  VisitRecord,
  VisitStatus,
} from "@/types/sevasetu";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "sevasetu.db");

declare global {
  // eslint-disable-next-line no-var
  var __sevasetuDb: Database.Database | undefined;
}

export function getDbPath(): string {
  return process.env.SEVASETU_DB_PATH || DEFAULT_DB_PATH;
}

function initializeSchema(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      token_number TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      age TEXT NOT NULL,
      gender TEXT NOT NULL,
      entry_by TEXT NOT NULL DEFAULT 'nurse_bay',
      input_mode TEXT NOT NULL DEFAULT 'voice',
      language TEXT NOT NULL DEFAULT 'hi',
      vitals_json TEXT NOT NULL DEFAULT '{}',
      raw_transcript TEXT NOT NULL,
      followup_qa_json TEXT NOT NULL DEFAULT '[]',
      doctor_brief_json TEXT,
      status TEXT NOT NULL DEFAULT 'ready_for_doctor',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      visit_id TEXT,
      patient_name TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      clinic_name TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'scan',
      image_name TEXT,
      medications_json TEXT NOT NULL DEFAULT '[]',
      calendar_sync_status TEXT NOT NULL DEFAULT 'unsynced',
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_prescriptions_created_at ON prescriptions(created_at DESC);

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      prescription_id TEXT NOT NULL,
      google_event_id TEXT NOT NULL,
      medicine_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      what_is_it_used_for_en TEXT NOT NULL,
      what_is_it_used_for_hi TEXT NOT NULL,
      food_relation TEXT NOT NULL DEFAULT 'after_food',
      scheduled_date TEXT NOT NULL,
      scheduled_time TEXT NOT NULL,
      app_tag TEXT NOT NULL DEFAULT 'sevasetu-rx',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_prescription ON calendar_events(prescription_id);
  `);
}

function seedInitialDataIfEmpty(db: Database.Database): void {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM visits")
    .get() as { count: number };

  if (row.count > 0) {
    return;
  }

  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 18 * 60 * 1000).toISOString();

  const visit1FollowUps: TextFollowUpQuestion[] = [
    {
      id: "fq-1",
      questionEn: "Does the fever come with chills or body ache?",
      questionHi: "क्या बुखार के साथ ठंड लगना या बदन दर्द भी है?",
      quickOptionsEn: [
        "Yes, evening chills & body ache",
        "Only mild headache",
        "No chills",
      ],
      quickOptionsHi: [
        "हाँ, शाम को ठंड और बदन दर्द",
        "केवल हल्का सिरदर्द",
        "ठंड नहीं लगती",
      ],
      answer: "Yes, evening chills & body ache (हाँ, शाम को ठंड और बदन दर्द)",
    },
    {
      id: "fq-2",
      questionEn: "Has the patient taken any medicine at home so far?",
      questionHi: "क्या मरीज़ ने घर पर कोई दवा ली है?",
      quickOptionsEn: [
        "Paracetamol 500mg yesterday",
        "Cough syrup only",
        "No medicine taken",
      ],
      quickOptionsHi: [
        "कल पैरासिटामोल 500mg ली थी",
        "केवल खांसी का सिरप",
        "कोई दवा नहीं ली",
      ],
      answer: "Paracetamol 500mg yesterday — temporary relief for 4 hours",
    },
    {
      id: "fq-3",
      questionEn: "Any known drug allergies or chronic conditions (Diabetes/BP)?",
      questionHi: "क्या किसी दवा से एलर्जी या कोई पुरानी बीमारी (शुगर/बीपी) है?",
      quickOptionsEn: [
        "No known allergies",
        "Hypertension (on Amlodipine)",
        "Diabetes Type 2",
      ],
      quickOptionsHi: [
        "कोई एलर्जी नहीं",
        "हाई बीपी (दवा चल रही है)",
        "डायबिटीज (शुगर)",
      ],
      answer: "No known drug allergies; no chronic illness",
    },
  ];

  const visit1Brief: DoctorIntakeBrief = {
    chiefComplaint:
      "High-grade intermittent fever and dry cough for 3 days, worsening at night.",
    chiefComplaintHi:
      "3 दिन से तेज़ बुखार और सूखी खांसी, रात में अधिक तकलीफ़।",
    symptomTimeline: [
      "Day 1–3: Evening spikes of fever (recorded 101.4°F at triage bay) with chills and myalgia.",
      "Dry, non-productive cough worse on lying down at night; no hemoptysis or dyspnea.",
      "Self-medicated with Tab Paracetamol 500mg once; fever recurred after 4 hours.",
    ],
    followUpSummary: [
      {
        question: "Associated chills / myalgia",
        answer: "Positive for evening chills and generalized body ache",
      },
      {
        question: "Prior medication taken",
        answer: "Tab Paracetamol 500mg yesterday (partial relief)",
      },
      {
        question: "Allergies & Comorbidities",
        answer: "NKDA; no history of Diabetes or Hypertension",
      },
    ],
    vitalsSummary: "BP 124/80 mmHg · Temp 101.4°F · Pulse 96 bpm · SpO2 98%",
    triagePriority: "Priority",
    clinicalNotes: [
      "Routine history completed at Nurse Bay in Hindi (Voice).",
      "Examine throat/chest auscultation directly; consider viral febrile panel if persistent >4 days.",
    ],
    timeSavedNote: "3.5 mins of routine history captured prior to consultation",
  };

  const visit2FollowUps: TextFollowUpQuestion[] = [
    {
      id: "fq-201",
      questionEn: "When is the upper abdominal burning worse?",
      questionHi: "पेट के ऊपरी हिस्से में जलन कब ज़्यादा होती है?",
      quickOptionsEn: [
        "After spicy meals & late at night",
        "Empty stomach in morning",
        "Continuous all day",
      ],
      quickOptionsHi: [
        "मसालेदार खाने के बाद और रात में",
        "सुबह खाली पेट",
        "पूरे दिन लगातार",
      ],
      answer: "After meals and when lying down at night",
    },
    {
      id: "fq-202",
      questionEn: "Any red-flag symptoms like vomiting, black stools, or weight loss?",
      questionHi: "क्या उल्टी, काले रंग का मल या वज़न घटने जैसी कोई समस्या है?",
      quickOptionsEn: ["None of these", "Occasional nausea", "Vomiting present"],
      quickOptionsHi: ["इनमें से कुछ नहीं", "कभी-कभी जी मिचलाना", "उल्टी होना"],
      answer: "None of these; mild sour regurgitation only",
    },
  ];

  const visit2Brief: DoctorIntakeBrief = {
    chiefComplaint:
      "Epigastric burning and acid reflux for 5 days, aggravated post-meals.",
    chiefComplaintHi:
      "5 दिन से पेट में जलन और खट्टी डकार, खाने के बाद अधिक।",
    symptomTimeline: [
      "5-day history of retrosternal & epigastric burning, worse after heavy/oily meals.",
      "No dysphagia, hematemesis, melena, or unintended weight loss.",
    ],
    followUpSummary: [
      {
        question: "Aggravating factors",
        answer: "Post-prandial and recumbent position at night",
      },
      {
        question: "GI red flags",
        answer: "Negative for vomiting, melena, or weight loss",
      },
    ],
    vitalsSummary: "BP 118/76 mmHg · Temp 98.4°F · Pulse 78 bpm · SpO2 99%",
    triagePriority: "Routine",
    clinicalNotes: [
      "Self-check-in completed in English/Hindi text.",
      "Ready for focused abdominal exam & PPI/dietary counseling.",
    ],
    timeSavedNote: "3 mins of baseline GI intake questions completed at bay",
  };

  const insertVisit = db.prepare(`
    INSERT INTO visits (
      id, token_number, patient_name, age, gender, entry_by, input_mode,
      language, vitals_json, raw_transcript, followup_qa_json, doctor_brief_json,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertVisit.run(
    "visit-opd-104",
    "OPD-104",
    "Rameshwar Sharma (रामेश्वर शर्मा)",
    "52",
    "Male",
    "nurse_bay",
    "voice",
    "hi",
    JSON.stringify({
      bp: "124/80",
      temp: "101.4°F",
      pulse: "96 bpm",
      spo2: "98%",
    }),
    "पेशेंट को तीन दिन से तेज़ बुखार और सूखी खांसी है, रात को ज़्यादा होती है और शाम को ठंड लगती है।",
    JSON.stringify(visit1FollowUps),
    JSON.stringify(visit1Brief),
    "ready_for_doctor",
    earlier,
    now
  );

  insertVisit.run(
    "visit-opd-105",
    "OPD-105",
    "Ananya Verma",
    "29",
    "Female",
    "patient",
    "text",
    "en",
    JSON.stringify({
      bp: "118/76",
      temp: "98.4°F",
      pulse: "78 bpm",
      spo2: "99%",
    }),
    "Having severe acidity, upper stomach burning, and sour reflux for the past 5 days, especially after dinner.",
    JSON.stringify(visit2FollowUps),
    JSON.stringify(visit2Brief),
    "ready_for_doctor",
    now,
    now
  );

  const sampleMeds: ExtractedMedication[] = [
    {
      id: "med-1",
      name: "Tab Pantoprazole",
      dosage: "40 mg",
      frequencyCode: "OD",
      frequencyPlain: "Once daily (Morning, empty stomach)",
      foodRelation: "before_food",
      whatIsItUsedForEn:
        "Reduces excess stomach acid and protects the stomach lining from reflux or medication-induced irritation.",
      whatIsItUsedForHi:
        "पेट में बनने वाले अतिरिक्त एसिड (जलन/गैस) को कम करता है और पेट की परत को सुरक्षित रखता है।",
      precautionNote: "Swallow whole with water 30 minutes before breakfast.",
      daysOfDosage: 5,
      isDaysConfirmed: true,
      recommendedTimes: ["07:30"],
    },
    {
      id: "med-2",
      name: "Tab Paracetamol (Dolo)",
      dosage: "650 mg",
      frequencyCode: "TDS",
      frequencyPlain: "Three times daily (Morning, Afternoon, Night)",
      foodRelation: "after_food",
      whatIsItUsedForEn:
        "Lowers fever and relieves body ache, headache, and chills.",
      whatIsItUsedForHi:
        "बुखार उतारने और बदन दर्द या सिरदर्द से राहत देने के लिए उपयोग किया जाता है।",
      precautionNote:
        "Take after food; keep at least a 6-hour gap between doses.",
      daysOfDosage: 3,
      isDaysConfirmed: true,
      recommendedTimes: ["09:00", "14:00", "21:30"],
    },
    {
      id: "med-3",
      name: "Syp Dextromethorphan + CPM",
      dosage: "10 ml",
      frequencyCode: "BD",
      frequencyPlain: "Twice daily (Morning & Bedtime)",
      foodRelation: "after_food",
      whatIsItUsedForEn:
        "Calms dry, irritating nighttime cough and throat allergy so you can rest comfortably.",
      whatIsItUsedForHi:
        "सूखी खांसी और गले की खराश को शांत करता है ताकि रात में अच्छी नींद आ सके।",
      precautionNote: "May cause mild drowsiness; avoid driving after night dose.",
      daysOfDosage: null, // Demonstrates missing days prompt in Phase 3
      isDaysConfirmed: false,
      recommendedTimes: ["09:00", "21:30"],
    },
  ];

  db.prepare(`
    INSERT INTO prescriptions (
      id, visit_id, patient_name, doctor_name, clinic_name,
      source_type, image_name, medications_json, calendar_sync_status,
      last_synced_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "rx-demo-101",
    "visit-opd-104",
    "Rameshwar Sharma (रामेश्वर शर्मा)",
    "Dr. Arvind Kulkarni (MD, Internal Medicine)",
    "SevaSetu Community Polyclinic",
    "scan",
    "opd_prescription_104.jpg",
    JSON.stringify(sampleMeds),
    "needs_days_confirmation",
    null,
    now
  );

  // Seed 2 existing active calendar events from a previous prescription so Phase 4 can demonstrate cleanup
  const todayStr = new Date().toISOString().slice(0, 10);
  const insertEvent = db.prepare(`
    INSERT INTO calendar_events (
      id, prescription_id, google_event_id, medicine_name, dosage,
      what_is_it_used_for_en, what_is_it_used_for_hi, food_relation,
      scheduled_date, scheduled_time, app_tag, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sevasetu-rx', 'active', ?)
  `);

  insertEvent.run(
    "cal-prev-1",
    "rx-demo-101",
    "gcal_sevasetu_prev_01",
    "Tab Cetirizine (Previous Rx)",
    "10 mg",
    "Relieves seasonal runny nose and sneezing.",
    "जुकाम और छींक से राहत के लिए।",
    "after_food",
    todayStr,
    "21:30",
    earlier
  );

  insertEvent.run(
    "cal-prev-2",
    "rx-demo-101",
    "gcal_sevasetu_prev_02",
    "Cap Amoxicillin (Previous Rx)",
    "500 mg",
    "Antibiotic course from earlier clinic visit.",
    "पिछली विज़िट का एंटीबायोटिक कोर्स।",
    "after_food",
    todayStr,
    "09:00",
    earlier
  );
}

export function getDb(): Database.Database {
  if (!global.__sevasetuDb) {
    const dbPath = getDbPath();
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new Database(dbPath);
    initializeSchema(db);
    seedInitialDataIfEmpty(db);
    global.__sevasetuDb = db;
  }
  return global.__sevasetuDb;
}

interface RawVisitRow {
  id: string;
  token_number: string;
  patient_name: string;
  age: string;
  gender: string;
  entry_by: EntryByRole;
  input_mode: InputModality;
  language: IntakeLanguage;
  vitals_json: string;
  raw_transcript: string;
  followup_qa_json: string;
  doctor_brief_json: string | null;
  status: VisitStatus;
  created_at: string;
  updated_at: string;
}

function mapVisitRow(row: RawVisitRow): VisitRecord {
  return {
    id: row.id,
    tokenNumber: row.token_number,
    patientName: row.patient_name,
    age: row.age,
    gender: row.gender,
    entryBy: row.entry_by,
    inputMode: row.input_mode,
    language: row.language,
    vitals: JSON.parse(row.vitals_json || "{}") as BayVitals,
    rawTranscript: row.raw_transcript,
    followUpQuestions: JSON.parse(
      row.followup_qa_json || "[]"
    ) as TextFollowUpQuestion[],
    doctorBrief: row.doctor_brief_json
      ? (JSON.parse(row.doctor_brief_json) as DoctorIntakeBrief)
      : null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listVisits(): VisitRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM visits ORDER BY created_at DESC")
    .all() as RawVisitRow[];
  return rows.map(mapVisitRow);
}

export function getVisitById(id: string): VisitRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM visits WHERE id = ?")
    .get(id) as RawVisitRow | undefined;
  return row ? mapVisitRow(row) : null;
}

export interface CreateVisitParams {
  id?: string;
  tokenNumber?: string;
  patientName: string;
  age: string;
  gender: string;
  entryBy: EntryByRole;
  inputMode: InputModality;
  language: IntakeLanguage;
  vitals?: BayVitals;
  rawTranscript: string;
  followUpQuestions?: TextFollowUpQuestion[];
  doctorBrief?: DoctorIntakeBrief | null;
  status?: VisitStatus;
}

export function createVisit(params: CreateVisitParams): VisitRecord {
  const db = getDb();
  const now = new Date().toISOString();
  // Next token = highest existing OPD number + 1 (stays unique even if rows are deleted)
  const maxRow = db
    .prepare(
      "SELECT MAX(CAST(SUBSTR(token_number, 5) AS INTEGER)) as max FROM visits WHERE token_number LIKE 'OPD-%'"
    )
    .get() as { max: number | null };

  const id = params.id || `visit-${Date.now()}`;
  const tokenNumber = params.tokenNumber || `OPD-${(maxRow.max ?? 103) + 1}`;

  const status: VisitStatus =
    params.status ||
    (params.doctorBrief ? "ready_for_doctor" : "intake_pending");

  db.prepare(`
    INSERT INTO visits (
      id, token_number, patient_name, age, gender, entry_by, input_mode,
      language, vitals_json, raw_transcript, followup_qa_json, doctor_brief_json,
      status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    tokenNumber,
    params.patientName || "Walk-in Patient",
    params.age,
    params.gender,
    params.entryBy,
    params.inputMode,
    params.language,
    JSON.stringify(params.vitals || {}),
    params.rawTranscript,
    JSON.stringify(params.followUpQuestions || []),
    params.doctorBrief ? JSON.stringify(params.doctorBrief) : null,
    status,
    now,
    now
  );

  return getVisitById(id)!;
}

export function updateVisitFollowUpsAndBrief(
  id: string,
  followUpQuestions: TextFollowUpQuestion[],
  doctorBrief: DoctorIntakeBrief | null,
  status: VisitStatus = "ready_for_doctor"
): VisitRecord | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE visits
    SET followup_qa_json = ?,
        doctor_brief_json = ?,
        status = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    JSON.stringify(followUpQuestions),
    doctorBrief ? JSON.stringify(doctorBrief) : null,
    status,
    now,
    id
  );
  return getVisitById(id);
}

/** Moves a patient between the doctor's waiting queue and the completed list. */
export function updateVisitStatus(
  id: string,
  status: VisitStatus
): VisitRecord | null {
  const db = getDb();
  const result = db
    .prepare("UPDATE visits SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, new Date().toISOString(), id);
  return result.changes > 0 ? getVisitById(id) : null;
}

interface RawPrescriptionRow {
  id: string;
  visit_id: string | null;
  patient_name: string;
  doctor_name: string;
  clinic_name: string;
  source_type: "scan" | "manual" | "demo";
  image_name: string | null;
  medications_json: string;
  calendar_sync_status: "unsynced" | "needs_days_confirmation" | "synced";
  last_synced_at: string | null;
  created_at: string;
}

function mapPrescriptionRow(row: RawPrescriptionRow): PrescriptionRecord {
  return {
    id: row.id,
    visitId: row.visit_id,
    patientName: row.patient_name,
    doctorName: row.doctor_name,
    clinicName: row.clinic_name,
    sourceType: row.source_type,
    imageName: row.image_name,
    medications: JSON.parse(
      row.medications_json || "[]"
    ) as ExtractedMedication[],
    calendarSyncStatus: row.calendar_sync_status,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}

export function listPrescriptions(): PrescriptionRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM prescriptions ORDER BY created_at DESC")
    .all() as RawPrescriptionRow[];
  return rows.map(mapPrescriptionRow);
}

export function getPrescriptionById(id: string): PrescriptionRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM prescriptions WHERE id = ?")
    .get(id) as RawPrescriptionRow | undefined;
  return row ? mapPrescriptionRow(row) : null;
}

export function savePrescription(params: {
  id?: string;
  visitId?: string | null;
  patientName: string;
  doctorName?: string;
  clinicName?: string;
  sourceType?: "scan" | "manual" | "demo";
  imageName?: string | null;
  medications: ExtractedMedication[];
}): PrescriptionRecord {
  const db = getDb();
  const now = new Date().toISOString();
  const id = params.id || `rx-${Date.now()}`;
  const hasMissingDays = params.medications.some(
    (m) => m.daysOfDosage === null || m.daysOfDosage <= 0
  );
  const syncStatus = hasMissingDays ? "needs_days_confirmation" : "unsynced";

  db.prepare(`
    INSERT OR REPLACE INTO prescriptions (
      id, visit_id, patient_name, doctor_name, clinic_name,
      source_type, image_name, medications_json, calendar_sync_status,
      last_synced_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.visitId || null,
    params.patientName,
    params.doctorName || "Dr. Arvind Kulkarni",
    params.clinicName || "SevaSetu Community Polyclinic",
    params.sourceType || "scan",
    params.imageName || null,
    JSON.stringify(params.medications),
    syncStatus,
    null,
    now
  );

  return getPrescriptionById(id)!;
}

/**
 * Replaces a prescription's medicines (e.g. after the patient confirms dosage
 * days or edits a row). Any change invalidates a previous calendar sync.
 */
export function updatePrescriptionMedications(
  id: string,
  medications: ExtractedMedication[]
): PrescriptionRecord | null {
  const db = getDb();
  const hasMissingDays = medications.some(
    (m) => m.daysOfDosage === null || m.daysOfDosage <= 0
  );
  const result = db
    .prepare(
      `UPDATE prescriptions
       SET medications_json = ?,
           calendar_sync_status = ?,
           last_synced_at = NULL
       WHERE id = ?`
    )
    .run(
      JSON.stringify(medications),
      hasMissingDays ? "needs_days_confirmation" : "unsynced",
      id
    );
  return result.changes > 0 ? getPrescriptionById(id) : null;
}

export function listCalendarEvents(
  status?: "active" | "removed_by_new_rx"
): CalendarEventRecord[] {
  const db = getDb();
  const query = status
    ? "SELECT * FROM calendar_events WHERE status = ? ORDER BY scheduled_date ASC, scheduled_time ASC"
    : "SELECT * FROM calendar_events ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, scheduled_date ASC, scheduled_time ASC";

  const rows = (
    status ? db.prepare(query).all(status) : db.prepare(query).all()
  ) as Array<{
    id: string;
    prescription_id: string;
    google_event_id: string;
    medicine_name: string;
    dosage: string;
    what_is_it_used_for_en: string;
    what_is_it_used_for_hi: string;
    food_relation: CalendarEventRecord["foodRelation"];
    scheduled_date: string;
    scheduled_time: string;
    app_tag: "sevasetu-rx";
    status: "active" | "removed_by_new_rx";
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    prescriptionId: row.prescription_id,
    googleEventId: row.google_event_id,
    medicineName: row.medicine_name,
    dosage: row.dosage,
    whatIsItUsedForEn: row.what_is_it_used_for_en,
    whatIsItUsedForHi: row.what_is_it_used_for_hi,
    foodRelation: row.food_relation,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    appTag: row.app_tag,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export function replaceActiveCalendarEvents(
  prescriptionId: string,
  newEvents: Array<
    Omit<CalendarEventRecord, "id" | "appTag" | "status" | "createdAt">
  >
): { removedCount: number; insertedCount: number } {
  const db = getDb();
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
    const deactivateResult = db
      .prepare(
        `UPDATE calendar_events
         SET status = 'removed_by_new_rx'
         WHERE status = 'active' AND app_tag = 'sevasetu-rx'`
      )
      .run();

    const insertStmt = db.prepare(`
      INSERT INTO calendar_events (
        id, prescription_id, google_event_id, medicine_name, dosage,
        what_is_it_used_for_en, what_is_it_used_for_hi, food_relation,
        scheduled_date, scheduled_time, app_tag, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sevasetu-rx', 'active', ?)
    `);

    for (let i = 0; i < newEvents.length; i++) {
      const ev = newEvents[i];
      insertStmt.run(
        `cal-${Date.now()}-${i}`,
        prescriptionId,
        ev.googleEventId,
        ev.medicineName,
        ev.dosage,
        ev.whatIsItUsedForEn,
        ev.whatIsItUsedForHi,
        ev.foodRelation,
        ev.scheduledDate,
        ev.scheduledTime,
        now
      );
    }

    db.prepare(
      `UPDATE prescriptions
       SET calendar_sync_status = 'unsynced'
       WHERE id != ? AND calendar_sync_status = 'synced'`
    ).run(prescriptionId);

    db.prepare(
      `UPDATE prescriptions
       SET calendar_sync_status = 'synced',
           last_synced_at = ?
       WHERE id = ?`
    ).run(now, prescriptionId);

    return {
      removedCount: deactivateResult.changes,
      insertedCount: newEvents.length,
    };
  });

  return transaction();
}

export interface DatabaseDiagnostics {
  dbFilePath: string;
  fileExists: boolean;
  fileSizeBytes: number;
  journalMode: string;
  tables: {
    visits: number;
    prescriptions: number;
    calendarEventsActive: number;
    calendarEventsRemoved: number;
  };
}

export function getDatabaseDiagnostics(): DatabaseDiagnostics {
  const db = getDb();
  const dbPath = getDbPath();
  const exists = fs.existsSync(dbPath);
  const stats = exists ? fs.statSync(dbPath) : null;

  const visitsCount = (
    db.prepare("SELECT COUNT(*) as count FROM visits").get() as {
      count: number;
    }
  ).count;
  const prescriptionsCount = (
    db.prepare("SELECT COUNT(*) as count FROM prescriptions").get() as {
      count: number;
    }
  ).count;
  const activeEventsCount = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM calendar_events WHERE status = 'active'"
      )
      .get() as { count: number }
  ).count;
  const removedEventsCount = (
    db
      .prepare(
        "SELECT COUNT(*) as count FROM calendar_events WHERE status = 'removed_by_new_rx'"
      )
      .get() as { count: number }
  ).count;
  const journalMode = (
    db.pragma("journal_mode") as Array<{ journal_mode: string }>
  )[0]?.journal_mode || "wal";

  return {
    dbFilePath: dbPath,
    fileExists: exists,
    fileSizeBytes: stats ? stats.size : 0,
    journalMode: journalMode.toUpperCase(),
    tables: {
      visits: visitsCount,
      prescriptions: prescriptionsCount,
      calendarEventsActive: activeEventsCount,
      calendarEventsRemoved: removedEventsCount,
    },
  };
}
