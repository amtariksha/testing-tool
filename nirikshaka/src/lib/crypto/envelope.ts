import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Minimal envelope encryption (implementation doc D12).
 *
 * Each value is encrypted with a fresh random 256-bit data key (DEK) using
 * AES-256-GCM; the DEK is wrapped with the master key from
 * NIRIKSHAKA_MASTER_KEY and stored inside the envelope, so no key table is
 * needed and master-key rotation only requires re-wrapping DEKs.
 *
 * Format: enc:v1:<b64 wrappedDek>:<b64 iv>:<b64 ciphertext+tag>
 *   wrappedDek = iv(12) || ciphertext(32) || tag(16), AES-256-GCM under master key
 *
 * NOTE: nirikshaka-worker/src/crypto/envelope.ts is an exact copy of this file —
 * keep the two in sync.
 */

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.NIRIKSHAKA_MASTER_KEY);
}

export function isEnvelope(value: string): boolean {
  return value.startsWith(PREFIX);
}

function getMasterKey(): Buffer {
  const raw = process.env.NIRIKSHAKA_MASTER_KEY;
  if (!raw) {
    throw new Error("NIRIKSHAKA_MASTER_KEY is not configured");
  }
  const hexPattern = /^[0-9a-fA-F]{64}$/;
  const key = hexPattern.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      "NIRIKSHAKA_MASTER_KEY must be 32 bytes (64 hex chars or base64)"
    );
  }
  return key;
}

function aesGcmEncrypt(key: Buffer, plaintext: Buffer, aad?: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]);
}

function aesGcmDecrypt(key: Buffer, packed: Buffer, aad?: Buffer): Buffer {
  if (packed.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Envelope payload too short");
  }
  const iv = packed.subarray(0, IV_LENGTH);
  const tag = packed.subarray(packed.length - TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypt a string value. `aad` (e.g. projectId) binds the ciphertext to its
 * context — decryption fails if a ciphertext is moved to another row.
 */
export function encryptString(plaintext: string, aad?: string): string {
  const masterKey = getMasterKey();
  const dek = randomBytes(KEY_LENGTH);
  const aadBuffer = aad ? Buffer.from(aad, "utf8") : undefined;

  const wrappedDek = aesGcmEncrypt(masterKey, dek);
  const payload = aesGcmEncrypt(dek, Buffer.from(plaintext, "utf8"), aadBuffer);

  return `${PREFIX}${wrappedDek.toString("base64")}:${payload
    .subarray(0, IV_LENGTH)
    .toString("base64")}:${payload.subarray(IV_LENGTH).toString("base64")}`;
}

export function decryptString(envelope: string, aad?: string): string {
  if (!isEnvelope(envelope)) {
    throw new Error("Value is not an enc:v1 envelope");
  }
  const parts = envelope.slice(PREFIX.length).split(":");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error("Malformed enc:v1 envelope");
  }
  const masterKey = getMasterKey();
  const wrappedDek = Buffer.from(parts[0], "base64");
  const iv = Buffer.from(parts[1], "base64");
  const ciphertextAndTag = Buffer.from(parts[2], "base64");
  const aadBuffer = aad ? Buffer.from(aad, "utf8") : undefined;

  const dek = aesGcmDecrypt(masterKey, wrappedDek);
  const packed = Buffer.concat([iv, ciphertextAndTag]);
  return aesGcmDecrypt(dek, packed, aadBuffer).toString("utf8");
}

/**
 * Best-effort decrypt for read paths: plaintext (pre-encryption rows) passes
 * through untouched; undecryptable envelopes return a marker instead of
 * throwing so one bad row cannot break a whole listing.
 */
export function tryDecryptString(
  value: string | null,
  aad?: string
): string | null {
  if (value === null || value === "" || !isEnvelope(value)) {
    return value;
  }
  try {
    return decryptString(value, aad);
  } catch (error: unknown) {
    console.error(
      "[envelope] decryption failed:",
      error instanceof Error ? error.message : error
    );
    return "[nirikshaka] decryption failed";
  }
}
