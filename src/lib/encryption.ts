import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("ENCRYPTION_KEY env var is not set (must be 64-hex-char / 32-byte value)");
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)");
  return buf;
}

/** Encrypts plaintext → base64 string: `<iv_hex>:<ciphertext_b64>:<tag_hex>` */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${enc.toString("base64")}:${tag.toString("hex")}`;
}

/** Decrypts a value produced by `encrypt`. Returns original plaintext. */
export function decrypt(encoded: string): string {
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");
  const [ivHex, cipherB64, tagHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const ciphertext = Buffer.from(cipherB64, "base64");
  const tag = Buffer.from(tagHex, "hex");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Returns true if a value looks like an encrypted blob (won't throw). */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 3 && parts[0].length === IV_LEN * 2;
}
