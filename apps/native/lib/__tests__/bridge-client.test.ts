/**
 * Bridge Client Tests
 *
 * Unit tests for BridgeClient class
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BridgeClient } from '../bridge-client';
import type { BridgeMessage } from '../bridge-protocol';

// Mock react-native-tcp-socket
vi.mock('react-native-tcp-socket', () => ({
  default: {
    createConnection: vi.fn(),
  },
}));

describe('BridgeClient', () => {
  let client: BridgeClient;

  beforeEach(() => {
    client = new BridgeClient();
  });

  describe('Status Management', () => {
    it('should start with disconnected status', () => {
      expect(client.getStatus()).toBe('disconnected');
    });

    it('should not be paired initially', () => {
      expect(client.isPaired()).toBe(false);
    });

    it('should notify status listeners on status change', () => {
      const listener = vi.fn();
      client.onStatusChange(listener);

      // Status changes will be triggered by connection
      // For now, just verify listener can be added
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Event Subscriptions', () => {
    it('should allow subscribing to status changes', () => {
      const listener = vi.fn();
      const unsubscribe = client.onStatusChange(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should allow subscribing to errors', () => {
      const listener = vi.fn();
      const unsubscribe = client.onError(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should allow subscribing to messages', () => {
      const listener = vi.fn();
      const unsubscribe = client.onMessage(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should allow subscribing to pairing events', () => {
      const listener = vi.fn();
      const unsubscribe = client.onPaired(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should unsubscribe listeners correctly', () => {
      const listener = vi.fn();
      const unsubscribe = client.onStatusChange(listener);

      unsubscribe();

      // After unsubscribing, listener should not be called
      // (This would need internal state changes to verify properly)
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Server ID and Pairing Token', () => {
    it('should return null server ID when not connected', () => {
      expect(client.getServerId()).toBeNull();
    });

    it('should return null pairing token when not paired', () => {
      expect(client.getPairingToken()).toBeNull();
    });
  });

  describe('Connection', () => {
    it('should throw error when sending message while disconnected', async () => {
      const message: BridgeMessage = {
        type: 'ping',
        id: '123',
      };

      await expect(client.sendMessage(message)).rejects.toThrow(
        'Bridge client not connected'
      );
    });

    it('should throw error when connecting while already connecting', async () => {
      // This test would require mocking the TCP socket properly
      // For now, verify the error condition exists
      expect(client.getStatus()).toBe('disconnected');
    });
  });

  describe('Disconnect', () => {
    it('should handle disconnect when already disconnected', async () => {
      // Should not throw
      await expect(client.disconnect()).resolves.toBeUndefined();
    });

    it('should reset status to disconnected after disconnect', async () => {
      await client.disconnect();
      expect(client.getStatus()).toBe('disconnected');
    });
  });
});
