ALTER TABLE "documents" ADD COLUMN "data" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "note" text;