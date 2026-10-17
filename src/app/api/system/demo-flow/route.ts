import { NextResponse } from "next/server";
import {
  followUpsForComplaint,
  getComplaint,
} from "@/community-packs/intake-templates";
import { lookupMedicinePurpose } from "@/community-packs/medicine-knowledge";
import { createVisit, getDb, savePrescription } from "@/lib/db";
import type {
  DoctorIntakeBrief,
  ExtractedMedication,
  FoodRelation,
} from "@/types/sevasetu";

export const dynamic = "force-dynamic";

/**
 * Phase 5 — one-click "Load Live Demo Flow".
 *
 * Creates a fresh, timestamped copy of the 60-second golden path so a
 * presenter can always start clean, even after the pre-seeded data has
 * already been consumed:
 *
 *   Hindi bay intake (voice) → answered text follow-ups → 15-second Doctor
 *   SOAP brief → prescription with one missing-dosage-days medicine (shows the
 *   amber prompt) → 2 stale "previous Rx" calendar events waiting to be
 *   auto-replaced on the next calendar sync.
 *
 * Works fully offline: no Gemma API key required.
 */

const DEMO_ANSWERS: Record<string, string> = {
  "fq-fever-1": "3–5 days with evening spikes (3–5 दिन, शाम को ज़्यादा)",
  "fq-fever-2": "Yes, evening chills & body ache (हाँ, शाम को ठंड और बदन दर्द)",
  "fq-fever-3": "Paracetamol 500mg yesterday — fever returned after 4 hours",
  "fq-fever-4": "No known drug allergies; no chronic illness",
};

function purposeFor(name: string): {
  en: string;
  hi: string;
  precaution: string;
} {
  const entry = lookupMedicinePurpose(name);
  return {
    en:
      entry?.en ??
      "Purpose not listed yet — please ask your doctor or pharmacist what this medicine is for.",
    hi:
      entry?.hi ??
      "इस दवा का उपयोग अभी उपलब्ध नहीं है — कृपया अपने डॉक्टर या फार्मासिस्ट से पूछें।",
    precaution: entry?.precaution ?? "Take exactly as written on the prescription.",
  };
}

function buildMedication(params: {
  id: string;
  name: string;
  dosage: string;
  frequencyCode: "OD" | "BD" | "TDS";
  frequencyPlain: string;
  foodRelation: FoodRelation;
  daysOfDosage: number | null;
  recommendedTimes: string[];
}): ExtractedMedication {
  const purpose = purposeFor(params.name);
  return {
    ...params,
    whatIsItUsedForEn: purpose.en,
    whatIsItUsedForHi: purpose.hi,
    precautionNote: purpose.precaution,
    isDaysConfirmed: params.daysOfDosage !== null && params.daysOfDosage > 0,
  };
}

