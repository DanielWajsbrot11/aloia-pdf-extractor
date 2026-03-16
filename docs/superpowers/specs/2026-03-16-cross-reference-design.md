# Cross-Reference Feature Design

## Overview

Add fuzzy cross-reference (VLOOKUP) capability to the PDF extractor. After extracting data from a first set of PDFs ("source"), the user can upload a second set ("lookup"), extract it, then run a case-insensitive substring match between columns across the two datasets. All matching rows are returned as a downloadable CSV.

## UI Flow

Steps 1-3 remain unchanged. Three new steps are added:

- **Step 4 — Define Lookup Schema & Upload Lookup PDFs**: Reuses SchemaBuilder and the upload zone for the second dataset. User defines fields, uploads PDFs, and extracts. Identical UX to steps 1-2 but labeled as "Lookup Dataset."
- **Step 5 — Configure Match**: Dropdowns populated from both datasets' column headers. User selects: (a) source column to match FROM, (b) lookup column to match AGAINST, (c) which lookup columns to RETURN (multi-select checkboxes).
- **Step 6 — Match Results**: Preview of matched rows CSV. Download button. "Start Over" button.

Entry point: Step 3 results screen gets a new "Cross-Reference" button alongside "Download CSV" and "Start Over."

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `lib/fuzzyMatch.ts` | `findMatches()` — substring matching logic, ported from Python `index.py` |
| `app/api/cross-reference/route.ts` | POST endpoint — receives source rows, lookup rows, match config; returns matches CSV |
| `components/MatchConfigurator.tsx` | Column mapping UI — dropdowns for source col, lookup col, checkbox multi-select for return cols |

### Modified Files

| File | Change |
|------|--------|
| `components/PDFExtractor.tsx` | Add state for lookup data, steps 4-6, "Cross-Reference" button on step 3 |

## Data Flow

```
Step 3 (source CSV in memory as parsed rows)
    ↓ user clicks "Cross-Reference"
Step 4 (define lookup schema → upload lookup PDFs → extract via existing /api/extract)
    ↓ parse lookup CSV text into rows + headers
Step 5 (user maps: source col → lookup col, selects return cols)
    ↓ POST /api/cross-reference { sourceRows, lookupRows, sourceCol, lookupCol, returnCols }
Step 6 (display matches CSV, download)
```

Both source and lookup extraction reuse the existing `/api/extract` endpoint. The new `/api/cross-reference` endpoint only handles the matching logic — no Claude calls.

## API: POST /api/cross-reference

**Request body (JSON):**
```json
{
  "sourceRows": [{ "abbrev": "ACME", "company": "ACME Corp" }, ...],
  "lookupRows": [{ "BILL_NAME": "Acme Corp International", "SO_NUMBER": "123", ... }, ...],
  "sourceCol": "abbrev",
  "lookupCol": "BILL_NAME",
  "returnCols": ["BILL_NAME", "SO_NUMBER"]
}
```

**Response:** CSV text with `Content-Disposition: attachment`, columns: `source_{sourceCol}`, then each return col.

## Match Logic (lib/fuzzyMatch.ts)

Ported from `index.py`:

```typescript
function findMatches(sourceRows, lookupRows, sourceCol, lookupCol, returnCols): MatchRow[]
```

- For each source row, get `sourceVal = row[sourceCol].toLowerCase().trim()`
- Skip empty source values
- For each lookup row, get `targetVal = row[lookupCol].toLowerCase().trim()`
- If `sourceVal` is contained in `targetVal` (substring), it's a match
- Collect: `source_{sourceCol}` + each return col value
- One source row can produce multiple matches (one-to-many)

## Component: MatchConfigurator

Props: `sourceHeaders: string[]`, `lookupHeaders: string[]`, `onConfirm(sourceCol, lookupCol, returnCols)`

UI:
- Dropdown: "Match from source column" (source headers)
- Dropdown: "Against lookup column" (lookup headers)
- Checkbox list: "Return these lookup columns" (lookup headers, multi-select)
- "Run Match" button

## State Changes in PDFExtractor

New state variables:
- `lookupCsvData: string` — raw CSV from lookup extraction
- `lookupRows: Record<string, string>[]` — parsed lookup rows
- `sourceRows: Record<string, string>[]` — parsed source rows (from step 3 CSV)
- `matchesCsv: string` — final matches output

Source CSV parsing happens when user clicks "Cross-Reference" — parse the existing `csvData` string into row objects and extract headers.

Lookup CSV parsing happens after the lookup extraction completes in step 4.

## CSV Parsing

A `parseCSV(text: string)` utility in `lib/fuzzyMatch.ts` handles parsing CSV text (with proper quote handling) into `{ headers: string[], rows: Record<string, string>[] }`.

## Error Handling

- If no matches found: show "No matches found" message with option to adjust columns or start over.
- If columns are not selected: disable "Run Match" button.
- If lookup extraction fails: show error in step 4, same pattern as step 2.
