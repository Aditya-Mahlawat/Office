"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PdfPane } from "@/components/PdfPane";
import { ScoreBars } from "@/components/ScoreBars";
import { StageTimeline } from "@/components/StageTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes, formatDate } from "@/lib/format";
import type { ReviewerDecision, VerificationRecord } from "@/lib/types";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<VerificationRecord | null>(null);
  const [page, setPage] = useState(1);
  const [sync, setSync] = useState(true);
  const [refPage, setRefPage] = useState(1);
  const [upPage, setUpPage] = useState(1);
  const [reviewer, setReviewer] = useState("Alex Reviewer");
  const [decision, setDecision] = useState<ReviewerDecision>("ACCEPTED");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    fetch(`/api/verifications/${id}`)
      .then((r) => r.json())
      .then((d) => setV(d.verification));
  }, [id]);

  function setBoth(n: number) {
    const p = Math.max(1, n);
    if (sync) {
      setPage(p);
      setRefPage(p);
      setUpPage(p);
    }
  }

  async function submitReview() {
    setError("");
    setSaved("");
    const res = await fetch(`/api/verifications/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewer, decision, comment }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Review failed");
      return;
    }
    setV(data.verification);
    setSaved("Reviewer decision saved. Automated decision is unchanged.");
  }

  if (!v) return <p className="muted">Loading report…</p>;

  const critical = v.issues.filter((i) => i.severity === "critical");
  const warnings = v.issues.filter((i) => i.severity === "warning");
  const refSrc = `/api/verifications/${v.id}/file?side=reference`;
  const upSrc = `/api/verifications/${v.id}/file?side=uploaded`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Verification {v.id}</h2>
          <p>
            {v.uploadedFileName} compared with {v.referenceId} (v{v.referenceVersion})
          </p>
        </div>
        <div className="row">
          <StatusBadge value={v.automatedDecision} />
          <StatusBadge value={v.finalDecision} />
        </div>
      </div>

      <div className="compare">
        <PdfPane
          title="Reference document"
          src={refSrc}
          page={sync ? page : refPage}
          onPage={(n) => (sync ? setBoth(n) : setRefPage(n))}
        />
        <PdfPane
          title="Uploaded document"
          src={upSrc}
          page={sync ? page : upPage}
          onPage={(n) => (sync ? setBoth(n) : setUpPage(n))}
        />
        <div className="card" style={{ overflow: "auto", maxHeight: "calc(100vh - 160px)" }}>
          <div className="card-h">Automated findings</div>
          <div className="card-b">
            <label className="small muted" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} />
              Synchronized page navigation
            </label>
            <div className="muted small">Overall match</div>
            <div className="big-score">{v.overallScore}%</div>
            <div style={{ margin: "8px 0 14px" }}>
              Automated: <StatusBadge value={v.automatedDecision} />
            </div>
            <ScoreBars scores={v.categoryScores} />

            <h4 style={{ margin: "18px 0 8px" }}>Critical issues</h4>
            {critical.length === 0 && <div className="muted small">None.</div>}
            {critical.map((i) => (
              <div key={i.id} className="issue critical">
                {i.message}
              </div>
            ))}
            <h4 style={{ margin: "18px 0 8px" }}>Warnings</h4>
            {warnings.length === 0 && <div className="muted small">None.</div>}
            {warnings.map((i) => (
              <div key={i.id} className="issue warning">
                {i.message}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h">Verification report</div>
          <div className="card-b small">
            <p>
              <strong>User:</strong> {v.userName} ({v.userId})
            </p>
            <p>
              <strong>Uploaded:</strong> {formatDate(v.createdAt)} · {v.uploadedFileName} ·{" "}
              {formatBytes(v.uploadedSizeBytes)} · {v.uploadedPageCount} page(s)
            </p>
            <p>
              <strong>Reference:</strong> {v.referenceId} v{v.referenceVersion} — {v.referenceFileName}
            </p>
            <p>
              <strong>Match score:</strong> {v.overallScore}%
            </p>
            <p>
              <strong>Automated decision:</strong> {v.automatedDecision}
            </p>
            <p>
              <strong>Final decision:</strong> {v.finalDecision}
            </p>
            <div className="notice" style={{ marginTop: 12 }}>
              {v.engineNote}
            </div>
            <h4>Processing</h4>
            <StageTimeline stages={v.stages} />
            {v.extractedSummary.uploadedTextPreview && (
              <>
                <h4>Extracted text preview (uploaded)</h4>
                <pre style={{ whiteSpace: "pre-wrap", background: "#f7fafc", padding: 10, borderRadius: 8 }}>
                  {v.extractedSummary.uploadedTextPreview}
                </pre>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">Human review / override</div>
          <div className="card-b">
            <p className="muted small">
              Automation is not the final authority. The automated decision stays stored even if you override it.
            </p>
            <div className="field">
              <label>Reviewer</label>
              <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
            </div>
            <div className="field">
              <label>Reviewer decision</label>
              <select value={decision} onChange={(e) => setDecision(e.target.value as ReviewerDecision)}>
                <option value="ACCEPTED">Accept</option>
                <option value="REJECTED">Reject</option>
                <option value="ACCEPTED_WITH_WARNING">Accept with warning</option>
              </select>
            </div>
            <div className="field">
              <label>Comment (required when overriding automation)</label>
              <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            {error && <div className="error">{error}</div>}
            {saved && <div className="small" style={{ color: "var(--ok)" }}>{saved}</div>}
            <button className="btn" onClick={submitReview}>
              Save reviewer decision
            </button>
            {v.review && (
              <div className="small" style={{ marginTop: 16 }}>
                <strong>Last review</strong>
                <div>
                  {v.review.reviewer} · {v.review.decision} · {formatDate(v.review.timestamp)}
                </div>
                <div className="muted">{v.review.comment || "No comment"}</div>
                {v.review.overridden && <div>Overrode automated {v.automatedDecision}.</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
