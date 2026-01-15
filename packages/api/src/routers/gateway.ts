import { db, gatewayConnection, encrypt, decrypt } from "@mote/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";

/**
 * Gateway connection router for managing SSH configuration
 */
export const gatewayRouter = {
  /**
   * Save or update gateway SSH configuration for authenticated user
   */
  saveConfig: protectedProcedure
    .input(
      z.object({
        sshHost: z.string().min(1, "SSH host is required"),
        sshPort: z.number().int().min(1).max(65535).default(22),
        sshUsername: z.string().min(1, "SSH username is required"),
        sshPrivateKey: z.string().min(1, "SSH private key is required"),
        projectRoot: z.string().min(1, "Project root is required"),
        cliPath: z.string().min(1, "CLI path is required"),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Encrypt the private key before storing
      const encryptedKey = encrypt(input.sshPrivateKey);

      // Check if config already exists
      const existing = await db.query.gatewayConnection.findFirst({
        where: eq(gatewayConnection.userId, userId),
      });

      if (existing) {
        // Update existing configuration
        await db
          .update(gatewayConnection)
          .set({
            sshHost: input.sshHost,
            sshPort: input.sshPort,
            sshUsername: input.sshUsername,
            sshPrivateKeyEncrypted: encryptedKey,
            projectRoot: input.projectRoot,
            cliPath: input.cliPath,
            updatedAt: new Date(),
          })
          .where(eq(gatewayConnection.userId, userId));

        // Also auto-configure clawd.bot Gateway HTTP API for chat
        const { clawdConnection } = await import("@mote/db");
        const existingClawd = await db.query.clawdConnection.findFirst({
          where: eq(clawdConnection.userId, userId),
        });

        if (!existingClawd) {
          // Auto-create clawd connection with default token (empty)
          const clawdId = crypto.randomUUID();
          await db.insert(clawdConnection).values({
            id: clawdId,
            userId,
            gatewayUrl: "http://localhost:18789", // Standard Gateway HTTP API port
            tokenEncrypted: encrypt(""), // Empty token by default
            defaultAgentId: "main",
            isActive: true,
          });
        }

        return {
          success: true,
          message: "Gateway configuration updated",
          id: existing.id,
        };
      } else {
        // Create new configuration
        const id = crypto.randomUUID();
        await db.insert(gatewayConnection).values({
          id,
          userId,
          sshHost: input.sshHost,
          sshPort: input.sshPort,
          sshUsername: input.sshUsername,
          sshPrivateKeyEncrypted: encryptedKey,
          projectRoot: input.projectRoot,
          cliPath: input.cliPath,
          isActive: false,
        });

        // Also auto-configure clawd.bot Gateway HTTP API for chat
        const { clawdConnection } = await import("@mote/db");
        const clawdId = crypto.randomUUID();
        await db.insert(clawdConnection).values({
          id: clawdId,
          userId,
          gatewayUrl: "http://localhost:18789", // Standard Gateway HTTP API port
          tokenEncrypted: encrypt(""), // Empty token by default
          defaultAgentId: "main",
          isActive: true,
        });

        return {
          success: true,
          message: "Gateway configuration created",
          id,
        };
      }
    }),

  /**
   * Get gateway configuration (without private key) for authenticated user
   */
  getConfig: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const config = await db.query.gatewayConnection.findFirst({
      where: eq(gatewayConnection.userId, userId),
    });

    if (!config) {
      return null;
    }

    // Return config without encrypted private key
    return {
      id: config.id,
      sshHost: config.sshHost,
      sshPort: config.sshPort,
      sshUsername: config.sshUsername,
      projectRoot: config.projectRoot,
      cliPath: config.cliPath,
      isActive: config.isActive,
      lastConnectedAt: config.lastConnectedAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }),

  /**
   * Delete gateway configuration for authenticated user
   * This will also close any active connections
   */
  deleteConfig: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const result = await db
      .delete(gatewayConnection)
      .where(eq(gatewayConnection.userId, userId));

    return {
      success: true,
      message: "Gateway configuration deleted",
    };
  }),

  /**
   * Get connection status for authenticated user
   */
  getStatus: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const config = await db.query.gatewayConnection.findFirst({
      where: eq(gatewayConnection.userId, userId),
      columns: {
        id: true,
        isActive: true,
        lastConnectedAt: true,
      },
    });

    if (!config) {
      return {
        connected: false,
        message: "No gateway configuration found",
      };
    }

    return {
      connected: config.isActive,
      lastConnectedAt: config.lastConnectedAt,
    };
  }),

  /**
   * Test SSH connection and gateway port connectivity
   */
  testConnection: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    // Get configuration
    const config = await db.query.gatewayConnection.findFirst({
      where: eq(gatewayConnection.userId, userId),
    });

    if (!config) {
      return {
        success: false,
        message: "No gateway configuration found. Please configure SSH settings first.",
      };
    }

    // Decrypt private key
    const privateKey = decrypt(config.sshPrivateKeyEncrypted);

    // Test SSH connection
    const { Client } = await import("ssh2");
    const client = new Client();

    return new Promise<{
      success: boolean;
      message: string;
      details?: string;
    }>((resolve) => {
      const timeout = setTimeout(() => {
        client.end();
        resolve({
          success: false,
          message: "Connection timeout",
          details: "Failed to connect within 10 seconds",
        });
      }, 10000);

      client
        .on("ready", () => {
          console.log(`[gateway-test] SSH connected successfully for user ${userId}`);

          // Try to forward port to gateway
          client.forwardOut(
            "127.0.0.1",
            0,
            "127.0.0.1",
            18790,
            (err, stream) => {
              clearTimeout(timeout);

              if (err) {
                client.end();
                resolve({
                  success: false,
                  message: "SSH connected but gateway port unreachable",
                  details: err.message,
                });
                return;
              }

              // Success! Close the test connection
              stream.end();
              client.end();
              resolve({
                success: true,
                message: "SSH connection and gateway port test successful",
                details: `Connected to ${config.sshHost}:${config.sshPort} and reached port 18790`,
              });
            }
          );
        })
        .on("error", (err) => {
          clearTimeout(timeout);
          console.error(`[gateway-test] SSH connection failed for user ${userId}:`, err);
          client.end();
          resolve({
            success: false,
            message: "SSH connection failed",
            details: err.message,
          });
        })
        .connect({
          host: config.sshHost,
          port: config.sshPort,
          username: config.sshUsername,
          privateKey: privateKey,
          readyTimeout: 10000,
        });
    });
  }),

  /**
   * Internal method to get decrypted private key (used by WebSocket server)
   * This is NOT exposed to the client directly
   */
  _getDecryptedConfig: async (userId: string) => {
    const config = await db.query.gatewayConnection.findFirst({
      where: eq(gatewayConnection.userId, userId),
    });

    if (!config) {
      return null;
    }

    // Decrypt the private key
    const privateKey = decrypt(config.sshPrivateKeyEncrypted);

    return {
      ...config,
      sshPrivateKey: privateKey,
    };
  },
};
