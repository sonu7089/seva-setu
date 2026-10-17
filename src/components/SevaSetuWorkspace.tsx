"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  FileText,
  Languages,
  Mic,
  RefreshCw,
  Server,
  UserCheck,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DatabaseDiagnostics } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  CalendarEventRecord,
  EntryByRole,
  GemmaProviderStatus,
  IntakeLanguage,
  PrescriptionRecord,
  TextFollowUpQuestion,
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

const SAMPLE_INTAKE_PROMPTS: Array<{
  label: string;
  lang: IntakeLanguage;
  name: string;
  age: string;
  gender: string;
  text: string;
}> = [
  {
    label: "Hindi — Fever & Dry Cough (बुखार और सूखी खांसी)",
    lang: "hi",
    name: "सुनीता देवी (Sunita Devi)",
    age: "46",
    gender: "Female",
    text: "मरीज़ को पिछले तीन दिन से शाम के समय तेज़ बुखार और सूखी खांसी हो रही है, रात में लेटने पर खांसी बढ़ जाती है।",
  },
  {
    label: "English — Gastric Burning & Reflux",
    lang: "en",
    name: "Vikram Nair",
    age: "38",
    gender: "Male",
    text: "Experiencing upper abdominal burning and sour reflux for 4 days, worse after dinner and spicy food.",
  },
];

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

  // Pre-visit Bay Intake State
  const [entryBy, setEntryBy] = React.useState<EntryByRole>("nurse_bay");
  const [language, setLanguage] = React.useState<IntakeLanguage>("hi");
  const [patientName, setPatientName] = React.useState(
    "सुनीता देवी (Sunita Devi)"
  );
  const [age, setAge] = React.useState("46");
  const [gender, setGender] = React.useState("Female");
  const [bp, setBp] = React.useState("126/82");
  const [temp, setTemp] = React.useState("100.8°F");
  const [pulse, setPulse] = React.useState("92 bpm");
  const [spo2, setSpo2] = React.useState("98%");
  const [rawTranscript, setRawTranscript] = React.useState(
    SAMPLE_INTAKE_PROMPTS[0].text
  );

  const [generatedQuestions, setGeneratedQuestions] = React.useState<
    TextFollowUpQuestion[]
  >([]);
  const [isTestingGemma, setIsTestingGemma] = React.useState(false);
  const [isSavingVisit, setIsSavingVisit] = React.useState(false);
  const [statusBanner, setStatusBanner] = React.useState<string | null>(null);

  const selectedVisit =
    visits.find((v) => v.id === selectedVisitId) || visits[0] || null;
  const activePrescription = prescriptions[0] || null;
  const pendingDaysCount = activePrescription
    ? activePrescription.medications.filter((m) => m.daysOfDosage === null)
        .length
    : 0;

  async function refreshSystemState() {
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
  }

  async function handleGenerateFollowUps() {
    setIsTestingGemma(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/gemma/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryBy,
          inputMode: "text",
          language,
          rawTranscript,
          patientInfo: {
            name: patientName,
            age,
            gender,
            vitals:
              entryBy === "nurse_bay"
                ? { bp, temp, pulse, spo2 }
                : undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.questions)) {
        setGeneratedQuestions(
          data.questions.map((q: TextFollowUpQuestion) => ({
            ...q,
            answer: q.quickOptionsEn?.[0] || "",
          }))
        );
      }
    } finally {
      setIsTestingGemma(false);
    }
  }

  async function handleSaveIntakeToSqlite() {
    setIsSavingVisit(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          age,
          gender,
          entryBy,
          inputMode: "text",
          language,
          vitals:
            entryBy === "nurse_bay" ? { bp, temp, pulse, spo2 } : {},
          rawTranscript,
          followUpQuestions: generatedQuestions,
          doctorBrief: {
            chiefComplaint: rawTranscript,
            chiefComplaintHi: language === "hi" ? rawTranscript : undefined,
            symptomTimeline: [
              `Recorded at ${entryBy === "nurse_bay" ? "Nurse Triage Bay" : "Patient Self-Check-In"}: ${rawTranscript}`,
            ],
            followUpSummary: generatedQuestions.map((q) => ({
              question: q.questionEn,
              answer: q.answer || "Confirmed at bay",
            })),
            vitalsSummary:
              entryBy === "nurse_bay"
                ? `BP ${bp} · Temp ${temp} · Pulse ${pulse} · SpO2 ${spo2}`
                : "Self-check-in (Vitals at bay)",
            triagePriority: "Routine",
            clinicalNotes: [
              "Saved directly to SQLite (data/sevasetu.db) for Doctor Console handoff.",
            ],
            timeSavedNote:
              "3.5 mins of routine baseline history captured prior to consultation",
          },
          status: "ready_for_doctor",
        }),
      });

      if (res.ok) {
        const created = await res.json();
        await refreshSystemState();
        if (created.visit?.id) {
          setSelectedVisitId(created.visit.id);
        }
        setStatusBanner(
          `Saved ${created.visit?.tokenNumber || "Visit"} to SQLite (data/sevasetu.db). Ready in Doctor Console.`
        );
      }
    } finally {
      setIsSavingVisit(false);
    }
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
        {/* WORKSPACE 1: PRE-VISIT BAY (PATIENT / NURSE) */}
        {activeTab === "previsit" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  1. Pre-Visit Triage Bay{" "}
                  <span className="font-devanagari font-normal text-muted-foreground">
                    (प्री-विज़िट सहायता कक्ष)
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Record initial patient symptoms in Hindi or English and
                  complete routine follow-up questions before entering the
                  doctor&apos;s room.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-md border bg-card p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setEntryBy("nurse_bay")}
                    className={cn(
                      "rounded px-2.5 py-1 font-medium transition-colors",
                      entryBy === "nurse_bay"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Nurse at Triage Bay
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryBy("patient")}
                    className={cn(
                      "rounded px-2.5 py-1 font-medium transition-colors",
                      entryBy === "patient"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Patient Check-In
                  </button>
                </div>
              </div>
            </div>

            {statusBanner && (
              <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <AlertTitle>Handoff Saved to SQLite</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>{statusBanner}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("doctor")}
                    className="h-7 border-emerald-300 bg-white text-xs text-emerald-900 hover:bg-emerald-100"
                  >
                    Open in Doctor Console
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Patient & Symptom Entry */}
              <Card className="lg:col-span-7">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        Patient Intake &amp; Symptom Recording
                      </CardTitle>
                      <CardDescription>
                        Supports bilingual Hindi (देवनागरी) and English clinical
                        intake
                      </CardDescription>
                    </div>
                    <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setLanguage("hi")}
                        className={cn(
                          "rounded px-2.5 py-1 font-medium transition-colors",
                          language === "hi"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground"
                        )}
                      >
                        हिंदी (hi-IN)
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage("en")}
                        className={cn(
                          "rounded px-2.5 py-1 font-medium transition-colors",
                          language === "en"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground"
                        )}
                      >
                        English (en-IN)
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Basic Patient Info */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="patient-name">
                        Patient Name (मरीज़ का नाम)
                      </Label>
                      <Input
                        id="patient-name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="e.g. Rameshwar Sharma"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="patient-age">Age (उम्र)</Label>
                      <Input
                        id="patient-age"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="patient-gender">Gender (लिंग)</Label>
                      <Input
                        id="patient-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Nurse Bay Vitals */}
                  {entryBy === "nurse_bay" && (
                    <div className="rounded-md border bg-muted/30 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">
                          Nurse Bay Vitals
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Recorded prior to consultation
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            BP (mmHg)
                          </Label>
                          <Input
                            value={bp}
                            onChange={(e) => setBp(e.target.value)}
                            className="h-8 bg-card font-mono text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Temperature
                          </Label>
                          <Input
                            value={temp}
                            onChange={(e) => setTemp(e.target.value)}
                            className="h-8 bg-card font-mono text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            Pulse
                          </Label>
                          <Input
                            value={pulse}
                            onChange={(e) => setPulse(e.target.value)}
                            className="h-8 bg-card font-mono text-xs tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">
                            SpO2
                          </Label>
                          <Input
                            value={spo2}
                            onChange={(e) => setSpo2(e.target.value)}
                            className="h-8 bg-card font-mono text-xs tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Sample Scenarios */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor="symptom-transcript">
                        Chief Complaint / Spoken Transcript (मुख्य समस्या)
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {SAMPLE_INTAKE_PROMPTS.map((sample) => (
                          <button
                            key={sample.label}
                            type="button"
                            onClick={() => {
                              setLanguage(sample.lang);
                              setPatientName(sample.name);
                              setAge(sample.age);
                              setGender(sample.gender);
                              setRawTranscript(sample.text);
                            }}
                            className="rounded border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            {sample.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      id="symptom-transcript"
                      rows={4}
                      value={rawTranscript}
                      onChange={(e) => setRawTranscript(e.target.value)}
                      className="text-bilingual font-devanagari text-sm"
                      placeholder="Speak or type patient symptoms in Hindi or English..."
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 pt-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Languages className="h-3.5 w-3.5" />
                    <span>Gemma 4 Bilingual Intake Engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateFollowUps}
                      disabled={isTestingGemma || !rawTranscript.trim()}
                    >
                      {isTestingGemma
                        ? "Analyzing with Gemma 4..."
                        : "Generate Follow-Up Questions"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveIntakeToSqlite}
                      disabled={isSavingVisit || !rawTranscript.trim()}
                    >
                      {isSavingVisit
                        ? "Saving..."
                        : "Save to Doctor Queue (SQLite)"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              {/* Right Column: Text-Only Follow-Up Questions Preview */}
              <Card className="lg:col-span-5">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Text Follow-Up Questions
                    </CardTitle>
                    <Badge variant="outline">Text-Only Modality</Badge>
                  </div>
                  <CardDescription>
                    Routine preliminary history questions generated by Gemma 4
                    so the doctor can skip baseline questioning.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {generatedQuestions.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Ready to generate targeted intake questions
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Click &ldquo;Generate Follow-Up Questions&rdquo; to test
                        the Gemma 4 adapter on the current Hindi/English
                        complaint.
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={handleGenerateFollowUps}
                        disabled={isTestingGemma}
                      >
                        Run Gemma 4 Follow-Up Generator
                      </Button>
                    </div>
                  ) : (
                    generatedQuestions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="space-y-2 rounded-md border bg-muted/20 p-3"
                      >
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-foreground">
                            {idx + 1}. {q.questionEn}
                          </p>
                          <p className="font-devanagari text-xs text-muted-foreground">
                            {q.questionHi}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {q.quickOptionsEn.map((opt, optIdx) => {
                            const selected = q.answer === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setGeneratedQuestions((prev) =>
                                    prev.map((item) =>
                                      item.id === q.id
                                        ? { ...item, answer: opt }
                                        : item
                                    )
                                  );
                                }}
                                className={cn(
                                  "rounded border px-2 py-1 text-left text-xs transition-colors",
                                  selected
                                    ? "border-primary bg-primary/10 font-medium text-foreground"
                                    : "bg-card text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {opt}
                                {q.quickOptionsHi?.[optIdx]
                                  ? ` · ${q.quickOptionsHi[optIdx]}`
                                  : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* WORKSPACE 2: DOCTOR CONSOLE */}
        {activeTab === "doctor" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  2. Doctor Consultation Console{" "}
                  <span className="font-devanagari font-normal text-muted-foreground">
                    (डॉक्टर परामर्श पटल)
                  </span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  15-second pre-visit SOAP briefs persisted in SQLite from the
                  Nurse / Patient Bay.
                </p>
              </div>
              <Badge variant="outline" className="w-fit tabular-nums">
                {visits.length} Patients in SQLite Queue
              </Badge>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Patient Queue List */}
              <div className="space-y-2.5 lg:col-span-4">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  OPD Waiting Queue
                </div>
                {visits.map((visit) => {
                  const isSelected = selectedVisit?.id === visit.id;
                  const priority =
                    visit.doctorBrief?.triagePriority || "Routine";
                  return (
                    <button
                      key={visit.id}
                      type="button"
                      onClick={() => setSelectedVisitId(visit.id)}
                      className={cn(
                        "w-full rounded-lg border p-3.5 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-card ring-1 ring-primary"
                          : "bg-card hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-primary tabular-nums">
                          {visit.tokenNumber}
                        </span>
                        <Badge
                          variant={
                            priority === "Urgent"
                              ? "urgent"
                              : priority === "Priority"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {priority}
                        </Badge>
                      </div>
                      <p className="mt-1 font-medium text-foreground">
                        {visit.patientName}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                        {visit.age} yrs · {visit.gender} ·{" "}
                        {visit.entryBy === "nurse_bay"
                          ? "Nurse Bay"
                          : "Self Check-In"}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {visit.doctorBrief?.chiefComplaint ||
                          visit.rawTranscript}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Selected Patient 15-Second Clinical Brief */}
              <div className="lg:col-span-8">
                {selectedVisit ? (
                  <Card>
                    <CardHeader className="border-b pb-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-primary">
                              {selectedVisit.tokenNumber}
                            </span>
                            <Separator
                              orientation="vertical"
                              className="h-3.5"
                            />
                            <span className="text-xs text-muted-foreground">
                              {selectedVisit.age} yrs · {selectedVisit.gender}
                            </span>
                          </div>
                          <CardTitle className="mt-1 text-lg">
                            {selectedVisit.patientName}
                          </CardTitle>
                        </div>

                        {selectedVisit.doctorBrief?.timeSavedNote && (
                          <div className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                            <Clock className="h-3.5 w-3.5" />
                            <span>
                              {selectedVisit.doctorBrief.timeSavedNote}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Vitals Strip */}
                      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border bg-muted/30 px-3 py-2 text-xs tabular-nums">
                        <div>
                          <span className="text-muted-foreground">BP:</span>{" "}
                          <span className="font-mono font-medium text-foreground">
                            {selectedVisit.vitals.bp || "—"}
                          </span>
                        </div>
                        <Separator orientation="vertical" className="h-3.5" />
                        <div>
                          <span className="text-muted-foreground">Temp:</span>{" "}
                          <span className="font-mono font-medium text-foreground">
                            {selectedVisit.vitals.temp || "—"}
                          </span>
                        </div>
                        <Separator orientation="vertical" className="h-3.5" />
                        <div>
                          <span className="text-muted-foreground">Pulse:</span>{" "}
                          <span className="font-mono font-medium text-foreground">
                            {selectedVisit.vitals.pulse || "—"}
                          </span>
                        </div>
                        <Separator orientation="vertical" className="h-3.5" />
                        <div>
                          <span className="text-muted-foreground">SpO2:</span>{" "}
                          <span className="font-mono font-medium text-foreground">
                            {selectedVisit.vitals.spo2 || "—"}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5 pt-5">
                      {/* Chief Complaint */}
                      <div className="space-y-1.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Chief Complaint (Normalized Summary)
                        </h3>
                        <p className="text-sm font-medium text-foreground">
                          {selectedVisit.doctorBrief?.chiefComplaint ||
                            selectedVisit.rawTranscript}
                        </p>
                        <div className="rounded-md border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Original Bay Transcript (
                            {selectedVisit.language.toUpperCase()}):{" "}
                          </span>
                          <span className="font-devanagari">
                            &ldquo;{selectedVisit.rawTranscript}&rdquo;
                          </span>
                        </div>
                      </div>

                      {/* Pre-Visit Follow-Up Q&A */}
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Routine History Answered Before Entry
                        </h3>
                        <div className="divide-y rounded-md border">
                          {(selectedVisit.doctorBrief?.followUpSummary
                            ?.length
                            ? selectedVisit.doctorBrief.followUpSummary
                            : selectedVisit.followUpQuestions.map((q) => ({
                                question: q.questionEn,
                                answer: q.answer || "Confirmed at bay",
                              }))
                          ).map((item, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col justify-between gap-1 px-3.5 py-2.5 text-sm sm:flex-row sm:items-center"
                            >
                              <span className="text-xs text-muted-foreground">
                                {item.question}
                              </span>
                              <span className="text-xs font-medium text-foreground">
                                {item.answer}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Clinical Timeline & Notes */}
                      {selectedVisit.doctorBrief?.symptomTimeline && (
                        <div className="space-y-1.5">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Clinical Timeline &amp; Notes
                          </h3>
                          <ul className="list-disc space-y-1 pl-4 text-xs text-foreground">
                            {selectedVisit.doctorBrief.symptomTimeline.map(
                              (point, i) => (
                                <li key={i}>{point}</li>
                              )
                            )}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          </div>
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
            <span>Phase 1 Foundation Active</span>
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
