/** A concept is "weak" below this accuracy, once it has at least MIN_ATTEMPTS answers. */
export const WEAK_THRESHOLD = 0.6;
export const MIN_ATTEMPTS = 3;

export const isWeak = (c: { attempts: number; correct: number }) =>
  c.attempts >= MIN_ATTEMPTS && c.correct / c.attempts < WEAK_THRESHOLD;
