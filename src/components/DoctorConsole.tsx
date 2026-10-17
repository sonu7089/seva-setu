"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Clock,
  Inbox,
  Mic,
  RefreshCw,
  Undo2,
  Type,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { TriagePriority, VisitRecord, VisitStatus } from "@/types/sevasetu";

const POLL_INTERVAL_MS = 10_000;

const PRIORITY_RANK: Record<TriagePriority, number> = {
  Urgent: 0,
  Priority: 1,
  Routine: 2,
};

const PRIORITY_BADGE: Record<
  TriagePriority,
  "urgent" | "warning" | "secondary"
> = {
  Urgent: "urgent",
  Priority: "warning",
  Routine: "secondary",
};

function getPriority(visit: VisitRecord): TriagePriority {
  return visit.doctorBrief?.triagePriority ?? "Routine";
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** Adds a unit only when the stored value doesn't already include one. */
function withUnit(value: string | undefined, unit: string): string {
  if (!value) return "—";
  return /[a-z°%]/i.test(value) ? value : `${value} ${unit}`;
}

interface DoctorConsoleProps {
  visits: VisitRecord[];
  selectedVisitId: string;
  onSelectVisit: (id: string) => void;
  onRefresh: () => Promise<void>;
  onUpdateVisitStatus: (id: string, status: VisitStatus) => Promise<void>;
}

type QueueView = "waiting" | "completed";

export function DoctorConsole({
  visits,
  selectedVisitId,
  onSelectVisit,
  onRefresh,
  onUpdateVisitStatus,
}: DoctorConsoleProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [view, setView] = React.useState<QueueView>("waiting");
  // On narrow screens the queue and the brief are separate screens (list -> detail).
  const [mobilePane, setMobilePane] = React.useState<"list" | "detail">("list");
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh]);

  // Keep the queue live while the doctor has this tab open.
  React.useEffect(() => {
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const waiting = React.useMemo(
    () =>
      visits
        .filter((v) => v.status !== "completed")
        .sort(
          (a, b) =>
            PRIORITY_RANK[getPriority(a)] - PRIORITY_RANK[getPriority(b)] ||
            a.createdAt.localeCompare(b.createdAt)
        ),
    [visits]
  );
  const completed = React.useMemo(
    () =>
      visits
        .filter((v) => v.status === "completed")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [visits]
  );

  const list = view === "waiting" ? waiting : completed;
  const selected = list.find((v) => v.id === selectedVisitId) ?? list[0] ?? null;

  function openVisit(id: string) {
    onSelectVisit(id);
    setMobilePane("detail");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changeView(next: QueueView) {
    setView(next);
    setMobilePane("list");
    setActionError(null);
  }

  async function changeStatus(visit: VisitRecord, status: VisitStatus) {
    setUpdatingId(visit.id);
    setActionError(null);
    try {
      await onUpdateVisitStatus(visit.id, status);
      // Hand the doctor the next patient in the list they were working through.
      const remaining = list.filter((v) => v.id !== visit.id);
      if (remaining[0]) onSelectVisit(remaining[0].id);
      setMobilePane("list");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not update this patient."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Doctor Console{" "}
            <span className="font-devanagari text-base font-normal text-muted-foreground">
              (डॉक्टर पटल)
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-visit briefs, ready before the patient walks in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 tabular-nums">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {waiting.length} in queue
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn(isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => v && changeView(v as QueueView)}
        aria-label="Queue view"
      >
        <ToggleGroupItem value="waiting" className="tabular-nums">
          Waiting ({waiting.length})
        </ToggleGroupItem>
        <ToggleGroupItem value="completed" className="tabular-nums">
          Completed ({completed.length})
        </ToggleGroupItem>
      </ToggleGroup>

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t update the queue</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {list.length === 0 || !selected ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            {view === "waiting" ? (
              <>
                <Inbox className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">
                  {completed.length > 0 ? "Queue cleared" : "No patients waiting"}
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {completed.length > 0
                    ? "Everyone has been seen. New briefs from the Pre-Visit Bay will appear here."
                    : "Patients appear here as soon as the nurse or patient sends a brief from the Pre-Visit Bay."}
                </p>
              </>
            ) : (
              <>
                <CheckCheck className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No completed patients yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Patients you mark as seen move here, so you can look them up
                  again.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* Queue */}
          <Card
            className={cn(
              "lg:col-span-4",
              mobilePane === "detail" && "hidden lg:block"
            )}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {view === "waiting" ? "Waiting queue" : "Completed"}
              </CardTitle>
              <CardDescription>
                {view === "waiting"
                  ? "Urgent cases first, then by arrival."
                  : "Most recently seen first."}
              </CardDescription>
            </CardHeader>
            <ScrollArea className="max-h-[560px]">
              <ul className="space-y-1 px-3 pb-3">
                {list.map((visit) => {
                  const priority = getPriority(visit);
                  const isSelected = visit.id === selected.id;
                  return (
                    <li key={visit.id}>
                      <button
                        type="button"
                        onClick={() => openVisit(visit.id)}
                        aria-current={isSelected ? "true" : undefined}
                        className={cn(
                          "w-full rounded-md border border-transparent p-3 text-left transition-colors hover:bg-accent/60",
                          isSelected && "border-border bg-accent"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {visit.tokenNumber}
                          </span>
                          {view === "completed" ? (
                            <Badge variant="success">Seen</Badge>
                          ) : (
                            <Badge variant={PRIORITY_BADGE[priority]}>
                              {priority}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium">
                          {visit.patientName}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {visit.age} yrs · {visit.gender} ·{" "}
                          {view === "completed"
                            ? `seen ${timeAgo(visit.updatedAt)}`
                            : timeAgo(visit.createdAt)}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                          {visit.doctorBrief?.chiefComplaint ||
                            visit.rawTranscript}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </Card>

          {/* Brief */}
          <div
            className={cn(
              "space-y-3 lg:col-span-8",
              mobilePane === "list" && "hidden lg:block"
            )}
          >
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 lg:hidden"
              onClick={() => setMobilePane("list")}
            >
              <ArrowLeft />
              Back to {view === "waiting" ? "queue" : "completed"}
            </Button>
            <BriefCard
              visit={selected}
              busy={updatingId === selected.id}
              onMarkSeen={() => changeStatus(selected, "completed")}
              onReopen={() => changeStatus(selected, "ready_for_doctor")}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BriefCard({
  visit,
  busy,
  onMarkSeen,
  onReopen,
}: {
  visit: VisitRecord;
  busy: boolean;
  onMarkSeen: () => void;
  onReopen: () => void;
}) {
  const isCompleted = visit.status === "completed";
  const brief = visit.doctorBrief;
  const priority = getPriority(visit);

  const history = brief?.followUpSummary?.length
    ? brief.followUpSummary
    : visit.followUpQuestions.map((q) => ({
        question: q.questionEn,
        answer: q.answer || "Not specified",
      }));

  const vitals = [
    { label: "BP", value: withUnit(visit.vitals.bp, "mmHg") },
    { label: "Temp", value: withUnit(visit.vitals.temp, "°F") },
    { label: "Pulse", value: withUnit(visit.vitals.pulse, "bpm") },
    { label: "SpO₂", value: withUnit(visit.vitals.spo2, "%") },
  ];

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono font-semibold text-primary">
                {visit.tokenNumber}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="tabular-nums">
                {visit.age} yrs · {visit.gender}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="inline-flex items-center gap-1">
                {visit.inputMode === "voice" ? (
                  <Mic className="h-3 w-3" />
                ) : (
                  <Type className="h-3 w-3" />
                )}
                {visit.entryBy === "nurse_bay" ? "Nurse bay" : "Self check-in"}
              </span>
            </div>
            <CardTitle className="mt-1.5 text-xl">{visit.patientName}</CardTitle>
          </div>
          <div className="flex flex-col items-end gap-2">
            {isCompleted ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Seen
              </Badge>
            ) : (
              <Badge variant={PRIORITY_BADGE[priority]}>{priority}</Badge>
            )}
            {isCompleted ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onReopen}
                disabled={busy}
              >
                <Undo2 />
                {busy ? "Updating…" : "Move back to queue"}
              </Button>
            ) : (
              <Button size="sm" onClick={onMarkSeen} disabled={busy}>
                <CheckCircle2 />
                {busy ? "Updating…" : "Mark as seen"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {vitals.map((v) => (
            <div key={v.label} className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{v.label}</p>
              <p className="text-sm font-semibold tabular-nums">{v.value}</p>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Section title="Chief complaint">
          <p className="text-base font-medium leading-snug">
            {brief?.chiefComplaint || visit.rawTranscript}
          </p>
          {brief?.chiefComplaintHi && (
            <p className="mt-1 font-devanagari text-sm text-muted-foreground">
              {brief.chiefComplaintHi}
            </p>
          )}
        </Section>

        {history.length > 0 && (
          <Section title="History from the bay">
            <dl className="divide-y rounded-md border">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  className="grid gap-1 px-3 py-2.5 text-sm sm:grid-cols-5 sm:gap-4"
                >
                  <dt className="text-muted-foreground sm:col-span-2">
                    {item.question}
                  </dt>
                  <dd className="font-medium sm:col-span-3">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        {(brief?.symptomTimeline?.length ?? 0) > 0 && (
          <Section title="Timeline">
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {brief!.symptomTimeline.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </Section>
        )}

        {(brief?.clinicalNotes?.length ?? 0) > 0 && (
          <Section title="Notes for the doctor">
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {brief!.clinicalNotes!.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </Section>
        )}

        <Separator />

        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 px-3 py-2.5 text-sm">
            <p className="mb-0.5 text-xs font-medium text-muted-foreground">
              Original words ({visit.language === "hi" ? "Hindi" : "English"})
            </p>
            <p className="font-devanagari text-bilingual">
              &ldquo;{visit.rawTranscript}&rdquo;
            </p>
          </div>
          {brief?.timeSavedNote && (
            <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
              <Clock className="h-3.5 w-3.5" />
              {brief.timeSavedNote}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
