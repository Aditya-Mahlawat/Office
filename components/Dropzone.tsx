"use client";

import { useCallback, useState } from "react";

export function Dropzone({
  title,
  subtitle,
  file,
  onFile,
  extra,
}: {
  title: string;
  subtitle?: string;
  file: File | null;
  onFile: (file: File | null) => void;
  extra?: string;
}) {
  const [over, setOver] = useState(false);

  const pick = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        alert("Only PDF files are supported.");
        return;
      }
      onFile(f);
    },
    [onFile]
  );

  return (
    <div
      className={`drop ${over ? "over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files[0]);
      }}
    >
      <strong>{title}</strong>
      <div>{subtitle || "Drag & drop PDF here or browse files"}</div>
      <div style={{ marginTop: 14 }}>
        <label className="btn secondary" style={{ display: "inline-block" }}>
          Browse files
          <input
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
      </div>
      {file && (
        <div className="small" style={{ marginTop: 14, color: "var(--ink)" }}>
          {file.name} · {(file.size / 1024).toFixed(1)} KB
          {extra ? ` · ${extra}` : ""}
        </div>
      )}
    </div>
  );
}
