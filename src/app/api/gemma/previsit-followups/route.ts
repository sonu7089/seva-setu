import { NextRequest, NextResponse } from "next/server";
import { generatePreVisitFollowUps } from "@/lib/gemma";
import { PreVisitInput } from "@/types/sevasetu";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<PreVisitInput>;
    const rawTranscript = body.rawTranscript?.trim();

    if (!rawTranscript) {
      return NextResponse.json(
        { ok: false, error: "Please describe the symptoms first." },
        { status: 400 }
      );
    }

    const input: PreVisitInput = {
      entryBy: body.entryBy || "nurse_bay",
      inputMode: body.inputMode || "text",
      language: body.language || "hi",
      rawTranscript,
      patientInfo: {
        name: body.patientInfo?.name,
        age: body.patientInfo?.age || "",
        gender: body.patientInfo?.gender || "",
        vitals: body.patientInfo?.vitals,
      },
    };

    const result = await generatePreVisitFollowUps(input);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not generate follow-up questions",
      },
      { status: 500 }
    );
  }
}
