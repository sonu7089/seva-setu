"use client";

import * as React from "react";
import { CheckCircle2, Clock, Info, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  foodRelationLabel,
  foodRelationLabelHi,
  frequencyPlain,
  MAX_DOSAGE_DAYS,
} from "@/lib/prescription-utils";
import { cn } from "@/lib/utils";
import type { ExtractedMedication } from "@/types/sevasetu";

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

interface MedicineCardProps {
  medication: ExtractedMedication;
  index: number;
  /** Current text in the days input (controlled by the parent). */
  daysInput: string;
  onDaysInputChange: (value: string) => void;
  onConfirmDays: () => void;
  isSavingDays: boolean;
  daysError?: string;
}

/**
 * Patient-facing card: what the medicine is for (English + Hindi), when to take
 * it, and — when the prescription didn't say — a prompt for how many days.
 */
export function MedicineCard({
  medication: med,
  index,
  daysInput,
  onDaysInputChange,
  onConfirmDays,
  isSavingDays,
  daysError,
}: MedicineCardProps) {
  const [changingDays, setChangingDays] = React.useState(false);
  const needsDays = med.daysOfDosage === null;
  const showDaysForm = needsDays || changingDays;
  const inputId = `days-${med.id}`;

  // Close the "change" form once the new value has been saved.
  React.useEffect(() => {
    setChangingDays(false);
  }, [med.daysOfDosage]);

  return (
    <Card className={cn(needsDays && "border-amber-300")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground tabular-nums">
              Medicine {index + 1}
            </p>
            <CardTitle className="mt-0.5 text-base leading-snug">
              {med.name}{" "}
              {med.dosage && (
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {med.dosage}
                </span>
              )}
            </CardTitle>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="font-mono">
                {med.frequencyCode}
              </Badge>
              <Badge variant="outline">
                {foodRelationLabel(med.foodRelation)}
                <span className="ml-1 font-devanagari font-normal text-muted-foreground">
                  · {foodRelationLabelHi(med.foodRelation)}
                </span>
              </Badge>
            </div>
          </div>

          {needsDays ? (
            <Badge variant="warning">Days missing</Badge>
          ) : (
            <Badge variant="success" className="gap-1 tabular-nums">
              <CheckCircle2 className="h-3 w-3" />
              {med.daysOfDosage} {med.daysOfDosage === 1 ? "day" : "days"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            What is this medicine used for?{" "}
            <span className="font-devanagari normal-case tracking-normal">
              (दवा का उपयोग)
            </span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            {med.whatIsItUsedForEn}
          </p>
          <p className="text-bilingual mt-1 font-devanagari text-sm text-muted-foreground">
            {med.whatIsItUsedForHi}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {med.recommendedTimes.length > 0 ? (
              med.recommendedTimes.map((t) => (
                <span
                  key={t}
                  className="rounded-md border bg-background px-2 py-0.5 font-mono text-xs tabular-nums"
                >
                  {formatTime(t)}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                Take only when needed — no fixed time
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {med.frequencyPlain || frequencyPlain(med.frequencyCode)}
          </p>
          {med.precautionNote && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {med.precautionNote}
            </p>
          )}
        </div>

        {showDaysForm ? (
          <div
            className={cn(
              "rounded-md border p-3",
              needsDays
                ? "border-amber-200 bg-amber-50/70"
                : "bg-muted/30"
            )}
          >
            <Label
              htmlFor={inputId}
              className={cn(
                "block leading-snug",
                needsDays && "text-amber-900"
              )}
            >
              {needsDays
                ? "Dosage Days Required — how many days did the doctor ask you to take this medicine?"
                : "Change the number of days"}
              <span className="mt-0.5 block font-devanagari text-xs font-normal text-muted-foreground">
                डॉक्टर ने यह दवा कितने दिन तक लेने को कहा है?
              </span>
            </Label>
            <form
              className="mt-2.5 flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onConfirmDays();
              }}
            >
              <Input
                id={inputId}
                inputMode="numeric"
                value={daysInput}
                onChange={(e) =>
                  onDaysInputChange(e.target.value.replace(/\D/g, "").slice(0, 3))
                }
                placeholder="e.g. 5"
                className="w-24 tabular-nums"
                aria-invalid={daysError ? true : undefined}
                aria-describedby={daysError ? `${inputId}-error` : undefined}
              />
              <span className="text-sm text-muted-foreground">days</span>
              <Button type="submit" size="sm" disabled={isSavingDays}>
                {isSavingDays ? "Saving…" : "Confirm days"}
              </Button>
              {!needsDays && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setChangingDays(false)}
                >
                  Cancel
                </Button>
              )}
            </form>
            {daysError ? (
              <p id={`${inputId}-error`} className="mt-1.5 text-xs text-destructive">
                {daysError}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enter a whole number from 1 to {MAX_DOSAGE_DAYS}.
              </p>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-xs text-muted-foreground"
            onClick={() => {
              onDaysInputChange(String(med.daysOfDosage ?? ""));
              setChangingDays(true);
            }}
          >
            <Pencil />
            Change days
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
