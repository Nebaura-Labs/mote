CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"clawd_connection_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"session_key" text,
	"agent_id" text,
	"prompt_tokens" text,
	"completion_tokens" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clawd_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"default_agent_id" text DEFAULT 'main' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clawd_connection_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_clawd_connection_id_clawd_connection_id_fk" FOREIGN KEY ("clawd_connection_id") REFERENCES "public"."clawd_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clawd_connection" ADD CONSTRAINT "clawd_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_message_userId_idx" ON "chat_message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_clawdConnectionId_idx" ON "chat_message" USING btree ("clawd_connection_id");--> statement-breakpoint
CREATE INDEX "chat_message_sessionKey_idx" ON "chat_message" USING btree ("session_key");--> statement-breakpoint
CREATE INDEX "chat_message_createdAt_idx" ON "chat_message" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "clawd_connection_userId_idx" ON "clawd_connection" USING btree ("user_id");