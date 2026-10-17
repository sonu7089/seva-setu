/**
 * Community Pack: Common Intake Complaint templates (Hindi + English).
 *
 * Source of truth lives in `./common-complaints.json` so Hacktoberfest
 * contributors can add a complaint without touching TypeScript — see
 * CONTRIBUTING.md ("Intake complaint templates").
 */
import data from "./common-complaints.json";
import type {
  BayVitals,
  IntakeLanguage,
  TextFollowUpQuestion,
} from "@/types/sevasetu";

export interface IntakeComplaintFollowUp {
  id: string;
  questionEn: string;
  questionHi: string;
  quickOptionsEn: string[];
  quickOptionsHi: string[];
}

export interface IntakeComplaint {
  id: string;
  labelEn: string;
  labelHi: string;
  sample: {
    name: string;
    age: string;
    gender: string;
    vitals: BayVitals;
    textEn: string;
    textHi: string;
  };
  followUps: IntakeComplaintFollowUp[];
}

export interface IntakeSampleScenario {
  label: string;
  lang: Extract<IntakeLanguage, "hi" | "en">;
  name: string;
  age: string;
  gender: string;
  vitals: BayVitals;
  text: string;
}

export const COMMON_COMPLAINTS: IntakeComplaint[] =
  data.complaints as IntakeComplaint[];

export const COMPLAINT_IDS: string[] = COMMON_COMPLAINTS.map((c) => c.id);

/** Preferred demo language per complaint (keeps the sample-chip row at 6 taps). */
const PREFERRED_DEMO_LANG: Record<string, "hi" | "en"> = {
  fever: "hi",
  "cough-cold": "en",
  "acidity-stomach-pain": "en",
  headache: "hi",
  "joint-pain": "hi",
  "skin-rash": "en",
};

/** One-tap sample scenarios for the Pre-Visit Bay, derived from the pack. */
export const SAMPLE_SCENARIOS: IntakeSampleScenario[] = COMMON_COMPLAINTS.map(
  (complaint) => {
    const lang = PREFERRED_DEMO_LANG[complaint.id] ?? "hi";
    return {
      label: lang === "hi" ? complaint.labelHi : complaint.labelEn,
      lang,
      name: complaint.sample.name,
      age: complaint.sample.age,
      gender: complaint.sample.gender,
      vitals: complaint.sample.vitals,
      text: lang === "hi" ? complaint.sample.textHi : complaint.sample.textEn,
    };
  }
);

export function getComplaint(id: string | undefined | null): IntakeComplaint | null {
  if (!id) return null;
  return COMMON_COMPLAINTS.find((c) => c.id === id) ?? null;
}

/** Follow-up questions for a complaint, shaped for the intake Q&A flow. */
export function followUpsForComplaint(
  id: string | undefined | null
): TextFollowUpQuestion[] {
  const complaint = getComplaint(id);
  if (!complaint) return [];
  return complaint.followUps.map((q) => ({
    id: q.id,
    questionEn: q.questionEn,
    questionHi: q.questionHi,
    quickOptionsEn: q.quickOptionsEn,
    quickOptionsHi: q.quickOptionsHi,
  }));
}
