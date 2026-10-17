"use client";

import * as React from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ACCEPTED_IMAGE_LABEL,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  prepareImageFromFile,
  prepareImageFromUrl,
  type PreparedImage,
} from "@/lib/image-utils";
import {
  countMissingDays,
  FOOD_RELATION_OPTIONS,
  FREQUENCY_OPTIONS,
  MAX_DOSAGE_DAYS,
  MAX_MEDICATIONS,
  parseDays,
} from "@/lib/prescription-utils";
import {
  getSamplePrescription,
  SAMPLE_PRESCRIPTIONS,
} from "@/lib/sample-prescriptions";
import { cn } from "@/lib/utils";
import type {
  ExtractedMedication,
  FoodRelation,
  PrescriptionRecord,
  VisitRecord,
} from "@/types/sevasetu";

interface ManualRow {
  key: string;
  name: string;
  dosage: string;
  frequencyCode: string;
  foodRelation: FoodRelation;
  days: string;
  /** Set when editing an existing prescription so unchanged rows keep their purpose text. */
  original?: ExtractedMedication;
}

interface RowErrors {
  name?: string;
  days?: string;
}

let rowCounter = 0;
function newRow(partial: Partial<ManualRow> = {}): ManualRow {
  rowCounter += 1;
  return {
    key: `row-${rowCounter}`,
    name: "",
    dosage: "",
    frequencyCode: "OD",
    foodRelation: "after_food",
    days: "",
    ...partial,
  };
}

function rowsFromPrescription(rx: PrescriptionRecord): ManualRow[] {
  return rx.medications.map((m) =>
    newRow({
      name: m.name,
      dosage: m.dosage,
      frequencyCode: m.frequencyCode,
      foodRelation: m.foodRelation,
      days: m.daysOfDosage === null ? "" : String(m.daysOfDosage),
      original: m,
    })
  );
}

function rowToPayload(row: ManualRow): Record<string, unknown> {
  const name = row.name.trim();
  const payload: Record<string, unknown> = {
    name,
    dosage: row.dosage.trim(),
    frequencyCode: row.frequencyCode,
    foodRelation: row.foodRelation,
    daysOfDosage: row.days.trim() ? Number(row.days) : null,
  };
  const o = row.original;
  if (o && o.name === name) {
    // Same medicine: keep the existing plain-language explanation.
    payload.whatIsItUsedForEn = o.whatIsItUsedForEn;
    payload.whatIsItUsedForHi = o.whatIsItUsedForHi;
    payload.precautionNote = o.precautionNote;
    if (
      o.frequencyCode === row.frequencyCode &&
      o.foodRelation === row.foodRelation
    ) {
      payload.frequencyPlain = o.frequencyPlain;
      payload.recommendedTimes = o.recommendedTimes;
    }
  }
  return payload;
}

interface PrescriptionScannerProps {
  visits: VisitRecord[];
  /** When set, the manual tab edits this prescription instead of creating a new one. */
  editing: PrescriptionRecord | null;
  onCancelEdit: () => void;
  onSaved: (prescription: PrescriptionRecord) => void | Promise<void>;
}

