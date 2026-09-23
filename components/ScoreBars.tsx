import { CATEGORY_LABELS, type CategoryScores } from "@/lib/types";

export function ScoreBars({ scores }: { scores: CategoryScores }) {
  return (
    <div>
      {(Object.keys(CATEGORY_LABELS) as (keyof CategoryScores)[]).map((key) => {
        const n = scores[key] ?? 0;
        const tone = n >= 85 ? "ok" : n >= 70 ? "mid" : "low";
        return (
          <div className="score-row" key={key}>
            <div>{CATEGORY_LABELS[key]}</div>
            <div className={`bar ${tone}`}>
              <span style={{ width: `${n}%` }} />
            </div>
            <div style={{ textAlign: "right" }}>{n}%</div>
          </div>
        );
      })}
    </div>
  );
}
