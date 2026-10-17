import {
  foodRelationLabel,
  foodRelationLabelHi,
} from "@/lib/prescription-utils";
import type {
  CalendarEventRecord,
  ExtractedMedication,
  FoodRelation,
  PrescriptionRecord,
} from "@/types/sevasetu";

/**
 * Pure calendar scheduling, time-slot formatting, and RFC 5545 (.ics) helpers
 * shared between the API route and the client simulator.
 */

export interface MealSlotInfo {
  labelEn: string;
  labelHi: string;
}

/** Formats `"07:30"` -> `"7:30 AM"`, `"14:00"` -> `"2:00 PM"`. */
export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Maps a 24h time + food relation to a clinical meal-aligned slot label. */
export function getMealSlotInfo(
  hhmm: string,
  foodRelation: FoodRelation
): MealSlotInfo {
  const [h, m] = hhmm.split(":").map(Number);
  const totalMinutes = (Number.isNaN(h) ? 9 : h) * 60 + (Number.isNaN(m) ? 0 : m);

  if (totalMinutes < 11 * 60 + 30) {
    if (foodRelation === "before_food") {
      return { labelEn: "Before breakfast", labelHi: "नाश्ते से पहले" };
    }
    if (foodRelation === "after_food" || foodRelation === "with_food") {
      return { labelEn: "After breakfast", labelHi: "नाश्ते के बाद" };
    }
    return { labelEn: "Morning dose", labelHi: "सुबह की खुराक" };
  }

  if (totalMinutes < 16 * 60 + 30) {
    if (foodRelation === "before_food") {
      return { labelEn: "Before lunch", labelHi: "दोपहर के खाने से पहले" };
    }
    if (foodRelation === "after_food" || foodRelation === "with_food") {
      return { labelEn: "After lunch", labelHi: "दोपहर के खाने के बाद" };
    }
    return { labelEn: "Afternoon dose", labelHi: "दोपहर की खुराक" };
  }

  if (totalMinutes < 19 * 60 + 30) {
    return { labelEn: "Evening dose", labelHi: "शाम की खुराक" };
  }

  if (totalMinutes < 21 * 60 + 45) {
    if (foodRelation === "before_food") {
      return { labelEn: "Before dinner", labelHi: "रात के खाने से पहले" };
    }
    if (foodRelation === "after_food" || foodRelation === "with_food") {
      return { labelEn: "After dinner", labelHi: "रात के खाने के बाद" };
    }
    return { labelEn: "Night dose", labelHi: "रात की खुराक" };
  }

  return { labelEn: "At bedtime", labelHi: "सोते समय" };
}

/** Returns today's date in `YYYY-MM-DD` local format. */
export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Adds `days` to a `YYYY-MM-DD` date string without timezone drift. */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

/** Formats `YYYY-MM-DD` into short readable parts (e.g. `{ weekday: "Sat", dayNum: "17", monthShort: "Oct", fullLabel: "Sat, 17 Oct" }`). */
export function formatIsoDateParts(isoDate: string): {
  weekday: string;
  dayNum: string;
  monthShort: string;
  fullLabel: string;
} {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) {
    return {
      weekday: "",
      dayNum: isoDate,
      monthShort: "",
      fullLabel: isoDate,
    };
  }
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  }).format(dt);
  const monthShort = new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: "UTC",
  }).format(dt);
  const dayNum = String(d);
  return {
    weekday,
    dayNum,
    monthShort,
    fullLabel: `${weekday}, ${dayNum} ${monthShort}`,
  };
}

export type NewCalendarEventInput = Omit<
  CalendarEventRecord,
  "id" | "appTag" | "status" | "createdAt"
>;

/**
 * Expands a prescription's confirmed medications across their `daysOfDosage`
 * into concrete daily calendar reminder entries starting on `startDate`.
 */
export function expandMedicationsToCalendarEvents(params: {
  prescriptionId: string;
  medications: ExtractedMedication[];
  startDate: string;
  googleEventIdByMedAndTime?: Record<string, string>;
}): NewCalendarEventInput[] {
  const {
    prescriptionId,
    medications,
    startDate,
    googleEventIdByMedAndTime = {},
  } = params;

  const events: NewCalendarEventInput[] = [];

  for (const med of medications) {
    const days = med.daysOfDosage;
    if (days === null || days <= 0) continue;

    // SOS medicines without fixed times get a single morning check-in slot only if no times exist,
    // otherwise use the medication's recommendedTimes.
    const times =
      med.recommendedTimes.length > 0
        ? med.recommendedTimes
        : med.frequencyCode === "SOS"
          ? []
          : ["09:00"];

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const scheduledDate = addDaysToIsoDate(startDate, dayOffset);
      for (const time of times) {
        const key = `${med.id}:${time}`;
        const baseGoogleId =
          googleEventIdByMedAndTime[key] ||
          `gcal_sevasetu_${prescriptionId}_${med.id}_${time.replace(":", "")}`;
        const googleEventId =
          days > 1 ? `${baseGoogleId}_d${dayOffset + 1}` : baseGoogleId;

        events.push({
          prescriptionId,
          googleEventId,
          medicineName: med.name,
          dosage: med.dosage,
          whatIsItUsedForEn: med.whatIsItUsedForEn,
          whatIsItUsedForHi: med.whatIsItUsedForHi,
          foodRelation: med.foodRelation,
          scheduledDate,
          scheduledTime: time,
        });
      }
    }
  }

  events.sort(
    (a, b) =>
      a.scheduledDate.localeCompare(b.scheduledDate) ||
      a.scheduledTime.localeCompare(b.scheduledTime)
  );

  return events;
}

