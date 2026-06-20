CREATE TYPE "public"."construction_stage" AS ENUM('plinth', 'ground_floor', 'first_floor', 'second_floor', 'outside_plaster', 'flooring', 'finishing');--> statement-breakpoint
CREATE TYPE "public"."installment_frequency" AS ENUM('monthly', 'quarterly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('self_finance', 'bank_loan', 'installment');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('available', 'booked', 'sold');--> statement-breakpoint
ALTER TYPE "public"."audit_entity" ADD VALUE 'document' BEFORE 'user';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'rtgs' BEFORE 'upi';--> statement-breakpoint
ALTER TYPE "public"."payment_mode" ADD VALUE 'neft' BEFORE 'upi';--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"booking_id" uuid,
	"document_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "project_name" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "unit_status" "unit_status" DEFAULT 'booked' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_type" "payment_type" DEFAULT 'self_finance' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stage_based" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "current_stage" "construction_stage";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "down_payment" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "installment_count" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "installment_frequency" "installment_frequency";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "alternate_mobile" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pan_masked" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "aadhaar_masked" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "sales_executive" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "customer_contribution" bigint;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "amount_released" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "sanction_date" date;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "installment_number" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stage" "construction_stage";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "source" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stage_limit_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "override_reason" text;--> statement-breakpoint
ALTER TABLE "property_costs" ADD COLUMN "extra_charges" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "property_costs" ADD COLUMN "discount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "property_costs" ADD COLUMN "agreement_value" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "bookings"
SET "payment_type" = CASE
	WHEN "finance_type" = 'loan' THEN 'bank_loan'::"payment_type"
	ELSE 'self_finance'::"payment_type"
END;--> statement-breakpoint
UPDATE "property_costs"
SET "agreement_value" = "base_cost" + "extra_charges" - "discount";--> statement-breakpoint
WITH numbered AS (
	SELECT "id", row_number() OVER (
		PARTITION BY "booking_id" ORDER BY "due_date", "id"
	)::integer AS number
	FROM "payment_schedule"
)
UPDATE "payment_schedule"
SET "installment_number" = numbered.number
FROM numbered
WHERE "payment_schedule"."id" = numbered."id";--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_customer_idx" ON "documents" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "documents_booking_idx" ON "documents" USING btree ("booking_id");
