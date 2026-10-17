"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { DoctorConsole } from "@/components/DoctorConsole";
import { Navbar } from "@/components/Navbar";
import { PreVisitBay } from "@/components/PreVisitBay";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DatabaseDiagnostics } from "@/lib/db";
import {
  CalendarEventRecord,
  GemmaProviderStatus,
  PrescriptionRecord,
  VisitRecord,
  WorkspaceTab,
} from "@/types/sevasetu";

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

  const activePrescription = prescriptions[0] || null;
  const pendingDaysCount = activePrescription
    ? activePrescription.medications.filter((m) => m.daysOfDosage === null)
        .length
    : 0;

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        readyVisitsCount={visits.length}
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
                  {dbStats.tables.calendarEventsActive} active events tracked
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
          />
        )}

        {/* WORKSPACE 3: POST-VISIT PRESCRIPTION & CALENDAR */}
        {activeTab === "postvisit" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  3. Post-Visit Prescription &amp; Smart Calendar{" "}
                  <span className="font-devanagari font-normal text-muted-foreground">
                    (दवा पर्ची और कैलेंडर)
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Plain-language medicine purpose guide, missing dosage-days
                  check, and automatic Google Calendar reminder replacement.
                </p>
              </div>
              {activePrescription && (
                <Badge variant="outline" className="w-fit font-mono text-xs">
                  {activePrescription.imageName || activePrescription.id}
                </Badge>
              )}
            </div>

            {pendingDaysCount > 0 && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>
                  Dosage Days Required ({pendingDaysCount} medicine missing
                  duration)
                </AlertTitle>
                <AlertDescription>
                  One or more medicines on the scanned prescription did not
                  clearly specify how many days to take it. Confirm the dosage
                  days before syncing to Google Calendar.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Extracted Prescription Medications Table */}
              <Card className="lg:col-span-8">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        Extracted Prescription &amp; Medicine Purpose
                      </CardTitle>
                      <CardDescription>
                        {activePrescription?.patientName} · Prescribed by{" "}
                        {activePrescription?.doctorName}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={pendingDaysCount > 0 ? "warning" : "success"}
                    >
                      {pendingDaysCount > 0
                        ? "Needs Days Confirmation"
                        : "Ready for Calendar Sync"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine &amp; Timing</TableHead>
                        <TableHead>
                          What Is This Medicine Used For? (दवा का उपयोग)
                        </TableHead>
                        <TableHead className="w-[140px]">
                          Dosage Days
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activePrescription?.medications.map((med) => (
                        <TableRow key={med.id}>
                          <TableCell className="align-top">
                            <div className="font-medium text-foreground">
                              {med.name}{" "}
                              <span className="font-mono text-xs text-muted-foreground">
                                {med.dosage}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant="secondary" className="font-mono">
                                {med.frequencyCode}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {med.foodRelation === "before_food"
                                  ? "Before Food"
                                  : "After Food"}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                              Slots: {med.recommendedTimes.join(", ")}
                            </p>
                          </TableCell>

                          <TableCell className="align-top">
                            <p className="text-xs text-foreground">
                              {med.whatIsItUsedForEn}
                            </p>
                            <p className="mt-1 font-devanagari text-xs text-muted-foreground">
                              {med.whatIsItUsedForHi}
                            </p>
                          </TableCell>

                          <TableCell className="align-top tabular-nums">
                            {med.daysOfDosage === null ? (
                              <Badge variant="warning">
                                Missing — Prompt User
                              </Badge>
                            ) : (
                              <span className="text-xs font-medium text-foreground">
                                {med.daysOfDosage} Days
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Active Calendar Events Tracked in SQLite */}
              <Card className="lg:col-span-4">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Google Calendar State
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[11px]">
                      sevasetu-rx
                    </Badge>
                  </div>
                  <CardDescription>
                    Existing prescription reminders tracked in SQLite{" "}
                    <code className="font-mono text-xs">calendar_events</code>.
                    Automatically replaced when a new prescription is synced.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-2.5">
                  {calendarEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-md border bg-muted/20 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {ev.medicineName} ({ev.dosage})
                        </span>
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {ev.scheduledTime}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {ev.whatIsItUsedForEn}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-mono">{ev.googleEventId}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {ev.status === "active"
                            ? "Active (Will Replace)"
                            : "Removed"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>

      {/* Clean Clinical Footer */}
      <footer className="border-t bg-card py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">
              SevaSetu (सेवासेतु)
            </span>
            <span>·</span>
            <span>Phase 2 · Bay Intake Active</span>
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
