CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."audit_entity" AS ENUM('customer', 'booking', 'property_cost', 'payment_schedule', 'payment', 'loan', 'user');--> statement-breakpoint
CREATE TYPE "public"."finance_type" AS ENUM('self_funded', 'loan');--> statement-breakpoint
CREATE TYPE "public"."loan_status" AS ENUM('not_applicable', 'pending_docs', 'applied', 'approved', 'disbursed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'accountant', 'sales_executive', 'manager');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" "audit_entity" NOT NULL,
	"entity_id" uuid,
	"before_json" jsonb,
	"after_json" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"booking_date" date NOT NULL,
	"property_type" text NOT NULL,
	"property_number" text,
	"booking_address" text,
	"finance_type" "finance_type" DEFAULT 'self_funded' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"mobile" text NOT NULL,
	"email" text,
	"aadhaar_pan_masked" text,
	"address" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"status" "loan_status" DEFAULT 'pending_docs' NOT NULL,
	"loan_amount" bigint,
	"bank_name" text,
	"reference_number" text,
	"approval_date" date,
	"disbursement_date" date,
	CONSTRAINT "loans_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "payment_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"amount" bigint NOT NULL,
	"mode" "payment_mode" DEFAULT 'bank_transfer' NOT NULL,
	"reference_number" text,
	"notes" text,
	"attachment_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"base_cost" bigint NOT NULL,
	"gst_percent_bps" integer DEFAULT 0 NOT NULL,
	"gst_amount" bigint NOT NULL,
	"maintenance_charge" bigint DEFAULT 0 NOT NULL,
	"documentation_percent_bps" integer DEFAULT 0 NOT NULL,
	"documentation_amount" bigint NOT NULL,
	"total_cost" bigint NOT NULL,
	CONSTRAINT "property_costs_booking_id_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'manager' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD CONSTRAINT "payment_schedule_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_costs" ADD CONSTRAINT "property_costs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_ts_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "schedule_booking_idx" ON "payment_schedule" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "users_clerk_idx" ON "users" USING btree ("clerk_user_id");