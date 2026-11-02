/**
 * codes.ts — human-friendly IDs used on the reports (pure, no DB).
 *   client code   CL001, CL002 ...
 *   booking code  BI001, BI002 ...
 *   payment no.   PAY2609-7K3QX9  (yymm of the payment date + 6 random chars)
 */

/** Next sequential code after the highest existing one with this prefix. */
export function nextCode(
  prefix: string,
  existing: (string | null | undefined)[],
  width = 3,
): string {
  let max = 0;
  for (const code of existing) {
    if (!code || !code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(width, "0")}`;
}

const ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I / O to avoid mix-ups

/** Payment number like PAY2609-7K3QX9. `rand` is injectable for tests. */
export function newPaymentNumber(
  paymentDate: string, // YYYY-MM-DD
  rand: () => number = Math.random,
): string {
  const yymm = paymentDate.slice(2, 4) + paymentDate.slice(5, 7);
  let tail = "";
  for (let i = 0; i < 6; i++) tail += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return `PAY${yymm}-${tail}`;
}
