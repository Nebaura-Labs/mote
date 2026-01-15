import { db, clawdConnection, encrypt } from "@mote/db";
import { eq } from "drizzle-orm";
import { protectedProcedure } from "../index";

/**
 * Auto-setup clawd connection if Gateway SSH is configured but clawd isn't
 */
export const autoSetupClawdRouter = {
  autoSetup: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    // Check if clawd connection exists
    const existing = await db.query.clawdConnection.findFirst({
      where: eq(clawdConnection.userId, userId),
    });

    if (existing) {
      return {
        success: true,
        message: "Clawd connection already exists",
        alreadyExists: true,
      };
    }

    // Create clawd connection with default settings
    const id = crypto.randomUUID();
    await db.insert(clawdConnection).values({
      id,
      userId,
      gatewayUrl: "http://localhost:18789", // Standard Gateway HTTP API port
      tokenEncrypted: encrypt(""), // Empty token by default
      defaultAgentId: "main",
      isActive: true,
    });

    return {
      success: true,
      message: "Clawd connection auto-configured",
      id,
    };
  }),
};
