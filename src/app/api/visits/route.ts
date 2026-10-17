import { NextRequest, NextResponse } from "next/server";
import { createVisit, listVisits } from "@/lib/db";
import { CreateVisitParams } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const visits = listVisits();
  return NextResponse.json({ visits });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateVisitParams;
    if (!body.rawTranscript || !body.age || !body.gender) {
      return NextResponse.json(
        { error: "Missing required intake fields (age, gender, rawTranscript)" },
        { status: 400 }
      );
    }
    const created = createVisit(body);
    return NextResponse.json({ visit: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create visit",
      },
      { status: 500 }
    );
  }
}
