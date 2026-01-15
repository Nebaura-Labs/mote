/**
 * SSH Tunnel Manager
 *
 * Manages SSH connection and port forwarding to clawd.bot Gateway.
 * Forwards remote port 18790 (Bridge protocol) to local port.
 * Uses native SSH command for full port forwarding support.
 */

import { BRIDGE_PORT } from './bridge-protocol';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { startSSHTunnel, stopSSHTunnel, getSSHTunnelStatus } from '../modules/ShellExecutor';

export type SSHAuthMethod = 'password' | 'key';

export interface SSHTunnelConfig {
  host: string;
  port: number;
  username: string;
  authMethod: SSHAuthMethod;
  // For password auth
  password?: string;
  // For key auth
  privateKeyPath?: string;
}

export type SSHTunnelStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface SSHTunnelError {
  code: string;
  message: string;
  details?: unknown;
}

export class SSHTunnel {
  private config: SSHTunnelConfig | null = null;
  private localPort: number = 0;
  private status: SSHTunnelStatus = 'disconnected';
  private statusListeners: Set<(status: SSHTunnelStatus) => void> = new Set();
  private errorListeners: Set<(error: SSHTunnelError) => void> = new Set();

  // SSH process tracking
  private sshProcessId: number | null = null;
  private controlSocketPath: string | null = null;

  /**
   * Connect SSH tunnel and forward remote port 18790 to local port
   */
  async connect(config: SSHTunnelConfig): Promise<number> {
    if (this.status === 'connecting' || this.status === 'connected') {
      throw new Error('SSH tunnel already connected or connecting');
    }

    this.config = config;
    this.updateStatus('connecting');

    try {
      // Validate config
      this.validateConfig(config);

      // Find available local port
      this.localPort = await this.findAvailableLocalPort();

      // Create control socket path for SSH connection management
      this.controlSocketPath = `${FileSystem.cacheDirectory}ssh-control-${Date.now()}`;

      // Read private key from file
      const privateKey = await this.readPrivateKey(config.privateKeyPath!);

      // Start native SSH tunnel with port forwarding
      const result = await startSSHTunnel({
        host: config.host,
        port: config.port,
        username: config.username,
        privateKey: privateKey,
        localPort: this.localPort,
        remoteHost: 'localhost',
        remotePort: BRIDGE_PORT,
      });

      if (!result.success) {
        throw new Error(result.error || result.stderr || 'SSH tunnel failed');
      }

      this.updateStatus('connected');
      console.log(`[SSHTunnel] Port forwarding active: localhost:${this.localPort} -> ${config.host}:${BRIDGE_PORT}`);

      return this.localPort;
    } catch (error) {
      const sshError: SSHTunnelError = {
        code: 'SSH_CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown SSH error',
        details: error,
      };

      this.updateStatus('error');
      this.notifyError(sshError);

      throw sshError;
    }
  }

  /**
   * Disconnect SSH tunnel and stop port forwarding
   */
  async disconnect(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    console.log('[SSHTunnel] Disconnecting...');

    try {
      // Stop native SSH tunnel
      stopSSHTunnel();

      // Cleanup control socket
      if (this.controlSocketPath) {
        const socketInfo = await FileSystem.getInfoAsync(this.controlSocketPath);
        if (socketInfo.exists) {
          await FileSystem.deleteAsync(this.controlSocketPath);
        }
      }

      this.sshProcessId = null;
      this.controlSocketPath = null;
      this.localPort = 0;
      this.config = null;
      this.updateStatus('disconnected');

      console.log('[SSHTunnel] Disconnected');
    } catch (error) {
      console.error('[SSHTunnel] Error during disconnect:', error);

      // Force disconnected state even if disconnect fails
      this.sshProcessId = null;
      this.controlSocketPath = null;
      this.localPort = 0;
      this.config = null;
      this.updateStatus('disconnected');
    }
  }

  /**
   * Get current tunnel status
   */
  getStatus(): SSHTunnelStatus {
    return this.status;
  }

  /**
   * Get local port (only valid when connected)
   */
  getLocalPort(): number {
    return this.localPort;
  }

