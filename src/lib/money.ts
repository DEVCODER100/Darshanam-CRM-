/**
 * money.ts — the ONLY place money crosses between human rupees and stored paise.
 *
 * Invariant (PRD §11): every monetary value in the system is an integer number
 * of paise, carried as a JS `bigint`. There is no floating-point money math
 * anywhere. 1 rupee = 100 paise. ₹1.49 Cr = 14,917,000 rupees = 1,491,700,000 paise.
 *
 * Percentages are carried as integer BASIS POINTS (1% = 100 bps, 5.9% = 590 bps)
 * so percent application stays exact integer arithmetic.
 */

export const PAISE_PER_RUPEE = 100n;
export const BPS_PER_UNIT = 10_000n; // 100% = 10,000 bps

/** Round-half-up integer division for non-negative-or-signed numerators. */
export function roundedDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("roundedDiv: division by zero");
  const neg = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n + d / 2n) / d;
  return neg ? -q : q;
}

/**
 * Parse human rupee input (e.g. "13000000", "1,30,00,000", "20.50") to paise.
 * Accepts up to 2 decimal places. Throws on malformed input.
 */
export function rupeesToPaise(input: string | number): bigint {
  const raw = String(input).trim().replace(/,/g, "");
  if (raw === "") throw new Error("rupeesToPaise: empty input");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`rupeesToPaise: invalid rupee amount "${input}"`);
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, frac = ""] = unsigned.split(".");
  const paiseFrac = (frac + "00").slice(0, 2); // pad/truncate to 2 digits
  const paise = BigInt(whole) * PAISE_PER_RUPEE + BigInt(paiseFrac);
  return negative ? -paise : paise;
}

/** Paise -> plain decimal rupee string, e.g. 2050n -> "20.50". */
export function paiseToRupeeString(paise: bigint): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const whole = abs / PAISE_PER_RUPEE;
  const frac = abs % PAISE_PER_RUPEE;
  const fracStr = frac.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fracStr}`;
}

/** Apply integer basis points to a paise amount, round half-up. 5% of 100 -> 5. */
export function applyBasisPoints(paise: bigint, bps: bigint): bigint {
  return roundedDiv(paise * bps, BPS_PER_UNIT);
}

/** Percent (number like 5 or 5.9) -> integer basis points. 5.9 -> 590. */
export function percentToBps(percent: string | number): bigint {
  const raw = String(percent).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`percentToBps: invalid percent "${percent}"`);
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, frac = ""] = unsigned.split(".");
  const fracStr = (frac + "00").slice(0, 2);
  const bps = BigInt(whole) * 100n + BigInt(fracStr);
  return negative ? -bps : bps;
}

/** Integer basis points -> display percent string. 590 -> "5.9". */
export function bpsToPercentString(bps: bigint): string {
  const negative = bps < 0n;
  const abs = negative ? -bps : bps;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const fracStr = frac.toString().padStart(2, "0").replace(/0+$/, "");
  const body = fracStr === "" ? `${whole}` : `${whole}.${fracStr}`;
  return `${negative ? "-" : ""}${body}`;
}

/**
 * Format paise as Indian-grouped rupees with the ₹ symbol, e.g.
 * 1_491_700_000n -> "₹1,49,17,000.00". Lakh/crore grouping (PRD §11).
 */
export function formatINR(paise: bigint, opts: { paise2dp?: boolean } = {}): string {
  const { paise2dp = true } = opts;
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const whole = (abs / PAISE_PER_RUPEE).toString();
  const fracStr = (abs % PAISE_PER_RUPEE).toString().padStart(2, "0");

  // Indian grouping: last 3 digits, then groups of 2.
  let grouped: string;
  if (whole.length <= 3) {
    grouped = whole;
  } else {
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3);
    const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    grouped = `${restGrouped},${last3}`;
  }

  const sign = negative ? "-" : "";
  return paise2dp ? `${sign}₹${grouped}.${fracStr}` : `${sign}₹${grouped}`;
}
