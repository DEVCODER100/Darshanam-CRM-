import { z } from "zod";

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

export const customerCreateSchema = z.object({
  fullName: z.string().trim().min(1),
  mobile: z.string().trim().min(5),
  alternateMobile: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  panNumber: z.string().trim().optional().or(z.literal("")),
  aadhaarNumber: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  salesExecutive: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});
export const customerUpdateSchema = customerCreateSchema.partial();

export const bookingCreateSchema = z.object({
  customerId: z.string().uuid(),
  bookingDate: isoDate,
  projectName: z.string().trim().optional().or(z.literal("")),
  propertyType: z.enum(["Villa", "Plot", "Apartment", "Flat", "Shop"]),
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
  amount: rupeeString,
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
  mode: z
    .enum([
      "cash",
      "cheque",
      "bank_transfer",
      "rtgs",
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
