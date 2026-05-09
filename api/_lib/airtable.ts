// SERVER-SIDE ONLY — imported by /api routes, never by the React frontend.
import { unsealData } from 'iron-session';

const SESSION_SECRET = process.env.SESSION_SECRET ?? '';
const TOKEN_COOKIE = 'at_token';
const BASE_URL = 'https://api.airtable.com/v0';

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

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

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}

export async function getTokenFromCookie(cookieHeader: string | undefined): Promise<string | null> {
  const cookies = parseCookies(cookieHeader);
  const sealed = cookies[TOKEN_COOKIE];
  if (!sealed) return null;

  try {
    const data = await unsealData<StoredToken>(sealed, { password: SESSION_SECRET });
    // Simple expiry check — token refresh is Phase 8
    if (Date.now() > data.expiresAt) return null;
    return data.accessToken;
  } catch {
    return null;
  }
}

export async function airtableGet(token: string, path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
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
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Airtable PATCH ${path} → ${res.status}: ${detail}`);
  }
  return res.json();
}
