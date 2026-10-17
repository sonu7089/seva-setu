import type { BayVitals } from "@/types/sevasetu";

export type IntakeField = "age" | "bp" | "temp" | "pulse" | "spo2";
export type IntakeErrors = Partial<Record<IntakeField, string>>;

const BP_PATTERN = /^(\d{2,3})\s*\/\s*(\d{2,3})$/;

export function validateAge(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return "Enter the patient's age.";
  if (!/^\d{1,3}$/.test(value)) return "Age must be a whole number.";
  const age = Number(value);
  if (age > 120) return "Age must be between 0 and 120.";
  return undefined;
}

/** Expects `systolic/diastolic`, e.g. `120/80`. Blank is allowed (vitals are optional). */
export function validateBp(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;
  const match = value.match(BP_PATTERN);
  if (!match) return "Use the format 120/80.";
  const systolic = Number(match[1]);
  const diastolic = Number(match[2]);
  if (systolic < 60 || systolic > 260) return "Systolic must be 60–260.";
  if (diastolic < 30 || diastolic > 160) return "Diastolic must be 30–160.";
  if (systolic <= diastolic) return "Systolic must be higher than diastolic.";
  return undefined;
}

/** Temperature in °F, 90–110. A trailing `°F`/`F` is tolerated. */
export function validateTemp(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim().replace(/\s*°?\s*f$/i, "");
  if (!value) return undefined;
  if (!/^\d{2,3}(\.\d)?$/.test(value)) return "Enter a number like 98.6.";
  const temp = Number(value);
  if (temp >= 34 && temp <= 43) return "Enter °F (90–110), not °C.";
  if (temp < 90 || temp > 110) return "Temperature must be 90–110 °F.";
  return undefined;
}

export function validatePulse(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;
  if (!/^\d{2,3}$/.test(value)) return "Enter a whole number like 80.";
  const pulse = Number(value);
  if (pulse < 30 || pulse > 220) return "Pulse must be 30–220 bpm.";
  return undefined;
}

export function validateSpo2(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim().replace(/\s*%$/, "");
  if (!value) return undefined;
  if (!/^\d{1,3}(\.\d)?$/.test(value)) return "Enter a number like 98.";
  const spo2 = Number(value);
  if (spo2 < 0 || spo2 > 100) return "SpO₂ must be 0–100%.";
  return undefined;
}

/** Validates the Pre-Visit Bay numeric fields. Vitals are only checked when `includeVitals` is set. */
export function validateIntake({
  age,
  vitals,
  includeVitals,
}: {
  age: string | undefined;
  vitals?: BayVitals;
  includeVitals: boolean;
}): IntakeErrors {
  const errors: IntakeErrors = {};
  const ageError = validateAge(age);
  if (ageError) errors.age = ageError;

  if (includeVitals) {
    const bp = validateBp(vitals?.bp);
    const temp = validateTemp(vitals?.temp);
    const pulse = validatePulse(vitals?.pulse);
    const spo2 = validateSpo2(vitals?.spo2);
    if (bp) errors.bp = bp;
    if (temp) errors.temp = temp;
    if (pulse) errors.pulse = pulse;
    if (spo2) errors.spo2 = spo2;
  }
  return errors;
}

export function firstIntakeError(errors: IntakeErrors): string | undefined {
  return Object.values(errors).find(Boolean);
}
