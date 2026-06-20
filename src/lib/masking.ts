/**
 * masking.ts — Aadhaar/PAN handling (PRD §3).
 *
 * The full Aadhaar/PAN is NEVER persisted. On input we immediately reduce it to
 * a masked form keeping only the last 4 characters. Audit logs never see more
 * than the last 4 either (the stored value is already masked).
 */

/** Strip spaces/dashes for normalisation. */
function normalize(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/** Last 4 characters of a sensitive identifier. */
export function lastFour(value: string): string {
  const v = normalize(value);
  return v.slice(-4);
}

/**
 * Mask to "XXXXXXXX1234" form — every character except the last 4 becomes "X".
 * Aadhaar (12 digits) -> "XXXXXXXX1234"; PAN (10 chars) -> "XXXXXX7890".
 */
export function maskSensitive(value: string): string {
  const v = normalize(value);
  if (v.length <= 4) return v;
  return "X".repeat(v.length - 4) + v.slice(-4);
}

/** Heuristic validation so we don't store garbage. Returns a typed result. */
export function classifyId(value: string): "aadhaar" | "pan" | "unknown" {
  const v = normalize(value).toUpperCase();
  if (/^\d{12}$/.test(v)) return "aadhaar";
  if (/^[A-Z]{5}\d{4}[A-Z]$/.test(v)) return "pan";
  return "unknown";
}
