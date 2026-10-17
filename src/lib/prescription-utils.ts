import type { ExtractedMedication, FoodRelation } from "@/types/sevasetu";
import {
  lookupMedicinePurpose,
  PURPOSE_UNKNOWN_EN,
  PURPOSE_UNKNOWN_HI,
} from "@/lib/medicine-purposes";

/**
 * Pure helpers shared by the server (parsing / persistence) and the client
 * (manual entry form + medicine cards). Keep this file free of Node imports.
 */

export const FREQUENCY_OPTIONS = [
  { code: "OD", label: "OD · once daily", plain: "Once daily" },
  { code: "BD", label: "BD · twice daily", plain: "Twice daily" },
  { code: "TDS", label: "TDS · three times daily", plain: "Three times daily" },
  { code: "QID", label: "QID · four times daily", plain: "Four times daily" },
  { code: "HS", label: "HS · at bedtime", plain: "At bedtime" },
  { code: "SOS", label: "SOS · only when needed", plain: "Only when needed" },
] as const;

export const FOOD_RELATION_OPTIONS: Array<{
  value: FoodRelation;
  label: string;
  labelHi: string;
}> = [
  { value: "before_food", label: "Before food", labelHi: "खाने से पहले" },
  { value: "after_food", label: "After food", labelHi: "खाने के बाद" },
  { value: "with_food", label: "With food", labelHi: "खाने के साथ" },
  { value: "anytime", label: "Any time", labelHi: "किसी भी समय" },
];

export const MAX_DOSAGE_DAYS = 365;
export const MAX_MEDICATIONS = 20;

const FOOD_RELATIONS = FOOD_RELATION_OPTIONS.map((o) => o.value);

export function foodRelationLabel(value: FoodRelation): string {
  return FOOD_RELATION_OPTIONS.find((o) => o.value === value)?.label ?? "Any time";
}

export function foodRelationLabelHi(value: FoodRelation): string {
  return (
    FOOD_RELATION_OPTIONS.find((o) => o.value === value)?.labelHi ??
    "किसी भी समय"
  );
}

/** Maps Rx shorthand variants (`BID`, `1-0-1`, `once daily`…) onto a known code. */
export function normalizeFrequencyCode(raw: unknown): string {
  const value = String(raw ?? "")
    .toUpperCase()
    .replace(/[.\s]/g, "");
  if (FREQUENCY_OPTIONS.some((o) => o.code === value)) return value;

  const aliases: Record<string, string> = {
    QD: "OD",
    "1-0-0": "OD",
    "0-1-0": "OD",
    "0-0-1": "HS",
    BID: "BD",
    "1-0-1": "BD",
    "1-1-0": "BD",
    "0-1-1": "BD",
    TID: "TDS",
    "1-1-1": "TDS",
    QDS: "QID",
    "1-1-1-1": "QID",
    HSLEEP: "HS",
    BEDTIME: "HS",
    PRN: "SOS",
    ONCEDAILY: "OD",
    ONCEADAY: "OD",
    TWICEDAILY: "BD",
    TWICEADAY: "BD",
    THRICEDAILY: "TDS",
    THREETIMESDAILY: "TDS",
  };
  return aliases[value] ?? "OD";
}

export function defaultTimes(code: string, food: FoodRelation): string[] {
  const before = food === "before_food";
  switch (code) {
    case "OD":
      return [before ? "07:30" : "09:00"];
    case "BD":
      return [before ? "07:30" : "09:00", before ? "20:30" : "21:00"];
    case "TDS":
      return before
        ? ["07:30", "13:30", "20:30"]
        : ["09:00", "14:00", "21:00"];
    case "QID":
      return ["08:00", "13:00", "18:00", "22:00"];
    case "HS":
      return ["22:00"];
    default:
      return []; // SOS: no fixed schedule
  }
}

export function frequencyPlain(code: string): string {
  return FREQUENCY_OPTIONS.find((o) => o.code === code)?.plain ?? "Once daily";
}

/** Accepts `5`, `"5"`, `"5 days"`. Anything missing/zero/absurd becomes `null` (→ ask the patient). */
export function parseDays(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const num =
    typeof raw === "number"
      ? raw
      : Number(String(raw).match(/\d+/)?.[0] ?? Number.NaN);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
  if (num < 1 || num > MAX_DOSAGE_DAYS) return null;
  return num;
}

const asText = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.trim() ? v.trim() : fallback;

const isTime = (v: unknown): v is string =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function isPurposeUnknown(med: ExtractedMedication): boolean {
  return med.whatIsItUsedForEn === PURPOSE_UNKNOWN_EN;
}

/**
 * Turns untrusted model / form output into well-formed medications:
 * fills defaults, validates enums, and guarantees `daysOfDosage` is either a
 * sane positive integer or `null` (which triggers the "Dosage Days Required" prompt).
 */
export function normalizeMedications(raw: unknown): ExtractedMedication[] {
  if (!Array.isArray(raw)) return [];

  const meds: ExtractedMedication[] = [];
  for (const item of raw.slice(0, MAX_MEDICATIONS)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = asText(r.name);
    if (!name) continue;

    const frequencyCode = normalizeFrequencyCode(r.frequencyCode);
    const foodRelation = FOOD_RELATIONS.includes(r.foodRelation as FoodRelation)
      ? (r.foodRelation as FoodRelation)
      : "after_food";
    const known = lookupMedicinePurpose(name);
    const daysOfDosage = parseDays(r.daysOfDosage);
    const times = Array.isArray(r.recommendedTimes)
      ? r.recommendedTimes.filter(isTime)
      : [];

    meds.push({
      id: `med-${meds.length + 1}`,
      name,
      dosage: asText(r.dosage),
      frequencyCode,
      frequencyPlain: asText(r.frequencyPlain, frequencyPlain(frequencyCode)),
      foodRelation,
      whatIsItUsedForEn: asText(
        r.whatIsItUsedForEn,
        known?.en ?? PURPOSE_UNKNOWN_EN
      ),
      whatIsItUsedForHi: asText(
        r.whatIsItUsedForHi,
        known?.hi ?? PURPOSE_UNKNOWN_HI
      ),
      precautionNote: asText(r.precautionNote, known?.precaution ?? ""),
      daysOfDosage,
      isDaysConfirmed: daysOfDosage !== null,
      recommendedTimes:
        times.length > 0 ? times : defaultTimes(frequencyCode, foodRelation),
    });
  }
  return meds;
}

export function countMissingDays(meds: ExtractedMedication[]): number {
  return meds.filter((m) => m.daysOfDosage === null).length;
}
