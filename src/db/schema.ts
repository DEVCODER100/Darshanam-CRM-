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
  index,
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
  }),
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    bookingDate: date("booking_date").notNull(),
    projectName: text("project_name"),
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
    amount: paise("amount").notNull(),
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
    // `amount` is the TOTAL paid (basic + gst). `gstAmount` is the GST portion
    // of that payment; basic principal = amount - gstAmount.
    amount: paise("amount").notNull(),
    gstAmount: paise("gst_amount").notNull().default(sql`0`),
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
  }),
);

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
    fileUrl: text("file_url").notNull(),
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
export type Document = typeof documents.$inferSelect;
export type AuditLogRow = typeof auditLog.$inferSelect;

export type Role = (typeof roleEnum.enumValues)[number];
