"use client";

import { useState, useRef, useCallback } from "react";
import SchemaBuilder, { SchemaMode } from "./SchemaBuilder";

interface UploadedFile {
  file: File;
  id: string;
}

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

    // Simulate progress (actual extraction is a single request)
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

  function downloadCSV() {
    const blob = new Blob([csvData], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted_data.csv";
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
  }

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
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-muted"
                }`}
              >
                {s}
              </div>
              <span className={`text-sm ${step >= s ? "text-foreground" : "text-muted"}`}>
                {s === 1 ? "Define Fields" : s === 2 ? "Upload PDFs" : "Results"}
              </span>
              {s < 3 && <div className="w-8 h-px bg-border" />}
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

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-accent transition-colors"
            >
              <p className="text-muted text-sm">
                Drop PDF files here or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                {files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg"
                  >
                    <span className="text-sm truncate">{f.file.name}</span>
                    <button
                      onClick={() => removeFile(f.id)}
                      className="text-muted hover:text-red-500 text-sm ml-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Progress bar */}
            {extracting && (
              <div className="mt-4">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-muted mt-2">Extracting... {progress}%</p>
              </div>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-500">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
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

            {/* CSV Preview */}
            <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto mb-6">
              <pre className="text-xs font-mono whitespace-pre">
                {csvData.split("\n").slice(0, 20).join("\n")}
                {csvData.split("\n").length > 20 && "\n..."}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadCSV}
                className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
              >
                Download CSV
              </button>
              <button
                onClick={reset}
                className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
