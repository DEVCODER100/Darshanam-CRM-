import type { Customer } from "@/db/schema";

/** A customer row safe to send to the browser: no encrypted PAN, no search hash. */
export function publicCustomer(row: Customer) {
  const { panEncrypted, panHash: _hash, ...rest } = row;
  return { ...rest, hasPan: !!panEncrypted };
}
