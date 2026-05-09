// SERVER-SIDE ONLY. Flat file — no internal project imports, only Node built-ins.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// ── Cookie crypto (AES-256-GCM, no external deps) ────────────────────────────

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function sealCookie(data: unknown, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function unsealCookie<T>(sealed: string, secret: string): T {
  const key = deriveKey(secret);
  const buf = Buffer.from(sealed, 'base64url');
  if (buf.length < 29) throw new Error('Sealed value too short');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(json) as T;
}

// ── Cookie parsing ────────────────────────────────────────────────────────────

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}

// ── Airtable types ───────────────────────────────────────────────────────────

export interface AirtableOpportunity {
  id: string;
  fields: {
    Name?: string;
    Client?: string;
    Address?: string;
    Status?: string;
    'Estimated Value'?: string | number;
    'Last Site Visit'?: string;
    'Photos Count'?: number;
    'Dropbox Folder URL'?: string;
    [key: string]: unknown;
  };
}

// ── Airtable token helper ─────────────────────────────────────────────────────

const TOKEN_COOKIE = 'at_token';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function getTokenFromCookie(cookieHeader: string | undefined): string | null {
  const secret = process.env.SESSION_SECRET ?? '';
  const cookies = parseCookies(cookieHeader);
  const sealed = cookies[TOKEN_COOKIE];
  if (!sealed) return null;
  try {
    const data = unsealCookie<StoredToken>(sealed, secret);
    if (Date.now() > data.expiresAt) return null;
    return data.accessToken;
  } catch {
    return null;
  }
}

// ── Airtable API helpers ──────────────────────────────────────────────────────

const AIRTABLE_BASE = 'https://api.airtable.com/v0';

export async function airtableGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${AIRTABLE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable GET ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

export async function airtablePatch(
  token: string,
  path: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${AIRTABLE_BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Airtable PATCH ${path} → ${res.status}: ${detail}`);
  }
  return res.json();
}
