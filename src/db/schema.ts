/**
 * Drizzle schema — Construction CRM (PRD §4).
 *
 * Money columns are ALL `bigint` paise (mode: "bigint" -> JS bigint at runtime).
 * Percent columns are integer BASIS POINTS (5% = 500, 5.9% = 590).
 * `outstanding` is intentionally absent — it is never stored, only computed
 * on read (PRD §4, §5).
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  bigint,
  boolean,
  integer,
  date,
  timestamp,
  jsonb,
  numeric,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Money helper: bigint paise column. */
const paise = (name: string) => bigint(name, { mode: "bigint" });

export const roleEnum = pgEnum("role", [
  "admin",
  "accountant",
  "sales_executive",
  "manager",
]);

export const financeTypeEnum = pgEnum("finance_type", [
  "self_funded",
  "loan",
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "self_finance",
  "bank_loan",
  "installment",
  "custom",
]);

export const unitStatusEnum = pgEnum("unit_status", [
  "available",
  "booked",
  "sold",
]);

export const constructionStageEnum = pgEnum("construction_stage", [
  "plinth",
  "ground_floor",
  "first_floor",
  "second_floor",
  "outside_plaster",
  "flooring",
  "finishing",
]);

export const installmentFrequencyEnum = pgEnum("installment_frequency", [
  "monthly",
  "quarterly",
  "custom",
]);

export const loanStatusEnum = pgEnum("loan_status", [
  "not_applicable",
  "pending_docs",
  "applied",
  "approved",
  "disbursed",
  "rejected",
]);

export const paymentModeEnum = pgEnum("payment_mode", [
  "cash",
  "cheque",
  "bank_transfer",
  "rtgs",
  "neft",
  "imps",
  "upi",
  "card",
  "other",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
]);

export const auditEntityEnum = pgEnum("audit_entity", [
  "customer",
  "booking",
  "property_cost",
  "payment_schedule",
  "payment",
  "loan",
  "document",
  "user",
  "unit",
  "project",
  "agent",
]);

// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    role: roleEnum("role").notNull().default("manager"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    clerkIdx: index("users_clerk_idx").on(t.clerkUserId),
  }),
);

/** A joint applicant; the PAN is stored encrypted. */
export interface JointApplicant {
  name: string;
  mobile: string;
  relation: string;
  panEncrypted: string;
}

// A project is one construction area (e.g. "Splendora 3" / "Construction Area 2").
// Units, clients, bookings and maps belong to one; payments etc. follow their booking.
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    area: text("area").notNull().default(""),
    archived: boolean("archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ uniqueName: uniqueIndex("projects_name_area_idx").on(t.name, t.area) }),
);

// A broker/agent who brings buyers; commission is a share of the basic amount received.
export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").references(() => projects.id),
  name: text("name").notNull(),
  mobile: text("mobile"),
  panMasked: text("pan_masked"), // the full PAN is not kept for agents
  commissionBps: integer("commission_bps").notNull().default(0), // 200 = 2%
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: text("full_name").notNull(),
    mobile: text("mobile").notNull(),
    alternateMobile: text("alternate_mobile"),
    email: text("email"),
    panMasked: text("pan_masked"),
    aadhaarMasked: text("aadhaar_masked"),
    // Stored MASKED (e.g. "XXXXXXXX1234"). Full value is never persisted (PRD §3).
    aadhaarPanMasked: text("aadhaar_pan_masked"),
    // Full PAN is stored ENCRYPTED (AES-256-GCM); `panHash` is an HMAC used only
    // for exact-match search. Without a PAN, `panExemptReason` explains why.
    panEncrypted: text("pan_encrypted"),
    panHash: text("pan_hash"),
    panExemptReason: text("pan_exempt_reason"),
    clientCode: text("client_code"),
    projectId: uuid("project_id").references(() => projects.id),
    // Aadhaar / passport number, encrypted like the PAN (masked copy is aadhaarMasked).
    idProofEncrypted: text("id_proof_encrypted"),
    // Everything else on the Register Client form (title, DOB, city, company...);
    // keys are listed in lib/customer-profile.ts.
    profile: jsonb("profile").$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
    jointApplicants: jsonb("joint_applicants").$type<JointApplicant[]>().notNull().default(sql`'[]'::jsonb`),
    address: text("address"),
    salesExecutive: text("sales_executive"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    nameIdx: index("customers_name_idx").on(t.fullName),
    projectIdx: index("customers_project_idx").on(t.projectId),
    panHashIdx: index("customers_pan_hash_idx").on(t.panHash),
    clientCodeIdx: uniqueIndex("customers_client_code_idx").on(t.clientCode),
  }),
);

