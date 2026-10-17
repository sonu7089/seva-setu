"use client";

import * as React from "react";
import { CheckCircle2, Play, RefreshCw, Sparkles } from "lucide-react";
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

  // Phase 5 — one-click golden-path demo (Hindi intake → Doctor brief →
  // prescription with missing-days prompt → calendar replacement setup).
  const [demoLoading, setDemoLoading] = React.useState(false);
  const [demoError, setDemoError] = React.useState<string | null>(null);
  const [demoLoaded, setDemoLoaded] = React.useState<{
    visitId: string;
    prescriptionId: string;
    patientName: string;
  } | null>(null);

  async function handleLoadDemoFlow() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      const res = await fetch("/api/system/demo-flow", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not load the demo flow.");
      }
      setSelectedVisitId(data.visit.id);
      setSelectedPrescriptionId(data.prescription.id);
      setDemoLoaded({
        visitId: data.visit.id,
        prescriptionId: data.prescription.id,
        patientName: data.visit.patientName,
      });
      await refreshSystemState();
    } catch (err) {
      setDemoError(
        err instanceof Error ? err.message : "Could not load the demo flow."
      );
    } finally {
      setDemoLoading(false);
    }
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
                  System Diagnostics — SQLite, Gemma 4 &amp; DigitalOcean
                  Gradient™ AI
                </h2>
                <p className="text-xs text-muted-foreground">
                  Zero-migration SQLite database, multi-provider Gemma 4
                  adapter, and DigitalOcean cloud / inference status
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
                    {gemmaStatus.activeProvider === "digitalocean_gradient"
                      ? "DigitalOcean Gradient"
                      : gemmaStatus.activeProvider === "google_ai_studio"
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

            {/* Phase 6 — DigitalOcean Gradient AI telemetry (hosts only, no secrets) */}
            <div className="mt-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>DigitalOcean Gradient™ AI &amp; App Platform</span>
                <Badge
                  variant={
                    gemmaStatus.digitalOcean?.anyConfigured
                      ? "success"
                      : "outline"
                  }
                >
                  {gemmaStatus.digitalOcean?.anyConfigured
                    ? "Connected"
                    : "Not configured — offline fallback active"}
                </Badge>
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Serverless Inference</p>
                  <p className="mt-0.5 truncate font-medium text-foreground">
                    {gemmaStatus.digitalOcean?.serverlessInferenceConfigured
                      ? `${gemmaStatus.digitalOcean.inferenceModel} · ${gemmaStatus.digitalOcean.inferenceHost ?? "inference.do-ai.run"}`
                      : "Set DO_MODEL_ACCESS_KEY"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gradient Agent</p>
                  <p className="mt-0.5 truncate font-medium text-foreground">
                    {gemmaStatus.digitalOcean?.agentConfigured
                      ? (gemmaStatus.digitalOcean.agentHost ?? "Configured")
                      : "Set DO_GENAI_ENDPOINT (optional)"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">GPU Droplet</p>
                  <p className="mt-0.5 truncate font-medium text-foreground">
                    {gemmaStatus.digitalOcean?.gpuDropletConfigured
                      ? (gemmaStatus.digitalOcean.gpuDropletHost ??
                        "Configured")
                      : "Set DO_GPU_DROPLET_URL (optional)"}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>Fallback chain:</span>
                {(gemmaStatus.fallbackChain ?? ["demo_fallback"]).map(
                  (provider, i, chain) => (
                    <span key={provider} className="flex items-center gap-1.5">
                      <span
                        className={
                          provider === gemmaStatus.activeProvider
                            ? "font-semibold text-foreground"
                            : undefined
                        }
                      >
                        {provider === "digitalocean_gradient"
                          ? "DigitalOcean Gradient"
                          : provider === "google_ai_studio"
                            ? "Google AI Studio"
                            : provider === "ollama_local"
                              ? "Ollama"
                              : "Offline Fallback"}
                      </span>
                      {i < chain.length - 1 && <span aria-hidden>→</span>}
                    </span>
                  )
                )}
                <span className="ml-2 font-mono text-primary">
                  /api/health
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {/* Phase 5 — one-click golden-path demo for judges & contributors */}
        <div className="mb-6 rounded-lg border border-primary/25 bg-primary/[0.04] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  60-second live demo flow{" "}
                  <span className="font-devanagari font-normal text-muted-foreground">
                    (लाइव डेमो)
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Loads a fresh Hindi waiting-area intake → Doctor brief → prescription
                  with a missing-dosage-days prompt → stale calendar events
                  ready to be replaced. Works offline, no API key needed.
                </p>
              </div>
            </div>
            <Button
              onClick={() => void handleLoadDemoFlow()}
              disabled={demoLoading}
              className="shrink-0"
            >
              <Play className="h-4 w-4" />
              {demoLoading ? "Loading demo…" : "Load Live Demo Flow"}
            </Button>
          </div>

          {demoError && (
            <p className="mt-3 text-xs font-medium text-destructive">
              {demoError}
            </p>
          )}

          {demoLoaded && !demoError && (
            <div className="mt-3 rounded-md border bg-card p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Demo ready for {demoLoaded.patientName} — walk it in order:
              </p>
              <ol className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">
                    1
                  </span>
                  <span>
                    Open the{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => setActiveTab("doctor")}
                    >
                      Doctor Console
                    </button>{" "}
                    — the Hindi brief is selected and scannable in ~15 seconds.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">
                    2
                  </span>
                  <span>
                    Open{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                      onClick={() => setActiveTab("postvisit")}
                    >
                      Post-Visit
                    </button>{" "}
                    — confirm the missing dosage days on the amber prompt.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">
                    3
                  </span>
                  <span>
                    Hit calendar sync — watch the 2 stale previous-Rx events get
                    removed and replaced by the new schedule.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary text-[11px] font-semibold text-primary-foreground">
                    4
                  </span>
                  <span>
                    Download the{" "}
                    <span className="font-medium text-foreground">.ics</span>{" "}
                    file to show the schedule works without a Google login.
                  </span>
                </li>
              </ol>
            </div>
          )}
        </div>

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
            <span>Phase 6 · DigitalOcean Gradient AI &amp; App Platform Ready</span>
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
