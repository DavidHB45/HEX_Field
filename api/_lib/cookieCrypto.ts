// Cookie encryption using Node.js built-in crypto only (AES-256-GCM).
// No external dependencies — avoids ESM/CJS compatibility issues with iron-session.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest(); // 32 bytes
}

export function sealCookie(data: unknown, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16 bytes
  // Layout: iv(12) + tag(16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function unsealCookie<T>(sealed: string, secret: string): T {
  const key = deriveKey(secret);
  const buf = Buffer.from(sealed, 'base64url');
  if (buf.length < 29) throw new Error('Token too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}