/** A label read from a map file (PDF text), as percent of the map. */
export interface MapLabel {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// An uploaded site map (image). Units sit on it as boxes; positions are stored
// as percent of the map (see units.map_x ...) so they fit any screen size.
export const siteMaps = pgTable("site_maps", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  projectName: text("project_name").notNull().default(""), // legacy text; projectId is the source of truth
  projectId: uuid("project_id").references(() => projects.id),
  fileUrl: text("file_url").notNull(), // /api/maps/<id>/image
  // The JPEG itself, base64. Kept in the database so maps work everywhere (local and live)
  // without separate file storage. Never select it in list queries.
  imageData: text("image_data").notNull().default(""),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  // Unit labels found in the source PDF's text, offered as ready-made boxes.
  detected: jsonb("detected").$type<MapLabel[]>().notNull().default(sql`'[]'::jsonb`),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A unit (bungalow, flat, shop...) exists before anyone books it, so the unit
// board can show every unit. "Booked" is NOT stored: a unit is booked when a
// booking points at it. Only `blocked` is set by hand.
export const units = pgTable(
  "units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectName: text("project_name").notNull().default(""), // legacy text; projectId is the source of truth
    projectId: uuid("project_id").references(() => projects.id),
    unitType: text("unit_type").notNull(),
    unitNumber: text("unit_number").notNull(),
    areaSqft: numeric("area_sqft", { precision: 10, scale: 2 }),
    floor: text("floor"),
    subType: text("sub_type"), // e.g. "Type A"
    // Where the unit's box sits on a site map (percent of the map; null = not placed).
    mapId: uuid("map_id").references(() => siteMaps.id, { onDelete: "set null" }),
    mapX: real("map_x"),
    mapY: real("map_y"),
    mapW: real("map_w"),
    mapH: real("map_h"),
    // A block holds the unit for someone until `unblockOn` (null = never expires).
    // Expiry is applied on read; every block and release is in the audit log.
    blocked: boolean("blocked").notNull().default(false),
    blockReason: text("block_reason"),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    blockCustomerId: uuid("block_customer_id").references(() => customers.id, { onDelete: "set null" }),
    blockName: text("block_name"),
    blockMobile: text("block_mobile"),
    blockedBy: uuid("blocked_by").references(() => users.id, { onDelete: "set null" }),
    unblockOn: date("unblock_on"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqueInProject: uniqueIndex("units_project_unique_idx").on(t.projectId, t.unitType, t.unitNumber),
    uniqueUnit: uniqueIndex("units_unique_idx").on(
      t.projectName,
      t.unitType,
      t.unitNumber,
    ),
  }),
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id").references(() => units.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    bookingCode: text("booking_code"),
    bookingDate: date("booking_date").notNull(),
    projectName: text("project_name"), // legacy text; projectId is the source of truth
    projectId: uuid("project_id").references(() => projects.id),
    propertyType: text("property_type").notNull(),
    propertyNumber: text("property_number"),
    bookingAddress: text("booking_address"),
    unitStatus: unitStatusEnum("unit_status").notNull().default("booked"),
    paymentType: paymentTypeEnum("payment_type")
      .notNull()
      .default("self_finance"),
    stageBased: boolean("stage_based").notNull().default(false),
    currentStage: constructionStageEnum("current_stage"),
    downPayment: paise("down_payment").notNull().default(sql`0`),
    installmentCount: integer("installment_count"),
    installmentFrequency: installmentFrequencyEnum("installment_frequency"),
    financeType: financeTypeEnum("finance_type").notNull().default("self_funded"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    customerIdx: index("bookings_customer_idx").on(t.customerId),
    projectIdx: index("bookings_project_idx").on(t.projectId),
    bookingCodeIdx: uniqueIndex("bookings_booking_code_idx").on(t.bookingCode),
  }),
);

// One cost structure per booking. Store BOTH percent (bps) and computed amount
// so a later rate change never rewrites historical bookings (PRD §6).
export const propertyCosts = pgTable("property_costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "cascade" }),
  baseCost: paise("base_cost").notNull(),
  extraCharges: paise("extra_charges").notNull().default(sql`0`),
  discount: paise("discount").notNull().default(sql`0`),
  agreementValue: paise("agreement_value").notNull().default(sql`0`),
  gstPercentBps: integer("gst_percent_bps").notNull().default(0),
  gstAmount: paise("gst_amount").notNull(),
  maintenanceCharge: paise("maintenance_charge")
    .notNull()
    .default(sql`0`),
  documentationPercentBps: integer("documentation_percent_bps")
    .notNull()
    .default(0),
  documentationAmount: paise("documentation_amount").notNull(),
  totalCost: paise("total_cost").notNull(),
});

