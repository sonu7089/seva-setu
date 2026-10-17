import { NextRequest, NextResponse } from "next/server";
import {
  expandMedicationsToCalendarEvents,
  getTodayIsoDate,
} from "@/lib/calendar-utils";
import {
  getPrescriptionById,
  listCalendarEvents,
  replaceActiveCalendarEvents,
} from "@/lib/db";
import {
  syncWithGoogleCalendarApi,
  type GoogleCalendarSyncResult,
} from "@/lib/google-calendar";
import { countMissingDays, normalizeMedications } from "@/lib/prescription-utils";
import type { CalendarSyncPayload } from "@/types/sevasetu";

export const dynamic = "force-dynamic";

interface SyncRequestBody extends Partial<CalendarSyncPayload> {
  googleAccessToken?: string;
  calendarId?: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  return NextResponse.json({
    ok: true,
    calendarEvents: listCalendarEvents(),
    googleEnvConfigured: Boolean(
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN?.trim()
    ),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SyncRequestBody;
    const prescriptionId = body.prescriptionId?.trim();

    if (!prescriptionId) {
      return NextResponse.json(
        { ok: false, error: "Select a prescription to sync." },
        { status: 400 }
      );
    }

    const prescription = getPrescriptionById(prescriptionId);
    if (!prescription) {
      return NextResponse.json(
        { ok: false, error: "Prescription not found." },
        { status: 404 }
      );
    }

    const medications = Array.isArray(body.medications)
      ? normalizeMedications(body.medications)
      : prescription.medications;

    if (medications.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "This prescription has no medicines to schedule.",
        },
        { status: 400 }
      );
    }

    const missingDays = countMissingDays(medications);
    if (missingDays > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `Confirm the number of days for all medicines before syncing (${missingDays} missing).`,
        },
        { status: 400 }
      );
    }

    const rawStartDate = body.startDate?.trim() || getTodayIsoDate();
    const startDate = ISO_DATE_RE.test(rawStartDate)
      ? rawStartDate
      : getTodayIsoDate();
    const patientTimezone =
      body.patientTimezone?.trim() || "Asia/Kolkata";
    const replacePreviousPrescription =
      body.replacePreviousPrescription ?? true;

    // Capture previously active reminders before replacing so the UI can show what was cleaned up
    const previousActiveEvents = listCalendarEvents("active");
    const removedMedicineNames = Array.from(
      new Set(previousActiveEvents.map((e) => e.medicineName))
    );

    const accessToken =
      body.googleAccessToken?.trim() ||
      process.env.GOOGLE_CALENDAR_ACCESS_TOKEN?.trim() ||
      "";

    let googleSync: GoogleCalendarSyncResult | null = null;
    if (accessToken) {
      googleSync = await syncWithGoogleCalendarApi({
        accessToken,
        calendarId: body.calendarId?.trim() || "primary",
        prescription,
        medications,
        startDate,
        timezone: patientTimezone,
        replacePreviousPrescription,
      });
    }

    const newEvents = expandMedicationsToCalendarEvents({
      prescriptionId: prescription.id,
      medications,
      startDate,
      googleEventIdByMedAndTime: googleSync?.googleEventIdByMedAndTime,
    });

    const { removedCount, insertedCount } = replaceActiveCalendarEvents(
      prescription.id,
      newEvents
    );

    return NextResponse.json({
      ok: true,
      mode: googleSync ? "google_oauth" : "local_simulator",
      removedCount,
      removedMedicineNames,
      insertedCount,
      startDate,
      prescription: getPrescriptionById(prescription.id),
      calendarEvents: listCalendarEvents(),
      googleSync,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not sync prescription to Google Calendar.",
      },
      { status: 500 }
    );
  }
}
