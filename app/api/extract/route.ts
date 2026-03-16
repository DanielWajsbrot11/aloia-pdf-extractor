import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildPrompt, parseJsonRows, toCSV, FieldDef } from "@/lib/pdfExtractor";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const pdfs = formData.getAll("pdfs") as File[];
    const schema = formData.get("schema") as string;
    const mode = formData.get("mode") as "form" | "json" | "nl";

    if (!pdfs.length) {
      return NextResponse.json({ error: "No PDF files provided" }, { status: 400 });
    }

    if (!schema) {
      return NextResponse.json({ error: "No schema provided" }, { status: 400 });
    }

    // Parse fields for form/json modes
    let fields: FieldDef[] = [];
    if (mode === "form" || mode === "json") {
      fields = JSON.parse(schema) as FieldDef[];
    }

    const prompt = buildPrompt(fields, mode, schema);
    const allRows: Record<string, unknown>[] = [];

    // Process each PDF
    for (const pdf of pdfs) {
      const arrayBuffer = await pdf.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error(`No text response for file: ${pdf.name}`);
      }

      const rows = parseJsonRows(textBlock.text);
      // Add source filename to each row
      for (const row of rows) {
        row._source_file = pdf.name;
      }
      allRows.push(...rows);
    }

    const csv = toCSV(allRows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="extracted_data.csv"',
      },
    });
  } catch (error) {
    console.error("Extraction error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