// One row per instalment (June 20L, October 40L, ...).
export const paymentSchedule = pgTable(
  "payment_schedule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    dueDate: date("due_date").notNull(),
    // `amount` is the GROSS due (basic + gst + other charges). The three split
    // columns are 0 on legacy rows, which are then treated as all-basic.
    amount: paise("amount").notNull(),
    basicAmount: paise("basic_amount").notNull().default(sql`0`),
    gstAmount: paise("gst_amount").notNull().default(sql`0`),
    otherChargeAmount: paise("other_charge_amount").notNull().default(sql`0`),
    documentationAmount: paise("documentation_amount").notNull().default(sql`0`),
    percentageBps: integer("percentage_bps"),
    label: text("label"),
    installmentNumber: integer("installment_number"),
  },
  (t) => ({
    bookingIdx: index("schedule_booking_idx").on(t.bookingId),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    paymentDate: date("payment_date").notNull(),
    // `amount` is the TOTAL paid (basic + gst + other charges). `gstAmount` and
    // `maintenanceAmount` are portions of it; basic = amount - gst - maintenance.
    amount: paise("amount").notNull(),
    gstAmount: paise("gst_amount").notNull().default(sql`0`),
    maintenanceAmount: paise("maintenance_amount").notNull().default(sql`0`),
    documentationAmount: paise("documentation_amount").notNull().default(sql`0`),
    paymentFor: text("payment_for"),
    paymentNumber: text("payment_number"),
    instrumentDate: date("instrument_date"),
    instrumentNumber: text("instrument_number"),
    instrumentBank: text("instrument_bank"),
    mode: paymentModeEnum("mode").notNull().default("bank_transfer"),
    stage: constructionStageEnum("stage"),
    source: text("source").notNull().default("customer"),
    stageLimitOverride: boolean("stage_limit_override").notNull().default(false),
    overrideReason: text("override_reason"),
    referenceNumber: text("reference_number"),
    notes: text("notes"),
    attachmentUrl: text("attachment_url"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bookingIdx: index("payments_booking_idx").on(t.bookingId),
    paymentNumberIdx: uniqueIndex("payments_payment_number_idx").on(t.paymentNumber),
  }),
);

// Brokerage paid out to an agent.
export const agentPayments = pgTable("agent_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  paymentDate: date("payment_date").notNull(),
  amount: paise("amount").notNull(),
  mode: text("mode").notNull().default("bank_transfer"),
  reference: text("reference"),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loans = pgTable("loans", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id, { onDelete: "cascade" }),
  status: loanStatusEnum("status").notNull().default("pending_docs"),
  loanAmount: paise("loan_amount"),
  customerContribution: paise("customer_contribution"),
  amountReleased: paise("amount_released").notNull().default(sql`0`),
  bankName: text("bank_name"),
  branchName: text("branch_name"),
  branchContact: text("branch_contact"),
  referenceNumber: text("reference_number"),
  sanctionDate: date("sanction_date"),
  approvalDate: date("approval_date"),
  disbursementDate: date("disbursement_date"),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "cascade",
    }),
    documentType: text("document_type").notNull(),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(), // /api/documents/<id>/file, or an old public link
    // The file itself, base64, kept in the database. Never select it in list queries.
    data: text("data").notNull().default(""),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    customerIdx: index("documents_customer_idx").on(t.customerId),
    bookingIdx: index("documents_booking_idx").on(t.bookingId),
  }),
);

// Log of construction-stage changes for a booking (who moved it, when, why).
export const stageHistory = pgTable(
  "stage_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    previousStage: constructionStageEnum("previous_stage"),
    newStage: constructionStageEnum("new_stage"),
    remarks: text("remarks"),
    changedBy: uuid("changed_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    bookingIdx: index("stage_history_booking_idx").on(t.bookingId),
  }),
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    action: auditActionEnum("action").notNull(),
    entityType: auditEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    entityIdx: index("audit_entity_idx").on(t.entityType, t.entityId),
    tsIdx: index("audit_ts_idx").on(t.timestamp),
  }),
);

// ---------------------------------------------------------------------------
// Inferred types for use across the app.
export type User = typeof users.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type PropertyCost = typeof propertyCosts.$inferSelect;
export type PaymentScheduleRow = typeof paymentSchedule.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type StageHistoryRow = typeof stageHistory.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;

export type Role = (typeof roleEnum.enumValues)[number];
