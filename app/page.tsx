"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { ReferenceDocument, VerificationRecord } from "@/lib/types";

type Dash = {
  stats: {
    total: number;
    accepted: number;
    rejected: number;
    manualReviews: number;
    averageScore: number;
  };
  recent: VerificationRecord[];
  recentRejected: VerificationRecord[];
  recentAccepted: VerificationRecord[];
  processing: VerificationRecord[];
  currentReference: ReferenceDocument | null;
};

function MiniList({ items }: { items: VerificationRecord[] }) {
  if (!items.length) return <div className="muted small">None yet.</div>;
  return (
    <div>
      {items.map((v) => (
        <Link
          key={v.id}
          href={`/history/${v.id}`}
          className="row"
          style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eef2f6" }}
        >
          <span>
            <strong>{v.id}</strong>
            <div className="muted small">
              {v.userName} · {v.overallScore}%
            </div>
          </span>
          <StatusBadge value={v.review?.decision || v.finalDecision} />
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <p className="muted">Loading dashboard…</p>;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Dashboard</h2>
          <p>Verification volume, outcomes, and the active reference template.</p>
        </div>
        <Link className="btn" href="/verify">
          New verification
        </Link>
      </div>

      <div className="grid-stats">
        <div className="card stat">
          <div className="label">Total documents</div>
          <div className="value">{data.stats.total.toLocaleString()}</div>
        </div>
        <div className="card stat ok">
          <div className="label">Accepted</div>
          <div className="value">{data.stats.accepted.toLocaleString()}</div>
        </div>
        <div className="card stat bad">
          <div className="label">Rejected</div>
          <div className="value">{data.stats.rejected.toLocaleString()}</div>
        </div>
        <div className="card stat warn">
          <div className="label">Manual reviews</div>
          <div className="value">{data.stats.manualReviews.toLocaleString()}</div>
        </div>
        <div className="card stat">
          <div className="label">Average match</div>
          <div className="value">{data.stats.averageScore}%</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h">Recent verifications</div>
          <div className="card-b">
            {data.recent.length === 0 ? (
              <div className="muted small">No verifications yet. Upload a reference, then a user PDF.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Score</th>
                    <th>Decision</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((v) => (
                    <tr key={v.id} className="clickable" onClick={() => (location.href = `/history/${v.id}`)}>
                      <td>{v.id}</td>
                      <td>{v.userName}</td>
                      <td>{v.overallScore}%</td>
                      <td>
                        <StatusBadge value={v.review?.decision || v.finalDecision} />
                      </td>
                      <td className="muted">{formatDate(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-h">Current reference</div>
          <div className="card-b">
            {data.currentReference ? (
              <>
                <div>
                  <strong>
                    {data.currentReference.id} · v{data.currentReference.version}
                  </strong>
                </div>
                <div className="muted small" style={{ margin: "6px 0 12px" }}>
                  {data.currentReference.fileName} · {data.currentReference.pageCount} page(s)
                  <br />
                  Uploaded {formatDate(data.currentReference.uploadedAt)}
                </div>
                <Link className="btn secondary" href="/references">
                  Manage references
                </Link>
              </>
            ) : (
              <div>
                <p className="muted small">No reference document is active.</p>
                <Link className="btn" href="/references">
                  Upload reference
                </Link>
              </div>
            )}
            <div style={{ marginTop: 18 }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 8 }}>
                Processing activity
              </div>
              {data.processing.length === 0 ? (
                <div className="muted small">Idle — no jobs in progress.</div>
              ) : (
                data.processing.map((p) => (
                  <div key={p.id} className="small">
                    {p.id} · {p.uploadedFileName}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="three-col">
        <div className="card">
          <div className="card-h">Recent accepted</div>
          <div className="card-b">
            <MiniList items={data.recentAccepted} />
          </div>
        </div>
        <div className="card">
          <div className="card-h">Recent rejected</div>
          <div className="card-b">
            <MiniList items={data.recentRejected} />
          </div>
        </div>
        <div className="card">
          <div className="card-h">Needs review</div>
          <div className="card-b">
            <MiniList
              items={data.recent.filter(
                (v) => v.finalDecision === "PENDING" || v.automatedDecision === "MANUAL_REVIEW"
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
