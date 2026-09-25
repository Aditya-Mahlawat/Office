"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/Dropzone";
import { StageTimeline } from "@/components/StageTimeline";
import { ScoreBars } from "@/components/ScoreBars";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes } from "@/lib/format";
import type { ReferenceDocument, VerificationRecord } from "@/lib/types";

export default function VerifyPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [userId, setUserId] = useState("user-001");
  const [userName, setUserName] = useState("Demo User");
  const [refId, setRefId] = useState("");
  const [refs, setRefs] = useState<ReferenceDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerificationRecord | null>(null);

  useEffect(() => {
    fetch("/api/references")
      .then((r) => r.json())
      .then((d) => {
        setRefs(d.references || []);
        setRefId("");
      });
  }, []);

  async function submit() {
    setError("");
    if (!file) {
      setError("Choose a PDF to verify.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("uploaded_document", file);
    fd.set("user_id", userId);
    fd.set("user_name", userName);
    if (refId) fd.set("reference_document_id", refId);
    const res = await fetch("/api/verify-document", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Verification failed");
      if (data.verification) setResult(data.verification);
      return;
    }
    setResult(data.verification);
  }

  const active = refs.find((r) => r.id === refId);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>New verification</h2>
          <p>Upload a completed PDF. It is compared against the selected reference version.</p>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 16 }}>
        This prototype runs a heuristic PDF engine (text, layout boxes, image operators). It does not claim neural
        OCR or seal classification. Production OCR/vision plugs into <code>runVerificationEngine()</code>.
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h">Upload document for verification</div>
          <div className="card-b">
            <Dropzone
              title="Drag & drop PDF here"
              subtitle="or browse files — PDF only"
              file={file}
              extra={file ? formatBytes(file.size) : undefined}
              onFile={setFile}
            />
            {file && (
              <div className="small muted" style={{ marginTop: 10 }}>
                File name: {file.name} · Size: {formatBytes(file.size)} · Upload status: ready
              </div>
            )}
            <div className="row" style={{ marginTop: 16 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>User ID</label>
                <input suppressHydrationWarning value={userId} onChange={(e) => setUserId(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>User name</label>
                <input suppressHydrationWarning value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Reference document (simulates per-registration template)</label>
              <select suppressHydrationWarning value={refId} onChange={(e) => setRefId(e.target.value)}>
                {refs.length === 0 && <option value="">No references uploaded</option>}
                {refs.length > 0 && <option value="">Auto (Detect best match from active templates)</option>}
                {refs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} v{r.version} — {r.fileName}
                    {r.active ? " (active)" : ""}
                  </option>
                ))}
              </select>
              {active && (
                <div className="muted small">
                  {active.pageCount} pages · uploaded {new Date(active.uploadedAt).toLocaleString()}
                  {active.criteria && (
                    <><br />This reference supplies {active.criteria.mandatoryFields.length} field and {active.criteria.expectedSections.length} section checks.</>
                  )}
                </div>
              )}
            </div>
            {error && <div className="error">{error}</div>}
            <button suppressHydrationWarning className="btn" disabled={busy} onClick={submit}>
              {busy ? "Processing…" : "Start verification"}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-h">Processing stages</div>
          <div className="card-b">
            {result ? (
              <StageTimeline stages={result.stages} />
            ) : (
              <div className="muted small">Stages appear after you start verification.</div>
            )}
          </div>
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-h">
            <span>Result {result.id}</span>
            <StatusBadge value={result.automatedDecision} />
          </div>
          <div className="card-b">
            <div className="row" style={{ alignItems: "flex-end", marginBottom: 12 }}>
              <div>
                <div className="muted small">Overall match</div>
                <div className="big-score">{result.overallScore}%</div>
              </div>
              <div className="muted small" style={{ maxWidth: 520 }}>
                {result.engineNote}
              </div>
            </div>
            <ScoreBars scores={result.categoryScores} />
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => router.push(`/history/${result.id}`)}>
                Open full report & side-by-side review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
