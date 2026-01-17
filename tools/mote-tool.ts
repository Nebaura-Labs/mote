/**
 * Mote IoT Tool
 * Control Mote ESP32 devices and local network IoT devices
 */

import crypto from "node:crypto";
import { Type } from "@sinclair/typebox";
import {
  type AnyAgentTool,
  jsonResult,
  readStringParam,
  readNumberParam,
} from "./common.js";
import { callGatewayTool, type GatewayCallOptions } from "./gateway.js";

/**
 * Schema for Mote tool actions
 */
const MoteToolSchema = Type.Union([
  // List connected Mote nodes
  Type.Object({
    action: Type.Literal("list"),
    gatewayUrl: Type.Optional(Type.String()),
    gatewayToken: Type.Optional(Type.String()),
    timeoutMs: Type.Optional(Type.Number()),
  }),

  // Scan WiFi networks from Mote device
  Type.Object({
    action: Type.Literal("wifi_scan"),
    node: Type.Optional(Type.String({ description: "Mote node ID (optional if only one Mote)" })),
    gatewayUrl: Type.Optional(Type.String()),
    gatewayToken: Type.Optional(Type.String()),
    timeoutMs: Type.Optional(Type.Number()),
  }),

  // Make HTTP request to local device via Mote
  Type.Object({
    action: Type.Literal("http"),
    node: Type.Optional(Type.String({ description: "Mote node ID (optional if only one Mote)" })),
    url: Type.String({ description: "URL to request (must be accessible from Mote's network)" }),
    method: Type.Optional(
      Type.Union([
        Type.Literal("GET"),
        Type.Literal("POST"),
        Type.Literal("PUT"),
        Type.Literal("DELETE"),
      ])
    ),
    body: Type.Optional(Type.String({ description: "Request body for POST/PUT" })),
    headers: Type.Optional(
      Type.Record(Type.String(), Type.String(), {
        description: "HTTP headers as key-value pairs",
      })
    ),
    gatewayUrl: Type.Optional(Type.String()),
    gatewayToken: Type.Optional(Type.String()),
    timeoutMs: Type.Optional(Type.Number()),
  }),
]);

/**
 * Resolve Mote node ID - if not specified, find the first Mote device
 */
async function resolveMoteNodeId(
  gatewayOpts: GatewayCallOptions,
  nodeHint?: string
): Promise<string> {
  if (nodeHint) {
    // If it looks like a full node ID, use it directly
    if (nodeHint.startsWith("mote-")) {
      return nodeHint;
    }
    // Otherwise treat as a search hint
  }

  // List all nodes and find Mote devices
  const result = await callGatewayTool<{
    nodes: Array<{
      nodeId: string;
      displayName?: string;
      platform?: string;
      deviceFamily?: string;
      status: string;
    }>;
  }>("node.list", gatewayOpts, {});

  const moteNodes = result.nodes.filter(
    (n) =>
      n.deviceFamily === "mote" ||
      n.platform === "esp32" ||
      n.nodeId.startsWith("mote-")
  );

  if (moteNodes.length === 0) {
    throw new Error("No Mote devices found. Make sure Mote is connected.");
  }

  // If hint provided, try to match
  if (nodeHint) {
    const hint = nodeHint.toLowerCase();
    const match = moteNodes.find(
      (n) =>
        n.nodeId.toLowerCase().includes(hint) ||
        n.displayName?.toLowerCase().includes(hint)
    );
    if (match) {
      return match.nodeId;
    }
  }

  // Return first connected Mote, or first Mote if none connected
  const connected = moteNodes.find((n) => n.status === "connected");
  return connected?.nodeId ?? moteNodes[0].nodeId;
}

/**
 * Create the Mote IoT tool
 */
export function createMoteTool(): AnyAgentTool {
  return {
    label: "Mote",
    name: "mote",
    description: `Control Mote IoT devices and make requests to local network devices.

Actions:
- list: List all connected Mote devices
- wifi_scan: Scan WiFi networks visible to the Mote device
- http: Make HTTP requests to devices on Mote's local network (smart home devices, etc.)

Use the http action to control smart home devices like lights, plugs, TVs, etc. by making HTTP requests to their local APIs.`,
    parameters: MoteToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const action = readStringParam(params, "action", { required: true });
      const gatewayOpts: GatewayCallOptions = {
        gatewayUrl: readStringParam(params, "gatewayUrl", { trim: false }),
        gatewayToken: readStringParam(params, "gatewayToken", { trim: false }),
        timeoutMs:
          typeof params.timeoutMs === "number" ? params.timeoutMs : 30000,
      };

      switch (action) {
        case "list": {
          const result = await callGatewayTool<{
            nodes: Array<{
              nodeId: string;
              displayName?: string;
              platform?: string;
              deviceFamily?: string;
              status: string;
              commands?: string[];
            }>;
          }>("node.list", gatewayOpts, {});

          const moteNodes = result.nodes.filter(
            (n) =>
              n.deviceFamily === "mote" ||
              n.platform === "esp32" ||
              n.nodeId.startsWith("mote-")
          );

          return jsonResult({
            moteDevices: moteNodes.map((n) => ({
              nodeId: n.nodeId,
              displayName: n.displayName ?? "Mote",
              status: n.status,
              commands: n.commands,
            })),
            count: moteNodes.length,
          });
        }

        case "wifi_scan": {
          const nodeHint = readStringParam(params, "node", { required: false });
          const nodeId = await resolveMoteNodeId(gatewayOpts, nodeHint);

          const result = await callGatewayTool<{
            ok: boolean;
            payloadJSON?: string;
            error?: { message: string };
          }>("node.invoke", gatewayOpts, {
            nodeId,
            command: "wifi.scan",
            params: {},
            idempotencyKey: crypto.randomUUID(),
          });

          if (!result.ok) {
            throw new Error(
              result.error?.message ?? "WiFi scan failed"
            );
          }

          const payload = result.payloadJSON
            ? JSON.parse(result.payloadJSON)
            : {};

          return jsonResult({
            nodeId,
            networks: payload.networks ?? [],
            count: payload.count ?? 0,
          });
        }

        case "http": {
          const nodeHint = readStringParam(params, "node", { required: false });
          const url = readStringParam(params, "url", { required: true });
          const method = readStringParam(params, "method", {
            required: false,
          }) ?? "GET";
          const body = readStringParam(params, "body", { required: false });
          const headers = params.headers as Record<string, string> | undefined;

          const nodeId = await resolveMoteNodeId(gatewayOpts, nodeHint);

          const result = await callGatewayTool<{
            ok: boolean;
            payloadJSON?: string;
            error?: { message: string };
          }>("node.invoke", gatewayOpts, {
            nodeId,
            command: "iot.http",
            params: {
              url,
              method: method.toUpperCase(),
              body: body ?? undefined,
              headers: headers ?? undefined,
            },
            idempotencyKey: crypto.randomUUID(),
          });

          if (!result.ok) {
            throw new Error(
              result.error?.message ?? "HTTP request failed"
            );
          }

          const payload = result.payloadJSON
            ? JSON.parse(result.payloadJSON)
            : {};

          return jsonResult({
            nodeId,
            statusCode: payload.statusCode,
            body: payload.body,
            success: payload.statusCode >= 200 && payload.statusCode < 400,
          });
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}
