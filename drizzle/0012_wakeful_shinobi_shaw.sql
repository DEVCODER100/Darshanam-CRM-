ALTER TYPE "public"."audit_entity" ADD VALUE 'project';--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "site_maps" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "project_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_area_idx" ON "projects" USING btree ("name","area");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_maps" ADD CONSTRAINT "site_maps_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_project_idx" ON "bookings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "customers_project_idx" ON "customers" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "units_project_unique_idx" ON "units" USING btree ("project_id","unit_type","unit_number");