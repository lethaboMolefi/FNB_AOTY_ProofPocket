// Display formatting, same output as the prototype's R(), shortDate() and slug().

const rand = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });

/** "R12 450"; negatives use a true minus sign: "−R300". */
export function R(n: number): string {
  return (n < 0 ? "−" : "") + "R" + rand.format(Math.round(Math.abs(n)));
}

/** "12 Oct" from a YYYY-MM-DD date. */
export function shortDate(day: string): string {
  return new Date(day + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function slug(s: string): string {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const plural = (n: number, one: string, many = one + "s") => (n === 1 ? one : many);

/** First 16 hex characters of a SHA-256, for display next to a file. */
export const shortFingerprint = (sha256: string) => sha256.slice(0, 16);