  /**
   * Check if tunnel is currently connected
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: (status: SSHTunnelStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Subscribe to errors
   */
  onError(listener: (error: SSHTunnelError) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Validate SSH config (private)
   */
  private validateConfig(config: SSHTunnelConfig): void {
    if (config.authMethod === 'password' && !config.password) {
      throw new Error('Password is required for password authentication');
    }

    if (config.authMethod === 'key' && !config.privateKeyPath) {
      throw new Error('Private key path is required for key authentication');
    }
  }

  /**
   * Execute SSH command with port forwarding (private)
   */
  private async executeSSHCommand(): Promise<void> {
    if (!this.config) {
      throw new Error('No SSH config');
    }

    const { host, port, username, authMethod } = this.config;

    // Build SSH command with port forwarding
    // -L localPort:localhost:remotePort - Local port forwarding
    // -N - Don't execute remote command (just forward ports)
    // -f - Go to background (daemon mode)
    // -o StrictHostKeyChecking=no - Auto-accept host key (for easier UX)
    // -o ServerAliveInterval=30 - Send keepalive every 30s
    // -S controlSocket - Control socket for connection management

    let sshCommand: string;

    if (authMethod === 'password') {
      // Password authentication
      // Note: We'll need to handle this differently on iOS vs Android
      // iOS doesn't have sshpass, so we might need an alternative approach

      if (Platform.OS === 'ios') {
        throw new Error(
          'Password authentication not yet supported on iOS. Please use SSH key authentication.'
        );
      }

      // Android: Use expect-style password input
      // This is a simplified approach - production would need proper password handling
      sshCommand = `ssh -p ${port} -L ${this.localPort}:localhost:${BRIDGE_PORT} -N -f -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -S "${this.controlSocketPath}" ${username}@${host}`;

      // TODO: Implement password input handling
      // This might require a native module or react-native-ssh library
      console.warn('[SSHTunnel] Password auth implementation incomplete');

    } else {
      // Key authentication
      const keyPath = this.config.privateKeyPath!;

      sshCommand = `ssh -i "${keyPath}" -p ${port} -L ${this.localPort}:localhost:${BRIDGE_PORT} -N -f -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -S "${this.controlSocketPath}" ${username}@${host}`;
    }

    console.log('[SSHTunnel] Executing SSH command (credentials hidden)');

    // Execute SSH command
    // Note: This requires a way to execute shell commands from React Native
    // We'll need to use a native module or library for this

    try {
      // Placeholder: Actual implementation needs native shell execution
      // Options:
      // 1. Use react-native-ssh-sftp's exec (if available)
      // 2. Create custom native module
      // 3. Use react-native-shell or similar library

      await this.executeShellCommand(sshCommand);

      // Give SSH a moment to establish the tunnel
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify tunnel is active by checking if we can connect to local port
      await this.verifyTunnelActive();

    } catch (error) {
      throw new Error(
        `Failed to execute SSH command: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute shell command (private)
   */
  private async executeShellCommand(command: string): Promise<void> {
    console.log('[SSHTunnel] Executing SSH command (credentials redacted)');

    try {
      const result = await executeShellCommand(command, 10000); // 10 second timeout

      if (result.exitCode !== 0) {
        throw new Error(
          `SSH command failed with exit code ${result.exitCode}: ${result.stderr}`
        );
      }

      if (result.stderr) {
        console.warn('[SSHTunnel] SSH stderr:', result.stderr);
      }

      console.log('[SSHTunnel] SSH command executed successfully');
    } catch (error) {
      throw new Error(
        `Failed to execute SSH command: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Kill SSH process using control socket (private)
   */
  private async killSSHProcess(): Promise<void> {
    if (!this.controlSocketPath) {
      return;
    }

    const killCommand = `ssh -S "${this.controlSocketPath}" -O exit dummy 2>/dev/null || true`;

    try {
      await this.executeShellCommand(killCommand);
    } catch (error) {
      console.error('[SSHTunnel] Error killing SSH process:', error);
    }
  }

  /**
   * Verify tunnel is active by checking local port (private)
   */
  private async verifyTunnelActive(): Promise<void> {
    // TODO: Implement port connectivity check
    // Could use react-native-tcp-socket to test connection to localhost:localPort
    console.log('[SSHTunnel] Tunnel verification pending implementation');
  }

  /**
   * Read private key from file (private)
   */
  private async readPrivateKey(keyPath: string): Promise<string> {
    try {
      const keyContent = await FileSystem.readAsStringAsync(keyPath);
      return keyContent;
    } catch (error) {
      throw new Error(
        `Failed to read private key from ${keyPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find available local port (private)
   */
  private async findAvailableLocalPort(): Promise<number> {
    // Use ephemeral port range (49152-65535)
    const basePort = 50000;
    const randomOffset = Math.floor(Math.random() * 1000);

    // TODO: Implement proper port availability checking
    // For now, just return a random port in the ephemeral range
    return basePort + randomOffset;
  }

  /**
   * Update status and notify listeners (private)
   */
  private updateStatus(status: SSHTunnelStatus): void {
    this.status = status;
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('[SSHTunnel] Error in status listener:', error);
      }
    });
  }

  /**
   * Notify error listeners (private)
   */
  private notifyError(error: SSHTunnelError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('[SSHTunnel] Error in error listener:', err);
      }
    });
  }
}

/**
 * Create a new SSH tunnel instance
 */
export function createSSHTunnel(): SSHTunnel {
  return new SSHTunnel();
}
