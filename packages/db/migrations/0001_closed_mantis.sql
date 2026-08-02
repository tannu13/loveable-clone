CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(255),
	"is_anonymous" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "user_id" uuid;--> statement-breakpoint
DO $$
DECLARE
	migration_user_id uuid;
BEGIN
	IF EXISTS (SELECT 1 FROM "conversations" WHERE "user_id" IS NULL) THEN
		INSERT INTO "users" ("is_anonymous")
		VALUES (true)
		RETURNING "id" INTO migration_user_id;

		UPDATE "conversations"
		SET "user_id" = migration_user_id
		WHERE "user_id" IS NULL;
	END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_user_id_idx" ON "conversations" USING btree ("user_id"); 
