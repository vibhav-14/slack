import type { Subject } from "../api/types";

const SMALL = new Set(["of", "and", "for", "in", "the", "to", "a", "an", "with"]);

/** Short label for tight spaces: "OOP" even when the official code is "CSE25304". */
export function shortCode(s: Pick<Subject, "code" | "officialCode" | "name">): string {
  if (!s.officialCode) return s.code;
  const words = s.name.split(/[\s-]+/).filter((w) => w && !SMALL.has(w.toLowerCase()));
  return words.map((w) => w[0].toUpperCase()).join("") || s.code;
}
