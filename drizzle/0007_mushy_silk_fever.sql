ALTER TABLE "customers" ADD COLUMN "id_proof_encrypted" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "joint_applicants" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "block_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "block_name" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "block_mobile" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "blocked_by" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "unblock_on" date;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_block_customer_id_customers_id_fk" FOREIGN KEY ("block_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;