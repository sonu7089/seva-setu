"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Mic,
  Sparkles,
  Square,
  UserPlus,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";
import {
  SAMPLE_SCENARIOS,
  type IntakeSampleScenario as SampleScenario,
} from "@/community-packs/intake-templates";
import {
  firstIntakeError,
  validateIntake,
  type IntakeField,
} from "@/lib/validation";
import {
  BayVitals,
  EntryByRole,
  InputModality,
  TextFollowUpQuestion,
  VisitRecord,
} from "@/types/sevasetu";

const SAMPLE_SCENARIO_LIST: SampleScenario[] = SAMPLE_SCENARIOS;

const SPEECH_LOCALE: Record<"hi" | "en", string> = {
  hi: "hi-IN",
  en: "en-IN",
};

interface PreVisitBayProps {
  onVisitSaved: (visit: VisitRecord) => void | Promise<void>;
  onOpenDoctorConsole: () => void;
}

export function PreVisitBay({
  onVisitSaved,
  onOpenDoctorConsole,
}: PreVisitBayProps) {
  const [entryBy, setEntryBy] = React.useState<EntryByRole>("nurse_bay");
  const [language, setLanguage] = React.useState<"hi" | "en">("hi");
  const [inputMode, setInputMode] = React.useState<InputModality>("text");

  const [patientName, setPatientName] = React.useState("");
  const [age, setAge] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [vitals, setVitals] = React.useState<BayVitals>({});
  const [transcript, setTranscript] = React.useState("");

  const [questions, setQuestions] = React.useState<TextFollowUpQuestion[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedVisit, setSavedVisit] = React.useState<VisitRecord | null>(null);
  // Inline validation: a field's error shows once it has been blurred, or after a blocked submit.
  const [touched, setTouched] = React.useState<
    Partial<Record<IntakeField, boolean>>
  >({});
  const [showAllErrors, setShowAllErrors] = React.useState(false);

  const appendTranscript = React.useCallback((text: string) => {
    if (!text) return;
    setTranscript((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  }, []);

  const speech = useSpeechRecognition({
    lang: SPEECH_LOCALE[language],
    onFinalTranscript: appendTranscript,
  });

  // Stop the mic when leaving the voice tab.
  const { listening: isListening, stop: stopListening } = speech;
  React.useEffect(() => {
    if (inputMode !== "voice" && isListening) stopListening();
  }, [inputMode, isListening, stopListening]);

  const errors = React.useMemo(
    () =>
      validateIntake({
        age,
        vitals,
        includeVitals: entryBy === "nurse_bay",
      }),
    [age, vitals, entryBy]
  );
  const hasErrors = Object.keys(errors).length > 0;
  // Required fields gate the button; format errors are revealed on click instead,
  // so the user always gets a visible explanation rather than a dead button.
  const hasRequired =
    transcript.trim().length > 0 &&
    gender.length > 0 &&
    age.trim().length > 0;
  const canContinue = hasRequired && !hasErrors;

  const fieldError = (field: IntakeField): string | undefined =>
    touched[field] || showAllErrors ? errors[field] : undefined;
  const markTouched = (field: IntakeField) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  const answeredCount = questions.filter((q) => q.answer?.trim()).length;

  function setVital(key: keyof BayVitals, value: string) {
    setVitals((prev) => ({ ...prev, [key]: value }));
  }

  function applySample(sample: SampleScenario) {
    setLanguage(sample.lang);
    setPatientName(sample.name);
    setAge(sample.age);
    setGender(sample.gender);
    setVitals(sample.vitals);
    setTranscript(sample.text);
    setQuestions([]);
    setError(null);
    setTouched({});
    setShowAllErrors(false);
  }

  function setAnswer(id: string, answer: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, answer } : q))
    );
  }

  function resetForm() {
    setPatientName("");
    setAge("");
    setGender("");
    setVitals({});
    setTranscript("");
    setQuestions([]);
    setSavedVisit(null);
    setError(null);
    setTouched({});
    setShowAllErrors(false);
  }

  const patientInfo = {
    name: patientName.trim() || undefined,
    age: age.trim(),
    gender,
    vitals: entryBy === "nurse_bay" ? vitals : undefined,
  };

  /** Reveals every inline error and blocks the action when the form is invalid. */
  function blockIfInvalid(): boolean {
    const message = firstIntakeError(errors);
    if (!message) return false;
    setShowAllErrors(true);
    setError(`Please fix the highlighted fields: ${message}`);
    return true;
  }

  async function handleGenerateFollowUps() {
    if (speech.listening) speech.stop();
    if (blockIfInvalid()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/gemma/previsit-followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryBy,
          inputMode,
          language,
          rawTranscript: transcript,
          patientInfo,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not generate questions");
      }
      setQuestions(
        (data.questions as TextFollowUpQuestion[]).map((q) => ({
          ...q,
          answer: "",
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSendToDoctor() {
    if (blockIfInvalid()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gemma/previsit-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryBy,
          inputMode,
          language,
          rawTranscript: transcript,
          patientInfo,
          followUps: questions,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not save the brief");
      }
      setSavedVisit(data.visit as VisitRecord);
      await onVisitSaved(data.visit as VisitRecord);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header + role */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Pre-Visit Bay{" "}
            <span className="font-devanagari text-base font-normal text-muted-foreground">
              (प्री-विज़िट)
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture symptoms in Hindi or English so the doctor can skip the
            routine questions.
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={entryBy}
          onValueChange={(v) => v && setEntryBy(v as EntryByRole)}
          aria-label="Who is filling this form"
          className="shrink-0"
        >
          <ToggleGroupItem value="nurse_bay">Nurse at waiting area</ToggleGroupItem>
          <ToggleGroupItem value="patient">Patient check-in</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* LEFT: patient + symptoms */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient details</CardTitle>
              <CardDescription>
                {entryBy === "nurse_bay"
                  ? "Basic details and vitals taken at the waiting area."
                  : "Tell us a little about yourself."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-6">
                <div className="space-y-1.5 sm:col-span-3">
                  <Label htmlFor="patient-name">
                    Name{" "}
                    <span className="font-devanagari font-normal text-muted-foreground">
                      (नाम)
                    </span>
                  </Label>
                  <Input
                    id="patient-name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Patient name"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="patient-age">
                    Age{" "}
                    <span className="font-devanagari font-normal text-muted-foreground">
                      (उम्र)
                    </span>
                  </Label>
                  <Input
                    id="patient-age"
                    inputMode="numeric"
                    value={age}
                    onChange={(e) =>
                      setAge(e.target.value.replace(/\D/g, "").slice(0, 3))
                    }
                    onBlur={() => markTouched("age")}
                    placeholder="46"
                    className="tabular-nums"
                    aria-invalid={fieldError("age") ? true : undefined}
                    aria-describedby={
                      fieldError("age") ? "patient-age-error" : undefined
                    }
                  />
                  <FieldError id="patient-age-error" message={fieldError("age")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="patient-gender">
                    Gender{" "}
                    <span className="font-devanagari font-normal text-muted-foreground">
                      (लिंग)
                    </span>
                  </Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="patient-gender">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {entryBy === "nurse_bay" && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Vitals</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <VitalField
                        id="vital-bp"
                        error={fieldError("bp")}
                        onBlur={() => markTouched("bp")}
                        label="BP"
                        unit="mmHg"
                        placeholder="120/80"
                        value={vitals.bp}
                        onChange={(v) => setVital("bp", v.replace(/[^\d/]/g, "").slice(0, 7))}
                      />
                      <VitalField
                        id="vital-temp"
                        error={fieldError("temp")}
                        onBlur={() => markTouched("temp")}
                        label="Temp"
                        unit="°F"
                        placeholder="98.6"
                        value={vitals.temp}
                        onChange={(v) => setVital("temp", v.replace(/[^\d.]/g, "").slice(0, 5))}
                      />
                      <VitalField
                        id="vital-pulse"
                        error={fieldError("pulse")}
                        onBlur={() => markTouched("pulse")}
                        label="Pulse"
                        unit="bpm"
                        placeholder="80"
                        value={vitals.pulse}
                        onChange={(v) => setVital("pulse", v.replace(/\D/g, "").slice(0, 3))}
                      />
                      <VitalField
                        id="vital-spo2"
                        error={fieldError("spo2")}
                        onBlur={() => markTouched("spo2")}
                        label="SpO₂"
                        unit="%"
                        placeholder="98"
                        value={vitals.spo2}
                        onChange={(v) => setVital("spo2", v.replace(/[^\d.]/g, "").slice(0, 5))}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Symptoms</CardTitle>
                  <CardDescription>
                    Speak or type — Hindi, English or a mix.
                  </CardDescription>
                </div>
                <ToggleGroup
                  type="single"
                  value={language}
                  onValueChange={(v) => v && setLanguage(v as "hi" | "en")}
                  aria-label="Language"
                >
                  <ToggleGroupItem value="hi" className="font-devanagari">
                    हिंदी
                  </ToggleGroupItem>
                  <ToggleGroupItem value="en">English</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Tabs
                value={inputMode}
                onValueChange={(v) => setInputMode(v as InputModality)}
              >
                <TabsList className="grid w-full grid-cols-2 sm:w-64">
                  <TabsTrigger value="text">Type</TabsTrigger>
                  <TabsTrigger value="voice">Voice</TabsTrigger>
                </TabsList>

                <TabsContent value="voice" className="mt-4">
                  {speech.supported === null ? (
                    <Skeleton className="h-[74px] w-full" />
                  ) : speech.supported === false ? (
                    <Alert variant="warning">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Voice input unavailable</AlertTitle>
                      <AlertDescription>
                        This browser does not support speech recognition. Use
                        Chrome or Edge, or switch to Type.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-4">
                      <Button
                        type="button"
                        size="icon"
                        variant={speech.listening ? "destructive" : "default"}
                        className={cn(
                          "h-12 w-12 shrink-0 rounded-full",
                          speech.listening && "animate-pulse"
                        )}
                        onClick={speech.listening ? speech.stop : speech.start}
                        aria-label={
                          speech.listening ? "Stop recording" : "Start recording"
                        }
                      >
                        {speech.listening ? (
                          <Square className="fill-current" />
                        ) : (
                          <Mic />
                        )}
                      </Button>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium">
                          {speech.listening
                            ? `Listening (${SPEECH_LOCALE[language]})…`
                            : "Tap the mic and start speaking"}
                        </p>
                        <p
                          className={cn(
                            "mt-0.5 truncate font-devanagari text-muted-foreground",
                            !speech.interim && "italic"
                          )}
                        >
                          {speech.interim ||
                            "Your words appear below as you speak."}
                        </p>
                      </div>
                    </div>
                  )}
                  {speech.error && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Voice input stopped</AlertTitle>
                      <AlertDescription>{speech.error}</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="text" className="mt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Try a sample:
                    </span>
                    {SAMPLE_SCENARIO_LIST.map((sample) => (
                      <Button
                        key={sample.label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 font-devanagari"
                        onClick={() => applySample(sample)}
                      >
                        {sample.label}
                      </Button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-1.5">
                <Label htmlFor="symptoms">
                  Chief complaint{" "}
                  <span className="font-devanagari font-normal text-muted-foreground">
                    (मुख्य समस्या)
                  </span>
                </Label>
                <Textarea
                  id="symptoms"
                  rows={4}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={
                    language === "hi"
                      ? "मरीज़ की तकलीफ़ यहाँ लिखें या बोलें…"
                      : "Describe the patient's symptoms…"
                  }
                  className="text-bilingual font-devanagari text-sm"
                />
              </div>
            </CardContent>

            <CardFooter className="justify-between gap-3 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                {(Object.keys(errors) as IntakeField[]).some((f) =>
                  fieldError(f)
                )
                  ? "Fix the highlighted fields to continue."
                  : !hasRequired
                    ? "Age, gender and symptoms are required."
                    : canContinue
                      ? "Next, a few quick follow-up questions."
                      : "Check the age and vitals before continuing."}
              </p>
              <Button
                onClick={handleGenerateFollowUps}
                disabled={!hasRequired || isGenerating || !!savedVisit}
              >
                <Sparkles />
                {isGenerating
                  ? "Preparing questions…"
                  : questions.length > 0
                    ? "Regenerate questions"
                    : "Continue"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* RIGHT: follow-up questions / confirmation */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          {savedVisit ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-semibold">Sent to the doctor</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-mono font-medium text-foreground">
                      {savedVisit.tokenNumber}
                    </span>{" "}
                    · {savedVisit.patientName} is in the queue with a ready
                    brief.
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <Button onClick={onOpenDoctorConsole}>
                    Open Doctor Console
                    <ArrowRight />
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    <UserPlus />
                    New patient
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Follow-up questions</CardTitle>
                  {questions.length > 0 && (
                    <Badge variant="secondary" className="tabular-nums">
                      {answeredCount}/{questions.length} answered
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  Routine history, so the doctor doesn&apos;t have to ask.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {isGenerating ? (
                  <div className="space-y-5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-4/5" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-24" />
                          <Skeleton className="h-8 w-28" />
                          <Skeleton className="h-8 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : questions.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    Fill in the details and tap{" "}
                    <span className="font-medium text-foreground">Continue</span>{" "}
                    to get tailored questions.
                  </div>
                ) : (
                  questions.map((q, idx) => (
                    <QuestionBlock
                      key={q.id}
                      index={idx + 1}
                      question={q}
                      onAnswer={(a) => setAnswer(q.id, a)}
                    />
                  ))
                )}
              </CardContent>

              {questions.length > 0 && !isGenerating && (
                <CardFooter className="border-t pt-4">
                  <Button
                    className="w-full"
                    onClick={handleSendToDoctor}
                    disabled={isSaving}
                  >
                    {isSaving ? "Preparing doctor brief…" : "Send brief to doctor"}
                    {!isSaving && <ArrowRight />}
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

function VitalField({
  id,
  label,
  unit,
  placeholder,
  value,
  error,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  unit: string;
  placeholder: string;
  value?: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-baseline justify-between">
        <span>{label}</span>
        <span className="text-[11px] font-normal text-muted-foreground">
          {unit}
        </span>
      </Label>
      <Input
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="tabular-nums"
        autoComplete="off"
        inputMode="decimal"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

function QuestionBlock({
  index,
  question,
  onAnswer,
}: {
  index: number;
  question: TextFollowUpQuestion;
  onAnswer: (answer: string) => void;
}) {
  const answer = question.answer ?? "";
  const matchesOption = question.quickOptionsEn.includes(answer);

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-medium leading-snug">
          {index}. {question.questionEn}
        </p>
        {question.questionHi && (
          <p className="mt-0.5 font-devanagari text-sm text-muted-foreground">
            {question.questionHi}
          </p>
        )}
      </div>

      <ToggleGroup
        type="single"
        value={matchesOption ? answer : ""}
        onValueChange={(v) => onAnswer(v)}
        className="flex-wrap"
        aria-label={question.questionEn}
      >
        {question.quickOptionsEn.map((opt, i) => (
          <ToggleGroupItem
            key={opt}
            value={opt}
            className="h-auto min-h-8 flex-col items-start gap-0 py-1.5 text-left"
          >
            <span>{opt}</span>
            {question.quickOptionsHi[i] && (
              <span className="font-devanagari text-[11px] font-normal text-muted-foreground">
                {question.quickOptionsHi[i]}
              </span>
            )}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Input
        value={matchesOption ? "" : answer}
        onChange={(e) => onAnswer(e.target.value)}
        placeholder="Or type a different answer"
        className="h-8 text-sm"
        aria-label={`Custom answer for question ${index}`}
      />
    </div>
  );
}
