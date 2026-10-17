"use client";

import * as React from "react";
import { AlertCircle, CalendarClock, Pencil } from "lucide-react";
import { CalendarScheduleCard } from "@/components/CalendarScheduleCard";
import { MedicineCard } from "@/components/MedicineCard";
import { PrescriptionScanner } from "@/components/PrescriptionScanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countMissingDays, parseDays, MAX_DOSAGE_DAYS } from "@/lib/prescription-utils";
import type {
  CalendarEventRecord,
  PrescriptionRecord,
  VisitRecord,
} from "@/types/sevasetu";

interface PostVisitWorkspaceProps {
  prescriptions: PrescriptionRecord[];
  visits: VisitRecord[];
  calendarEvents: CalendarEventRecord[];
  selectedPrescriptionId: string;
  onSelectPrescription: (id: string) => void;
  onRefresh: () => Promise<void>;
}

const SOURCE_LABEL: Record<PrescriptionRecord["sourceType"], string> = {
  scan: "Scanned with Gemma 4",
  manual: "Entered manually",
  demo: "Demo data",
};

export function PostVisitWorkspace({
  prescriptions,
  visits,
  calendarEvents,
  selectedPrescriptionId,
  onSelectPrescription,
  onRefresh,
}: PostVisitWorkspaceProps) {
  const active =
    prescriptions.find((p) => p.id === selectedPrescriptionId) ??
    prescriptions[0] ??
    null;

  const [editing, setEditing] = React.useState<PrescriptionRecord | null>(null);
  const [daysInput, setDaysInput] = React.useState<Record<string, string>>({});
  const [daysError, setDaysError] = React.useState<Record<string, string>>({});
  const [savingDaysId, setSavingDaysId] = React.useState<string | null>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  // A different prescription means a fresh set of pending inputs.
  const activeId = active?.id ?? null;
  React.useEffect(() => {
    setDaysInput({});
    setDaysError({});
  }, [activeId]);

  const missingCount = active ? countMissingDays(active.medications) : 0;
  const missingNames = active
    ? active.medications
        .filter((m) => m.daysOfDosage === null)
        .map((m) => m.name)
    : [];

  async function handleSaved(rx: PrescriptionRecord) {
    onSelectPrescription(rx.id);
    await onRefresh();
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function confirmDays(medId: string) {
    if (!active) return;
    const days = parseDays(daysInput[medId]);
    if (days === null) {
      setDaysError((prev) => ({
        ...prev,
        [medId]: `Enter a whole number from 1 to ${MAX_DOSAGE_DAYS}.`,
      }));
      return;
    }
    setDaysError((prev) => ({ ...prev, [medId]: "" }));
    setSavingDaysId(medId);
    try {
      const res = await fetch(`/api/prescriptions/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysByMedicationId: { [medId]: days } }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not save the number of days.");
      }
      setDaysInput((prev) => {
        const next = { ...prev };
        delete next[medId];
        return next;
      });
      await onRefresh();
    } catch (err) {
      setDaysError((prev) => ({
        ...prev,
        [medId]: err instanceof Error ? err.message : "Something went wrong.",
      }));
    } finally {
      setSavingDaysId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            After Your Visit{" "}
            <span className="font-devanagari text-base font-normal text-muted-foreground">
              (दवा पर्ची)
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan the prescription, confirm how long to take each medicine, and
            sync your schedule to Google Calendar.
          </p>
        </div>
        {prescriptions.length > 1 && active && (
          <div className="w-full sm:w-64">
            <Select value={active.id} onValueChange={onSelectPrescription}>
              <SelectTrigger aria-label="Choose prescription">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prescriptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.patientName} · {p.imageName || SOURCE_LABEL[p.sourceType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* LEFT: scanner / manual entry */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <PrescriptionScanner
            visits={visits}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onSaved={handleSaved}
          />
        </div>

        {/* RIGHT: results */}
        <div ref={resultsRef} className="scroll-mt-24 space-y-4 lg:col-span-7">
          {!active ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No prescription yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Scan a prescription or type the medicines in to see what each
                  one is used for.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {active.patientName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Prescribed by {active.doctorName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{SOURCE_LABEL[active.sourceType]}</Badge>
                    <Badge variant={missingCount > 0 ? "warning" : "success"}>
                      {missingCount > 0
                        ? "Needs days confirmation"
                        : active.calendarSyncStatus === "synced"
                          ? "Calendar synced"
                          : "All days confirmed"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(active)}
                    >
                      <Pencil />
                      Edit medicines
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {missingCount > 0 && (
                <Alert variant="warning">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    Dosage Days Required ({missingCount}{" "}
                    {missingCount === 1 ? "medicine" : "medicines"} missing
                    duration)
                  </AlertTitle>
                  <AlertDescription>
                    The prescription didn&apos;t clearly say how many days to
                    take {missingNames.join(", ")}. Confirm the days below —
                    calendar reminders stay on hold until every medicine has
                    its days.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {active.medications.map((med, idx) => (
                  <MedicineCard
                    key={med.id}
                    medication={med}
                    index={idx}
                    daysInput={daysInput[med.id] ?? ""}
                    onDaysInputChange={(value) => {
                      setDaysInput((prev) => ({ ...prev, [med.id]: value }));
                      if (daysError[med.id]) {
                        setDaysError((prev) => ({ ...prev, [med.id]: "" }));
                      }
                    }}
                    onConfirmDays={() => void confirmDays(med.id)}
                    isSavingDays={savingDaysId === med.id}
                    daysError={daysError[med.id] || undefined}
                  />
                ))}
              </div>
            </>
          )}

          <CalendarScheduleCard
            prescription={active}
            calendarEvents={calendarEvents}
            onSynced={onRefresh}
          />
        </div>
      </div>
    </div>
  );
}
