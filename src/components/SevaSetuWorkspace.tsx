"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { DoctorConsole } from "@/components/DoctorConsole";
import { Navbar } from "@/components/Navbar";
import { PostVisitWorkspace } from "@/components/PostVisitWorkspace";
import { PreVisitBay } from "@/components/PreVisitBay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { DatabaseDiagnostics } from "@/lib/db";
import {
  CalendarEventRecord,
  GemmaProviderStatus,
  PrescriptionRecord,
  VisitRecord,
  VisitStatus,
  WorkspaceTab,
} from "@/types/sevasetu";
import { countMissingDays } from "@/lib/prescription-utils";

interface InitialSystemPayload {
  db: DatabaseDiagnostics;
  gemma: GemmaProviderStatus;
  visits: VisitRecord[];
  prescriptions: PrescriptionRecord[];
  calendarEvents: CalendarEventRecord[];
}

export function SevaSetuWorkspace({
  initialData,
}: {
  initialData: InitialSystemPayload;
}) {
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>("previsit");
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);

  const [dbStats, setDbStats] = React.useState<DatabaseDiagnostics>(
    initialData.db
  );
  const [gemmaStatus, setGemmaStatus] = React.useState<GemmaProviderStatus>(
    initialData.gemma
  );
  const [visits, setVisits] = React.useState<VisitRecord[]>(initialData.visits);
  const [prescriptions, setPrescriptions] = React.useState<
    PrescriptionRecord[]
  >(initialData.prescriptions);
  const [calendarEvents, setCalendarEvents] = React.useState<
    CalendarEventRecord[]
  >(initialData.calendarEvents);

  // Selected visit in Doctor Console
  const [selectedVisitId, setSelectedVisitId] = React.useState<string>(
    initialData.visits[0]?.id || ""
  );

  // Selected prescription in the Post-Visit tab (defaults to the newest)
  const [selectedPrescriptionId, setSelectedPrescriptionId] =
    React.useState<string>(initialData.prescriptions[0]?.id || "");

  const activePrescription =
    prescriptions.find((p) => p.id === selectedPrescriptionId) ||
    prescriptions[0] ||
    null;
  const pendingDaysCount = activePrescription
    ? countMissingDays(activePrescription.medications)
    : 0;
  const waitingVisitsCount = visits.filter(
    (v) => v.status !== "completed"
  ).length;

  const refreshSystemState = React.useCallback(async () => {
    try {
      const res = await fetch("/api/system/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.ok) {
        setDbStats(data.db);
        setGemmaStatus(data.gemma);
        setVisits(data.visits);
        setPrescriptions(data.prescriptions);
        setCalendarEvents(data.calendarEvents);
      }
    } catch {
      // Network blips are fine; the next poll will retry.
    }
  }, []);

  async function handleVisitSaved(visit: VisitRecord) {
    setSelectedVisitId(visit.id);
    await refreshSystemState();
  }

  async function handleUpdateVisitStatus(id: string, status: VisitStatus) {
    const res = await fetch(`/api/visits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Could not update this patient.");
    }
    await refreshSystemState();
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        readyVisitsCount={waitingVisitsCount}
        pendingDaysCount={pendingDaysCount}
        gemmaStatus={gemmaStatus}
        dbReady={dbStats.fileExists}
        onToggleDiagnostics={() => setDiagnosticsOpen((prev) => !prev)}
        diagnosticsOpen={diagnosticsOpen}
      />

      {/* Collapsible SQLite & Gemma 4 Engine Diagnostics Drawer */}
      {diagnosticsOpen && (
        <div className="border-b bg-card">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Phase 1 Foundation — SQLite Persistence &amp; Gemma 4 Engine
                </h2>
                <p className="text-xs text-muted-foreground">
                  Zero-migration SQLite database and multi-provider Gemma 4
                  adapter status
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshSystemState}
                className="h-8 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh Diagnostics
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>SQLite Database</span>
                  <Badge variant="success">{dbStats.journalMode} Mode</Badge>
                </div>
                <p className="mt-1.5 truncate font-mono text-xs font-medium text-foreground">
                  data/sevasetu.db
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  Size: {(dbStats.fileSizeBytes / 1024).toFixed(1)} KB ·
                  Auto-initialized
                </p>
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>SQLite Tables</span>
                  <span className="font-mono text-[11px] text-foreground">
                    3 tables active
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs tabular-nums">
                  <div>
                    <span className="font-semibold text-foreground">
                      {dbStats.tables.visits}
                    </span>{" "}
                    <span className="text-muted-foreground">visits</span>
                  </div>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div>
                    <span className="font-semibold text-foreground">
                      {dbStats.tables.prescriptions}
                    </span>{" "}
                    <span className="text-muted-foreground">prescriptions</span>
                  </div>
                  <Separator orientation="vertical" className="h-3.5" />
                  <div>
                    <span className="font-semibold text-foreground">
                      {dbStats.tables.calendarEventsActive}
                    </span>{" "}
                    <span className="text-muted-foreground">events</span>
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Gemma 4 Provider</span>
                  <Badge variant="outline">
                    {gemmaStatus.activeProvider === "google_ai_studio"
                      ? "Google AI Studio"
                      : gemmaStatus.activeProvider === "ollama_local"
                        ? "Ollama Local"
                        : "Fallback Ready"}
                  </Badge>
                </div>
                <p className="mt-1.5 truncate text-xs font-medium text-foreground">
                  {gemmaStatus.modelName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Text (HI/EN) + Multimodal Rx Vision
                </p>
              </div>

              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Calendar Cleanup Tag</span>
                  <span className="font-mono text-[11px] text-primary">
                    app=sevasetu-rx
                  </span>
                </div>
                <p className="mt-1.5 text-xs font-medium text-foreground">
                  Auto-removes outdated Rx reminders
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {dbStats.tables.calendarEventsActive} active ·{" "}
                  {dbStats.tables.calendarEventsRemoved} replaced
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* Kept mounted (just hidden) so a half-finished intake survives tab switches */}
        <div hidden={activeTab !== "previsit"}>
          <PreVisitBay
            onVisitSaved={handleVisitSaved}
            onOpenDoctorConsole={() => setActiveTab("doctor")}
          />
        </div>

        {activeTab === "doctor" && (
          <DoctorConsole
            visits={visits}
            selectedVisitId={selectedVisitId}
            onSelectVisit={setSelectedVisitId}
            onRefresh={refreshSystemState}
            onUpdateVisitStatus={handleUpdateVisitStatus}
          />
        )}

        {/* Kept mounted (just hidden) so a half-typed prescription survives tab switches */}
        <div hidden={activeTab !== "postvisit"}>
          <PostVisitWorkspace
            prescriptions={prescriptions}
            visits={visits}
            calendarEvents={calendarEvents}
            selectedPrescriptionId={selectedPrescriptionId}
            onSelectPrescription={setSelectedPrescriptionId}
            onRefresh={refreshSystemState}
          />
        </div>
      </main>

      {/* Clean Clinical Footer */}
      <footer className="border-t bg-card py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              SevaSetu (सेवासेतु)
            </span>
            <span>·</span>
            <span>Phase 4 · Smart Calendar Sync Active</span>
          </div>
          <div className="flex items-center gap-4 tabular-nums">
            <span>SQLite: data/sevasetu.db ({dbStats.tables.visits} visits)</span>
            <span>·</span>
            <span>Engine: {gemmaStatus.modelName}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
