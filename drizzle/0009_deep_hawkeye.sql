CREATE TABLE "site_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"project_name" text DEFAULT '' NOT NULL,
	"file_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"detected" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "map_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "map_x" real;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "map_y" real;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "map_w" real;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "map_h" real;--> statement-breakpoint
ALTER TABLE "site_maps" ADD CONSTRAINT "site_maps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_map_id_site_maps_id_fk" FOREIGN KEY ("map_id") REFERENCES "public"."site_maps"("id") ON DELETE set null ON UPDATE no action;