import {
  buildCalendarEventDescription,
  buildCalendarEventTitle,
} from "@/lib/calendar-utils";
import type { ExtractedMedication, PrescriptionRecord } from "@/types/sevasetu";

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export interface GoogleCalendarSyncResult {
  calendarId: string;
  deletedFromGoogle: number;
  createdInGoogle: number;
  googleEventIdByMedAndTime: Record<string, string>;
}

interface GoogleEventListResponse {
  items?: Array<{
    id?: string;
    summary?: string;
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

function addMinutesToTime(hhmm: string, minutesToAdd: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h || 0) * 60 + (m || 0) + minutesToAdd) % (24 * 60);
  const nh = String(Math.floor(total / 60)).padStart(2, "0");
  const nm = String(total % 60).padStart(2, "0");
  return `${nh}:${nm}`;
}

/**
 * Syncs a prescription directly with the user's Google Calendar via the
 * Google Calendar REST API v3:
 * 1. Queries and deletes all existing events tagged with `privateExtendedProperty="app=sevasetu-rx"`.
 * 2. Inserts recurring daily medicine reminders across each medicine's `daysOfDosage`
 *    with the plain-language English & Hindi purpose inside the event description.
 */
export async function syncWithGoogleCalendarApi(params: {
  accessToken: string;
  calendarId?: string;
  prescription: PrescriptionRecord;
  medications: ExtractedMedication[];
  startDate: string;
  timezone: string;
  replacePreviousPrescription?: boolean;
}): Promise<GoogleCalendarSyncResult> {
  const {
    accessToken,
    calendarId = "primary",
    prescription,
    medications,
    startDate,
    timezone,
    replacePreviousPrescription = true,
  } = params;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken.trim()}`,
    "Content-Type": "application/json",
  };

  const encodedCalendarId = encodeURIComponent(calendarId.trim() || "primary");
  let deletedFromGoogle = 0;

  // Step 1: Query & delete existing SevaSetu medicine events (app=sevasetu-rx)
  if (replacePreviousPrescription) {
    const listUrl = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events?privateExtendedProperty=${encodeURIComponent(
      "app=sevasetu-rx"
    )}&maxResults=250`;

    const listRes = await fetch(listUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const listData = (await listRes
      .json()
      .catch(() => ({}))) as GoogleEventListResponse;

    if (!listRes.ok) {
      const msg =
        listData?.error?.message ||
        `Google Calendar API returned ${listRes.status}. Check your OAuth access token.`;
      throw new Error(msg);
    }

    const existingItems = listData.items ?? [];
    for (const item of existingItems) {
      if (!item.id) continue;
      const delUrl = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events/${encodeURIComponent(
        item.id
      )}`;
      const delRes = await fetch(delUrl, {
        method: "DELETE",
        headers,
      });
      if (delRes.ok || delRes.status === 204 || delRes.status === 410) {
        deletedFromGoogle += 1;
      }
    }
  }

  // Step 2: Insert new recurring daily medicine events across confirmed daysOfDosage
  const googleEventIdByMedAndTime: Record<string, string> = {};
  let createdInGoogle = 0;

  for (const med of medications) {
    const days = med.daysOfDosage;
    if (days === null || days <= 0) continue;

    const times =
      med.recommendedTimes.length > 0
        ? med.recommendedTimes
        : med.frequencyCode === "SOS"
          ? []
          : ["09:00"];

    for (const time of times) {
      const endTime = addMinutesToTime(time, 15);
      const summary = buildCalendarEventTitle(
        med.name,
        med.dosage,
        med.foodRelation
      );
      const description = buildCalendarEventDescription({
        medicineName: med.name,
        dosage: med.dosage,
        whatIsItUsedForEn: med.whatIsItUsedForEn,
        whatIsItUsedForHi: med.whatIsItUsedForHi,
        foodRelation: med.foodRelation,
        precautionNote: med.precautionNote,
        doctorName: prescription.doctorName,
        clinicName: prescription.clinicName,
        daysOfDosage: days,
      });

      const eventBody = {
        summary,
        description,
        start: {
          dateTime: `${startDate}T${time}:00`,
          timeZone: timezone,
        },
        end: {
          dateTime: `${startDate}T${endTime}:00`,
          timeZone: timezone,
        },
        recurrence: [`RRULE:FREQ=DAILY;COUNT=${days}`],
        extendedProperties: {
          private: {
            app: "sevasetu-rx",
            prescriptionId: prescription.id,
            medicationId: med.id,
          },
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 10 }],
        },
      };

      const insertUrl = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodedCalendarId}/events`;
      const insertRes = await fetch(insertUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(eventBody),
      });

      const insertData = (await insertRes.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string };
      };

      if (!insertRes.ok) {
        throw new Error(
          insertData?.error?.message ||
            `Could not create Google Calendar event for ${med.name}.`
        );
      }

      const key = `${med.id}:${time}`;
      if (insertData.id) {
        googleEventIdByMedAndTime[key] = insertData.id;
      }
      createdInGoogle += days;
    }
  }

  return {
    calendarId: calendarId.trim() || "primary",
    deletedFromGoogle,
    createdInGoogle,
    googleEventIdByMedAndTime,
  };
}
