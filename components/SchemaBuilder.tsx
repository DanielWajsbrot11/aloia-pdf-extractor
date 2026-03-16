"use client";

import { useState } from "react";

export interface FieldDef {
  name: string;
  description: string;
}

export type SchemaMode = "form" | "json" | "nl";

interface SchemaBuilderProps {
  onSchemaChange: (schema: string, mode: SchemaMode) => void;
}

export default function SchemaBuilder({ onSchemaChange }: SchemaBuilderProps) {
  const [activeTab, setActiveTab] = useState<SchemaMode>("form");
  const [fields, setFields] = useState<FieldDef[]>([{ name: "", description: "" }]);
  const [jsonInput, setJsonInput] = useState("");
  const [nlInput, setNlInput] = useState("");

  const tabs: { key: SchemaMode; label: string }[] = [
    { key: "form", label: "Field Builder" },
    { key: "json", label: "JSON Schema" },
    { key: "nl", label: "Natural Language" },
  ];

  function addField() {
    setFields([...fields, { name: "", description: "" }]);
  }

  function removeField(index: number) {
    const updated = fields.filter((_, i) => i !== index);
    setFields(updated.length ? updated : [{ name: "", description: "" }]);
  }

  function updateField(index: number, key: keyof FieldDef, value: string) {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
  }

  function handleConfirm() {
    if (activeTab === "form") {
      const validFields = fields.filter((f) => f.name.trim());
      if (!validFields.length) return;
      onSchemaChange(JSON.stringify(validFields), "form");
    } else if (activeTab === "json") {
      try {
        const parsed = JSON.parse(jsonInput);
        if (!Array.isArray(parsed)) return;
        onSchemaChange(JSON.stringify(parsed), "json");
      } catch {
        alert("Invalid JSON. Expected an array of { name, description } objects.");
      }
    } else {
      if (!nlInput.trim()) return;
      onSchemaChange(nlInput.trim(), "nl");
    }
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form Builder */}
      {activeTab === "form" && (
        <div className="space-y-3">
          {fields.map((field, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Field name"
                value={field.name}
                onChange={(e) => updateField(i, "name", e.target.value)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
              <input
                type="text"
                placeholder="Description (hint for AI)"
                value={field.description}
                onChange={(e) => updateField(i, "description", e.target.value)}
                className="flex-2 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
              <button
                onClick={() => removeField(i)}
                className="px-2 py-2 text-muted hover:text-red-500 transition-colors text-sm"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            onClick={addField}
            className="text-sm text-accent hover:text-accent-light transition-colors"
          >
            + Add field
          </button>
        </div>
      )}

      {/* JSON Input */}
      {activeTab === "json" && (
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`[
  { "name": "company_name", "description": "The company or organization name" },
  { "name": "date", "description": "Document date" }
]`}
          className="w-full h-48 px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-accent resize-none"
        />
      )}

      {/* Natural Language */}
      {activeTab === "nl" && (
        <textarea
          value={nlInput}
          onChange={(e) => setNlInput(e.target.value)}
          placeholder="Describe what you want to extract, e.g.: Extract the invoice number, date, vendor name, line items with quantities and prices, and the total amount."
          className="w-full h-48 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-none"
        />
      )}

      <button
        onClick={handleConfirm}
        className="mt-4 px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-light transition-colors"
      >
        Confirm Schema
      </button>
    </div>
  );
}
