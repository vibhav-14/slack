import type { Priority } from "../api/types";

/** Round a list of numbers so they still add up to `total` (largest remainder wins). */
function roundTo(values: number[], total: number): number[] {
  const floors = values.map(Math.floor);
  const order = values.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]);
  let left = total - floors.reduce((a, b) => a + b, 0);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/** The "why" behind a priority score, set out as an examiner's mark sheet. */
export function FactorList({ priority }: { priority: Priority }) {
  const counted = priority.factors.filter((f) => f.available && f.value !== null);
  const marks = roundTo(counted.map((f) => f.value! * f.effectiveWeight * 100), priority.score);
  const outOf = roundTo(counted.map((f) => f.effectiveWeight * 100), 100);
  const markFor = new Map(counted.map((f, i) => [f.key, { got: marks[i], max: outOf[i] }]));

  return (
    <table className="marksheet">
      <thead>
        <tr>
          <th scope="col">Factor</th>
          <th scope="col">Evidence</th>
          <th scope="col" className="col-num">
            Marks
          </th>
        </tr>
      </thead>
      <tbody>
        {priority.factors.map((f) => {
          const m = markFor.get(f.key);
          return (
            <tr key={f.key} className={m ? undefined : "is-uncounted"}>
              <th scope="row">{f.label}</th>
              <td>{f.detail}</td>
              <td className="col-num">
                {m ? (
                  <span aria-label={`${m.got} of ${m.max} marks`}>
                    <strong>{m.got}</strong> / {m.max}
                  </span>
                ) : (
                  "not counted"
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={2}>
            Total
          </th>
          <td className="col-num">
            <strong>{priority.score}</strong> / 100
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
