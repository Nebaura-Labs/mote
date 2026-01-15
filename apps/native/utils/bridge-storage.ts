/**
 * Bridge Storage
 *
 * Secure storage for Bridge connection credentials and configuration
 * Uses expo-secure-store (iOS Keychain / Android Keystore)
 */

import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";

// ============================================================================
// Storage Keys
// ============================================================================

const KEYS = {
  SSH_CONFIG: "bridge_ssh_config",
  PAIRING_TOKEN: "bridge_pairing_token",
  IDENTITY_FILE_PATH: "bridge_identity_file_path",
  SERVER_ID: "bridge_server_id",
} as const;

// ============================================================================
// Types
// ============================================================================

export type SSHAuthMethod = 'password' | 'key';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  authMethod: SSHAuthMethod;
  // For password auth
  password?: string;
  // For key auth
  identityFilePath?: string;
  // Gateway paths
  projectRoot: string;
  cliPath: string;
}

// ============================================================================
// SSH Configuration
// ============================================================================

/**
 * Save SSH configuration
 */
export async function saveSSHConfig(config: SSHConfig): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEYS.SSH_CONFIG, JSON.stringify(config));
  } catch (error) {
    console.error("[BridgeStorage] Failed to save SSH config:", error);
    throw new Error("Failed to save SSH configuration");
  }
}

/**
 * Get SSH configuration
 */
export async function getSSHConfig(): Promise<SSHConfig | null> {
  try {
    const json = await SecureStore.getItemAsync(KEYS.SSH_CONFIG);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error("[BridgeStorage] Failed to get SSH config:", error);
    return null;
  }
}

/**
 * Delete SSH configuration
 */
export async function deleteSSHConfig(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEYS.SSH_CONFIG);
  } catch (error) {
    console.error("[BridgeStorage] Failed to delete SSH config:", error);
  }
}

// ============================================================================
// Pairing Token
// ============================================================================

/**
 * Save pairing token (from BridgePairOk message)
 */
export async function savePairingToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEYS.PAIRING_TOKEN, token);
  } catch (error) {
    console.error("[BridgeStorage] Failed to save pairing token:", error);
    throw new Error("Failed to save pairing token");
  }
}

/**
 * Get pairing token
 */
export async function getPairingToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS.PAIRING_TOKEN);
  } catch (error) {
    console.error("[BridgeStorage] Failed to get pairing token:", error);
    return null;
  }
}

/**
 * Delete pairing token
 */
export async function deletePairingToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEYS.PAIRING_TOKEN);
  } catch (error) {
    console.error("[BridgeStorage] Failed to delete pairing token:", error);
  }
}

// ============================================================================
// Server ID
// ============================================================================

/**
 * Save server ID (from BridgeHelloOk message)
 */
export async function saveServerId(serverId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEYS.SERVER_ID, serverId);
  } catch (error) {
    console.error("[BridgeStorage] Failed to save server ID:", error);
    throw new Error("Failed to save server ID");
  }
}

/**
 * Get server ID
 */
export async function getServerId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS.SERVER_ID);
  } catch (error) {
    console.error("[BridgeStorage] Failed to get server ID:", error);
    return null;
  }
}

/**
 * Delete server ID
 */
export async function deleteServerId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEYS.SERVER_ID);
  } catch (error) {
    console.error("[BridgeStorage] Failed to delete server ID:", error);
  }
}

// ============================================================================
// SSH Identity File
// ============================================================================

/**
 * Get secure directory for SSH keys
 */
function getSecureSSHDirectory(): string {
  return `${FileSystem.documentDirectory}ssh_keys/`;
}

/**
 * Get secure path for identity file
 */
function getSecureIdentityFilePath(): string {
  return `${getSecureSSHDirectory()}id_rsa`;
}

/**
 * Save identity file securely
 * Copies the file content to app-specific secure directory
 */
export async function saveIdentityFile(sourceUri: string): Promise<string> {
  try {
    const secureDir = getSecureSSHDirectory();
    const securePath = getSecureIdentityFilePath();

    // Create secure directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(secureDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(secureDir, { intermediates: true });
    }

    // Copy identity file to secure location
    await FileSystem.copyAsync({
      from: sourceUri,
      to: securePath,
    });

    // Store the secure path
    await SecureStore.setItemAsync(KEYS.IDENTITY_FILE_PATH, securePath);

    return securePath;
  } catch (error) {
    console.error("[BridgeStorage] Failed to save identity file:", error);
    throw new Error("Failed to save identity file");
  }
}

