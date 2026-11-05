/** Rules for customer documents: the types, who may open them, what files are accepted. Pure. */

export const DOCUMENT_TYPES = {
  aadhaar: "Aadhaar",
  pan: "PAN",
  photo: "Photo",
  address_proof: "Address proof",
  booking_form: "Booking / application form",
  agreement: "Agreement",
  sale_deed: "Sale deed",
  loan_document: "Loan document",
  payment_receipt: "Payment receipt",
  other: "Other",
} as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;
export const DOCUMENT_KEYS = Object.keys(DOCUMENT_TYPES) as [DocumentType, ...DocumentType[]];

/** Only admin and accountant (sensitive:view) may open these. */
export const SENSITIVE_TYPES: ReadonlySet<string> = new Set(["aadhaar", "pan", "address_proof"]);

/** Shown as a Uploaded / Missing checklist on the customer profile. */
export const REQUIRED_TYPES: DocumentType[] = ["aadhaar", "pan", "photo", "address_proof", "booking_form"];

export const MAX_FILE_BYTES = 3_500_000; // stays under the host's request-size limit
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export const isDocumentType = (v: unknown): v is DocumentType => typeof v === "string" && v in DOCUMENT_TYPES;

/** An error message, or null when the file is acceptable. */
export function checkFile(f: { type: string; size: number }): string | null {
  if (!ALLOWED_MIME.includes(f.type)) return "Upload a PDF, JPG, PNG or WEBP file.";
  if (f.size > MAX_FILE_BYTES) return `That file is too large (max ${(MAX_FILE_BYTES / 1_000_000).toFixed(1)} MB).`;
  return null;
}

export const canOpen = (type: string, canSeeSensitive: boolean) => canSeeSensitive || !SENSITIVE_TYPES.has(type);

/** For each required type, how many files are on record. */
export function checklist(docs: { documentType: string }[]) {
  return REQUIRED_TYPES.map((type) => ({
    type,
    label: DOCUMENT_TYPES[type],
    count: docs.filter((d) => d.documentType === type).length,
  }));
}
