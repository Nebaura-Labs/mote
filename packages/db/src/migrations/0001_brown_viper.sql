CREATE TABLE "gateway_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ssh_host" text NOT NULL,
	"ssh_port" integer DEFAULT 22 NOT NULL,
	"ssh_username" text NOT NULL,
	"ssh_private_key_encrypted" text NOT NULL,
	"project_root" text NOT NULL,
	"cli_path" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_connected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_connection_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "gateway_connection" ADD CONSTRAINT "gateway_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gateway_connection_userId_idx" ON "gateway_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gateway_connection_isActive_idx" ON "gateway_connection" USING btree ("is_active");