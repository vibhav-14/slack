import type { Priority } from "../api/types";
import { Meter } from "./ui";

/** The "why" behind a priority score: each factor, its evidence and its points. */
export function FactorList({ priority }: { priority: Priority }) {
  return (
    <ul className="factors">
      {priority.factors.map((f) => {
        if (!f.available || f.value === null) {
          return (
            <li key={f.key} className="factor is-unavailable">
              <span className="factor-name">{f.label}</span>
              <span className="meter meter-empty" aria-hidden="true" />
              <span className="factor-detail">{f.detail}</span>
              <span className="factor-pts" aria-label="Not counted">
                —
              </span>
            </li>
          );
        }
        const max = Math.round(f.effectiveWeight * 100);
        const pts = Math.round(f.value * f.effectiveWeight * 100);
        return (
          <li key={f.key} className="factor">
            <span className="factor-name">{f.label}</span>
            <Meter value={f.value} label={`${f.label}: ${Math.round(f.value * 100)}%`} />
            <span className="factor-detail">{f.detail}</span>
            <span className="factor-pts" aria-label={`${pts} of ${max} points`}>
              <strong>{pts}</strong>/{max}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
