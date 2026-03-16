import { NextResponse } from "next/server";
import { findMatches, matchesToCSV, MatchConfig } from "@/lib/fuzzyMatch";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceRows, lookupRows, sourceCol, lookupCol, returnCols } = body;

    if (!sourceRows?.length) {
      return NextResponse.json({ error: "No source rows provided" }, { status: 400 });
    }
    if (!lookupRows?.length) {
      return NextResponse.json({ error: "No lookup rows provided" }, { status: 400 });
    }
    if (!sourceCol || !lookupCol || !returnCols?.length) {
      return NextResponse.json({ error: "Match configuration incomplete" }, { status: 400 });
    }

    const config: MatchConfig = { sourceCol, lookupCol, returnCols };
    const matches = findMatches(sourceRows, lookupRows, config);

    if (matches.length === 0) {
      return NextResponse.json({ error: "No matches found" }, { status: 404 });
    }

    const csv = matchesToCSV(matches);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="cross_reference_matches.csv"',
      },
    });
  } catch (error) {
    console.error("Cross-reference error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
