/**
 * AES-256-GCM encrypt/decrypt for LogSource.config credentials at rest.
 * Key: LOG_SOURCE_ENCRYPTION_KEY (32-byte hex, or any string hashed to 32 bytes).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function keyBytes(): Buffer {
  const raw = process.env.LOG_SOURCE_ENCRYPTION_KEY?.trim();
  if (!raw) {
    // Dev fallback — never use in production without setting the env var.
    return createHash("sha256").update("agentox-log-source-dev-key").digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw).digest();
}

export type EncryptedBlob = {
  v: 1;
  iv: string;
  tag: string;
  ct: string;
};

export function encryptSourceConfig(
  config: Record<string, unknown>
): EncryptedBlob {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, keyBytes(), iv);
  const plain = Buffer.from(JSON.stringify(config), "utf8");
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: encrypted.toString("base64"),
  };
}

export function decryptSourceConfig(
  stored: unknown
): Record<string, unknown> {
  if (!stored || typeof stored !== "object") return {};
  const blob = stored as Partial<EncryptedBlob> & Record<string, unknown>;

  // Already plaintext (legacy / test) — return as-is
  if (blob.v !== 1 || typeof blob.iv !== "string" || typeof blob.ct !== "string") {
    return blob as Record<string, unknown>;
  }

  const iv = Buffer.from(blob.iv, "base64");
  const tag = Buffer.from(String(blob.tag ?? ""), "base64");
  const ct = Buffer.from(blob.ct, "base64");
  const decipher = createDecipheriv(ALGO, keyBytes(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as Record<string, unknown>;
}

export function isEncryptedBlob(stored: unknown): boolean {
  if (!stored || typeof stored !== "object") return false;
  const blob = stored as Partial<EncryptedBlob>;
  return blob.v === 1 && typeof blob.iv === "string" && typeof blob.ct === "string";
}
