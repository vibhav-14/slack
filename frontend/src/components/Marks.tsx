import type { ReactNode } from "react";

/* Hand-drawn red pen strokes. */

/** A number ringed in red pen, slightly overshooting where the loop closes. */
export function Circled({ children }: { children: ReactNode }) {
  return (
    <span className="circled">
      <svg viewBox="0 0 64 48" preserveAspectRatio="none" aria-hidden="true">
        <path className="pen-stroke" d="M51 9C36 1 12 4 5 21c-6 16 14 25 33 23 19-2 26-17 18-29C51 7 40 4 27 6" />
      </svg>
      {children}
    </span>
  );
}

export function Tick() {
  return (
    <svg className="pen-mark" viewBox="0 0 24 24" role="img" aria-label="Correct">
      <path className="pen-stroke" d="M3 13c2 2 4 5 6 8 3-7 7-13 13-18" />
    </svg>
  );
}

export function Cross() {
  return (
    <svg className="pen-mark" viewBox="0 0 24 24" role="img" aria-label="Incorrect">
      <path className="pen-stroke" d="M5 4c4 5 9 11 15 17" />
      <path className="pen-stroke" d="M20 4c-5 5-11 11-16 17" />
    </svg>
  );
}
