// Times on the admin monitoring pages, in South African time.
const FMT = new Intl.DateTimeFormat("en-ZA", { timeZone: "Africa/Johannesburg", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const when = (at: string | null | undefined) => (at ? FMT.format(new Date(at)) : "Never");

/** Query string from the filled-in fields only. */
export const qs = (o: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
