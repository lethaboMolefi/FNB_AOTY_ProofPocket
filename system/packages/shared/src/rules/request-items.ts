// Payment requests built from stock: the amount is each line's selling price × quantity.

/** Total of the lines in rand, rounded to the cent (worked in cents so 0.1 × 3 is 0.30). */
export function requestItemsTotal(lines: { price: number; qty: number }[]): number {
  return lines.reduce((cents, l) => cents + Math.round(l.price * 100 * l.qty), 0) / 100;
}

/** Lines asking for more than is in stock. The request still goes out; the founder is told. */
export function requestItemsShortfall(lines: { name: string; qty: number; inStock: number }[]): string[] {
  return lines.filter((l) => l.qty > l.inStock).map((l) => `${l.name} (${l.inStock} in stock)`);
}
