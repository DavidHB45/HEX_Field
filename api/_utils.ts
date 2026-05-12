import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export const TOKEN_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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
    const data = unsealCookie<TokenData>(sealed, secret);
    if (Date.now() > data.expiresAt) return null;
    return data.accessToken;
  } catch { return null; }
}

/** Returns the full token payload (including refresh token) from a cookie, regardless of expiry. */
export function getTokenData(cookieHeader: string | undefined, cookieName: string): TokenData | null {
  const secret = process.env.SESSION_SECRET ?? '';
  const sealed = parseCookies(cookieHeader)[cookieName];
  if (!sealed) return null;
  try {
    return unsealCookie<TokenData>(sealed, secret);
  } catch { return null; }
}

/** Attempt one silent refresh of an Airtable access token. Returns new TokenData on success. */
export async function refreshAirtableToken(refreshToken: string): Promise<TokenData> {
  const clientId = process.env.AIRTABLE_CLIENT_ID ?? '';
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET ?? '';
  const res = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) throw new Error(`Airtable token refresh failed: ${res.status}`);
  const tokens = await res.json() as { access_token: string; refresh_token?: string; expires_in: number };
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

/** Attempt one silent refresh of a Dropbox access token. Returns new TokenData on success. */
export async function refreshDropboxToken(refreshToken: string): Promise<TokenData> {
  const appKey = process.env.DROPBOX_APP_KEY ?? '';
  const appSecret = process.env.DROPBOX_APP_SECRET ?? '';
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  if (!res.ok) throw new Error(`Dropbox token refresh failed: ${res.status}`);
  const tokens = await res.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (tokens.expires_in ?? TOKEN_MAX_AGE_SECONDS) * 1000,
  };
}
