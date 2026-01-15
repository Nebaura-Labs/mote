import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, integer, index } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

export const gatewayConnection = pgTable(
  "gateway_connection",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique() // One gateway per user
      .references(() => user.id, { onDelete: "cascade" }),
    sshHost: text("ssh_host").notNull(),
    sshPort: integer("ssh_port").notNull().default(22),
    sshUsername: text("ssh_username").notNull(),
    // Encrypted SSH private key (AES-256-GCM with salt)
    sshPrivateKeyEncrypted: text("ssh_private_key_encrypted").notNull(),
    projectRoot: text("project_root").notNull(),
    cliPath: text("cli_path").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    lastConnectedAt: timestamp("last_connected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("gateway_connection_userId_idx").on(table.userId),
    index("gateway_connection_isActive_idx").on(table.isActive),
  ],
);

export const gatewayConnectionRelations = relations(gatewayConnection, ({ one }) => ({
  user: one(user, {
    fields: [gatewayConnection.userId],
    references: [user.id],
  }),
}));
