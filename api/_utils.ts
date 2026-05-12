import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export const TOKEN_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function sealCookie(data: unknown, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

export function unsealCookie<T>(sealed: string, secret: string): T {
  const key = deriveKey(secret);
  const buf = Buffer.from(sealed, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  return JSON.parse(json) as T;
}

export function getToken(cookieHeader: string | undefined, cookieName: string): string | null {
  const secret = process.env.SESSION_SECRET ?? '';
  const sealed = parseCookies(cookieHeader)[cookieName];
  if (!sealed) return null;
  try {
    const data = unsealCookie<{ accessToken: string; expiresAt: number }>(sealed, secret);
    if (Date.now() > data.expiresAt) return null;
    return data.accessToken;
  } catch { return null; }
}
