import type { PriorityFactor } from "../api/types";

/** Plain-language explanation of the scoring model, built from the weights the API reports. */
export function ScoringNote({ factors }: { factors: PriorityFactor[] | undefined }) {
  if (!factors?.length) return null;
  return (
    <details className="formula">
      <summary style={{ cursor: "pointer" }}>How the score is calculated</summary>
      <div className="prose stack" style={{ marginTop: "var(--s-3)" }}>
        <p>
          Each topic gets a score out of 100 from five factors. Each factor is measured from 0 to 1 and multiplied by its
          weight:
        </p>
        <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
          {factors.map((f) => (
            <li key={f.key}>
              <strong>{f.label}</strong> — up to {Math.round(f.weight * 100)} points
            </li>
          ))}
        </ul>
        <p>
          72 or more is high priority, 58–71 medium, below that low. Scores update as soon as you change a topic's status or
          finish a quiz.
        </p>
      </div>
    </details>
  );
}
