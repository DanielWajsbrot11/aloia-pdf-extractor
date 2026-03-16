export interface FieldDef {
  name: string;
  description: string;
}

export function buildPrompt(fields: FieldDef[], mode: "form" | "json" | "nl", rawSchema: string): string {
  if (mode === "nl") {
    return `Extract structured data from this PDF document based on the following instructions:

${rawSchema}

Return the extracted data as a JSON array of objects. Each object represents one row of data.
If the document contains only one logical record, return an array with one object.
Return ONLY the JSON array, no other text or markdown formatting.`;
  }

  const fieldList = fields
    .map((f) => `  - "${f.name}": ${f.description}`)
    .join("\n");

  return `Extract structured data from this PDF document. For each record found, extract these fields:

${fieldList}

Return the extracted data as a JSON array of objects using the exact field names specified above.
If the document contains only one logical record, return an array with one object.
Return ONLY the JSON array, no other text or markdown formatting.`;
}

export function parseJsonRows(text: string): Record<string, unknown>[] {
  const trimmed = text.trim();

  // Try direct parse first
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Try to extract JSON from markdown code block
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Code block content may also be truncated, fall through
      }
    }

    // Try to find a complete JSON array
    const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Array may be truncated, fall through
      }
    }

    // Handle truncated JSON — Claude hit max_tokens mid-array
    // Find the start of the array, then salvage complete objects
    const arrayStart = trimmed.indexOf("[");
    if (arrayStart !== -1) {
      let jsonStr = trimmed.slice(arrayStart);
      // Remove any trailing incomplete object (after last '}')
      const lastBrace = jsonStr.lastIndexOf("}");
      if (lastBrace !== -1) {
        jsonStr = jsonStr.slice(0, lastBrace + 1);
        // Remove trailing comma if present
        jsonStr = jsonStr.replace(/,\s*$/, "");
        jsonStr += "]";
        try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.warn(`Recovered ${parsed.length} rows from truncated Claude response`);
            return parsed;
          }
        } catch {
          // Could not recover
        }
      }
    }

    console.error("Claude raw response (first 500 chars):", trimmed.slice(0, 500));
    throw new Error("Could not parse JSON from Claude response");
  }
}

function escapeCSV(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Always wrap in double quotes, escape internal double quotes
  return `"${str.replace(/"/g, '""')}"`;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";

  // Collect all unique keys across all rows
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  const header = keys.map(escapeCSV).join(",");
  const dataRows = rows.map((row) => keys.map((key) => escapeCSV(row[key])).join(","));

  return [header, ...dataRows].join("\n");
}
