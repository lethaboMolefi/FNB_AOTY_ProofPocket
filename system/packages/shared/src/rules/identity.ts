// South African ID numbers: YYMMDD date of birth, 6 more digits, and a Luhn check digit.
// Checked before an ID number is stored, so a mistyped digit is caught at the form.

const realDate = (yyyy: number, mm: number, dd: number) => {
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
};

export function isValidSaId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const yy = Number(id.slice(0, 2)), mm = Number(id.slice(2, 4)), dd = Number(id.slice(4, 6));
  // The century isn't in the number: the date must exist in 19YY or 20YY.
  if (!realDate(1900 + yy, mm, dd) && !realDate(2000 + yy, mm, dd)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const n = Number(id[i]);
    if (i % 2 === 0) sum += n;
    else { const x = n * 2; sum += x > 9 ? x - 9 : x; }
  }
  return sum % 10 === 0;
}

/** For screens: only the last three digits, e.g. "••••••••••087". */
export const maskId = (id: string) => (id ? "•".repeat(Math.max(0, id.length - 3)) + id.slice(-3) : "");
