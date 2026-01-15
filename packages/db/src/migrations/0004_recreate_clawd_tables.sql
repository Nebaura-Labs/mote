-- Recreate clawd_connection table with correct column names
CREATE TABLE IF NOT EXISTS "clawd_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL UNIQUE,
	"gateway_url" text NOT NULL,
	"token_encrypted" text NOT NULL,
	"default_agent_id" text DEFAULT 'main' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clawd_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action
);

-- Recreate chat_message table
CREATE TABLE IF NOT EXISTS "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"clawd_connection_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"session_key" text,
	"agent_id" text,
	"prompt_tokens" text,
	"completion_tokens" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "chat_message_clawd_connection_id_clawd_connection_id_fk" FOREIGN KEY ("clawd_connection_id") REFERENCES "clawd_connection"("id") ON DELETE cascade ON UPDATE no action
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "clawd_connection_userId_idx" ON "clawd_connection" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "chat_message_userId_idx" ON "chat_message" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "chat_message_clawdConnectionId_idx" ON "chat_message" USING btree ("clawd_connection_id");
CREATE INDEX IF NOT EXISTS "chat_message_sessionKey_idx" ON "chat_message" USING btree ("session_key");
CREATE INDEX IF NOT EXISTS "chat_message_createdAt_idx" ON "chat_message" USING btree ("created_at");
