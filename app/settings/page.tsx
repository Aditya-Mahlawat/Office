"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings));
  }, []);

  const w = settings.weights;
  const r = settings.rules;

  async function save() {
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    setSettings(data.settings);
    setMsg("Settings saved. New verifications use these weights and rules.");
  }

  async function removeApiKey() {
    setMsg("");
    const updated = { ...settings, geminiApiKey: "" };
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const data = await res.json();
    setSettings(data.settings);
    setMsg("API key removed and settings saved.");
  }

  function setWeight(key: keyof typeof w, value: number) {
    setSettings({ ...settings, weights: { ...w, [key]: value } });
  }

  function setRule<K extends keyof typeof r>(key: K, value: (typeof r)[K]) {
    setSettings({ ...settings, rules: { ...r, [key]: value } });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Settings</h2>
          <p>Score weights and acceptance rules are applied by the verification engine, not hard-coded in the UI.</p>
        </div>
        <button className="btn" onClick={save} suppressHydrationWarning>
          Save settings
        </button>
      </div>
      {msg && <div className="notice" style={{ marginBottom: 16 }}>{msg}</div>}

      <div className="two-col">
        <div className="card">
          <div className="card-h">Score weights (relative %)</div>
          <div className="card-b">
            {(
              [
                ["text", "Text"],
                ["fields", "Required fields"],
                ["structure", "Structure"],
                ["layout", "Layout"],
                ["signature", "Signature"],
                ["stamp", "Stamp"],
                ["letterhead", "Letterhead"],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label>
                  {label}: {w[key]}
                </label>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={w[key]}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                />
              </div>
            ))}
            <div className="muted small">
              Weights are normalized. Current sum: {Object.values(w).reduce((a, b) => a + b, 0)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">Acceptance / rejection rules</div>
          <div className="card-b">
            <div className="field">
              <label>Accept if overall score ≥ {r.overallThreshold}%</label>
              <input
                type="range"
                min={50}
                max={100}
                value={r.overallThreshold}
                onChange={(e) => setRule("overallThreshold", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Layout similarity floor {r.layoutThreshold}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={r.layoutThreshold}
                onChange={(e) => setRule("layoutThreshold", Number(e.target.value))}
              />
            </div>
            <label className="small" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={r.requireSignature}
                onChange={(e) => setRule("requireSignature", e.target.checked)}
              />
              Require signature detected
            </label>
            <label className="small" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={r.requireStamp}
                onChange={(e) => setRule("requireStamp", e.target.checked)}
              />
              Require stamp/seal detected
            </label>
            <label className="small" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={r.requireAllMandatoryFields}
                onChange={(e) => setRule("requireAllMandatoryFields", e.target.checked)}
              />
              All mandatory fields must be present
            </label>
            <label className="small" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={r.requireNoCriticalSectionsMissing}
                onChange={(e) => setRule("requireNoCriticalSectionsMissing", e.target.checked)}
              />
              No critical section missing
            </label>
            <label className="small" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={r.commentRequiredOnOverride}
                onChange={(e) => setRule("commentRequiredOnOverride", e.target.checked)}
              />
              Require comment when overriding automation
            </label>
            <label className="small" style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={r.sendLowScoreToManualReview}
                onChange={(e) => setRule("sendLowScoreToManualReview", e.target.checked)}
              />
              Send borderline scores to manual review (band {r.manualReviewBand}%)
            </label>
            <div className="field">
              <label>Mandatory fields (one per line)</label>
              <textarea
                rows={5}
                value={r.mandatoryFields.join("\n")}
                onChange={(e) =>
                  setRule(
                    "mandatoryFields",
                    e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                  )
                }
              />
            </div>
            <div className="field">
              <label>Expected sections (one per line)</label>
              <textarea
                rows={5}
                value={r.expectedSections.join("\n")}
                onChange={(e) =>
                  setRule(
                    "expectedSections",
                    e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                  )
                }
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">Vision & OCR Provider</div>
        <div className="card-b small">
          <p>
            When a scanned document (image-only PDF) is uploaded, the verification engine uses OCR to extract text, fields, and letterhead structure.
          </p>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Google Gemini API Key (optional):</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="password"
                suppressHydrationWarning
                placeholder="AIzaSy... (leave blank to use standalone Tesseract OCR)"
                value={settings.geminiApiKey || ""}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value.trim() })}
                style={{ width: "100%", maxWidth: 450 }}
              />
              <button className="btn" onClick={save}>Save Key</button>
              {settings.geminiApiKey && (
                <button className="btn ghost danger-link" onClick={removeApiKey}>
                  Remove Key
                </button>
              )}
            </div>
            <p className="muted" style={{ marginTop: 6 }}>
              {settings.geminiApiKey
                ? "✓ Gemini Multimodal Vision API is configured for cloud-powered document understanding."
                : "ℹ No API key configured. Standalone local Tesseract + Sharp OCR engine is active (100% offline)."}
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">External integration</div>
        <div className="card-b small">
          <p>
            Existing websites can call <code>POST /api/verify-document</code> with multipart fields{" "}
            <code>uploaded_document</code>, <code>user_id</code>, optional <code>reference_document_id</code>.
          </p>
          <p className="muted">
            If reference_document_id is omitted, the currently active reference is used — the production path for
            “new registration → assigned template”.
          </p>
        </div>
      </div>
    </div>
  );
}
