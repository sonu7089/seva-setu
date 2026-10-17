import { NextRequest, NextResponse } from "next/server";
import { savePrescription } from "@/lib/db";
import { parsePrescriptionWithVision } from "@/lib/gemma";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Base64 characters (~7.5 MB of image). The client already downsizes photos well below this. */
const MAX_IMAGE_BASE64_LENGTH = 10_000_000;

interface ParseRequestBody {
  imageBase64?: string;
  mimeType?: string;
  imageName?: string;
  sampleId?: string;
  patientName?: string;
  visitId?: string | null;
  rawTextHint?: string;
}

/**
 * Reads a prescription photo with Gemma 4 vision, saves the extracted medicines
 * to SQLite, and returns them. `daysOfDosage` is `null` whenever the duration
 * is missing/unclear so the UI can ask the patient.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ParseRequestBody;
    const imageBase64 = body.imageBase64?.trim() || undefined;
    const rawTextHint = body.rawTextHint?.trim() || undefined;

    if (!imageBase64 && !rawTextHint && !body.sampleId) {
      return NextResponse.json(
        { ok: false, error: "Upload a prescription photo or pick a sample first." },
        { status: 400 }
      );
    }

    let mimeType = body.mimeType?.trim() || "image/jpeg";
    if (imageBase64) {
      const dataUrlMime = imageBase64.match(/^data:([^;]+);base64,/)?.[1];
      if (dataUrlMime) mimeType = dataUrlMime;
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json(
          { ok: false, error: "Only JPG, PNG or WEBP images are supported." },
          { status: 415 }
        );
      }
      if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
        return NextResponse.json(
          { ok: false, error: "That image is too large. Try a smaller photo." },
          { status: 413 }
        );
      }
    }

    const parsed = await parsePrescriptionWithVision({
      imageBase64,
      mimeType,
      rawTextHint,
      sampleId: body.sampleId,
    });

    const patientName =
      body.patientName?.trim() || parsed.patientName || "Walk-in Patient";

    const prescription = savePrescription({
      visitId: body.visitId || null,
      patientName,
      doctorName: parsed.doctorName,
      clinicName: parsed.clinicName,
      sourceType: parsed.usedFallback ? "demo" : "scan",
      imageName: body.imageName?.trim().slice(0, 120) || null,
      medications: parsed.medications,
    });

    return NextResponse.json(
      {
        ok: true,
        prescription,
        providerUsed: parsed.providerUsed,
        modelName: parsed.modelName,
        promptId: parsed.promptId,
        usedFallback: parsed.usedFallback,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not read the prescription",
      },
      { status: 500 }
    );
  }
}
