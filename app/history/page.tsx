"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { VerificationRecord } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<VerificationRecord[]>([]);
  const [decision, setDecision] = useState("");
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [refVersion, setRefVersion] = useState("");

  async function load() {
    const q = new URLSearchParams();
    if (decision) q.set("decision", decision);
    if (user) q.set("user", user);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (minScore) q.set("min_score", minScore);
    if (maxScore) q.set("max_score", maxScore);
    if (refVersion) q.set("reference_version", refVersion);
    const res = await fetch(`/api/verifications?${q.toString()}`);
    const data = await res.json();
    setItems(data.verifications || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Verification history</h2>
          <p>Every run is stored with the reference version used at that time.</p>
        </div>
      </div>

      <div className="filters">
        <select value={decision} onChange={(e) => setDecision(e.target.value)}>
          <option value="">All outcomes</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="manual_review">Manual review</option>
        </select>
        <input placeholder="User" value={user} onChange={(e) => setUser(e.target.value)} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <input
          placeholder="Min %"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          style={{ width: 80 }}
        />
        <input
          placeholder="Max %"
          value={maxScore}
          onChange={(e) => setMaxScore(e.target.value)}
          style={{ width: 80 }}
        />
        <input
          placeholder="Ref version"
          value={refVersion}
          onChange={(e) => setRefVersion(e.target.value)}
          style={{ width: 110 }}
        />
        <button className="btn secondary" onClick={load}>
          Apply filters
        </button>
      </div>

      <div className="card">
        <div className="card-b" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Verification ID</th>
                <th>User</th>
                <th>Upload date</th>
                <th>Reference</th>
                <th>Match</th>
                <th>Automated</th>
                <th>Final</th>
                <th>Reviewer</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted">
                    No records match these filters.
                  </td>
                </tr>
              )}
              {items.map((v) => {
                const reason =
                  v.issues.find((i) => i.severity === "critical")?.message ||
                  v.issues[0]?.message ||
                  "—";
                return (
                  <tr key={v.id} className="clickable" onClick={() => router.push(`/history/${v.id}`)}>
                    <td>{v.id}</td>
                    <td>{v.userName}</td>
                    <td>{formatDate(v.createdAt)}</td>
                    <td>
                      {v.referenceId} v{v.referenceVersion}
                    </td>
                    <td>{v.overallScore}%</td>
                    <td>
                      <StatusBadge value={v.automatedDecision} />
                    </td>
                    <td>
                      <StatusBadge value={v.finalDecision} />
                    </td>
                    <td>{v.review?.reviewer || "—"}</td>
                    <td>
                      <StatusBadge value={v.status} />
                    </td>
                    <td className="muted" title={reason}>
                      {reason.length > 48 ? `${reason.slice(0, 48)}…` : reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
