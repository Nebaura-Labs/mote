/**
 * JSON Lines Parser Tests
 */

import { JSONLinesParser } from "../json-lines-parser";
import { createHelloMessage, createPongMessage } from "../bridge-protocol";

describe("JSONLinesParser", () => {
  let parser: JSONLinesParser;

  beforeEach(() => {
    parser = new JSONLinesParser();
  });

  describe("Single Complete Message", () => {
    it("should parse a single complete message", () => {
      const messages = parser.feed('{"type":"ping","id":"123"}\n');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ type: "ping", id: "123" });
    });

    it("should parse hello message", () => {
      const hello = createHelloMessage("ios", "iPhone 15");
      const json = JSON.stringify(hello) + "\n";

      const messages = parser.feed(json);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(hello);
    });
  });

  describe("Multiple Messages", () => {
    it("should parse multiple messages in one feed", () => {
      const messages = parser.feed(
        '{"type":"ping","id":"1"}\n{"type":"pong","id":"1"}\n'
      );

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ type: "ping", id: "1" });
      expect(messages[1]).toEqual({ type: "pong", id: "1" });
    });

    it("should parse messages across multiple feeds", () => {
      const messages1 = parser.feed('{"type":"ping","id":"1"}\n');
      const messages2 = parser.feed('{"type":"pong","id":"1"}\n');

      expect(messages1).toHaveLength(1);
      expect(messages1[0]).toEqual({ type: "ping", id: "1" });

      expect(messages2).toHaveLength(1);
      expect(messages2[0]).toEqual({ type: "pong", id: "1" });
    });
  });

  describe("Incomplete Messages", () => {
    it("should buffer incomplete message", () => {
      const messages1 = parser.feed('{"type":"pi');

      expect(messages1).toHaveLength(0);
      expect(parser.hasIncompleteData()).toBe(true);
      expect(parser.getBuffer()).toBe('{"type":"pi');
    });

    it("should complete buffered message in next feed", () => {
      const messages1 = parser.feed('{"type":"pi');
      expect(messages1).toHaveLength(0);

      const messages2 = parser.feed('ng","id":"123"}\n');

      expect(messages2).toHaveLength(1);
      expect(messages2[0]).toEqual({ type: "ping", id: "123" });
      expect(parser.hasIncompleteData()).toBe(false);
    });

    it("should handle message split across multiple feeds", () => {
      const messages1 = parser.feed('{"type');
      expect(messages1).toHaveLength(0);

      const messages2 = parser.feed('":"ping",');
      expect(messages2).toHaveLength(0);

      const messages3 = parser.feed('"id":"123"}\n');

      expect(messages3).toHaveLength(1);
      expect(messages3[0]).toEqual({ type: "ping", id: "123" });
    });
  });

  describe("Empty Lines", () => {
    it("should skip empty lines", () => {
      const messages = parser.feed('\n\n{"type":"ping","id":"1"}\n\n');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ type: "ping", id: "1" });
    });

    it("should skip whitespace-only lines", () => {
      const messages = parser.feed('   \n  \t\n{"type":"ping","id":"1"}\n   ');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ type: "ping", id: "1" });
    });
  });

  describe("Invalid Messages", () => {
    it("should skip invalid JSON", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation();

      const messages = parser.feed('not valid json\n{"type":"ping","id":"1"}\n');

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ type: "ping", id: "1" });
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    it("should skip messages that don't match Bridge protocol", () => {
      const consoleWarn = jest.spyOn(console, "warn").mockImplementation();

      const messages = parser.feed(
        '{"invalid":"message"}\n{"type":"ping","id":"1"}\n'
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({ type: "ping", id: "1" });
      expect(consoleWarn).toHaveBeenCalled();

      consoleWarn.mockRestore();
    });
  });

  describe("Buffer Management", () => {
    it("should clear buffer on reset", () => {
      parser.feed('{"type":"incomplete');
      expect(parser.hasIncompleteData()).toBe(true);

      parser.reset();

      expect(parser.hasIncompleteData()).toBe(false);
      expect(parser.getBuffer()).toBe("");
    });

    it("should preserve buffer across successful parses", () => {
      const messages = parser.feed('{"type":"ping","id":"1"}\n{"incomplete');

      expect(messages).toHaveLength(1);
      expect(parser.getBuffer()).toBe('{"incomplete');
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle message with complex JSON payload", () => {
      const message = {
        type: "invoke",
        id: "req-123",
        method: "test.method",
        paramsJSON: JSON.stringify({ nested: { value: 42, array: [1, 2, 3] } }),
      };

      const messages = parser.feed(JSON.stringify(message) + "\n");

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });

    it("should handle rapid successive messages", () => {
      const input = Array.from({ length: 100 }, (_, i) =>
        JSON.stringify({ type: "ping", id: `${i}` })
      ).join("\n") + "\n";

      const messages = parser.feed(input);

      expect(messages).toHaveLength(100);
      expect(messages[0]).toEqual({ type: "ping", id: "0" });
      expect(messages[99]).toEqual({ type: "ping", id: "99" });
    });

    it("should handle message ending with incomplete message", () => {
      const input =
        '{"type":"ping","id":"1"}\n' +
        '{"type":"pong","id":"1"}\n' +
        '{"type":"ping","id":"2"';

      const messages = parser.feed(input);

      expect(messages).toHaveLength(2);
      expect(parser.hasIncompleteData()).toBe(true);
      expect(parser.getBuffer()).toBe('{"type":"ping","id":"2"');
    });
  });
});
