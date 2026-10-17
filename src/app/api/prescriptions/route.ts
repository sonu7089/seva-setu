import { NextRequest, NextResponse } from "next/server";
import { listPrescriptions, savePrescription } from "@/lib/db";
import { explainUnknownMedicines } from "@/lib/gemma";
import { normalizeMedications } from "@/lib/prescription-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, prescriptions: listPrescriptions() });
}

interface ManualPrescriptionBody {
  patientName?: string;
  visitId?: string | null;
  doctorName?: string;
  medications?: unknown;
}

/** Saves a prescription typed in by hand (the fallback when scanning isn't possible). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ManualPrescriptionBody;
    const normalized = normalizeMedications(body.medications);

    if (normalized.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Add at least one medicine with a name." },
        { status: 400 }
      );
    }

    const medications = await explainUnknownMedicines(normalized);
    const prescription = savePrescription({
      visitId: body.visitId || null,
      patientName: body.patientName?.trim() || "Walk-in Patient",
      doctorName: body.doctorName?.trim() || undefined,
      sourceType: "manual",
      imageName: null,
      medications,
    });

    return NextResponse.json({ ok: true, prescription }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not save the prescription",
      },
      { status: 500 }
    );
  }
}
