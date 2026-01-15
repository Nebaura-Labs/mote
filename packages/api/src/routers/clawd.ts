import { db, clawdConnection, chatMessage, encrypt, decrypt } from "@mote/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure } from "../index";
import { gatewayClientPool } from "../gateway-client";

/**
 * Clawd.bot Gateway connection router for managing Gateway configuration and chat
 */
export const clawdRouter = {
  /**
   * Save or update clawd.bot Gateway configuration for authenticated user
   */
  saveConfig: protectedProcedure
    .input(
      z.object({
        gatewayUrl: z.string().url("Invalid Gateway URL"),
        token: z.string().min(1, "Gateway token is required"),
        defaultAgentId: z.string().default("main"),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Encrypt the Gateway token before storing
      const encryptedToken = encrypt(input.token);

      // Check if config already exists
      const existing = await db.query.clawdConnection.findFirst({
        where: eq(clawdConnection.userId, userId),
      });

      if (existing) {
        // Update existing configuration
        await db
          .update(clawdConnection)
          .set({
            gatewayUrl: input.gatewayUrl,
            tokenEncrypted: encryptedToken,
            defaultAgentId: input.defaultAgentId,
            updatedAt: new Date(),
          })
          .where(eq(clawdConnection.userId, userId));

        return {
          success: true,
          message: "Gateway configuration updated",
          id: existing.id,
        };
      } else {
        // Create new configuration
        const id = crypto.randomUUID();
        await db.insert(clawdConnection).values({
          id,
          userId,
          gatewayUrl: input.gatewayUrl,
          tokenEncrypted: encryptedToken,
          defaultAgentId: input.defaultAgentId,
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
   * Get clawd.bot Gateway configuration (without token) for authenticated user
   */
  getConfig: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const config = await db.query.clawdConnection.findFirst({
      where: eq(clawdConnection.userId, userId),
    });

    if (!config) {
      return null;
    }

    // Return config without encrypted token
    return {
      id: config.id,
      gatewayUrl: config.gatewayUrl,
      defaultAgentId: config.defaultAgentId,
      isActive: config.isActive,
      lastUsedAt: config.lastUsedAt,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }),

  /**
   * Delete clawd.bot configuration for authenticated user
   */
  deleteConfig: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const config = await db.query.clawdConnection.findFirst({
      where: eq(clawdConnection.userId, userId),
    });

    if (!config) {
      return {
        success: false,
        message: "No configuration found",
      };
    }

    await db.delete(clawdConnection).where(eq(clawdConnection.userId, userId));

    return {
      success: true,
      message: "Clawd.bot configuration deleted",
    };
  }),

  /**
   * Send a chat message to clawd.bot Gateway and get response
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        message: z.string().min(1, "Message is required"),
        sessionKey: z.string().optional(),
        agentId: z.string().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Get user's Gateway configuration
      const config = await db.query.clawdConnection.findFirst({
        where: eq(clawdConnection.userId, userId),
      });

      if (!config) {
        throw new Error("No Gateway configuration found. Please configure first.");
      }

      // Decrypt Gateway token
      const token = decrypt(config.tokenEncrypted);
      const agentId = input.agentId || config.defaultAgentId;

      // Generate session key if not provided
      const sessionKey = input.sessionKey || crypto.randomUUID();
      const idempotencyKey = crypto.randomUUID();

      // Save user message to database
      const userMessageId = crypto.randomUUID();
      await db.insert(chatMessage).values({
        id: userMessageId,
        userId,
        clawdConnectionId: config.id,
        role: "user",
        content: input.message,
        sessionKey,
        agentId,
      });

      // Connect to Gateway via WebSocket (Bridge Protocol)
      const gateway = await gatewayClientPool.getClient(userId, token, config.gatewayUrl);

      // Send chat message and wait for complete response
      console.log(`[clawd] Sending chat message for user ${userId}`);
      const chatResponse = await gateway.sendChatMessageAndWait({
        sessionKey,
        message: input.message,
        idempotencyKey,
      });

      console.log(`[clawd] Received response for runId: ${chatResponse.runId}`);

      // Use the actual AI response
      const assistantMessage = chatResponse.content;

      // Save assistant response placeholder to database
      const assistantMessageId = crypto.randomUUID();
      await db.insert(chatMessage).values({
        id: assistantMessageId,
        userId,
        clawdConnectionId: config.id,
        role: "assistant",
        content: assistantMessage,
        sessionKey,
        agentId,
        promptTokens: null,
        completionTokens: null,
      });

      // Update last used timestamp
      await db
        .update(clawdConnection)
        .set({ lastUsedAt: new Date() })
        .where(eq(clawdConnection.id, config.id));

      return {
        success: true,
        message: assistantMessage,
        messageId: assistantMessageId,
        sessionKey,
        runId: chatResponse.runId,
      };
    }),

  /**
   * Get chat history for authenticated user
   */
  getMessages: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
        sessionKey: z.string().optional(),
      })
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;

      // Get user's clawd configuration
      const config = await db.query.clawdConnection.findFirst({
        where: eq(clawdConnection.userId, userId),
      });

      if (!config) {
        return {
          messages: [],
          total: 0,
        };
      }

      // Build where clause
      const whereClause = input.sessionKey
        ? and(
            eq(chatMessage.clawdConnectionId, config.id),
            eq(chatMessage.sessionKey, input.sessionKey)
          )
        : eq(chatMessage.clawdConnectionId, config.id);

      // Get messages
      const messages = await db.query.chatMessage.findMany({
        where: whereClause,
        orderBy: [desc(chatMessage.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });

      return {
        messages: messages.reverse(), // Reverse to get chronological order
        total: messages.length,
      };
    }),

  /**
   * Clear all chat history for authenticated user
   */
  clearHistory: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    const config = await db.query.clawdConnection.findFirst({
      where: eq(clawdConnection.userId, userId),
    });

    if (!config) {
      return {
        success: false,
        message: "No configuration found",
      };
    }

    await db
      .delete(chatMessage)
      .where(eq(chatMessage.clawdConnectionId, config.id));

    return {
      success: true,
      message: "Chat history cleared",
    };
  }),
};
