import { NextRequest, NextResponse } from "next/server";
import { getPrescriptionById, updatePrescriptionMedications } from "@/lib/db";
import { explainUnknownMedicines } from "@/lib/gemma";
import { normalizeMedications, parseDays } from "@/lib/prescription-utils";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

interface PatchBody {
  /** Patient-confirmed days, keyed by medication id. Everything else is left untouched. */
  daysByMedicationId?: Record<string, unknown>;
  /** Full replacement list (used by the manual edit form). */
  medications?: unknown;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const prescription = getPrescriptionById(id);
  if (!prescription) {
    return NextResponse.json(
      { ok: false, error: "Prescription not found." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, prescription });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const existing = getPrescriptionById(id);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Prescription not found." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as PatchBody;
    let medications = existing.medications;

    if (body.daysByMedicationId && typeof body.daysByMedicationId === "object") {
      const updates = Object.entries(body.daysByMedicationId);
      for (const [medId, raw] of updates) {
        if (!medications.some((m) => m.id === medId)) {
          return NextResponse.json(
            { ok: false, error: `Unknown medicine "${medId}".` },
            { status: 400 }
          );
        }
        if (parseDays(raw) === null) {
          return NextResponse.json(
            { ok: false, error: "Days must be a whole number from 1 to 365." },
            { status: 400 }
          );
        }
      }
      medications = medications.map((m) => {
        if (!(m.id in body.daysByMedicationId!)) return m;
        return {
          ...m,
          daysOfDosage: parseDays(body.daysByMedicationId![m.id]),
          isDaysConfirmed: true,
        };
      });
    } else if (body.medications !== undefined) {
      const normalized = normalizeMedications(body.medications);
      if (normalized.length === 0) {
        return NextResponse.json(
          { ok: false, error: "A prescription needs at least one medicine." },
          { status: 400 }
        );
      }
      medications = await explainUnknownMedicines(normalized);
    } else {
      return NextResponse.json(
        { ok: false, error: "Nothing to update." },
        { status: 400 }
      );
    }

    const prescription = updatePrescriptionMedications(id, medications);
    return NextResponse.json({ ok: true, prescription });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not update the prescription",
      },
      { status: 500 }
    );
  }
}
