// Messages about money (v2: messages with risk flags; inventory 12.2 "Check a message").

export const RISK_FLAGS = {
  unverifiedFunder: "Sender is not a verified funder",
  feeFirst: "Asks for a fee before money is released",
  pressure: "Pressure to act today",
  secrets: "Asks for your PIN, password or code",
  bankChange: "Asks you to pay into new bank details",
  watchlist: "Other founders reported this sender",
} as const;

const FUNDING = /\b(fund(s|ing)?|grant|loan|qualif(y|ies|ied)|approved|investment|bursary|R\s?\d[\d\s,]*000)\b/i;
const FEE = /\b(fee|processing|admin(istration)? (fee|cost)|release (the )?(funds|money)|deposit|pay .{0,30}(first|before|to release|to unlock))\b/i;
const PRESSURE = /\b(today|immediately|urgent(ly)?|within \d+ ?(hours?|hrs|minutes)|right now|last chance|expires? (today|tonight))\b/i;
const SECRETS = /\b(pin|otp|one[- ]time (pin|code|password)|password|verification code|authenticator code)\b/i;
const BANK_CHANGE = /\b(new|changed|updated|different) (bank|account)( details| number)?\b/i;

/** Risk flags for a message, in the prototype's order. `verifiedSender` = a verified ProofPocket organisation. */
export function messageRiskFlags(m: { text: string; verifiedSender: boolean; onWatchlist?: boolean }): string[] {
  const f: string[] = [];
  if (!m.verifiedSender && FUNDING.test(m.text)) f.push(RISK_FLAGS.unverifiedFunder);
  if (FEE.test(m.text)) f.push(RISK_FLAGS.feeFirst);
  if (PRESSURE.test(m.text)) f.push(RISK_FLAGS.pressure);
  if (SECRETS.test(m.text)) f.push(RISK_FLAGS.secrets);
  if (BANK_CHANGE.test(m.text)) f.push(RISK_FLAGS.bankChange);
  if (m.onWatchlist) f.push(RISK_FLAGS.watchlist);
  return f;
}

/** Email addresses and phone numbers are compared in one form: lower case, digits only for numbers (+27 → 0). */
export function senderKey(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.includes("@")) return s;
  const digits = s.replace(/\D/g, "");
  return digits.startsWith("27") && digits.length === 11 ? "0" + digits.slice(2) : digits || s;
}

/** Masked bank details for suppliers: "Capitec ••3310". ProofPocket never needs full supplier numbers. */
export function maskBank(bank: string, accountNumber: string): string {
  const last4 = accountNumber.replace(/\D/g, "").slice(-4);
  return `${bank.trim()} ••${last4}`;
}

/**
 * Behavioural velocity check (your teammate's "Fake Cash" feedback).
 * Returns a flag string if the recent entries look unnatural, or null if fine.
 *
 * Thresholds (tuned to a busy founder's realistic pace):
 *  - >5 entries in 10 minutes  → warn (could be a very busy day, flag but don't block)
 *  - >15 entries in 1 hour     → warn
 *
 * @param recentEntries - timestamps (ISO string or Date) of the founder's last entries, newest first.
 *   Caller should pass at most the last 20 entries.
 * @param now - the timestamp of the entry being added (defaults to current time).
 */
export function velocityFlag(recentEntries: (string | Date)[], now?: Date): string | null {
  const t = now?.getTime() ?? Date.now();
  const times = recentEntries.map((e) => (typeof e === "string" ? new Date(e).getTime() : e.getTime()));

  const in10min = times.filter((ts) => t - ts <= 10 * 60 * 1000).length;
  if (in10min > 5) return "Rapid cash entry: more than 5 entries in 10 minutes. ProofPocket flagged this automatically.";

  const in1hr = times.filter((ts) => t - ts <= 60 * 60 * 1000).length;
  if (in1hr > 15) return "Unusual activity: more than 15 entries in one hour. ProofPocket flagged this automatically.";

  return null;
}
