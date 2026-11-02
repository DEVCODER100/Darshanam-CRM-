ALTER TYPE "public"."audit_entity" ADD VALUE 'unit';--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_name" text DEFAULT '' NOT NULL,
	"unit_type" text NOT NULL,
	"unit_number" text NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"block_reason" text,
	"blocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "documentation_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "documentation_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "units_unique_idx" ON "units" USING btree ("project_name","unit_type","unit_number");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;