/**
 * pan-format.ts — PAN shape helpers with no Node APIs, so they are safe to use
 * in client components and validators. Encryption lives in pan.ts.
 */
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export const normalizePan = (value: string): string =>
  value.replace(/\s+/g, "").toUpperCase();

export const isValidPan = (value: string): boolean => PAN_RE.test(normalizePan(value));

/** "ABCDE1234F" -> "XXXXXX234F" (last 4 kept, as elsewhere in the app). */
export function maskPan(value: string): string {
  const v = normalizePan(value);
  return v.length <= 4 ? v : "X".repeat(v.length - 4) + v.slice(-4);
}
