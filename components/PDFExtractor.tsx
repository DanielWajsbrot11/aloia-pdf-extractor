"use client";

import { useState, useRef, useCallback } from "react";
import SchemaBuilder, { SchemaMode } from "./SchemaBuilder";
import MatchConfigurator from "./MatchConfigurator";
import { parseCSV } from "@/lib/fuzzyMatch";

interface UploadedFile {
  file: File;
  id: string;
}

const STEP_LABELS: Record<number, string> = {
  1: "Define Fields",
  2: "Upload PDFs",
  3: "Results",
  4: "Lookup Dataset",
  5: "Configure Match",
  6: "Match Results",
};

export default function PDFExtractor() {
  const [step, setStep] = useState(1);
  const [schema, setSchema] = useState("");
  const [mode, setMode] = useState<SchemaMode>("form");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [csvData, setCsvData] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cross-reference state
  const [lookupSchema, setLookupSchema] = useState("");
  const [lookupMode, setLookupMode] = useState<SchemaMode>("form");
  const [lookupFiles, setLookupFiles] = useState<UploadedFile[]>([]);
  const [lookupCsvData, setLookupCsvData] = useState("");
  const [matchesCsv, setMatchesCsv] = useState("");
  const [matching, setMatching] = useState(false);
  const lookupFileInputRef = useRef<HTMLInputElement>(null);

  // Derived: parse headers from CSV data
  function getHeaders(csv: string): string[] {
    if (!csv) return [];
    const { headers } = parseCSV(csv);
    return headers;
  }

  function handleSchemaConfirm(s: string, m: SchemaMode) {
    setSchema(s);
    setMode(m);
    setStep(2);
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files)
      .filter((f) => f.type === "application/pdf")
      .map((f) => ({ file: f, id: crypto.randomUUID() }));
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files)
      .filter((f) => f.type === "application/pdf")
      .map((f) => ({ file: f, id: crypto.randomUUID() }));
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  async function handleExtract() {
    if (!files.length) return;
    setExtracting(true);
    setError("");
    setCsvData("");
    setProgress(0);

    const formData = new FormData();
    formData.append("schema", schema);
    formData.append("mode", mode);
    for (const { file } of files) {
      formData.append("pdfs", file);
    }

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 90));
    }, 500);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Extraction failed");
      }

      const csv = await res.text();
      setCsvData(csv);
      setProgress(100);
      setStep(3);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Unknown error");
      setProgress(0);
    } finally {
      setExtracting(false);
    }
  }

  function downloadCSV(data: string, filename: string) {
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep(1);
    setSchema("");
    setMode("form");
    setFiles([]);
    setCsvData("");
    setError("");
    setProgress(0);
    setLookupSchema("");
    setLookupMode("form");
    setLookupFiles([]);
    setLookupCsvData("");
    setMatchesCsv("");
  }

  // --- Cross-reference handlers ---

  function startCrossReference() {
    setError("");
    setLookupSchema("");
    setLookupMode("form");
    setLookupFiles([]);
    setLookupCsvData("");
    setMatchesCsv("");
    setStep(4);
  }

  function handleLookupSchemaConfirm(s: string, m: SchemaMode) {
    setLookupSchema(s);
    setLookupMode(m);
  }

  function handleLookupFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files)
      .filter((f) => f.type === "application/pdf")
      .map((f) => ({ file: f, id: crypto.randomUUID() }));
    setLookupFiles((prev) => [...prev, ...newFiles]);
  }

  function removeLookupFile(id: string) {
    setLookupFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const handleLookupDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files)
      .filter((f) => f.type === "application/pdf")
      .map((f) => ({ file: f, id: crypto.randomUUID() }));
    setLookupFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  async function handleLookupExtract() {
    if (!lookupFiles.length || !lookupSchema) return;
    setExtracting(true);
    setError("");
    setProgress(0);

    const formData = new FormData();
    formData.append("schema", lookupSchema);
    formData.append("mode", lookupMode);
    for (const { file } of lookupFiles) {
      formData.append("pdfs", file);
    }

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 90));
    }, 500);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      clearInterval(progressInterval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Lookup extraction failed");
      }

      const csv = await res.text();
      setLookupCsvData(csv);
      setProgress(100);
      setStep(5);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Unknown error");
      setProgress(0);
    } finally {
      setExtracting(false);
    }
  }

  async function handleRunMatch(sourceCol: string, lookupCol: string, returnCols: string[]) {
    setMatching(true);
    setError("");

    const { rows: sourceRows } = parseCSV(csvData);
    const { rows: lookupRows } = parseCSV(lookupCsvData);

    try {
      const res = await fetch("/api/cross-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceRows, lookupRows, sourceCol, lookupCol, returnCols }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Match failed");
      }

      const csv = await res.text();
      setMatchesCsv(csv);
      setStep(6);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMatching(false);
    }
  }

  // Determine which steps to show in indicator
  const maxStep = step <= 3 ? 3 : 6;
  const stepsToShow = Array.from({ length: maxStep }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">Aloia PDF Extractor</h1>
          <p className="text-sm text-muted mt-1">
            Extract structured data from PDFs using AI
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {stepsToShow.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                  step >= s ? "bg-accent text-white" : "bg-gray-100 text-muted"
                }`}
              >
                {s}
              </div>
              <span className={`text-sm whitespace-nowrap ${step >= s ? "text-foreground" : "text-muted"}`}>
                {STEP_LABELS[s]}
              </span>
              {s < maxStep && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1: Schema Builder */}
        {step === 1 && (
          <div className="border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Define Extraction Fields</h2>
            <SchemaBuilder onSchemaChange={handleSchemaConfirm} />
          </div>
        )}

        {/* Step 2: Upload PDFs */}
        {step === 2 && (
          <div className="border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Upload PDFs</h2>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-accent transition-colors"
            >
              <p className="text-muted text-sm">Drop PDF files here or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>

            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm truncate">{f.file.name}</span>
                    <button onClick={() => removeFile(f.id)} className="text-muted hover:text-red-500 text-sm ml-2">
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {extracting && (
              <div className="mt-4">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-sm text-muted mt-2">Extracting... {progress}%</p>
              </div>
            )}

            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button
                onClick={handleExtract}
                disabled={!files.length || extracting}
                className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extracting ? "Extracting..." : "Extract Data"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && (
          <div className="border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Extraction Results</h2>

            <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto mb-6">
              <pre className="text-xs font-mono whitespace-pre">
                {csvData.split("\n").slice(0, 20).join("\n")}
                {csvData.split("\n").length > 20 && "\n..."}
              </pre>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => downloadCSV(csvData, "extracted_data.csv")}
                className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
              >
                Download CSV
              </button>
              <button
                onClick={startCrossReference}
                className="px-6 py-2.5 border-2 border-accent text-accent rounded-lg text-sm font-medium hover:bg-accent-bg transition-colors"
              >
                Cross-Reference
              </button>
              <button onClick={reset} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Lookup Dataset — Schema + Upload + Extract */}
        {step === 4 && (
          <div className="border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium mb-2">Lookup Dataset</h2>
            <p className="text-sm text-muted mb-6">
              Define fields and upload PDFs for the dataset you want to cross-reference against.
            </p>

            {/* Lookup schema builder (inline) */}
            {!lookupSchema && (
              <div className="mb-6">
                <h3 className="text-sm font-medium mb-3">Define lookup fields</h3>
                <SchemaBuilder onSchemaChange={handleLookupSchemaConfirm} />
              </div>
            )}

            {/* After schema confirmed: show upload zone */}
            {lookupSchema && (
              <>
                <div className="mb-4 px-3 py-2 bg-accent-bg rounded-lg">
                  <p className="text-sm text-accent">Lookup schema confirmed</p>
                </div>

                <div
                  onDrop={handleLookupDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => lookupFileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-accent transition-colors"
                >
                  <p className="text-muted text-sm">Drop lookup PDF files here or click to browse</p>
                  <input
                    ref={lookupFileInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleLookupFilesSelected}
                    className="hidden"
                  />
                </div>

                {lookupFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {lookupFiles.map((f) => (
                      <div key={f.id} className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg">
                        <span className="text-sm truncate">{f.file.name}</span>
                        <button onClick={() => removeLookupFile(f.id)} className="text-muted hover:text-red-500 text-sm ml-2">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {extracting && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-sm text-muted mt-2">Extracting lookup data... {progress}%</p>
                  </div>
                )}

                {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

                <div className="mt-6 flex gap-3">
                  <button onClick={() => setStep(3)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    Back
                  </button>
                  <button
                    onClick={handleLookupExtract}
                    disabled={!lookupFiles.length || extracting}
                    className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {extracting ? "Extracting..." : "Extract Lookup Data"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 5: Configure Match */}
        {step === 5 && (
          <div className="border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium mb-2">Configure Match</h2>
            <p className="text-sm text-muted mb-6">
              Select which columns to match between your source and lookup datasets.
            </p>

            {matching && (
              <div className="mb-4">
                <p className="text-sm text-muted">Running cross-reference...</p>
              </div>
            )}

            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            <MatchConfigurator
              sourceHeaders={getHeaders(csvData)}
              lookupHeaders={getHeaders(lookupCsvData)}
              onConfirm={handleRunMatch}
              onBack={() => setStep(4)}
            />
          </div>
        )}

        {/* Step 6: Match Results */}
        {step === 6 && (
          <div className="border border-border rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Cross-Reference Results</h2>

            <div className="mb-2">
              <p className="text-sm text-muted">
                {matchesCsv.split("\n").length - 1} match{matchesCsv.split("\n").length - 1 !== 1 ? "es" : ""} found
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto mb-6">
              <pre className="text-xs font-mono whitespace-pre">
                {matchesCsv.split("\n").slice(0, 20).join("\n")}
                {matchesCsv.split("\n").length > 20 && "\n..."}
              </pre>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => downloadCSV(matchesCsv, "cross_reference_matches.csv")}
                className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
              >
                Download Matches CSV
              </button>
              <button onClick={() => setStep(5)} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Adjust Match
              </button>
              <button onClick={reset} className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
