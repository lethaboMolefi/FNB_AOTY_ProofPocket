// Calendar helpers on YYYY-MM-DD strings. Business days are South African (Africa/Johannesburg).

const DAY_MS = 86_400_000;

export const TIME_ZONE = "Africa/Johannesburg";

/** Today's date in South Africa as YYYY-MM-DD. */
export function todayZA(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const noon = (day: string) => new Date(day + "T12:00:00Z").getTime();

export function daysBetween(a: string, b: string): number {
  return Math.round((noon(b) - noon(a)) / DAY_MS);
}

export function addDays(day: string, n: number): string {
  return new Date(noon(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/** "2026-10" from "2026-10-24". */
export const monthOf = (day: string) => day.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** The last `count` months ending with the month of `today`, oldest first. */
export function monthsEnding(today: string, count: number): string[] {
  const cur = monthOf(today);
  return Array.from({ length: count }, (_, i) => addMonths(cur, i - (count - 1)));
}

export const firstOfMonth = (day: string) => monthOf(day) + "-01";

export function monthLabel(month: string): string {
  return new Date(month + "-01T12:00:00Z").toLocaleString("en-ZA", { month: "short", timeZone: "UTC" });
}
