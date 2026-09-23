import type { ProcessingStage } from "@/lib/types";

export function StageTimeline({ stages }: { stages: ProcessingStage[] }) {
  return (
    <div className="stage-list">
      {stages.map((s) => (
        <div key={s.key} className={`stage ${s.status}`}>
          <span className="pip" />
          <div>
            <div>{s.label}</div>
            {s.detail && <div className="muted small">{s.detail}</div>}
          </div>
          <div className="muted small" style={{ textTransform: "capitalize" }}>
            {s.status}
          </div>
        </div>
      ))}
    </div>
  );
}