/**
 * Save pasted SSH key content
 * Writes the pasted key content directly to secure storage
 */
export async function savePastedIdentityKey(keyContent: string): Promise<string> {
  try {
    const secureDir = getSecureSSHDirectory();
    const securePath = getSecureIdentityFilePath();

    // Create secure directory if it doesn't exist
    const dirInfo = await FileSystem.getInfoAsync(secureDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(secureDir, { intermediates: true });
    }

    // Write key content to secure location
    await FileSystem.writeAsStringAsync(securePath, keyContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    // Store the secure path
    await SecureStore.setItemAsync(KEYS.IDENTITY_FILE_PATH, securePath);

    return securePath;
  } catch (error) {
    console.error("[BridgeStorage] Failed to save pasted identity key:", error);
    throw new Error("Failed to save pasted identity key");
  }
}

/**
 * Get identity file path
 */
export async function getIdentityFilePath(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEYS.IDENTITY_FILE_PATH);
  } catch (error) {
    console.error("[BridgeStorage] Failed to get identity file path:", error);
    return null;
  }
}

/**
 * Read identity file content
 */
export async function readIdentityFile(): Promise<string | null> {
  try {
    const path = await getIdentityFilePath();
    if (!path) {
      return null;
    }

    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) {
      console.warn("[BridgeStorage] Identity file does not exist:", path);
      return null;
    }

    const content = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return content;
  } catch (error) {
    console.error("[BridgeStorage] Failed to read identity file:", error);
    return null;
  }
}

/**
 * Delete identity file
 */
export async function deleteIdentityFile(): Promise<void> {
  try {
    const path = await getIdentityFilePath();
    if (path) {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path);
      }
    }
    await SecureStore.deleteItemAsync(KEYS.IDENTITY_FILE_PATH);
  } catch (error) {
    console.error("[BridgeStorage] Failed to delete identity file:", error);
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Clear all bridge data (logout/reset)
 */
export async function clearAllBridgeData(): Promise<void> {
  await Promise.all([
    deleteSSHConfig(),
    deletePairingToken(),
    deleteServerId(),
    deleteIdentityFile(),
  ]);
}

/**
 * Check if bridge is configured (has SSH config and identity file)
 */
export async function isBridgeConfigured(): Promise<boolean> {
  const [config, identityPath] = await Promise.all([getSSHConfig(), getIdentityFilePath()]);

  return config !== null && identityPath !== null;
}

/**
 * Check if bridge is paired (has pairing token)
 */
export async function isBridgePaired(): Promise<boolean> {
  const token = await getPairingToken();
  return token !== null;
}

// ============================================================================
// API Sync
// ============================================================================

/**
 * Sync SSH configuration to web API
 * This uploads the SSH config to the database so the web server can establish SSH tunnels
 */
export async function syncSSHConfigToAPI(): Promise<void> {
  try {
    // Get SSH config from local storage
    const config = await getSSHConfig();
    if (!config) {
      throw new Error("No SSH configuration found to sync");
    }

    // Read private key content
    let privateKey: string;
    if (config.authMethod === 'key') {
      const keyContent = await readIdentityFile();
      if (!keyContent) {
        throw new Error("Private key file not found");
      }
      privateKey = keyContent;
    } else {
      // For password auth, we can't use it with WebSocket proxy
      throw new Error("Password authentication is not supported with WebSocket proxy. Please use key authentication.");
    }

    // Use oRPC client for API call
    const { client } = await import('@/utils/orpc');
    const result = await client.gateway.saveConfig({
      sshHost: config.host,
      sshPort: config.port,
      sshUsername: config.username,
      sshPrivateKey: privateKey,
      projectRoot: config.projectRoot,
      cliPath: config.cliPath,
    });

    console.log('[BridgeStorage] SSH config synced to API:', result.message);

  } catch (error) {
    console.error("[BridgeStorage] Failed to sync SSH config to API:", error);
    throw error;
  }
}

/**
 * Test SSH connection and gateway port connectivity
 * This tests if the SSH credentials work and if port 18790 is reachable
 */
export async function testSSHConnection(): Promise<{
  success: boolean;
  message: string;
  details?: string;
}> {
  try {
    console.log('[BridgeStorage] Testing SSH connection...');

    // Use oRPC client for API call
    const { client } = await import('@/utils/orpc');
    const result = await client.gateway.testConnection();

    console.log('[BridgeStorage] SSH test result:', result);
    return result;

  } catch (error) {
    console.error("[BridgeStorage] Failed to test SSH connection:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to test connection',
    };
  }
}