/** Builds the Google Calendar event title for a medicine dose. */
export function buildCalendarEventTitle(
  medicineName: string,
  dosage: string,
  foodRelation: FoodRelation
): string {
  const strength = dosage ? ` (${dosage})` : "";
  return `${medicineName}${strength} · ${foodRelationLabel(foodRelation)}`;
}

/**
 * Builds the plain-language Google Calendar event description containing
 * "What this medicine is used for" in English & Hindi plus meal instructions.
 */
export function buildCalendarEventDescription(params: {
  medicineName: string;
  dosage: string;
  whatIsItUsedForEn: string;
  whatIsItUsedForHi: string;
  foodRelation: FoodRelation;
  precautionNote?: string;
  doctorName?: string;
  clinicName?: string;
  daysOfDosage?: number | null;
}): string {
  const lines: string[] = [
    `What is this medicine used for? (दवा का उपयोग):`,
    params.whatIsItUsedForEn,
    params.whatIsItUsedForHi,
    "",
    `How to take: ${foodRelationLabel(params.foodRelation)} (${foodRelationLabelHi(params.foodRelation)})`,
  ];

  if (params.daysOfDosage) {
    lines.push(`Course duration: ${params.daysOfDosage} ${params.daysOfDosage === 1 ? "day" : "days"}`);
  }
  if (params.precautionNote) {
    lines.push(`Note: ${params.precautionNote}`);
  }
  if (params.doctorName || params.clinicName) {
    lines.push(
      `Prescribed by: ${[params.doctorName, params.clinicName].filter(Boolean).join(" · ")}`
    );
  }
  lines.push("", "Managed by SevaSetu (app=sevasetu-rx)");
  return lines.join("\n");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsLocalDateTime(isoDate: string, hhmm: string): string {
  const datePart = isoDate.replace(/-/g, "");
  const [h = "09", m = "00"] = hhmm.split(":");
  return `${datePart}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
}

function addMinutesToTime(hhmm: string, minutesToAdd: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h || 0) * 60 + (m || 0) + minutesToAdd) % (24 * 60);
  const nh = String(Math.floor(total / 60)).padStart(2, "0");
  const nm = String(total % 60).padStart(2, "0");
  return `${nh}:${nm}`;
}

/**
 * Generates an RFC 5545 iCalendar (`.ics`) file string for a prescription's
 * scheduled medicine reminders so patients can import into Google Calendar,
 * Apple Calendar, or Outlook with one click.
 */
export function generatePrescriptionIcs(params: {
  prescription: PrescriptionRecord;
  events: Array<
    Pick<
      CalendarEventRecord,
      | "googleEventId"
      | "medicineName"
      | "dosage"
      | "whatIsItUsedForEn"
      | "whatIsItUsedForHi"
      | "foodRelation"
      | "scheduledDate"
      | "scheduledTime"
    >
  >;
  timezone?: string;
}): string {
  const { prescription, events } = params;
  const dtStamp =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const vEvents = events.map((ev, idx) => {
    const dtStart = formatIcsLocalDateTime(ev.scheduledDate, ev.scheduledTime);
    const endTime = addMinutesToTime(ev.scheduledTime, 15);
    const dtEnd = formatIcsLocalDateTime(ev.scheduledDate, endTime);
    const summary = escapeIcsText(
      buildCalendarEventTitle(ev.medicineName, ev.dosage, ev.foodRelation)
    );
    const medMatch = prescription.medications.find(
      (m) => m.name === ev.medicineName
    );
    const description = escapeIcsText(
      buildCalendarEventDescription({
        medicineName: ev.medicineName,
        dosage: ev.dosage,
        whatIsItUsedForEn: ev.whatIsItUsedForEn,
        whatIsItUsedForHi: ev.whatIsItUsedForHi,
        foodRelation: ev.foodRelation,
        precautionNote: medMatch?.precautionNote,
        doctorName: prescription.doctorName,
        clinicName: prescription.clinicName,
        daysOfDosage: medMatch?.daysOfDosage,
      })
    );
    const uid = `${ev.googleEventId || `sevasetu-${idx}`}@sevasetu.local`;

    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "CATEGORIES:SevaSetu,Medicine",
      "X-SEVASETU-APP:sevasetu-rx",
      "BEGIN:VALARM",
      "TRIGGER:-PT10M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${summary}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SevaSetu//Smart Prescription Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:SevaSetu Medicines - ${escapeIcsText(prescription.patientName)}`,
    ...vEvents,
    "END:VCALENDAR",
  ].join("\r\n");
}
