import { z } from "zod";
import { isValidPan } from "./pan-format";

const rupeeString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a rupee amount, e.g. 1300000 or 20.50");

const percentString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a percent, e.g. 5 or 5.9");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be a date YYYY-MM-DD");

const stage = z.enum([
  "plinth",
  "ground_floor",
  "first_floor",
  "second_floor",
  "outside_plaster",
  "flooring",
  "finishing",
]);

const customerBase = z.object({
  fullName: z.string().trim().min(1),
  mobile: z.string().trim().min(5),
  alternateMobile: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  panNumber: z.string().trim().optional().or(z.literal("")),
  // Only when the customer truly has no PAN (e.g. foreign national). Mandatory otherwise.
  noPanReason: z.string().trim().optional().or(z.literal("")),
  aadhaarNumber: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  salesExecutive: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

const PAN_SHAPE = "PAN must look like ABCDE1234F";

export const customerCreateSchema = customerBase.superRefine((v, ctx) => {
  const pan = v.panNumber?.trim();
  if (pan) {
    if (!isValidPan(pan)) ctx.addIssue({ code: "custom", path: ["panNumber"], message: PAN_SHAPE });
  } else if (!v.noPanReason?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["panNumber"],
      message: "PAN is required. If the customer has none, give the reason.",
    });
  }
});

export const customerUpdateSchema = customerBase.partial().superRefine((v, ctx) => {
  const pan = v.panNumber?.trim();
  if (pan && !isValidPan(pan)) {
    ctx.addIssue({ code: "custom", path: ["panNumber"], message: PAN_SHAPE });
  }
});

export const bookingCreateSchema = z.object({
  customerId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  bookingDate: isoDate,
  projectName: z.string().trim().optional().or(z.literal("")),
  propertyType: z.enum(["Villa", "Bungalow", "Plot", "Apartment", "Flat", "Shop"]),
  propertyNumber: z.string().trim().optional().or(z.literal("")),
  bookingAddress: z.string().trim().optional().or(z.literal("")),
  unitStatus: z.enum(["available", "booked", "sold"]).default("booked"),
  paymentType: z
    .enum(["self_finance", "bank_loan", "installment"])
    .default("self_finance"),
  stageBased: z.boolean().default(false),
  currentStage: stage.nullable().optional(),
  downPayment: rupeeString.default("0"),
  installmentCount: z.number().int().positive().nullable().optional(),
  installmentFrequency: z
    .enum(["monthly", "quarterly", "custom"])
    .nullable()
    .optional(),
  baseCost: rupeeString,
  extraCharges: rupeeString.default("0"),
  discount: rupeeString.default("0"),
  gstPercent: percentString.default("0"),
  maintenanceCharge: rupeeString.default("0"),
  documentationPercent: percentString.default("0"),
});
export const bookingUpdateSchema = bookingCreateSchema
  .omit({ customerId: true })
  .partial();

export const costUpdateSchema = z.object({
  baseCost: rupeeString,
  extraCharges: rupeeString.default("0"),
  discount: rupeeString.default("0"),
  gstPercent: percentString,
  maintenanceCharge: rupeeString,
  documentationPercent: percentString,
});

export const scheduleRowSchema = z.object({
  dueDate: isoDate,
  // `amount` is the GROSS due (basic + gst + other charges); basic is derived.
  amount: rupeeString,
  gstAmount: rupeeString.default("0"),
  otherChargeAmount: rupeeString.default("0"),
  documentationAmount: rupeeString.default("0"),
  percentage: percentString.optional().or(z.literal("")),
  label: z.string().trim().optional().or(z.literal("")),
  installmentNumber: z.number().int().positive().optional(),
});
export const scheduleReplaceSchema = z.object({
  rows: z.array(scheduleRowSchema),
});

export const paymentCreateSchema = z.object({
  paymentDate: isoDate,
  amount: rupeeString,
  gstAmount: rupeeString.default("0"),
  maintenanceAmount: rupeeString.default("0"),
  documentationAmount: rupeeString.default("0"),
  paymentFor: z.string().trim().optional().or(z.literal("")),
  instrumentDate: isoDate.optional().or(z.literal("")),
  instrumentNumber: z.string().trim().optional().or(z.literal("")),
  instrumentBank: z.string().trim().optional().or(z.literal("")),
  mode: z
    .enum([
      "cash",
      "cheque",
      "bank_transfer",
      "rtgs",
      "imps",
      "neft",
      "upi",
      "card",
      "other",
    ])
    .default("bank_transfer"),
  stage: stage.nullable().optional(),
  source: z.enum(["customer", "bank"]).default("customer"),
  overrideStageLimit: z.boolean().default(false),
  overrideReason: z.string().trim().optional().or(z.literal("")),
  referenceNumber: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
});
export const paymentUpdateSchema = paymentCreateSchema.partial();

export const loanUpsertSchema = z.object({
  status: z.enum([
    "not_applicable",
    "pending_docs",
    "applied",
    "approved",
    "disbursed",
    "rejected",
  ]),
  loanAmount: rupeeString.optional().or(z.literal("")),
  customerContribution: rupeeString.optional().or(z.literal("")),
  amountReleased: rupeeString.optional().or(z.literal("")),
  bankName: z.string().trim().optional().or(z.literal("")),
  branchName: z.string().trim().optional().or(z.literal("")),
  branchContact: z.string().trim().optional().or(z.literal("")),
  referenceNumber: z.string().trim().optional().or(z.literal("")),
  sanctionDate: isoDate.optional().or(z.literal("")),
  approvalDate: isoDate.optional().or(z.literal("")),
  disbursementDate: isoDate.optional().or(z.literal("")),
});

export const stageUpdateSchema = z.object({
  currentStage: stage,
  remarks: z.string().trim().optional().or(z.literal("")),
});

export const documentCreateSchema = z.object({
  documentType: z.enum([
    "aadhaar",
    "pan",
    "agreement",
    "loan_document",
    "other",
  ]),
  fileName: z.string().trim().min(1),
  fileUrl: z.string().url(),
  bookingId: z.string().uuid().nullable().optional(),
});

export const UNIT_TYPES = ["Villa", "Bungalow", "Apartment", "Flat", "Shop", "Plot"] as const;

// Add one unit (unitNumber) or many at once (count + start -> numbers start..start+count-1).
export const unitCreateSchema = z
  .object({
    projectName: z.string().trim().default(""),
    unitType: z.enum(UNIT_TYPES),
    unitNumber: z.string().trim().min(1).optional(),
    count: z.number().int().min(1).max(500).optional(),
    start: z.number().int().min(0).default(1),
  })
  .refine((v) => v.unitNumber || v.count, {
    message: "Give a unit number, or a count to create several",
  });

export const unitPatchSchema = z.object({
  blocked: z.boolean(),
  blockReason: z.string().trim().optional().or(z.literal("")),
});
