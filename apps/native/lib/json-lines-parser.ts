/**
 * JSON Lines Parser
 *
 * Parses streaming JSON Lines format (one JSON object per line)
 * Handles incomplete lines and maintains a buffer
 *
 * Format: Each line is a complete JSON object followed by `\n`
 * Example:
 *   {"type":"hello","platform":"ios"}\n
 *   {"type":"helloOk","serverId":"abc"}\n
 */

import type { BridgeMessage } from "./bridge-protocol";
import { isBridgeMessage, parseBridgeMessage } from "./bridge-protocol";

export class JSONLinesParser {
  private buffer = "";

  /**
   * Feed new data into the parser
   * Returns array of complete Bridge messages
   */
  feed(data: string): BridgeMessage[] {
    // Append new data to buffer
    this.buffer += data;

    // Split by newlines
    const lines = this.buffer.split("\n");

    // Last element might be incomplete, keep it in buffer
    this.buffer = lines.pop() || "";

    // Parse complete lines
    const messages: BridgeMessage[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        continue;
      }

      try {
        // Parse JSON
        const parsed = JSON.parse(trimmed);

        // Validate as Bridge message
        if (isBridgeMessage(parsed)) {
          messages.push(parsed);
        } else {
          console.warn("[JSONLinesParser] Invalid Bridge message:", trimmed);
        }
      } catch (error) {
        console.error("[JSONLinesParser] Failed to parse JSON line:", trimmed, error);
      }
    }

    return messages;
  }

  /**
   * Reset the parser buffer
   */
  reset(): void {
    this.buffer = "";
  }

  /**
   * Get current buffer content (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Check if buffer has incomplete data
   */
  hasIncompleteData(): boolean {
    return this.buffer.length > 0;
  }
}
