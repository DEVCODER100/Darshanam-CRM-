/**
 * pan.ts — PAN handling: validation, AES-256-GCM encryption at rest, and an
 * HMAC for exact-match search. The key is PAN_ENCRYPTION_KEY (base64, 32 bytes).
 * Keep that key safe: without it, stored PANs cannot be read back.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

import { isValidPan, maskPan, normalizePan } from "./pan-format";

export { isValidPan, maskPan, normalizePan };

function keyFrom(base64Key: string | undefined): Buffer {
  if (!base64Key) {
    throw new Error(
      "PAN_ENCRYPTION_KEY is not set. Generate one (32 random bytes, base64) and add it to the environment.",
    );
  }
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("PAN_ENCRYPTION_KEY must be 32 bytes, base64 encoded.");
  return key;
}

const envKey = () => keyFrom(process.env.PAN_ENCRYPTION_KEY);

/** Returns "v1.<iv>.<tag>.<ciphertext>" (base64 parts). Works for any short text. */
export function encryptText(text: string, key: Buffer = envKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export const encryptPan = (pan: string, key?: Buffer) => encryptText(normalizePan(pan), key);

export function decryptPan(blob: string, key: Buffer = envKey()): string {
  const [version, iv, tag, enc] = blob.split(".");
  if (version !== "v1" || !iv || !tag || !enc) throw new Error("Unrecognised PAN format");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64")), decipher.final()]).toString("utf8");
}

/** Deterministic search hash, so a PAN can be found without decrypting every row. */
export function hashPan(pan: string, key: Buffer = envKey()): string {
  return createHmac("sha256", key).update(`pan:${normalizePan(pan)}`).digest("hex");
}

export const decryptText = decryptPan;
export const keyFromBase64 = keyFrom;

/** Decrypt for roles that may see it; `fallback` otherwise or on error. */
export function revealText(blob: string | null, canSee: boolean, fallback = ""): string {
  if (!blob || !canSee) return fallback;
  try {
    return decryptText(blob);
  } catch {
    return fallback;
  }
}

/** What the database columns for a PAN look like. Throws if the key is missing. */
export function panColumns(pan: string) {
  const clean = normalizePan(pan);
  return {
    panEncrypted: encryptPan(clean),
    panHash: hashPan(clean),
    panMasked: maskPan(clean),
  };
}

/** Full PAN for roles allowed to see it, masked for everyone else. */
export function displayPan(
  row: { panEncrypted: string | null; panMasked: string | null },
  canSeeFull: boolean,
): string | null {
  if (!row.panEncrypted) return row.panMasked;
  if (!canSeeFull) return row.panMasked;
  try {
    return decryptPan(row.panEncrypted);
  } catch {
    return row.panMasked; // wrong or missing key: never crash a page over this
  }
}
