import { NextRequest, NextResponse } from "next/server";
import { generatePreVisitFollowUps } from "@/lib/gemma";
import { PreVisitInput } from "@/types/sevasetu";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<PreVisitInput>;
    const sampleInput: PreVisitInput = {
      entryBy: body.entryBy || "nurse_bay",
      inputMode: body.inputMode || "voice",
      language: body.language || "hi",
      rawTranscript:
        body.rawTranscript ||
        "पेशेंट को तीन दिन से तेज़ बुखार और सूखी खांसी है, रात को ज़्यादा होती है।",
      patientInfo: {
        name: body.patientInfo?.name || "Rameshwar Sharma",
        age: body.patientInfo?.age || "52",
        gender: body.patientInfo?.gender || "Male",
        vitals: body.patientInfo?.vitals,
      },
    };

    const result = await generatePreVisitFollowUps(sampleInput);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Gemma 4 engine test failed",
      },
      { status: 500 }
    );
  }
}
