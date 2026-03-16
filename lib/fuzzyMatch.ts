export interface MatchConfig {
  sourceCol: string;
  lookupCol: string;
  returnCols: string[];
}

export interface MatchRow {
  [key: string]: string;
}

export function findMatches(
  sourceRows: Record<string, string>[],
  lookupRows: Record<string, string>[],
  config: MatchConfig,
): MatchRow[] {
  const { sourceCol, lookupCol, returnCols } = config;
  const results: MatchRow[] = [];

  for (const sourceRow of sourceRows) {
    const searchVal = (sourceRow[sourceCol] ?? "").trim().toLowerCase();
    if (!searchVal) continue;

    for (const lookupRow of lookupRows) {
      const targetVal = (lookupRow[lookupCol] ?? "").trim().toLowerCase();
      if (!targetVal) continue;

      if (targetVal.includes(searchVal)) {
        const result: MatchRow = {
          [`source_${sourceCol}`]: sourceRow[sourceCol]?.trim() ?? "",
        };
        for (const col of returnCols) {
          result[col] = (lookupRow[col] ?? "").trim();
        }
        results.push(result);
      }
    }
  }

  return results;
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = parseCSVLines(text);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0];
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = j < values.length ? values[j] : "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLines(text: string): string[][] {
  const results: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\n" || ch === "\r") {
        current.push(field);
        field = "";
        results.push(current);
        current = [];
        if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
          i += 2;
        } else {
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/line
  if (field || current.length > 0) {
    current.push(field);
    results.push(current);
  }

  return results;
}

export function matchesToCSV(rows: MatchRow[]): string {
  if (rows.length === 0) return "";

  const keys = Object.keys(rows[0]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const header = keys.map(escape).join(",");
  const dataRows = rows.map((row) => keys.map((k) => escape(row[k] ?? "")).join(","));

  return [header, ...dataRows].join("\n");
}
