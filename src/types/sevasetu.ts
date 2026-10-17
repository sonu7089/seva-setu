export type EntryByRole = "patient" | "nurse_bay";
export type InputModality = "voice" | "text";
export type IntakeLanguage = "hi" | "en" | "hinglish";
export type TriagePriority = "Routine" | "Priority" | "Urgent";
export type VisitStatus = "intake_pending" | "ready_for_doctor" | "completed";
export type WorkspaceTab = "previsit" | "doctor" | "postvisit";

export interface BayVitals {
  bp?: string;
  temp?: string;
  pulse?: string;
  spo2?: string;
  weight?: string;
}

export interface PreVisitInput {
  entryBy: EntryByRole;
  inputMode: InputModality;
  language: IntakeLanguage;
  rawTranscript: string;
  patientInfo: {
    name?: string;
    age: string;
    gender: string;
    vitals?: BayVitals;
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
  chiefComplaintHi?: string;
  symptomTimeline: string[];
  followUpSummary: Array<{
    question: string;
    answer: string;
  }>;
  vitalsSummary?: string;
  triagePriority: TriagePriority;
  clinicalNotes?: string[];
  timeSavedNote: string;
}

export interface VisitRecord {
  id: string;
  tokenNumber: string;
  patientName: string;
  age: string;
  gender: string;
  entryBy: EntryByRole;
  inputMode: InputModality;
  language: IntakeLanguage;
  vitals: BayVitals;
  rawTranscript: string;
  followUpQuestions: TextFollowUpQuestion[];
  doctorBrief: DoctorIntakeBrief | null;
  status: VisitStatus;
  createdAt: string;
  updatedAt: string;
}

export type FoodRelation =
  | "before_food"
  | "after_food"
  | "with_food"
  | "anytime";

export interface ExtractedMedication {
  id: string;
  name: string;
  dosage: string;
  frequencyCode: string; // e.g. "BD", "TDS", "OD", "HS", "SOS"
  frequencyPlain: string; // e.g. "Twice daily (Morning & Night)"
  foodRelation: FoodRelation;
  whatIsItUsedForEn: string;
  whatIsItUsedForHi: string;
  precautionNote: string;
  daysOfDosage: number | null; // null if unclear on Rx -> triggers manual UI prompt
  isDaysConfirmed: boolean;
  recommendedTimes: string[]; // e.g. ["09:00", "21:30"]
}

export interface PrescriptionRecord {
  id: string;
  visitId: string | null;
  patientName: string;
  doctorName: string;
  clinicName: string;
  sourceType: "scan" | "manual" | "demo";
  imageName: string | null;
  medications: ExtractedMedication[];
  calendarSyncStatus: "unsynced" | "needs_days_confirmation" | "synced";
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface CalendarEventRecord {
  id: string;
  prescriptionId: string;
  googleEventId: string;
  medicineName: string;
  dosage: string;
  whatIsItUsedForEn: string;
  whatIsItUsedForHi: string;
  foodRelation: FoodRelation;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  appTag: "sevasetu-rx";
  status: "active" | "removed_by_new_rx";
  createdAt: string;
}

export interface CalendarSyncPayload {
  prescriptionId?: string;
  replacePreviousPrescription: boolean;
  patientTimezone: string;
  startDate: string; // YYYY-MM-DD
  medications: ExtractedMedication[];
}

export type GemmaProviderMode =
  | "google_ai_studio"
  | "ollama_local"
  | "demo_fallback";

export interface GemmaProviderStatus {
  activeProvider: GemmaProviderMode;
  modelName: string;
  googleApiKeyConfigured: boolean;
  ollamaEndpointConfigured: boolean;
  ollamaBaseUrl: string | null;
  visionSupported: boolean;
  bilingualSupported: boolean;
  fallbackReady: boolean;
}
