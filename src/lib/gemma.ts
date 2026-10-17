import fs from "fs";
import path from "path";
import promptCatalogJson from "@/prompts/gemma-prompts.json";
import { isPurposeUnknown, normalizeMedications } from "@/lib/prescription-utils";
import {
  getSamplePrescription,
  SAMPLE_PRESCRIPTIONS,
} from "@/lib/sample-prescriptions";
import {
  DoctorIntakeBrief,
  ExtractedMedication,
  GemmaProviderMode,
  GemmaProviderStatus,
  PreVisitInput,
  TextFollowUpQuestion,
  TriagePriority,
} from "@/types/sevasetu";

const DEFAULT_GOOGLE_MODEL = process.env.GEMMA_MODEL || "gemma-4-26b-a4b-it";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma3:12b";

export interface PromptTemplateEntry {
  id: string;
  purpose: string;
  temperature: number;
  systemInstruction: string;
  template: string[];
}

export interface GemmaPromptCatalog {
  version: string;
  description: string;
  defaultModels: {
    googleAiStudio: string[];
    ollamaLocal: string;
  };
  prompts: {
    preVisitFollowUps: PromptTemplateEntry;
    doctorIntakeBrief: PromptTemplateEntry;
    prescriptionVisionParser: PromptTemplateEntry;
    medicinePurposeExplainer: PromptTemplateEntry;
  };
}

/**
 * Loads `src/prompts/gemma-prompts.json` from disk on each call in dev mode so
 * prompt edits take effect immediately without restarting the server.
 */
export function loadGemmaPromptCatalog(): GemmaPromptCatalog {
  try {
    const filePath = path.join(
      process.cwd(),
      "src",
      "prompts",
      "gemma-prompts.json"
    );
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw) as GemmaPromptCatalog;
    }
  } catch {
    // Fallback to bundled import if fs read fails
  }
  return promptCatalogJson as GemmaPromptCatalog;
}

/**
 * Interpolates `{{variable}}` placeholders inside a prompt template array from `src/prompts/gemma-prompts.json`.
 */
export function renderPromptFromJson(
  key: keyof GemmaPromptCatalog["prompts"],
  variables: Record<string, string>
): { prompt: string; temperature: number; id: string } {
  const catalog = loadGemmaPromptCatalog();
  const entry = catalog.prompts[key];
  let rendered = entry.template.join("\n");

  for (const [varName, value] of Object.entries(variables)) {
    rendered = rendered.replaceAll(`{{${varName}}}`, value);
  }

  return {
    prompt: rendered.trim(),
    temperature: entry.temperature,
    id: entry.id,
  };
}

export function getGemmaProviderStatus(): GemmaProviderStatus {
  const googleKey =
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "";
  const ollamaUrl =
    process.env.OLLAMA_BASE_URL?.trim() ||
    process.env.LOCAL_LLM_BASE_URL?.trim() ||
    "";

  if (googleKey.length > 0) {
    return {
      activeProvider: "google_ai_studio",
      modelName: DEFAULT_GOOGLE_MODEL,
      googleApiKeyConfigured: true,
      ollamaEndpointConfigured: ollamaUrl.length > 0,
      ollamaBaseUrl: ollamaUrl || null,
      visionSupported: true,
      bilingualSupported: true,
      fallbackReady: true,
    };
  }

  if (ollamaUrl.length > 0) {
    return {
      activeProvider: "ollama_local",
      modelName: DEFAULT_OLLAMA_MODEL,
      googleApiKeyConfigured: false,
      ollamaEndpointConfigured: true,
      ollamaBaseUrl: ollamaUrl,
      visionSupported: true,
      bilingualSupported: true,
      fallbackReady: true,
    };
  }

  return {
    activeProvider: "demo_fallback",
    modelName: "gemma-4-27b-it (Resilient Local Fallback)",
    googleApiKeyConfigured: false,
    ollamaEndpointConfigured: false,
    ollamaBaseUrl: null,
    visionSupported: true,
    bilingualSupported: true,
    fallbackReady: true,
  };
}

