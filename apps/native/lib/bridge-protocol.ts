/**
 * Bridge Protocol Types
 *
 * Based on clawd.bot Bridge protocol (TCP + JSON Lines)
 * Reference: https://github.com/clawdbot/clawdbot
 */

// ============================================================================
// Constants
// ============================================================================

export const BRIDGE_PROTOCOL_VERSION = "1.0";
export const BRIDGE_PORT = 18790;
export const PING_INTERVAL_MS = 30000; // 30 seconds
export const HANDSHAKE_TIMEOUT_MS = 10000; // 10 seconds
export const RPC_TIMEOUT_MS = 30000; // 30 seconds

// ============================================================================
// Base Message Types
// ============================================================================

export type BridgePlatform = "ios" | "android";

export interface BridgeDeviceInfo {
  name: string;
  model: string;
  platform: BridgePlatform;
}

// ============================================================================
// Handshake Messages
// ============================================================================

export interface BridgeHelloMessage {
  type: "hello";
  platform: BridgePlatform;
  deviceName: string;
  capabilities: string[];
  commands: string[];
}

export interface BridgeHelloOkMessage {
  type: "helloOk";
  serverId: string;
  canvasURL?: string;
}

// ============================================================================
// Pairing Messages
// ============================================================================

export interface BridgePairRequestMessage {
  type: "pair";
  deviceInfo: BridgeDeviceInfo;
}

export interface BridgePairOkMessage {
  type: "pairOk";
  token: string;
}

// ============================================================================
// RPC Messages
// ============================================================================

export interface BridgeInvokeRequestMessage {
  type: "invoke";
  id: string;
  method: string;
  paramsJSON?: string;
}

export interface BridgeInvokeResponseMessage {
  type: "invokeResponse";
  id: string;
  ok: boolean;
  payloadJSON?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============================================================================
// Event Messages
// ============================================================================

export interface BridgeEventMessage {
  type: "event";
  event: string;
  payloadJSON?: string;
}

// ============================================================================
// Keepalive Messages
// ============================================================================

export interface BridgePingMessage {
  type: "ping";
  id: string;
}

export interface BridgePongMessage {
  type: "pong";
  id: string;
}

// ============================================================================
// Error Messages
// ============================================================================

export interface BridgeErrorMessage {
  type: "error";
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// Union Type
// ============================================================================

export type BridgeMessage =
  | BridgeHelloMessage
  | BridgeHelloOkMessage
  | BridgePairRequestMessage
  | BridgePairOkMessage
  | BridgeInvokeRequestMessage
  | BridgeInvokeResponseMessage
  | BridgeEventMessage
  | BridgePingMessage
  | BridgePongMessage
  | BridgeErrorMessage;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates if a message is a valid Bridge message
 */
export function isBridgeMessage(obj: unknown): obj is BridgeMessage {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const message = obj as Record<string, unknown>;

  if (typeof message.type !== "string") {
    return false;
  }

  // Validate based on type
  switch (message.type) {
    case "hello":
      return (
        typeof message.platform === "string" &&
        typeof message.deviceName === "string" &&
        Array.isArray(message.capabilities) &&
        Array.isArray(message.commands)
      );

    case "helloOk":
      return typeof message.serverId === "string";

    case "pair":
      return (
        typeof message.deviceInfo === "object" &&
        message.deviceInfo !== null &&
        typeof (message.deviceInfo as BridgeDeviceInfo).name === "string" &&
        typeof (message.deviceInfo as BridgeDeviceInfo).model === "string" &&
        typeof (message.deviceInfo as BridgeDeviceInfo).platform === "string"
      );

    case "pairOk":
      return typeof message.token === "string";

    case "invoke":
      return typeof message.id === "string" && typeof message.method === "string";

    case "invokeResponse":
      return typeof message.id === "string" && typeof message.ok === "boolean";

    case "event":
      return typeof message.event === "string";

    case "ping":
    case "pong":
      return typeof message.id === "string";

    case "error":
      return typeof message.code === "string" && typeof message.message === "string";

    default:
      return false;
  }
}

/**
 * Serializes a Bridge message to JSON string (for sending)
 */
export function serializeBridgeMessage(message: BridgeMessage): string {
  return JSON.stringify(message);
}

/**
 * Parses a JSON string to a Bridge message (for receiving)
 * Throws if invalid
 */
export function parseBridgeMessage(json: string): BridgeMessage {
  const parsed = JSON.parse(json);

  if (!isBridgeMessage(parsed)) {
    throw new Error(`Invalid Bridge message: ${json}`);
  }

  return parsed;
}

// ============================================================================
// Message Builders
// ============================================================================

/**
 * Creates a hello message
 */
export function createHelloMessage(
  platform: BridgePlatform,
  deviceName: string,
  capabilities: string[] = ["voice"],
  commands: string[] = ["mote.audio.start", "mote.audio.stop", "mote.battery.status"]
): BridgeHelloMessage {
  return {
    type: "hello",
    platform,
    deviceName,
    capabilities,
    commands,
  };
}

/**
 * Creates a pair request message
 */
export function createPairRequestMessage(deviceInfo: BridgeDeviceInfo): BridgePairRequestMessage {
  return {
    type: "pair",
    deviceInfo,
  };
}

/**
 * Creates an invoke request message
 */
export function createInvokeRequestMessage(
  id: string,
  method: string,
  params?: unknown
): BridgeInvokeRequestMessage {
  return {
    type: "invoke",
    id,
    method,
    paramsJSON: params ? JSON.stringify(params) : undefined,
  };
}

/**
 * Creates an invoke response message
 */
export function createInvokeResponseMessage(
  id: string,
  payload?: unknown,
  error?: { code: string; message: string; details?: unknown }
): BridgeInvokeResponseMessage {
  return {
    type: "invokeResponse",
    id,
    ok: !error,
    payloadJSON: payload ? JSON.stringify(payload) : undefined,
    error,
  };
}

/**
 * Creates an event message
 */
export function createEventMessage(event: string, payload?: unknown): BridgeEventMessage {
  return {
    type: "event",
    event,
    payloadJSON: payload ? JSON.stringify(payload) : undefined,
  };
}

/**
 * Creates a ping message
 */
export function createPingMessage(id: string): BridgePingMessage {
  return {
    type: "ping",
    id,
  };
}

/**
 * Creates a pong message
 */
export function createPongMessage(id: string): BridgePongMessage {
  return {
    type: "pong",
    id,
  };
}

/**
 * Creates an error message
 */
export function createErrorMessage(
  code: string,
  message: string,
  details?: unknown
): BridgeErrorMessage {
  return {
    type: "error",
    code,
    message,
    details,
  };
}
