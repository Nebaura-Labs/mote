/**
 * SSH Tunnel Native Module
 *
 * Provides native SSH tunneling with port forwarding for iOS.
 * Uses NMSSH library for secure, low-latency connections.
 */

import { Platform, NativeModules } from 'react-native';

const { ShellExecutor } = NativeModules;

export interface SSHTunnelResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export interface SSHTunnelStatus {
  connected: boolean;
  authenticated: boolean;
}

export interface SSHTunnelConfig {
  host: string;
  port: number;
  username: string;
  privateKey: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
}

/**
 * Start an SSH tunnel with port forwarding
 *
 * @param config - SSH tunnel configuration
 * @returns Promise with tunnel setup result
 */
export async function startSSHTunnel(config: SSHTunnelConfig): Promise<SSHTunnelResult> {
  if (Platform.OS === 'web') {
    throw new Error('SSH tunneling not supported on web platform');
  }

  if (!ShellExecutor) {
    throw new Error('ShellExecutor native module not found');
  }

  return await ShellExecutor.startPortForwarding(
    config.host,
    config.port,
    config.username,
    config.privateKey,
    config.localPort,
    config.remoteHost,
    config.remotePort
  );
}

/**
 * Stop the active SSH tunnel
 */
export function stopSSHTunnel(): void {
  if (!ShellExecutor) {
    throw new Error('ShellExecutor native module not found');
  }

  ShellExecutor.stopPortForwarding();
}

/**
 * Get the current tunnel status
 */
export function getSSHTunnelStatus(): SSHTunnelStatus {
  if (!ShellExecutor) {
    throw new Error('ShellExecutor native module not found');
  }

  return ShellExecutor.getTunnelStatus();
}

/**
 * Check if SSH tunneling is available on this platform
 */
export function isSSHTunnelAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
