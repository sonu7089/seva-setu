import type { FoodRelation } from "@/types/sevasetu";

/**
 * Pre-loaded sample prescriptions for instant demos. The images live in
 * `public/samples/` and are rasterised in the browser before being sent to the
 * vision parser. `medications` is the offline fallback used when no Gemma
 * provider is reachable, so the demo still works end to end.
 */
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

export const SAMPLE_PRESCRIPTIONS: SamplePrescription[] = [
  {
    id: "rx-sample-fever",
    label: "Fever & cough",
    description: "One medicine has no days written — triggers the days prompt.",
    imagePath: "/samples/rx-fever-cough.svg",
    patientName: "Sunita Devi",
    doctorName: "Dr. Arvind Kulkarni (MD, Internal Medicine)",
    clinicName: "SevaSetu Community Polyclinic",
    medications: [
      {
        name: "Tab Paracetamol",
        dosage: "650 mg",
        frequencyCode: "TDS",
        foodRelation: "after_food",
        daysOfDosage: 3,
      },
      {
        name: "Tab Azithromycin",
        dosage: "500 mg",
        frequencyCode: "OD",
        foodRelation: "after_food",
        daysOfDosage: 3,
      },
      {
        name: "Syp Dextromethorphan + CPM",
        dosage: "10 ml",
        frequencyCode: "BD",
        foodRelation: "after_food",
        daysOfDosage: null,
      },
    ],
  },
  {
    id: "rx-sample-acidity",
    label: "Acidity & reflux",
    description: "Every medicine has its duration written.",
    imagePath: "/samples/rx-acidity.svg",
    patientName: "Vikram Nair",
    doctorName: "Dr. Meera Iyer (MBBS, MD)",
    clinicName: "SevaSetu Community Polyclinic",
    medications: [
      {
        name: "Tab Pantoprazole",
        dosage: "40 mg",
        frequencyCode: "OD",
        foodRelation: "before_food",
        daysOfDosage: 14,
      },
      {
        name: "Tab Domperidone",
        dosage: "10 mg",
        frequencyCode: "BD",
        foodRelation: "before_food",
        daysOfDosage: 5,
      },
      {
        name: "Syp Antacid Gel",
        dosage: "10 ml",
        frequencyCode: "TDS",
        foodRelation: "after_food",
        daysOfDosage: 5,
      },
    ],
  },
];

export function getSamplePrescription(
  id: string | undefined | null
): SamplePrescription | null {
  if (!id) return null;
  return SAMPLE_PRESCRIPTIONS.find((s) => s.id === id) ?? null;
}
