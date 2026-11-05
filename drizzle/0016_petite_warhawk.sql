CREATE TABLE "brokerage_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"default_bps" integer DEFAULT 0 NOT NULL,
	"per_type" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"kind" text DEFAULT 'per_booking' NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_payments" ADD COLUMN "kind" text DEFAULT 'brokerage' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "agent_code" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "sms_opt_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "email_opt_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "rera_no" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "gstin" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "pan_encrypted" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "pan_hash" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "id_proof_encrypted" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "pin_code" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "user_group" text DEFAULT 'Agent Group' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "brokerage_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "reward_plan_id" uuid;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "brokerage_plans" ADD CONSTRAINT "brokerage_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_plans" ADD CONSTRAINT "reward_plans_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_brokerage_plan_id_brokerage_plans_id_fk" FOREIGN KEY ("brokerage_plan_id") REFERENCES "public"."brokerage_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reward_plan_id_reward_plans_id_fk" FOREIGN KEY ("reward_plan_id") REFERENCES "public"."reward_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agents_code_idx" ON "agents" USING btree ("agent_code");