export async function POST() {
  try {
    const complaint = getComplaint("fever");
    const stamp = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const patientName = `Live Demo — Meera Devi (मीरा देवी) · ${stamp}`;

    // Step 1–2: Hindi voice intake + answered text follow-ups.
    const followUps = followUpsForComplaint("fever").map((q) => ({
      ...q,
      answer: DEMO_ANSWERS[q.id] ?? "Answered at demo bay",
    }));

    // Step 3: 15-second Doctor decision-support brief.
    const brief: DoctorIntakeBrief = {
      chiefComplaint:
        "High-grade intermittent fever and dry cough for 3 days, worsening at night.",
      chiefComplaintHi:
        "3 दिन से तेज़ बुखार और सूखी खांसी, रात में अधिक तकलीफ़।",
      symptomTimeline: [
        "Day 1–3: Evening spikes of fever (recorded 101.2°F at triage bay) with chills and body ache.",
        "Dry, non-productive cough worse on lying down at night; no breathing difficulty.",
        "Self-medicated with Tab Paracetamol 500mg once; fever recurred after 4 hours.",
      ],
      followUpSummary: followUps.slice(0, 3).map((q) => ({
        question: q.questionEn,
        answer: q.answer ?? "",
      })),
      vitalsSummary: "BP 122/80 mmHg · Temp 101.2°F · Pulse 94 bpm · SpO2 98%",
      triagePriority: "Priority",
      clinicalNotes: [
        `Routine history completed at Nurse Bay in Hindi (Voice) for the live demo${complaint ? ` using the "${complaint.labelEn}" community template` : ""}.`,
        "Examine throat/chest auscultation directly; consider viral febrile panel if persistent >4 days.",
      ],
      timeSavedNote: "3.5 mins of routine history captured prior to consultation",
    };

    const visit = createVisit({
      patientName,
      age: "34",
      gender: "Female",
      entryBy: "nurse_bay",
      inputMode: "voice",
      language: "hi",
      vitals: { bp: "122/80", temp: "101.2", pulse: "94", spo2: "98" },
      rawTranscript:
        "मरीज़ को तीन दिन से तेज़ बुखार और सूखी खांसी है, शाम को ठंड लगती है और रात में खांसी बढ़ जाती है।",
      followUpQuestions: followUps,
      doctorBrief: brief,
      status: "ready_for_doctor",
    });

    // Step 4: prescription scan result with ONE missing-dosage-days medicine,
    // so the amber "Dosage Days Required" prompt is showing on load.
    const prescription = savePrescription({
      visitId: visit.id,
      patientName,
      doctorName: "Dr. Arvind Kulkarni (MD, Internal Medicine)",
      clinicName: "SevaSetu Community Polyclinic",
      sourceType: "demo",
      imageName: null,
      medications: [
        buildMedication({
          id: `livedemo-med-paracetamol-${Date.now()}`,
          name: "Tab Paracetamol",
          dosage: "650 mg",
          frequencyCode: "TDS",
          frequencyPlain: "Three times daily (Morning, Afternoon, Night)",
          foodRelation: "after_food",
          daysOfDosage: 3,
          recommendedTimes: ["09:00", "14:00", "21:30"],
        }),
        buildMedication({
          id: `livedemo-med-azithromycin-${Date.now()}`,
          name: "Tab Azithromycin",
          dosage: "500 mg",
          frequencyCode: "OD",
          frequencyPlain: "Once daily (After Dinner)",
          foodRelation: "after_food",
          daysOfDosage: 3,
          recommendedTimes: ["21:30"],
        }),
        buildMedication({
          id: `livedemo-med-cough-${Date.now()}`,
          name: "Syp Dextromethorphan + CPM",
          dosage: "10 ml",
          frequencyCode: "BD",
          frequencyPlain: "Twice daily (Morning & Bedtime)",
          foodRelation: "after_food",
          daysOfDosage: null, // Intentionally missing: triggers the days prompt.
          recommendedTimes: ["09:00", "21:30"],
        }),
      ],
    });

    // Step 5 (setup): 2 stale "previous Rx" events, so the next calendar sync
    // visibly removes old reminders before inserting the new schedule.
    const db = getDb();
    const todayStr = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const insertEvent = db.prepare(`
      INSERT INTO calendar_events (
        id, prescription_id, google_event_id, medicine_name, dosage,
        what_is_it_used_for_en, what_is_it_used_for_hi, food_relation,
        scheduled_date, scheduled_time, app_tag, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sevasetu-rx', 'active', ?)
    `);
    const runId = Date.now();
    const staleEvents = [
      {
        name: "Tab Cetirizine (Previous Rx)",
        dosage: "10 mg",
        en: "Relieves seasonal runny nose and sneezing.",
        hi: "जुकाम और छींक से राहत के लिए।",
        time: "21:30",
      },
      {
        name: "Cap Amoxicillin (Previous Rx)",
        dosage: "500 mg",
        en: "Antibiotic course from the earlier clinic visit.",
        hi: "पिछली विज़िट का एंटीबायोटिक कोर्स।",
        time: "09:00",
      },
    ];
    for (let i = 0; i < staleEvents.length; i++) {
      const ev = staleEvents[i];
      insertEvent.run(
        `cal-livedemo-prev-${runId}-${i}`,
        prescription.id,
        `gcal_livedemo_prev_${runId}_${i}`,
        ev.name,
        ev.dosage,
        ev.en,
        ev.hi,
        "after_food",
        todayStr,
        ev.time,
        nowIso
      );
    }

    return NextResponse.json({
      ok: true,
      visit,
      prescription,
      staleEventsSeeded: staleEvents.length,
      steps: [
        "Hindi bay intake saved with vitals + transcript",
        "Text follow-ups answered; Doctor SOAP brief ready",
        "Prescription loaded with 1 missing-dosage-days prompt",
        "2 stale previous-Rx events staged for auto-replacement",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not load the demo flow",
      },
      { status: 500 }
    );
  }
}
