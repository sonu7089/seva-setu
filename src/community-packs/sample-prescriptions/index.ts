/**
 * Community Pack: Sample Prescriptions for instant demos.
 *
 * Source of truth lives in `./samples.json` so Hacktoberfest contributors can
 * add anonymized prescriptions without touching TypeScript — see
 * CONTRIBUTING.md ("Sample prescriptions"). The images live in
 * `public/samples/` and `medications` is the offline fallback used when no
 * Gemma provider is reachable, so the demo still works end to end.
 */
import data from "./samples.json";
import type { FoodRelation } from "@/types/sevasetu";

export interface SamplePrescription {
  id: string;
  label: string;
  description: string;
  imagePath: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  medications: Array<{
    name: string;
    dosage: string;
    frequencyCode: string;
    foodRelation: FoodRelation;
    daysOfDosage: number | null;
  }>;
}

export const SAMPLE_PRESCRIPTIONS: SamplePrescription[] =
  data.samples as SamplePrescription[];

export function getSamplePrescription(
  id: string | undefined | null
): SamplePrescription | null {
  if (!id) return null;
  return SAMPLE_PRESCRIPTIONS.find((s) => s.id === id) ?? null;
}
