import { SevaSetuWorkspace } from "@/components/SevaSetuWorkspace";
import {
  getDatabaseDiagnostics,
  listCalendarEvents,
  listPrescriptions,
  listVisits,
} from "@/lib/db";
import { getGemmaProviderStatus } from "@/lib/gemma";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const db = getDatabaseDiagnostics();
  const gemma = getGemmaProviderStatus();
  const visits = listVisits();
  const prescriptions = listPrescriptions();
  const calendarEvents = listCalendarEvents();

  return (
    <SevaSetuWorkspace
      initialData={{
        db,
        gemma,
        visits,
        prescriptions,
        calendarEvents,
      }}
    />
  );
}