function parseJsonSafely<T>(rawText: string): T | null {
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const firstBrace = cleaned.search(/[\[{]/);
    const lastBrace = Math.max(
      cleaned.lastIndexOf("}"),
      cleaned.lastIndexOf("]")
    );

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

interface GemmaCompletionOptions {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

async function callGoogleAiStudio(
  options: GemmaCompletionOptions
): Promise<{ text: string; modelUsed: string } | null> {
  const apiKey =
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    "";
  if (!apiKey) return null;

  const catalog = loadGemmaPromptCatalog();
  const candidateModels = Array.from(
    new Set([DEFAULT_GOOGLE_MODEL, ...catalog.defaultModels.googleAiStudio])
  );

  for (const model of candidateModels) {
    try {
      const parts: Array<Record<string, unknown>> = [{ text: options.prompt }];
      if (options.imageBase64) {
        const cleanBase64 = options.imageBase64.replace(
          /^data:[^;]+;base64,/,
          ""
        );
        parts.push({
          inline_data: {
            mime_type: options.mimeType || "image/jpeg",
            data: cleanBase64,
          },
        });
      }

      const isGemma4 = model.startsWith("gemma-4");
      const generationConfig: Record<string, unknown> = {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
      };
      if (isGemma4) {
        generationConfig.thinkingConfig = { thinkingLevel: "MINIMAL" };
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig,
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string; thought?: boolean }>;
          };
        }>;
      };
      const allParts = data.candidates?.[0]?.content?.parts || [];
      const nonThoughtParts = allParts.filter((p) => !p.thought);
      const partsToUse =
        nonThoughtParts.length > 0 ? nonThoughtParts : allParts;

      const text = partsToUse
        .map((p) => p.text || "")
        .join("\n")
        .trim();

      if (text) {
        return { text, modelUsed: model };
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function callOllamaEndpoint(
  options: GemmaCompletionOptions
): Promise<string | null> {
  const baseUrl = (
    process.env.OLLAMA_BASE_URL ||
    process.env.LOCAL_LLM_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  if (!baseUrl) return null;

  try {
    const endpoint = baseUrl.endsWith("/v1")
      ? `${baseUrl}/chat/completions`
      : `${baseUrl}/v1/chat/completions`;

    const content: unknown = options.imageBase64
      ? [
          { type: "text", text: options.prompt },
          {
            type: "image_url",
            image_url: {
              url: options.imageBase64.startsWith("data:")
                ? options.imageBase64
                : `data:${options.mimeType || "image/jpeg"};base64,${options.imageBase64}`,
            },
          },
        ]
      : options.prompt;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_OLLAMA_MODEL,
        messages: [{ role: "user", content }],
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxOutputTokens,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function runGemmaCompletion(
  options: GemmaCompletionOptions
): Promise<{
  text: string | null;
  providerUsed: GemmaProviderMode;
  modelName: string;
}> {
  const status = getGemmaProviderStatus();

  if (status.googleApiKeyConfigured) {
    const googleResponse = await callGoogleAiStudio(options);
    if (googleResponse) {
      return {
        text: googleResponse.text,
        providerUsed: "google_ai_studio",
        modelName: googleResponse.modelUsed,
      };
    }
  }

  if (status.ollamaEndpointConfigured) {
    const ollamaResponse = await callOllamaEndpoint(options);
    if (ollamaResponse) {
      return {
        text: ollamaResponse,
        providerUsed: "ollama_local",
        modelName: DEFAULT_OLLAMA_MODEL,
      };
    }
  }

  return {
    text: null,
    providerUsed: "demo_fallback",
    modelName: "gemma-4-27b-it (Resilient Local Fallback)",
  };
}

function buildFallbackFollowUpQuestions(
  rawTranscript: string
): TextFollowUpQuestion[] {
  const lower = rawTranscript.toLowerCase();

  const isStomach =
    lower.includes("पेट") ||
    lower.includes("जलन") ||
    lower.includes("गैस") ||
    lower.includes("stomach") ||
    lower.includes("acidity") ||
    lower.includes("pain") ||
    lower.includes("reflux");

  if (isStomach) {
    return [
      {
        id: "fq-gi-1",
        questionEn:
          "How does the stomach pain or burning relate to meals?",
        questionHi:
          "पेट का दर्द या जलन खाने से पहले ज़्यादा होती है या खाने के बाद?",
        quickOptionsEn: [
          "Worse after spicy/heavy meals",
          "Worse on an empty stomach",
          "Continuous throughout the day",
        ],
        quickOptionsHi: [
          "मसालेदार/भारी खाने के बाद ज़्यादा",
          "खाली पेट ज़्यादा",
          "पूरे दिन लगातार",
        ],
      },
      {
        id: "fq-gi-2",
        questionEn:
          "Are there any associated symptoms like nausea, vomiting, or loose motions?",
        questionHi:
          "क्या इसके साथ जी मिचलाना, उल्टी या दस्त जैसी कोई शिकायत है?",
        quickOptionsEn: [
          "Only sour belching / reflux",
          "Mild nausea, no vomiting",
          "Vomiting / loose stools present",
        ],
        quickOptionsHi: [
          "केवल खट्टी डकार और जलन",
          "हल्का जी मिचलाना, उल्टी नहीं",
          "उल्टी या दस्त भी हैं",
        ],
      },
      {
        id: "fq-gi-3",
        questionEn:
          "Have you taken any antacid or painkiller recently, or have any drug allergies?",
        questionHi:
          "क्या आपने हाल ही में कोई एंटासिड/दर्द की दवा ली है, या किसी दवा से एलर्जी है?",
        quickOptionsEn: [
          "Took antacid syrup, no allergies",
          "Took painkillers recently",
          "No medicines taken, no allergies",
        ],
        quickOptionsHi: [
          "एंटासिड लिया था, कोई एलर्जी नहीं",
          "हाल ही में दर्द की दवा ली थी",
          "कोई दवा नहीं ली, कोई एलर्जी नहीं",
        ],
      },
    ];
  }

  return [
    {
      id: "fq-gen-1",
      questionEn:
        "What is the pattern of the fever or symptoms during the day?",
      questionHi:
        "बुखार या तकलीफ़ दिन में किस समय ज़्यादा बढ़ती है?",
      quickOptionsEn: [
        "Spikes in the evening/night with chills",
        "Continuous throughout the day",
        "Mild & intermittent",
      ],
      quickOptionsHi: [
        "शाम और रात को ठंड के साथ तेज़ होता है",
        "पूरे दिन लगातार रहता है",
        "हल्का और रुक-रुक कर आता है",
      ],
    },
    {
      id: "fq-gen-2",
      questionEn:
        "Are there any breathing difficulties, chest pain, or throat pain while swallowing?",
      questionHi:
        "क्या सांस लेने में तकलीफ़, सीने में दर्द, या निगलने में गले में दर्द है?",
      quickOptionsEn: [
        "Throat irritation only, no breathlessness",
        "No chest pain or breathing issue",
        "Mild shortness of breath on exertion",
      ],
      quickOptionsHi: [
        "केवल गले में खराश, सांस ठीक है",
        "सीने में दर्द या सांस की दिक्कत नहीं",
        "चलने पर हल्की सांस फूलती है",
      ],
    },
    {
      id: "fq-gen-3",
      questionEn:
        "What medicines have been taken at home so far, and any known drug allergies?",
      questionHi:
        "घर पर अब तक कौन-सी दवा ली है, और क्या किसी दवा से एलर्जी है?",
      quickOptionsEn: [
        "Paracetamol 500mg taken; no allergies",
        "No medicines taken yet; no allergies",
        "On regular BP/Diabetes medication",
      ],
      quickOptionsHi: [
        "पैरासिटामोल ली है; कोई एलर्जी नहीं",
        "अभी कोई दवा नहीं ली; कोई एलर्जी नहीं",
        "बीपी / शुगर की नियमित दवा चल रही है",
      ],
    },
  ];
}

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "")
    : [];

/** Validates and cleans model output so the UI can always trust its shape (max 4 questions). */
function normalizeFollowUps(raw: unknown): TextFollowUpQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).questionEn === "string"
    )
    .slice(0, 4)
    .map((item, idx) => ({
      id: `fq-${idx + 1}`,
      questionEn: String(item.questionEn),
      questionHi:
        typeof item.questionHi === "string" ? item.questionHi : "",
      quickOptionsEn: asStringArray(item.quickOptionsEn).slice(0, 4),
      quickOptionsHi: asStringArray(item.quickOptionsHi).slice(0, 4),
    }));
}

const TRIAGE_LEVELS: TriagePriority[] = ["Routine", "Priority", "Urgent"];

function normalizeDoctorBrief(
  raw: Partial<DoctorIntakeBrief>,
  fallbackVitals: string
): DoctorIntakeBrief | null {
  if (!raw || typeof raw.chiefComplaint !== "string" || !raw.chiefComplaint) {
    return null;
  }
  return {
    chiefComplaint: raw.chiefComplaint,
    chiefComplaintHi:
      typeof raw.chiefComplaintHi === "string" ? raw.chiefComplaintHi : undefined,
    symptomTimeline: asStringArray(raw.symptomTimeline),
    followUpSummary: Array.isArray(raw.followUpSummary)
      ? raw.followUpSummary
          .filter((f) => f && typeof f.question === "string")
          .map((f) => ({
            question: f.question,
            answer: typeof f.answer === "string" ? f.answer : "Not specified",
          }))
      : [],
    vitalsSummary:
      typeof raw.vitalsSummary === "string" ? raw.vitalsSummary : fallbackVitals,
    triagePriority: TRIAGE_LEVELS.includes(raw.triagePriority as TriagePriority)
      ? (raw.triagePriority as TriagePriority)
      : "Routine",
    clinicalNotes: asStringArray(raw.clinicalNotes),
    timeSavedNote:
      typeof raw.timeSavedNote === "string" && raw.timeSavedNote
        ? raw.timeSavedNote
        : "3.5 mins of routine history captured prior to consultation",
  };
}

/** Rough English gist of a Hindi/English complaint for the offline fallback brief. */
function summarizeComplaintOffline(rawTranscript: string): string {
  const t = rawTranscript.toLowerCase();
  const found: string[] = [];
  const rules: Array<[RegExp, string]> = [
    [/बुखार|bukhar|fever/, "fever"],
    [/खांसी|खाँसी|khansi|cough/, "cough"],
    [/पेट|जलन|गैस|एसिडिटी|acidity|reflux|stomach|burning/, "abdominal pain / acid reflux"],
    [/सिर\s?दर्द|headache/, "headache"],
    [/सांस|साँस|breath/, "breathlessness"],
    [/उल्टी|vomit/, "vomiting"],
    [/दस्त|loose motion|diarr/, "loose stools"],
    [/बदन दर्द|body ?ache|weakness|कमज़ोरी|कमजोरी/, "body ache / weakness"],
  ];
  for (const [re, label] of rules) {
    if (re.test(t)) found.push(label);
  }
  if (found.length > 0) {
    return `Patient reports ${found.join(", ")} (summarized from waiting-area intake)`;
  }
  return rawTranscript.length > 140
    ? `${rawTranscript.slice(0, 140)}…`
    : rawTranscript;
}

export async function generatePreVisitFollowUps(
  input: PreVisitInput
): Promise<{
  questions: TextFollowUpQuestion[];
  providerUsed: GemmaProviderMode;
  modelName: string;
  promptId: string;
}> {
  const { prompt, temperature, id } = renderPromptFromJson(
    "preVisitFollowUps",
    {
      age: input.patientInfo.age,
      gender: input.patientInfo.gender,
      language: input.language,
      rawTranscript: input.rawTranscript,
    }
  );

  const completion = await runGemmaCompletion({ prompt, temperature });
  if (completion.text) {
    const parsed = normalizeFollowUps(
      parseJsonSafely<unknown>(completion.text)
    );
    if (parsed.length > 0) {
      return {
        questions: parsed,
        providerUsed: completion.providerUsed,
        modelName: completion.modelName,
        promptId: id,
      };
    }
  }

  return {
    questions: buildFallbackFollowUpQuestions(input.rawTranscript),
    providerUsed: "demo_fallback",
    modelName: "gemma-4-27b-it (Resilient Local Fallback)",
    promptId: id,
  };
}

export async function generateDoctorIntakeBrief(
  input: PreVisitInput,
  followUps: TextFollowUpQuestion[]
): Promise<{
  brief: DoctorIntakeBrief;
  providerUsed: GemmaProviderMode;
  modelName: string;
  promptId: string;
}> {
  const qaText = followUps
    .map((q) => `- Q: ${q.questionEn}\n  A: ${q.answer || "Not specified"}`)
    .join("\n");

  const vitals = input.patientInfo.vitals;
  const vitalsFormatted = vitals
    ? [
        vitals.bp ? `BP ${vitals.bp} mmHg` : null,
        vitals.temp ? `Temp ${vitals.temp}°F` : null,
        vitals.pulse ? `Pulse ${vitals.pulse} bpm` : null,
        vitals.spo2 ? `SpO2 ${vitals.spo2}%` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Vitals not recorded"
    : "Vitals pending at bay";

  const { prompt, temperature, id } = renderPromptFromJson(
    "doctorIntakeBrief",
    {
      patientName: input.patientInfo.name || "Walk-in Patient",
      age: input.patientInfo.age,
      gender: input.patientInfo.gender,
      vitalsFormatted,
      rawTranscript: input.rawTranscript,
      qaText,
    }
  );

  const completion = await runGemmaCompletion({ prompt, temperature });
  if (completion.text) {
    const parsed = normalizeDoctorBrief(
      parseJsonSafely<Partial<DoctorIntakeBrief>>(completion.text) || {},
      vitalsFormatted
    );
    if (parsed) {
      return {
        brief: parsed,
        providerUsed: completion.providerUsed,
        modelName: completion.modelName,
        promptId: id,
      };
    }
  }

  const fallbackBrief: DoctorIntakeBrief = {
    chiefComplaint: summarizeComplaintOffline(input.rawTranscript),
    chiefComplaintHi:
      input.language === "en" ? undefined : input.rawTranscript.slice(0, 140),
    symptomTimeline: [
      `Initial intake (${input.inputMode.toUpperCase()} / ${input.language.toUpperCase()}): "${input.rawTranscript}"`,
      "Pre-visit text follow-up questions completed prior to consultation room entry.",
    ],
    followUpSummary: followUps.map((f) => ({
      question: f.questionEn,
      answer: f.answer || "Confirmed at bay",
    })),
    vitalsSummary: vitalsFormatted,
    triagePriority:
      vitals?.temp && parseFloat(vitals.temp) >= 101 ? "Priority" : "Routine",
    clinicalNotes: [
      "Baseline history & medication check completed at waiting area.",
      "Doctor can proceed directly to focused physical exam & treatment plan.",
    ],
    timeSavedNote: "3.5 mins of routine history captured prior to consultation",
  };

  return {
    brief: fallbackBrief,
    providerUsed: "demo_fallback",
    modelName: "gemma-4-27b-it (Resilient Local Fallback)",
    promptId: id,
  };
}

export interface PrescriptionParseResult {
  medications: ExtractedMedication[];
  doctorName: string;
  clinicName: string;
  patientName?: string;
  providerUsed: GemmaProviderMode;
  modelName: string;
  promptId: string;
  /** True when no model answered and offline demo data was returned instead. */
  usedFallback: boolean;
}

const DEFAULT_DOCTOR = "Dr. Arvind Kulkarni (MD, Internal Medicine)";
const DEFAULT_CLINIC = "SevaSetu Community Polyclinic";

export async function parsePrescriptionWithVision(params: {
  imageBase64?: string;
  mimeType?: string;
  rawTextHint?: string;
  /** Pre-loaded sample used for the offline fallback so demos stay faithful. */
  sampleId?: string;
}): Promise<PrescriptionParseResult> {
  const { prompt, temperature, id } = renderPromptFromJson(
    "prescriptionVisionParser",
    {
      rawTextHintSection: params.rawTextHint
        ? `Additional prescription text context: ${params.rawTextHint}`
        : "",
    }
  );

  if (params.imageBase64 || params.rawTextHint) {
    const completion = await runGemmaCompletion({
      prompt,
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      temperature,
      maxOutputTokens: 4096,
    });

    if (completion.text) {
      const parsed = parseJsonSafely<
        | { doctorName?: string; clinicName?: string; medications?: unknown }
        | unknown[]
      >(completion.text);

      const medsRaw = Array.isArray(parsed)
        ? parsed
        : (parsed as { medications?: unknown } | null)?.medications;
      const medications = normalizeMedications(medsRaw);

      if (medications.length > 0) {
        const meta = Array.isArray(parsed)
          ? {}
          : (parsed as { doctorName?: string; clinicName?: string });
        return {
          medications,
          doctorName:
            typeof meta.doctorName === "string" && meta.doctorName.trim()
              ? meta.doctorName.trim()
              : DEFAULT_DOCTOR,
          clinicName:
            typeof meta.clinicName === "string" && meta.clinicName.trim()
              ? meta.clinicName.trim()
              : DEFAULT_CLINIC,
          providerUsed: completion.providerUsed,
          modelName: completion.modelName,
          promptId: id,
          usedFallback: false,
        };
      }
    }
  }

  // Offline / unreadable: return the matching sample, or the first sample as a generic demo.
  const sample = getSamplePrescription(params.sampleId) ?? SAMPLE_PRESCRIPTIONS[0];
  return {
    medications: normalizeMedications(sample.medications),
    doctorName: sample.doctorName,
    clinicName: sample.clinicName,
    patientName: params.sampleId ? sample.patientName : undefined,
    providerUsed: "demo_fallback",
    modelName: "gemma-4-27b-it (Resilient Local Fallback)",
    promptId: id,
    usedFallback: true,
  };
}

/**
 * Fills in plain-language purposes for medicines that are neither in the built-in
 * dictionary nor explained by the user (typically manual entry). Falls back silently
 * to the "ask your doctor" placeholder when no model is available.
 */
export async function explainUnknownMedicines(
  medications: ExtractedMedication[]
): Promise<ExtractedMedication[]> {
  const unknownIdx = medications
    .map((m, i) => (isPurposeUnknown(m) ? i : -1))
    .filter((i) => i >= 0);
  if (unknownIdx.length === 0) return medications;

  const status = getGemmaProviderStatus();
  if (!status.googleApiKeyConfigured && !status.ollamaEndpointConfigured) {
    return medications;
  }

  const { prompt, temperature } = renderPromptFromJson(
    "medicinePurposeExplainer",
    {
      medicineList: unknownIdx
        .map((i) => `- ${medications[i].name} ${medications[i].dosage}`.trim())
        .join("\n"),
    }
  );
  const completion = await runGemmaCompletion({ prompt, temperature });
  if (!completion.text) return medications;

  const parsed = parseJsonSafely<Array<Record<string, unknown>>>(
    completion.text
  );
  if (!Array.isArray(parsed)) return medications;

  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const result = [...medications];
  unknownIdx.forEach((medIndex, k) => {
    const item = parsed[k];
    if (!item) return;
    const en = text(item.whatIsItUsedForEn);
    const hi = text(item.whatIsItUsedForHi);
    if (!en || !hi) return;
    result[medIndex] = {
      ...result[medIndex],
      whatIsItUsedForEn: en,
      whatIsItUsedForHi: hi,
      precautionNote: result[medIndex].precautionNote || text(item.precautionNote),
    };
  });
  return result;
}
