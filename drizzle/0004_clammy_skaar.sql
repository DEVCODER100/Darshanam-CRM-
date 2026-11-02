ALTER TABLE "payment_schedule" ADD COLUMN "basic_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "gst_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "other_charge_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "percentage_bps" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "maintenance_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_for" text;