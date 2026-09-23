"use client";

import { useEffect, useState } from "react";
import { Dropzone } from "@/components/Dropzone";
import { formatBytes, formatDate } from "@/lib/format";
import type { ReferenceDocument } from "@/lib/types";

export default function ReferencesPage() {
  const [refs, setRefs] = useState<ReferenceDocument[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/references");
    const data = await res.json();
    setRefs(data.references || []);
    const active = (data.references as ReferenceDocument[]).find((r) => r.active);
    setPreview(active?.id ?? data.references?.[0]?.id ?? null);
  }

  useEffect(() => {
    load();
  }, []);

  async function upload() {
    setError("");
    if (!file) {
      setError("Choose a PDF.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/references", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    setFile(null);
    await load();
    setPreview(data.reference.id);
  }

  async function activate(id: string) {
    await fetch(`/api/references/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    await load();
    setPreview(id);
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete ${name}? It will disappear from reference management. Files used by completed history are retained so those reports stay reproducible.`)) return;
    const res = await fetch(`/api/references/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete reference.");
      return;
    }
    if (preview === id) setPreview(null);
    await load();
  }

  const current = refs.find((r) => r.id === preview);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Reference documents</h2>
          <p>New uploads create a new version. Historical verifications keep pointing at the old file.</p>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-h">Upload / replace reference</div>
          <div className="card-b">
            <Dropzone title="Upload reference document" file={file} onFile={setFile} />
            {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
            <div style={{ marginTop: 12 }}>
              <button className="btn" disabled={busy} onClick={upload}>
                {busy ? "Uploading…" : "Save as new version and activate"}
              </button>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">Active template</div>
          <div className="card-b">
            {refs.filter((r) => r.active).map((r) => (
              <div key={r.id}>
                <strong>
                  {r.id} · version {r.version}
                </strong>
                <div className="muted small">
                  {r.fileName} · {r.pageCount} pages · {formatBytes(r.sizeBytes)}
                  <br />
                  {formatDate(r.uploadedAt)}
                </div>
              </div>
            ))}
            {refs.every((r) => !r.active) && <div className="muted small">No active reference.</div>}
          </div>
        </div>
      </div>

      <div className="two-col" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-h">Version history</div>
          <div className="card-b" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Version</th>
                  <th>File</th>
                  <th>Pages</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {refs
                  .slice()
                  .reverse()
                  .map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>v{r.version}</td>
                      <td>{r.fileName}</td>
                      <td>{r.pageCount}</td>
                      <td>{formatDate(r.uploadedAt)}</td>
                      <td>{r.active ? "Active" : "Inactive"}</td>
                      <td className="row">
                        <button className="btn ghost" onClick={() => setPreview(r.id)}>
                          View
                        </button>
                        <a className="btn ghost" href={`/api/references/${r.id}/file`} target="_blank">
                          Download
                        </a>
                        {!r.active && (
                          <button className="btn ghost" onClick={() => activate(r.id)}>
                            Activate
                          </button>
                        )}
                        <button className="btn ghost danger-link" onClick={() => remove(r.id, r.fileName)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-h">Viewer {current ? `· ${current.id}` : ""}</div>
          {current ? (
            <iframe className="pdf-frame" title="Reference" src={`/api/references/${current.id}/file`} />
          ) : (
            <div className="card-b muted small">Upload a reference to preview it here.</div>
          )}
        </div>
      </div>
    </div>
  );
}
