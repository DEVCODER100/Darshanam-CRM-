import type { Params } from "./report-filters";

/** Rebuild a query string from page params, with overrides (null removes a key). */
export function queryString(sp: Params, override: Record<string, string | null> = {}): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) out.set(k, val);
  }
  for (const [k, v] of Object.entries(override)) {
    if (v === null) out.delete(k);
    else out.set(k, v);
  }
  return out.toString();
}
