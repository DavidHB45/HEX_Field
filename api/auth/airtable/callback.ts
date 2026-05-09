import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PKCE_COOKIE = 'at_pkce';
const TOKEN_COOKIE = 'at_token';

function deriveKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}
function sealCookie(data: unknown, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}
function unsealCookie<T>(sealed: string, secret: string): T {
  const key = deriveKey(secret);
  const buf = Buffer.from(sealed, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  const json = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  return JSON.parse(json) as T;
}
function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}

interface PkceData { codeVerifier: string; state: string }
interface TokenResponse { access_token: string; refresh_token: string; expires_in: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code, state, error } = req.query as Record<string, string>;
  const secret = process.env.SESSION_SECRET ?? '';

  if (error) return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  const cookies = parseCookies(req.headers['cookie']);
  if (!cookies[PKCE_COOKIE]) return res.redirect('/?auth_error=missing_pkce');

  let pkce: PkceData;
  try { pkce = unsealCookie<PkceData>(cookies[PKCE_COOKIE], secret); }
  catch { return res.redirect('/?auth_error=invalid_pkce'); }

  if (pkce.state !== state) return res.redirect('/?auth_error=state_mismatch');

  const clientId = process.env.AIRTABLE_CLIENT_ID ?? '';
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET ?? '';
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI ?? '';

  const tokenRes = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code, redirect_uri: redirectUri, client_id: clientId,
      code_verifier: pkce.codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    console.error('Token exchange failed:', await tokenRes.text());
    return res.redirect('/?auth_error=token_exchange_failed');
  }

  const tokens: TokenResponse = await tokenRes.json();
  const sealed = sealCookie(
    { accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000 },
    secret
  );

  res.setHeader('Set-Cookie', [
    `${PKCE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${TOKEN_COOKIE}=${sealed}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 24 * 60 * 60}`,
  ]);
  return res.redirect('/');
}
