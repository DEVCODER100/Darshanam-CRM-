import type { Customer } from "@/db/schema";
import { maskPan, revealText } from "./pan";

/** A customer row safe to send to the browser: no ciphertext, no search hash. */
export function publicCustomer(row: Customer) {
  const { panEncrypted, panHash: _hash, idProofEncrypted: _id, jointApplicants, ...rest } = row;
  return {
    ...rest,
    hasPan: !!panEncrypted,
    jointApplicants: jointApplicants.map(({ name, mobile, relation }) => ({ name, mobile, relation })),
  };
}

/** Joint applicants with the PAN shown in full only to roles allowed to see it. */
export function jointView(row: Pick<Customer, "jointApplicants">, canSee: boolean) {
  return row.jointApplicants.map((j) => {
    const full = revealText(j.panEncrypted, true);
    return { ...j, pan: canSee ? full : full && maskPan(full) };
  });
}
