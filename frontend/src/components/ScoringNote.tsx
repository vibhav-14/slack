import type { PriorityFactor } from "../api/types";

/** Plain-language explanation of the scoring model, built from the weights the API reports. */
export function ScoringNote({ factors }: { factors: PriorityFactor[] | undefined }) {
  if (!factors?.length) return null;
  return (
    <details className="formula">
      <summary style={{ cursor: "pointer" }}>How the score is calculated</summary>
      <div className="prose stack" style={{ marginTop: "var(--s-3)" }}>
        <p>Each topic gets a score out of 100 from six factors, each measured from 0 to 1 and multiplied by its weight:</p>
        <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
          {factors.map((f) => (
            <li key={f.key}>
              <strong>{f.label}</strong> — {Math.round(f.weight * 100)}% of the score
            </li>
          ))}
        </ul>
        <p>
          A factor with no evidence yet — say, no past papers uploaded — isn't counted as zero. It's left out, and the
          other factors' weights are scaled up to fill the gap. Add more material and the scores get sharper.
        </p>
        <p>65 or more is high priority, 45–64 medium, below that low.</p>
      </div>
    </details>
  );
}
