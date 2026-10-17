import { NextRequest, NextResponse } from "next/server";
import { createVisit } from "@/lib/db";
import { generateDoctorIntakeBrief } from "@/lib/gemma";
import { firstIntakeError, validateIntake } from "@/lib/validation";
import { PreVisitInput, TextFollowUpQuestion } from "@/types/sevasetu";

export const dynamic = "force-dynamic";

interface BriefRequestBody extends Partial<PreVisitInput> {
  followUps?: TextFollowUpQuestion[];
}

/**
 * Compiles the bay intake + follow-up answers into a 15-second doctor brief
 * and persists the visit to SQLite so it appears in the Doctor Console queue.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BriefRequestBody;
    const rawTranscript = body.rawTranscript?.trim();

    if (!rawTranscript || !body.patientInfo?.age || !body.patientInfo?.gender) {
      return NextResponse.json(
        {
          ok: false,
          error: "Age, gender and a symptom description are required.",
        },
        { status: 400 }
      );
    }

    const validationError = firstIntakeError(
      validateIntake({
        age: body.patientInfo.age,
        vitals: body.patientInfo.vitals,
        includeVitals: body.entryBy !== "patient",
      })
    );
    if (validationError) {
      return NextResponse.json(
        { ok: false, error: validationError },
        { status: 400 }
      );
    }

    const input: PreVisitInput = {
      entryBy: body.entryBy || "nurse_bay",
      inputMode: body.inputMode || "text",
      language: body.language || "hi",
      rawTranscript,
      patientInfo: body.patientInfo,
    };
    const followUps = Array.isArray(body.followUps) ? body.followUps : [];

    const { brief, providerUsed, modelName, promptId } =
      await generateDoctorIntakeBrief(input, followUps);

    const visit = createVisit({
      patientName: input.patientInfo.name?.trim() || "Walk-in Patient",
      age: input.patientInfo.age,
      gender: input.patientInfo.gender,
      entryBy: input.entryBy,
      inputMode: input.inputMode,
      language: input.language,
      vitals: input.entryBy === "nurse_bay" ? input.patientInfo.vitals : {},
      rawTranscript,
      followUpQuestions: followUps,
      doctorBrief: brief,
      status: "ready_for_doctor",
    });

    return NextResponse.json(
      { ok: true, visit, brief, providerUsed, modelName, promptId },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not generate the doctor brief",
      },
      { status: 500 }
    );
  }
}
