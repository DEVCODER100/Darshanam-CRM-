import type { z } from "zod";
import type { customers } from "@/db/schema";
import { cleanProfile } from "./customer-profile";
import { maskSensitive } from "./masking";
import { encryptPan, encryptText } from "./pan";
import type { customerUpdateSchema } from "./validators";

type Input = z.infer<typeof customerUpdateSchema>;

/**
 * The columns beyond name / contact / PAN that a create or edit can set: the
 * profile JSON, the encrypted ID proof, and the joint applicants (whose PANs
 * are encrypted; an unchanged PAN comes back from the form as its ciphertext).
 * Only what was sent is returned, so an edit never wipes a field it did not touch.
 */
export function extraColumns(input: Input): Partial<typeof customers.$inferInsert> {
  const out: Partial<typeof customers.$inferInsert> = {};
  if (input.profile !== undefined) out.profile = cleanProfile(input.profile);
  if (input.idProofNumber) {
    out.idProofEncrypted = encryptText(input.idProofNumber);
    out.aadhaarMasked = maskSensitive(input.idProofNumber);
  }
  if (input.jointApplicants) {
    out.jointApplicants = input.jointApplicants.map((j) => ({
      name: j.name,
      mobile: j.mobile,
      relation: j.relation,
      panEncrypted: j.panNumber
        ? encryptPan(j.panNumber)
        : j.panEncrypted.startsWith("v1.")
          ? j.panEncrypted
          : "",
    }));
  }
  return out;
}
