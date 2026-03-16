"use client";

import { useState } from "react";

interface MatchConfiguratorProps {
  sourceHeaders: string[];
  lookupHeaders: string[];
  onConfirm: (sourceCol: string, lookupCol: string, returnCols: string[]) => void;
  onBack: () => void;
}

export default function MatchConfigurator({
  sourceHeaders,
  lookupHeaders,
  onConfirm,
  onBack,
}: MatchConfiguratorProps) {
  const [sourceCol, setSourceCol] = useState("");
  const [lookupCol, setLookupCol] = useState("");
  const [returnCols, setReturnCols] = useState<Set<string>>(new Set());

  function toggleReturnCol(col: string) {
    setReturnCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) {
        next.delete(col);
      } else {
        next.add(col);
      }
      return next;
    });
  }

  function selectAllReturnCols() {
    setReturnCols(new Set(lookupHeaders));
  }

  function clearReturnCols() {
    setReturnCols(new Set());
  }

  const canSubmit = sourceCol && lookupCol && returnCols.size > 0;

  return (
    <div className="space-y-6">
      {/* Source column */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Match FROM (source column)
        </label>
        <select
          value={sourceCol}
          onChange={(e) => setSourceCol(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent bg-white"
        >
          <option value="">Select source column...</option>
          {sourceHeaders.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      {/* Lookup column */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Match AGAINST (lookup column)
        </label>
        <select
          value={lookupCol}
          onChange={(e) => setLookupCol(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent bg-white"
        >
          <option value="">Select lookup column...</option>
          {lookupHeaders.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      {/* Return columns */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">
            Return these lookup columns
          </label>
          <div className="flex gap-2">
            <button
              onClick={selectAllReturnCols}
              className="text-xs text-accent hover:text-accent-light"
            >
              Select all
            </button>
            <button
              onClick={clearReturnCols}
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="border border-border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
          {lookupHeaders.map((h) => (
            <label
              key={h}
              className="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={returnCols.has(h)}
                onChange={() => toggleReturnCol(h)}
                className="accent-accent"
              />
              <span className="text-sm">{h}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="px-4 py-2.5 border border-border rounded-lg text-sm hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => canSubmit && onConfirm(sourceCol, lookupCol, Array.from(returnCols))}
          disabled={!canSubmit}
          className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Run Match
        </button>
      </div>
    </div>
  );
}
