import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

/**
 * Clawd.bot Gateway Connection Configuration
 *
 * Stores encrypted Gateway credentials for connecting to a user's clawd.bot Gateway.
 * Each user can have one active Gateway connection.
 */
export const clawdConnection = pgTable(
  "clawd_connection",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),

    // Gateway URL (e.g., "http://localhost:18789" or through SSH tunnel)
    gatewayUrl: text("gateway_url").notNull(),

    // Encrypted Gateway token using AES-256-GCM
    tokenEncrypted: text("token_encrypted").notNull(),

    // Default agent ID to use (e.g., "main")
    defaultAgentId: text("default_agent_id").notNull().default("main"),

    // Whether this connection is currently active
    isActive: boolean("is_active").default(true).notNull(),

    // Last time this connection was used to send a message
    lastUsedAt: timestamp("last_used_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("clawd_connection_userId_idx").on(table.userId),
  ]
);

/**
 * Chat Messages
 *
 * Stores chat message history between user and clawd.bot AI.
 * Messages are linked to the user's clawd connection.
 */
export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    clawdConnectionId: text("clawd_connection_id")
      .notNull()
      .references(() => clawdConnection.id, { onDelete: "cascade" }),

    // Role: "user" or "assistant"
    role: text("role").notNull(),

    // Message content
    content: text("content").notNull(),

    // clawd.bot session key for multi-turn conversations
    sessionKey: text("session_key"),

    // Agent ID used for this message
    agentId: text("agent_id"),

    // Token usage stats (if available)
    promptTokens: text("prompt_tokens"),
    completionTokens: text("completion_tokens"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_message_userId_idx").on(table.userId),
    index("chat_message_clawdConnectionId_idx").on(table.clawdConnectionId),
    index("chat_message_sessionKey_idx").on(table.sessionKey),
    index("chat_message_createdAt_idx").on(table.createdAt),
  ]
);

// Relations
export const clawdConnectionRelations = relations(clawdConnection, ({ one, many }) => ({
  user: one(user, {
    fields: [clawdConnection.userId],
    references: [user.id],
  }),
  messages: many(chatMessage),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  user: one(user, {
    fields: [chatMessage.userId],
    references: [user.id],
  }),
  clawdConnection: one(clawdConnection, {
    fields: [chatMessage.clawdConnectionId],
    references: [clawdConnection.id],
  }),
}));
