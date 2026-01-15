import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "crypto";

/**
 * Encryption utilities for SSH private keys
 * Uses AES-256-GCM with PBKDF2 key derivation
 */

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  if (key.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters long");
  }
  return key;
}

/**
 * Derive encryption key from master key and salt using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Format: salt:iv:authTag:ciphertext (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
  try {
    const masterKey = getEncryptionKey();

    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create cipher and encrypt
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine salt, IV, auth tag, and ciphertext
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      encrypted,
    ]);

    return combined.toString("base64");
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Decrypt ciphertext using AES-256-GCM
 * Expects format: salt:iv:authTag:ciphertext (base64 encoded)
 */
export function decrypt(ciphertext: string): string {
  try {
    const masterKey = getEncryptionKey();

    // Decode base64 combined string
    const combined = Buffer.from(ciphertext, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive key from master key and salt
    const key = deriveKey(masterKey, salt);

    // Create decipher and decrypt
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
