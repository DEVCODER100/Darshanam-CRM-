import type { z } from "zod";
import type { agents } from "@/db/schema";
import { percentToBps } from "./money";
import { encryptText, maskPan, normalizePan, panColumns } from "./pan";
import type { agentPatchSchema } from "./validators";

type Input = z.infer<typeof agentPatchSchema>;
const text = (v: string | undefined) => (v === undefined ? undefined : v || null);

/**
 * Database columns for the agent fields that were sent (blank text becomes empty). The PAN
 * and ID proof are encrypted like a client's; a blank PAN or ID proof leaves the stored one.
 * Throws if the encryption key is missing and a PAN or ID proof was given.
 */
export function agentColumns(d: Input): Partial<typeof agents.$inferInsert> {
  const out: Partial<typeof agents.$inferInsert> = {
    title: text(d.title),
    name: d.name,
    companyName: text(d.companyName),
    mobile: text(d.mobile),
    phone: text(d.phone),
    email: text(d.email),
    smsOptIn: d.smsOptIn,
    emailOptIn: d.emailOptIn,
    reraNo: text(d.reraNo),
    gstin: text(d.gstin),
    brokeragePlanId: text(d.brokeragePlanId),
    rewardPlanId: text(d.rewardPlanId),
    address: text(d.address),
    pinCode: text(d.pinCode),
    city: text(d.city),
    state: text(d.state),
    country: text(d.country),
    userGroup: d.userGroup,
    archived: d.active === undefined ? undefined : !d.active,
    notes: text(d.notes),
    commissionBps: d.commissionPercent === undefined ? undefined : Number(percentToBps(d.commissionPercent)),
  };
  if (d.pan) Object.assign(out, panColumns(d.pan), { panMasked: maskPan(normalizePan(d.pan)) });
  if (d.idProofNo) out.idProofEncrypted = encryptText(d.idProofNo);
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as typeof out;
}

/** {"Villa": "2.5", "Shop": ""} -> {"Villa": 250}; blank types fall back to the plan default. */
export const perTypeBps = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).filter(([, v]) => v).map(([k, v]) => [k, Number(percentToBps(v))]));