export function PrescriptionScanner({
  visits,
  editing,
  onCancelEdit,
  onSaved,
}: PrescriptionScannerProps) {
  const [mode, setMode] = React.useState<"scan" | "manual">("scan");
  const [patientName, setPatientName] = React.useState("");
  const [visitId, setVisitId] = React.useState("none");

  const [image, setImage] = React.useState<PreparedImage | null>(null);
  const [sampleId, setSampleId] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isPreparing, setIsPreparing] = React.useState(false);
  const [isReading, setIsReading] = React.useState(false);

  const [rows, setRows] = React.useState<ManualRow[]>(() => [newRow()]);
  const [rowErrors, setRowErrors] = React.useState<Record<string, RowErrors>>(
    {}
  );
  const [isSaving, setIsSaving] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{
    tone: "success" | "warning";
    title: string;
    text: string;
  } | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  // Entering edit mode loads that prescription into the manual form.
  const editingId = editing?.id ?? null;
  React.useEffect(() => {
    if (editing) {
      setMode("manual");
      setRows(rowsFromPrescription(editing));
      setRowErrors({});
      setError(null);
      setNotice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

  function resetManualForm() {
    setRows([newRow()]);
    setRowErrors({});
  }

  function cancelEdit() {
    resetManualForm();
    setError(null);
    onCancelEdit();
  }

  /* ---------- Scan / upload ---------- */

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);
    setNotice(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError(`Unsupported file. Please choose a ${ACCEPTED_IMAGE_LABEL} image.`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That image is larger than 12 MB. Please choose a smaller photo.");
      return;
    }
    setIsPreparing(true);
    try {
      setImage(await prepareImageFromFile(file));
      setSampleId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that image.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleSample(id: string) {
    const sample = getSamplePrescription(id);
    if (!sample) return;
    setError(null);
    setNotice(null);
    setIsPreparing(true);
    try {
      setImage(await prepareImageFromUrl(sample.imagePath, `${sample.id}.jpg`));
      setSampleId(sample.id);
      if (visitId === "none") setPatientName(sample.patientName);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load the sample prescription."
      );
    } finally {
      setIsPreparing(false);
    }
  }

  function clearImage() {
    setImage(null);
    setSampleId(null);
    setError(null);
  }

  function handleVisitChange(value: string) {
    setVisitId(value);
    const visit = visits.find((v) => v.id === value);
    if (visit) setPatientName(visit.patientName);
  }

  async function handleReadPrescription() {
    if (!image) return;
    setIsReading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/gemma/parse-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: image.dataUrl,
          mimeType: image.mimeType,
          imageName: image.name,
          sampleId,
          patientName: patientName.trim() || undefined,
          visitId: visitId === "none" ? null : visitId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not read the prescription.");
      }
      const rx = data.prescription as PrescriptionRecord;
      const missing = countMissingDays(rx.medications);

      if (data.usedFallback) {
        setNotice({
          tone: "warning",
          title: "Showing demo data",
          text: "Gemma 4 could not be reached, so a sample prescription is shown instead of your photo. Add a GOOGLE_API_KEY or local Ollama endpoint to read real prescriptions.",
        });
      } else {
        setNotice({
          tone: "success",
          title: `Read ${rx.medications.length} ${rx.medications.length === 1 ? "medicine" : "medicines"}`,
          text:
            missing > 0
              ? `${missing} ${missing === 1 ? "medicine has" : "medicines have"} no clear number of days — please confirm below.`
              : "All dosage days were found on the prescription.",
        });
      }
      clearImage();
      await onSaved(rx);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsReading(false);
    }
  }

  /* ---------- Manual entry / edit ---------- */

  function updateRow(key: string, patch: Partial<ManualRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setRowErrors((prev) => (prev[key] ? { ...prev, [key]: {} } : prev));
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function validateRows(): boolean {
    const errors: Record<string, RowErrors> = {};
    let filled = 0;
    for (const row of rows) {
      const touched = row.name.trim() || row.dosage.trim() || row.days.trim();
      if (!touched) continue;
      filled += 1;
      const e: RowErrors = {};
      if (!row.name.trim()) e.name = "Enter the medicine name.";
      if (row.days.trim() && parseDays(row.days) === null) {
        e.days = `1–${MAX_DOSAGE_DAYS} days.`;
      }
      if (e.name || e.days) errors[row.key] = e;
    }
    setRowErrors(errors);
    if (filled === 0) {
      setError("Add at least one medicine.");
      return false;
    }
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields.");
      return false;
    }
    return true;
  }

  async function handleSaveManual() {
    setError(null);
    setNotice(null);
    if (!validateRows()) return;

    const medications = rows
      .filter((r) => r.name.trim())
      .map(rowToPayload);

    setIsSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/prescriptions/${editing.id}` : "/api/prescriptions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing
              ? { medications }
              : {
                  medications,
                  patientName: patientName.trim() || undefined,
                  visitId: visitId === "none" ? null : visitId,
                }
          ),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not save the prescription.");
      }
      const rx = data.prescription as PrescriptionRecord;
      const missing = countMissingDays(rx.medications);
      setNotice({
        tone: "success",
        title: editing ? "Prescription updated" : "Prescription saved",
        text:
          missing > 0
            ? `${missing} ${missing === 1 ? "medicine still needs" : "medicines still need"} its number of days.`
            : "Every medicine has its dosage days confirmed.",
      });
      resetManualForm();
      if (editing) onCancelEdit();
      await onSaved(rx);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  const busy = isPreparing || isReading || isSaving;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {editing ? "Edit medicines" : "Add your prescription"}
        </CardTitle>
        <CardDescription>
          {editing
            ? `Correct anything the scan got wrong for ${editing.patientName}.`
            : "Snap a photo of the prescription, or type the medicines in."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant={notice.tone === "warning" ? "warning" : "default"}>
            {notice.tone === "warning" ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            )}
            <AlertTitle>{notice.title}</AlertTitle>
            <AlertDescription>{notice.text}</AlertDescription>
          </Alert>
        )}

        {!editing && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rx-patient">
                Patient name{" "}
                <span className="font-devanagari font-normal text-muted-foreground">
                  (नाम)
                </span>
              </Label>
              <Input
                id="rx-patient"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Patient name"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rx-visit">Link to a visit</Label>
              <Select value={visitId} onValueChange={handleVisitChange}>
                <SelectTrigger id="rx-visit">
                  <SelectValue placeholder="Not linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {visits.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.tokenNumber} · {v.patientName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Tabs
          value={mode}
          onValueChange={(v) => {
            if (editing) return;
            setMode(v as "scan" | "manual");
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2 sm:w-64">
            <TabsTrigger value="scan" disabled={!!editing}>
              Scan photo
            </TabsTrigger>
            <TabsTrigger value="manual">Type it in</TabsTrigger>
          </TabsList>

          {/* ---------- SCAN ---------- */}
          <TabsContent value="scan" className="mt-4 space-y-4">
            {isPreparing || isReading ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <p className="text-sm font-medium">
                  {isReading
                    ? "Reading your prescription with Gemma 4…"
                    : "Preparing the image…"}
                </p>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            ) : image ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-lg border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.dataUrl}
                    alt="Prescription preview"
                    className="mx-auto max-h-80 w-auto object-contain"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 h-7 w-7 rounded-full shadow-sm"
                    onClick={clearImage}
                    aria-label="Remove image"
                  >
                    <X />
                  </Button>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {image.name}
                  {sampleId && " · sample prescription"}
                </p>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void handleFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isDragging && "border-primary bg-primary/5"
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium">
                  Drop a prescription photo here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  {ACCEPTED_IMAGE_LABEL} · up to 12 MB
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera />
                Take photo
              </Button>
              <span className="text-xs text-muted-foreground">Try a sample:</span>
              {SAMPLE_PRESCRIPTIONS.map((sample) => (
                <Button
                  key={sample.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={busy}
                  title={sample.description}
                  onClick={() => void handleSample(sample.id)}
                >
                  {sample.label}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* ---------- MANUAL ---------- */}
          <TabsContent value="manual" className="mt-4 space-y-3">
            {rows.map((row, idx) => {
              const rowError = rowErrors[row.key] ?? {};
              return (
                <div
                  key={row.key}
                  className="space-y-3 rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground tabular-nums">
                      Medicine {idx + 1}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => removeRow(row.key)}
                      disabled={rows.length === 1}
                      aria-label={`Remove medicine ${idx + 1}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.key}-name`}>Name</Label>
                    <Input
                      id={`${row.key}-name`}
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      placeholder="e.g. Tab Pantoprazole"
                      autoComplete="off"
                      aria-invalid={rowError.name ? true : undefined}
                    />
                    {rowError.name && (
                      <p className="text-xs text-destructive">{rowError.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${row.key}-dosage`}>Strength</Label>
                      <Input
                        id={`${row.key}-dosage`}
                        value={row.dosage}
                        onChange={(e) =>
                          updateRow(row.key, { dosage: e.target.value })
                        }
                        placeholder="40 mg"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${row.key}-days`}>
                        Days{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id={`${row.key}-days`}
                        inputMode="numeric"
                        value={row.days}
                        onChange={(e) =>
                          updateRow(row.key, {
                            days: e.target.value.replace(/\D/g, "").slice(0, 3),
                          })
                        }
                        placeholder="5"
                        className="tabular-nums"
                        aria-invalid={rowError.days ? true : undefined}
                      />
                      {rowError.days && (
                        <p className="text-xs text-destructive">{rowError.days}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${row.key}-freq`}>How often</Label>
                      <Select
                        value={row.frequencyCode}
                        onValueChange={(v) =>
                          updateRow(row.key, { frequencyCode: v })
                        }
                      >
                        <SelectTrigger id={`${row.key}-freq`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCY_OPTIONS.map((o) => (
                            <SelectItem key={o.code} value={o.code}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${row.key}-food`}>With food</Label>
                      <Select
                        value={row.foodRelation}
                        onValueChange={(v) =>
                          updateRow(row.key, { foodRelation: v as FoodRelation })
                        }
                      >
                        <SelectTrigger id={`${row.key}-food`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FOOD_RELATION_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length >= MAX_MEDICATIONS}
              onClick={() => setRows((prev) => [...prev, newRow()])}
            >
              <Plus />
              Add another medicine
            </Button>
            <p className="text-xs text-muted-foreground">
              Leave days empty if you don&apos;t know — we&apos;ll ask you next.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter className="justify-between gap-3 border-t pt-4">
        {mode === "scan" && !editing ? (
          <>
            <p className="text-xs text-muted-foreground">
              {image ? "Ready to read." : "Choose a photo or a sample."}
            </p>
            <Button onClick={handleReadPrescription} disabled={!image || busy}>
              <Sparkles />
              {isReading ? "Reading…" : "Read prescription"}
            </Button>
          </>
        ) : (
          <>
            {editing ? (
              <Button variant="ghost" onClick={cancelEdit} disabled={isSaving}>
                Cancel
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={handleSaveManual} disabled={busy}>
              {isSaving
                ? "Saving…"
                : editing
                  ? "Save changes"
                  : "Save prescription"}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
