import { NextResponse } from "next/server";
import {
  getDatabaseDiagnostics,
  listCalendarEvents,
  listPrescriptions,
  listVisits,
} from "@/lib/db";
import { getGemmaProviderStatus } from "@/lib/gemma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbDiagnostics = getDatabaseDiagnostics();
    const gemmaStatus = getGemmaProviderStatus();
    const visits = listVisits();
    const prescriptions = listPrescriptions();
    const calendarEvents = listCalendarEvents();

    return NextResponse.json({
      ok: true,
      db: dbDiagnostics,
      gemma: gemmaStatus,
      visits,
      prescriptions,
      calendarEvents,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load system status",
      },
      { status: 500 }
    );
  }
}
