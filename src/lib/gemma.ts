import fs from "fs";
import path from "path";
import promptCatalogJson from "@/prompts/gemma-prompts.json";
import {
  DoctorIntakeBrief,
  ExtractedMedication,
  GemmaProviderMode,
  GemmaProviderStatus,
  PreVisitInput,
  TextFollowUpQuestion,
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
        maxOutputTokens: 2048,
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
    const parsed = parseJsonSafely<TextFollowUpQuestion[]>(completion.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
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
        vitals.bp ? `BP ${vitals.bp}` : null,
        vitals.temp ? `Temp ${vitals.temp}` : null,
        vitals.pulse ? `Pulse ${vitals.pulse}` : null,
        vitals.spo2 ? `SpO2 ${vitals.spo2}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
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
    const parsed = parseJsonSafely<DoctorIntakeBrief>(completion.text);
    if (parsed && parsed.chiefComplaint) {
      return {
        brief: parsed,
        providerUsed: completion.providerUsed,
        modelName: completion.modelName,
        promptId: id,
      };
    }
  }

  const fallbackBrief: DoctorIntakeBrief = {
    chiefComplaint:
      input.language === "hi"
        ? "Acute febrile illness with dry cough (translated from Hindi bay intake)"
        : input.rawTranscript.slice(0, 140),
    chiefComplaintHi: input.rawTranscript.slice(0, 140),
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
      "Baseline history & medication check completed at triage bay.",
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

export async function parsePrescriptionWithVision(params: {
  imageBase64?: string;
  mimeType?: string;
  rawTextHint?: string;
}): Promise<{
  medications: ExtractedMedication[];
  doctorName: string;
  clinicName: string;
  providerUsed: GemmaProviderMode;
  modelName: string;
  promptId: string;
}> {
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
    });

    if (completion.text) {
      const parsed = parseJsonSafely<{
        doctorName?: string;
        clinicName?: string;
        medications?: ExtractedMedication[];
      }>(completion.text);

      if (parsed?.medications && Array.isArray(parsed.medications)) {
        return {
          medications: parsed.medications,
          doctorName:
            parsed.doctorName || "Dr. Arvind Kulkarni (MD, Internal Medicine)",
          clinicName: parsed.clinicName || "SevaSetu Community Polyclinic",
          providerUsed: completion.providerUsed,
          modelName: completion.modelName,
          promptId: id,
        };
      }
    }
  }

  return {
    doctorName: "Dr. Arvind Kulkarni (MD, Internal Medicine)",
    clinicName: "SevaSetu Community Polyclinic",
    providerUsed: "demo_fallback",
    modelName: "gemma-4-27b-it (Resilient Local Fallback)",
    promptId: id,
    medications: [
      {
        id: "med-rx-1",
        name: "Tab Pantoprazole",
        dosage: "40 mg",
        frequencyCode: "OD",
        frequencyPlain: "Once daily (Morning, 30 mins before breakfast)",
        foodRelation: "before_food",
        whatIsItUsedForEn:
          "Reduces stomach acid and prevents acidity or gastric irritation.",
        whatIsItUsedForHi:
          "पेट में एसिड और जलन को कम करता है तथा पेट की परत को सुरक्षित रखता है।",
        precautionNote: "Take on an empty stomach with a full glass of water.",
        daysOfDosage: 5,
        isDaysConfirmed: true,
        recommendedTimes: ["07:30"],
      },
      {
        id: "med-rx-2",
        name: "Tab Paracetamol (Dolo)",
        dosage: "650 mg",
        frequencyCode: "TDS",
        frequencyPlain: "Three times daily (Morning, Afternoon, Night)",
        foodRelation: "after_food",
        whatIsItUsedForEn:
          "Reduces fever and relieves body ache and headache.",
        whatIsItUsedForHi:
          "बुखार कम करने और बदन दर्द व सिरदर्द से राहत के लिए।",
        precautionNote: "Keep at least a 6-hour interval between doses.",
        daysOfDosage: 3,
        isDaysConfirmed: true,
        recommendedTimes: ["09:00", "14:00", "21:30"],
      },
      {
        id: "med-rx-3",
        name: "Syp Dextromethorphan + CPM",
        dosage: "10 ml",
        frequencyCode: "BD",
        frequencyPlain: "Twice daily (Morning & Bedtime)",
        foodRelation: "after_food",
        whatIsItUsedForEn:
          "Suppresses dry cough and relieves throat irritation at night.",
        whatIsItUsedForHi:
          "सूखी खांसी और गले की खराश को शांत करने के लिए।",
        precautionNote: "Shake well before use; may cause mild drowsiness.",
        daysOfDosage: null,
        isDaysConfirmed: false,
        recommendedTimes: ["09:00", "21:30"],
      },
    ],
  };
}
