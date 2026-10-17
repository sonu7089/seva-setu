import { NextRequest, NextResponse } from "next/server";
import { updateVisitStatus } from "@/lib/db";
import type { VisitStatus } from "@/types/sevasetu";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_STATUSES: VisitStatus[] = ["ready_for_doctor", "completed"];

/** Marks a patient as seen (`completed`) or puts them back in the waiting queue. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status?: VisitStatus };

    if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const visit = updateVisitStatus(id, body.status);
    if (!visit) {
      return NextResponse.json(
        { ok: false, error: "Visit not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, visit });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not update the visit",
      },
      { status: 500 }
    );
  }
}
