import type { ISODate } from "../api/types";

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function todayISO(): ISODate {
  return toISODate(today());
}

/** Whole days from today until `date` (negative if in the past). */
export function daysUntil(date: ISODate): number {
  return Math.round((parseISODate(date).getTime() - today().getTime()) / 86_400_000);
}

const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const weekdayDayMonth = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export const fmt = {
  short: (s: ISODate) => dayMonth.format(parseISODate(s)),
  weekday: (s: ISODate) => weekdayDayMonth.format(parseISODate(s)),
  long: (d: Date) => longDate.format(d),
};

/** "today", "tomorrow", "in 5 days", "3 days ago", "in 6 weeks" */
export function relativeDays(date: ISODate): string {
  const n = daysUntil(date);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n < 0) return `${-n} days ago`;
  if (n >= 21) return `in ${Math.round(n / 7)} weeks`;
  return `in ${n} days`;
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return dayMonth.format(new Date(iso));
}

export function minutesLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
