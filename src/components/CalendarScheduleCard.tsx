"use client";

import * as React from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  KeyRound,
  RefreshCw,
  Trash2,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  addDaysToIsoDate,
  expandMedicationsToCalendarEvents,
  formatIsoDateParts,
  formatTime12h,
  generatePrescriptionIcs,
  getMealSlotInfo,
  getTodayIsoDate,
} from "@/lib/calendar-utils";
import {
  countMissingDays,
  foodRelationLabel,
  foodRelationLabelHi,
} from "@/lib/prescription-utils";
import { cn } from "@/lib/utils";
import type {
  CalendarEventRecord,
  PrescriptionRecord,
} from "@/types/sevasetu";

interface CalendarScheduleCardProps {
  prescription: PrescriptionRecord | null;
  calendarEvents: CalendarEventRecord[];
  onSynced: () => Promise<void>;
}

type SimulatorView = "day" | "week" | "removed";

interface SyncFeedback {
  mode: "google_oauth" | "local_simulator";
  removedCount: number;
  removedMedicineNames: string[];
  insertedCount: number;
  startDate: string;
  calendarId?: string;
}

const DAYS_WINDOW = 7;

export function CalendarScheduleCard({
  prescription,
  calendarEvents,
  onSynced,
}: CalendarScheduleCardProps) {
  const [startDate, setStartDate] = React.useState<string>(() =>
    getTodayIsoDate()
  );
  const [showOAuthConfig, setShowOAuthConfig] = React.useState(false);
  const [googleAccessToken, setGoogleAccessToken] = React.useState("");
  const [calendarId, setCalendarId] = React.useState("primary");

  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = React.useState<SyncFeedback | null>(
    null
  );

  const [view, setView] = React.useState<SimulatorView>("day");
  const [selectedDate, setSelectedDate] = React.useState<string>(() =>
    getTodayIsoDate()
  );
  const [weekStartOffset, setWeekStartOffset] = React.useState(0);

  const activeEvents = React.useMemo(
    () => calendarEvents.filter((e) => e.status === "active"),
    [calendarEvents]
  );
  const removedEvents = React.useMemo(
    () => calendarEvents.filter((e) => e.status === "removed_by_new_rx"),
    [calendarEvents]
  );

  // Distinct scheduled dates across active events
  const activeDates = React.useMemo(() => {
    const set = new Set<string>();
    for (const ev of activeEvents) {
      set.add(ev.scheduledDate);
    }
    return Array.from(set).sort();
  }, [activeEvents]);

  // Keep selectedDate pointing at a valid active date when events change
  React.useEffect(() => {
    if (activeDates.length > 0 && !activeDates.includes(selectedDate)) {
      setSelectedDate(activeDates[0]);
      setWeekStartOffset(0);
    }
  }, [activeDates, selectedDate]);

  // Clear stale feedback banner when switching to a different prescription
  const prescriptionId = prescription?.id ?? null;
  React.useEffect(() => {
    setSyncError(null);
    setSyncFeedback(null);
  }, [prescriptionId]);

  const missingCount = prescription
    ? countMissingDays(prescription.medications)
    : 0;

  // Preview how many total doses & days this prescription will schedule once synced
  const plannedSummary = React.useMemo(() => {
    if (!prescription || missingCount > 0) {
      return { totalDoses: 0, maxDays: 0 };
    }
    const previewEvents = expandMedicationsToCalendarEvents({
      prescriptionId: prescription.id,
      medications: prescription.medications,
      startDate,
    });
    const maxDays = prescription.medications.reduce(
      (max, m) => Math.max(max, m.daysOfDosage ?? 0),
      0
    );
    return {
      totalDoses: previewEvents.length,
      maxDays,
    };
  }, [prescription, missingCount, startDate]);

  // Check if active events in SQLite are from an older/different prescription (or pre-seeded previous Rx)
  const hasPreviousRxActiveEvents = React.useMemo(() => {
    if (activeEvents.length === 0) return false;
    if (!prescription) return false;
    if (prescription.calendarSyncStatus !== "synced") return true;
    return activeEvents.some((e) => e.prescriptionId !== prescription.id);
  }, [activeEvents, prescription]);

  // Build the 7-day strip anchored at the first active date (or startDate if empty)
  const baseDate = activeDates[0] || startDate;
  const visibleWeekDates = React.useMemo(() => {
    const anchor = addDaysToIsoDate(baseDate, weekStartOffset);
    return Array.from({ length: DAYS_WINDOW }, (_, idx) =>
      addDaysToIsoDate(anchor, idx)
    );
  }, [baseDate, weekStartOffset]);

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>();
    for (const ev of activeEvents) {
      const list = map.get(ev.scheduledDate) ?? [];
      list.push(ev);
      map.set(ev.scheduledDate, list);
    }
    return map;
  }, [activeEvents]);

  const selectedDayEvents = React.useMemo(
    () => eventsByDate.get(selectedDate) ?? [],
    [eventsByDate, selectedDate]
  );

  // Group the selected day's events by scheduledTime for clean meal-aligned timeline rendering
  const selectedDayTimeGroups = React.useMemo(() => {
    const groups: Array<{
      time: string;
      events: CalendarEventRecord[];
    }> = [];
    for (const ev of selectedDayEvents) {
      const existing = groups.find((g) => g.time === ev.scheduledTime);
      if (existing) {
        existing.events.push(ev);
      } else {
        groups.push({ time: ev.scheduledTime, events: [ev] });
      }
    }
    groups.sort((a, b) => a.time.localeCompare(b.time));
    return groups;
  }, [selectedDayEvents]);

  async function handleSyncCalendar() {
    if (!prescription || missingCount > 0) return;
    setIsSyncing(true);
    setSyncError(null);
    setSyncFeedback(null);

    try {
      const timezone =
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata"
          : "Asia/Kolkata";

      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescriptionId: prescription.id,
          replacePreviousPrescription: true,
          patientTimezone: timezone,
          startDate,
          medications: prescription.medications,
          googleAccessToken: googleAccessToken.trim() || undefined,
          calendarId: calendarId.trim() || "primary",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(
          data.error || "Could not sync prescription to Google Calendar."
        );
      }

      setSyncFeedback({
        mode: data.mode,
        removedCount: data.removedCount ?? 0,
        removedMedicineNames: data.removedMedicineNames ?? [],
        insertedCount: data.insertedCount ?? 0,
        startDate: data.startDate ?? startDate,
        calendarId: data.googleSync?.calendarId,
      });

      setSelectedDate(data.startDate ?? startDate);
      setWeekStartOffset(0);
      setView("day");
      await onSynced();
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Could not sync to Google Calendar."
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function handleDownloadIcs() {
    if (!prescription || missingCount > 0) return;
    const eventsForIcs =
      prescription.calendarSyncStatus === "synced" &&
      activeEvents.some((e) => e.prescriptionId === prescription.id)
        ? activeEvents.filter((e) => e.prescriptionId === prescription.id)
        : expandMedicationsToCalendarEvents({
            prescriptionId: prescription.id,
            medications: prescription.medications,
            startDate,
          });

    const icsContent = generatePrescriptionIcs({
      prescription,
      events: eventsForIcs,
    });

    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const slug = prescription.patientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `sevasetu-${slug || "rx"}-schedule.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isSynced =
    prescription?.calendarSyncStatus === "synced" && missingCount === 0;

  return (
    <div className="space-y-4">
      {/* 1. Smart Google Calendar Sync Action Card */}
      {prescription && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    missingCount > 0
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                  )}
                >
                  {missingCount > 0 ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">
                      {missingCount > 0
                        ? "Calendar sync is on hold"
                        : isSynced
                          ? "Synced to Google Calendar"
                          : "Ready for Google Calendar sync"}
                    </CardTitle>
                    {isSynced && <Badge variant="success">Synced</Badge>}
                  </div>
                  <CardDescription className="mt-1">
                    {missingCount > 0
                      ? `Confirm the days for ${missingCount} ${missingCount === 1 ? "medicine" : "medicines"} above to unlock scheduling.`
                      : `Schedules ${plannedSummary.totalDoses} ${plannedSummary.totalDoses === 1 ? "dose" : "doses"} across ${plannedSummary.maxDays} ${plannedSummary.maxDays === 1 ? "day" : "days"} and automatically removes outdated reminders (app=sevasetu-rx).`}
                  </CardDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => setShowOAuthConfig((prev) => !prev)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                {googleAccessToken.trim()
                  ? "Google OAuth active"
                  : "Google OAuth token"}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {syncError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Calendar sync failed</AlertTitle>
                <AlertDescription>{syncError}</AlertDescription>
              </Alert>
            )}

            {syncFeedback && (
              <Alert className="border-emerald-200 bg-emerald-50/60 text-emerald-950 [&>svg]:text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>
                  {syncFeedback.mode === "google_oauth"
                    ? `Synced with Google Calendar (${syncFeedback.calendarId || "primary"})`
                    : "Prescription schedule synced"}
                </AlertTitle>
                <AlertDescription className="mt-1 space-y-1 text-xs text-emerald-900">
                  <p>
                    <span className="font-semibold">Step 1 · Old cleanup:</span>{" "}
                    {syncFeedback.removedCount > 0
                      ? `Removed ${syncFeedback.removedCount} outdated ${syncFeedback.removedCount === 1 ? "reminder" : "reminders"} (${syncFeedback.removedMedicineNames.join(", ")}) tagged app=sevasetu-rx.`
                      : "No previous active reminders needed removal."}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Step 2 · New schedule:
                    </span>{" "}
                    Created {syncFeedback.insertedCount} meal-aligned medicine{" "}
                    {syncFeedback.insertedCount === 1
                      ? "reminder"
                      : "reminders"}{" "}
                    starting {formatIsoDateParts(syncFeedback.startDate).fullLabel}.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {showOAuthConfig && (
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">
                    Live Google Calendar API (optional)
                  </p>
                  <Badge variant="outline" className="text-[11px]">
                    {googleAccessToken.trim()
                      ? "Live Google OAuth Mode"
                      : "Simulator + SQLite Mode"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste a Google OAuth 2.0 access token with{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    calendar.events
                  </code>{" "}
                  scope to push directly to a live Google account, or leave blank
                  to use the built-in interactive Calendar Simulator and{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                    .ics
                  </code>{" "}
                  export.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="gcal-token" className="text-xs">
                      OAuth Bearer token
                    </Label>
                    <Input
                      id="gcal-token"
                      type="password"
                      value={googleAccessToken}
                      onChange={(e) => setGoogleAccessToken(e.target.value)}
                      placeholder="ya29.a0AfH6SM..."
                      autoComplete="off"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gcal-id" className="text-xs">
                      Calendar ID
                    </Label>
                    <Input
                      id="gcal-id"
                      value={calendarId}
                      onChange={(e) => setCalendarId(e.target.value)}
                      placeholder="primary"
                      autoComplete="off"
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <Label htmlFor="rx-start-date" className="text-xs">
                  Start date{" "}
                  <span className="font-devanagari font-normal text-muted-foreground">
                    (प्रारंभ तिथि)
                  </span>
                </Label>
                <Input
                  id="rx-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value || getTodayIsoDate())
                  }
                  disabled={missingCount > 0 || isSyncing}
                  className="h-9 w-full tabular-nums sm:w-44"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadIcs}
                  disabled={missingCount > 0}
                >
                  <Download />
                  Download .ics
                </Button>
                <Button
                  type="button"
                  onClick={handleSyncCalendar}
                  disabled={missingCount > 0 || isSyncing}
                >
                  {isSyncing ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <CalendarClock />
                  )}
                  {isSyncing
                    ? "Syncing schedule…"
                    : isSynced
                      ? "Re-sync to Google Calendar"
                      : "Sync to Google Calendar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 2. Interactive Google Calendar Simulator & Cleanup Log */}
      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Google Calendar Schedule{" "}
                <span className="font-devanagari font-normal text-muted-foreground">
                  (दवा समय-सारणी)
                </span>
              </CardTitle>
              <CardDescription className="mt-0.5">
                Interactive Day &amp; Week preview of active reminders tagged{" "}
                <span className="font-mono text-xs text-foreground">
                  app=sevasetu-rx
                </span>
                .
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="success" className="tabular-nums">
                {activeEvents.length} active
              </Badge>
              {removedEvents.length > 0 && (
                <Badge variant="secondary" className="tabular-nums">
                  {removedEvents.length} replaced
                </Badge>
              )}
            </div>
          </div>

          {hasPreviousRxActiveEvents && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>
                Currently showing{" "}
                <span className="font-semibold tabular-nums">
                  {activeEvents.length}
                </span>{" "}
                active{" "}
                {activeEvents.length === 1 ? "reminder" : "reminders"} from an
                earlier prescription. Syncing the prescription above will
                automatically remove and replace them.
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as SimulatorView)}
              aria-label="Calendar simulator view"
            >
              <ToggleGroupItem value="day" className="text-xs">
                Day view
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="text-xs">
                Week overview
              </ToggleGroupItem>
              <ToggleGroupItem
                value="removed"
                className="text-xs tabular-nums"
              >
                Replaced ({removedEvents.length})
              </ToggleGroupItem>
            </ToggleGroup>

            {view !== "removed" && activeDates.length > 0 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={weekStartOffset <= 0}
                  onClick={() =>
                    setWeekStartOffset((prev) => Math.max(0, prev - DAYS_WINDOW))
                  }
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-1.5 text-xs text-muted-foreground tabular-nums">
                  {formatIsoDateParts(visibleWeekDates[0]).fullLabel} –{" "}
                  {
                    formatIsoDateParts(
                      visibleWeekDates[visibleWeekDates.length - 1]
                    ).fullLabel
                  }
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={
                    weekStartOffset + DAYS_WINDOW >=
                    Math.max(activeDates.length, DAYS_WINDOW)
                  }
                  onClick={() =>
                    setWeekStartOffset((prev) => prev + DAYS_WINDOW)
                  }
                  aria-label="Next week"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {view === "day" && (
            <>
              {activeEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                  No active medicine reminders in Google Calendar yet. Confirm
                  dosage days and tap{" "}
                  <span className="font-medium text-foreground">
                    Sync to Google Calendar
                  </span>{" "}
                  above.
                </div>
              ) : (
                <>
                  {/* 7-Day Date Strip */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {visibleWeekDates.map((iso) => {
                      const parts = formatIsoDateParts(iso);
                      const count = eventsByDate.get(iso)?.length ?? 0;
                      const isSelected = iso === selectedDate;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => setSelectedDate(iso)}
                          className={cn(
                            "flex flex-col items-center rounded-md border px-1.5 py-2 text-center transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5 text-foreground shadow-sm"
                              : count > 0
                                ? "bg-background text-foreground hover:bg-accent/60"
                                : "bg-muted/20 text-muted-foreground hover:bg-accent/40"
                          )}
                        >
                          <span className="text-[10px] font-medium uppercase text-muted-foreground">
                            {parts.weekday}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 text-sm font-semibold tabular-nums",
                              isSelected && "text-primary"
                            )}
                          >
                            {parts.dayNum}
                          </span>
                          <span className="mt-1 rounded px-1 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                            {count > 0
                              ? `${count} ${count === 1 ? "dose" : "doses"}`
                              : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <Separator />

                  {/* Selected Day Timeline */}
                  {selectedDayTimeGroups.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                      No medicine doses scheduled on{" "}
                      <span className="font-medium text-foreground">
                        {formatIsoDateParts(selectedDate).fullLabel}
                      </span>
                      .
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {formatIsoDateParts(selectedDate).fullLabel}
                        </span>
                        <span className="tabular-nums">
                          {selectedDayEvents.length}{" "}
                          {selectedDayEvents.length === 1
                            ? "reminder"
                            : "reminders"}{" "}
                          scheduled
                        </span>
                      </div>

                      <div className="space-y-3">
                        {selectedDayTimeGroups.map((group) => {
                          const slot = getMealSlotInfo(
                            group.time,
                            group.events[0].foodRelation
                          );
                          return (
                            <div
                              key={group.time}
                              className="rounded-lg border bg-muted/15 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary">
                                    <Clock className="h-3 w-3" />
                                    {formatTime12h(group.time)}
                                  </span>
                                  <span className="text-xs font-medium text-foreground">
                                    {slot.labelEn}
                                  </span>
                                  <span className="font-devanagari text-xs text-muted-foreground">
                                    · {slot.labelHi}
                                  </span>
                                </div>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  10m popup reminder
                                </span>
                              </div>

                              <div className="space-y-2">
                                {group.events.map((ev) => (
                                  <div
                                    key={ev.id}
                                    className="rounded-md border bg-card p-3"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <p className="text-sm font-semibold text-foreground">
                                          {ev.medicineName}{" "}
                                          {ev.dosage && (
                                            <span className="font-mono text-xs font-normal text-muted-foreground">
                                              ({ev.dosage})
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      <Badge variant="outline" className="text-[11px]">
                                        {foodRelationLabel(ev.foodRelation)}
                                        <span className="ml-1 font-devanagari font-normal text-muted-foreground">
                                          · {foodRelationLabelHi(ev.foodRelation)}
                                        </span>
                                      </Badge>
                                    </div>

                                    <div className="mt-2 rounded border bg-muted/25 px-2.5 py-2 text-xs">
                                      <p className="text-foreground">
                                        {ev.whatIsItUsedForEn}
                                      </p>
                                      {ev.whatIsItUsedForHi && (
                                        <p className="text-bilingual mt-0.5 font-devanagari text-muted-foreground">
                                          {ev.whatIsItUsedForHi}
                                        </p>
                                      )}
                                    </div>

                                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                      <span className="truncate font-mono">
                                        {ev.googleEventId}
                                      </span>
                                      <Badge
                                        variant="success"
                                        className="text-[10px]"
                                      >
                                        Active
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {view === "week" && (
            <div className="space-y-2.5">
              {visibleWeekDates.map((iso) => {
                const parts = formatIsoDateParts(iso);
                const dayEvents = eventsByDate.get(iso) ?? [];
                return (
                  <div
                    key={iso}
                    className="flex flex-col gap-2 rounded-lg border bg-muted/15 p-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(iso);
                        setView("day");
                      }}
                      className="flex shrink-0 items-baseline gap-2 text-left hover:underline sm:w-32"
                    >
                      <span className="text-xs font-semibold text-foreground">
                        {parts.fullLabel}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                        ({dayEvents.length})
                      </span>
                    </button>

                    {dayEvents.length === 0 ? (
                      <p className="text-xs text-muted-foreground sm:flex-1">
                        No scheduled doses
                      </p>
                    ) : (
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {dayEvents.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => {
                              setSelectedDate(iso);
                              setView("day");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-left text-xs transition-colors hover:bg-accent"
                          >
                            <span className="font-mono font-semibold tabular-nums text-primary">
                              {ev.scheduledTime}
                            </span>
                            <span className="font-medium text-foreground">
                              {ev.medicineName}
                            </span>
                            {ev.dosage && (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {ev.dosage}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {view === "removed" && (
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Events from earlier prescriptions tagged with{" "}
                <span className="font-mono text-foreground">
                  app=sevasetu-rx
                </span>{" "}
                that were automatically removed when a new prescription was
                synced.
              </p>

              {removedEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No replaced reminders yet. Sync a prescription above to see
                  outdated reminders get cleaned up automatically.
                </div>
              ) : (
                removedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-md border bg-muted/20 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium text-muted-foreground line-through">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {ev.medicineName} ({ev.dosage})
                      </span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {formatIsoDateParts(ev.scheduledDate).fullLabel} ·{" "}
                        {formatTime12h(ev.scheduledTime)}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {ev.whatIsItUsedForEn}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate font-mono">
                        {ev.googleEventId}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        Replaced by new Rx
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
