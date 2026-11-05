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
  idProofNumber: z.string().trim().optional().or(z.literal("")),
  profile: z.record(z.string(), z.string()).optional(),
  jointApplicants: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Joint applicant needs a name"),
        mobile: z.string().trim().default(""),
        relation: z.string().trim().default(""),
        panNumber: z
          .string()
          .trim()
          .default("")
          .refine((v) => !v || isValidPan(v), "Joint applicant PAN must look like ABCDE1234F"),
        panEncrypted: z.string().default(""), // unchanged PAN passed back by the edit form
      }),
    )
    .optional(),
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
  agentId: z.string().uuid().nullable().optional(),
  bookingDate: isoDate,
  projectName: z.string().trim().optional().or(z.literal("")),
  propertyType: z.enum(["Villa", "Bungalow", "Plot", "Apartment", "Flat", "Shop"]),
  propertyNumber: z.string().trim().optional().or(z.literal("")),
  bookingAddress: z.string().trim().optional().or(z.literal("")),
  unitStatus: z.enum(["available", "booked", "sold"]).default("booked"),
  paymentType: z
    .enum(["self_finance", "bank_loan", "installment", "custom"])
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

const optional = (max = 200) => z.string().trim().max(max).optional();
const uuidOrBlank = z.string().uuid().or(z.literal("")).optional();

// No defaults here: a PATCH must leave anything it does not mention alone.
export const agentBase = z.object({
  title: optional(10),
  name: z.string().trim().min(1, "Give the agent a name").max(80),
  companyName: optional(),
  mobile: optional(20),
  phone: optional(20),
  email: z.string().trim().email("Email does not look right").or(z.literal("")).optional(),
  smsOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  reraNo: optional(40),
  gstin: optional(20),
  pan: z.string().trim().refine((v) => !v || isValidPan(v), "PAN must look like ABCDE1234F").optional(),
  idProofNo: optional(40),
  brokeragePlanId: uuidOrBlank,
  rewardPlanId: uuidOrBlank,
  address: optional(400),
  pinCode: optional(12),
  city: optional(80),
  state: optional(80),
  country: optional(80),
  userGroup: z.string().trim().min(1).max(60).optional(),
  active: z.boolean().optional(),
  notes: optional(500),
  commissionPercent: z.string().trim().regex(/^\d{1,2}(\.\d{1,2})?$/, "Commission is a percent like 2 or 1.5").optional(),
});
const needsContact = (v: { mobile?: string; email?: string }) => !!(v.mobile || v.email);
export const agentSchema = agentBase.refine(needsContact, { message: "Give a mobile number or an email", path: ["mobile"] });
export const agentPatchSchema = agentBase.partial();

export const planSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("brokerage"),
    name: z.string().trim().min(1, "Give the plan a name").max(60),
    defaultPercent: z.string().trim().regex(/^\d{1,2}(\.\d{1,2})?$/, "Use a percent like 2 or 1.5").default("0"),
    perType: z.record(z.string(), z.string().trim().regex(/^(\d{1,2}(\.\d{1,2})?)?$/, "Use a percent like 2 or 1.5")).default({}),
  }),
  z.object({
    type: z.literal("reward"),
    name: z.string().trim().min(1, "Give the plan a name").max(60),
    kind: z.enum(["per_booking", "percent_sales"]),
    value: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a number"), // rupees per booking, or a percent
  }),
]);
export const planPatchSchema = z.object({ type: z.enum(["brokerage", "reward"]), archived: z.boolean().optional() }).and(z.object({
  name: z.string().trim().min(1).max(60).optional(),
  defaultPercent: z.string().trim().optional(),
  perType: z.record(z.string(), z.string().trim()).optional(),
  kind: z.enum(["per_booking", "percent_sales"]).optional(),
  value: z.string().trim().optional(),
}));
export const agentPaymentSchema = z.object({
  paymentDate: isoDate,
  kind: z.enum(["brokerage", "reward"]).default("brokerage"),
  amount: rupeeString,
  mode: z.string().trim().default("bank_transfer"),
  reference: z.string().trim().default(""),
  note: z.string().trim().default(""),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name").max(80),
  area: z.string().trim().max(80).default(""),
});
export const projectPatchSchema = projectSchema.partial().extend({ archived: z.boolean().optional() });

export const unitImportSchema = z.object({
  rows: z
    .array(
      z.object({
        project: z.string().trim().default(""),
        type: z.enum(UNIT_TYPES),
        number: z.string().trim().min(1),
        area: z.string().nullable().default(null),
        floor: z.string().nullable().default(null),
        subType: z.string().nullable().default(null),
      }),
    )
    .min(1, "Nothing to import")
    .max(5000),
  dryRun: z.boolean().default(true),
});

const pct = (min = 0) => z.number().min(min).max(100);

/** Unit labels read from a map file (percent of the map). */
export const mapLabelsSchema = z
  .array(z.object({ label: z.string().trim().min(1).max(40), x: pct(), y: pct(), w: pct(), h: pct() }))
  .max(3000);

// Every box on a map: an existing unit, or a new unit to create where it sits.
export const mapBoxesSchema = z.object({
  boxes: z
    .array(
      z
        .object({
          unitId: z.string().uuid().optional(),
          create: z
            .object({ type: z.enum(UNIT_TYPES), number: z.string().trim().min(1), project: z.string().trim().default("") })
            .optional(),
          x: pct(),
          y: pct(),
          w: pct(0.1),
          h: pct(0.1),
        })
        .refine((b) => b.unitId || b.create, "Each box needs a unit"),
    )
    .max(2000),
});

// Blocking needs who it is held for and a contact number; releasing needs nothing.
export const unitPatchSchema = z
  .object({
    blocked: z.boolean(),
    customerId: z.string().uuid().optional().or(z.literal("")),
    name: z.string().trim().optional().or(z.literal("")),
    mobile: z.string().trim().optional().or(z.literal("")),
    blockReason: z.string().trim().optional().or(z.literal("")),
    unblockOn: isoDate.optional().or(z.literal("")), // blank = never
    blockedBy: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (!v.blocked) return;
    if (!v.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Who is the unit blocked for?" });
    if (!v.mobile) ctx.addIssue({ code: "custom", path: ["mobile"], message: "Contact number is required" });
  });
