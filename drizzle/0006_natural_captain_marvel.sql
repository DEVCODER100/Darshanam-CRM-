ALTER TYPE "public"."payment_mode" ADD VALUE 'imps' BEFORE 'upi';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pan_encrypted" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pan_hash" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "pan_exempt_reason" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "client_code" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "branch_name" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "branch_contact" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "payment_number" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "instrument_date" date;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "instrument_number" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "instrument_bank" text;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_booking_code_idx" ON "bookings" USING btree ("booking_code");--> statement-breakpoint
CREATE INDEX "customers_pan_hash_idx" ON "customers" USING btree ("pan_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_client_code_idx" ON "customers" USING btree ("client_code");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_payment_number_idx" ON "payments" USING btree ("payment_number");