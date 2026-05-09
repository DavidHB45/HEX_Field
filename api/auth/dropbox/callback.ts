import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const STATE_COOKIE = 'db_state';
const TOKEN_COOKIE = 'db_token';

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

interface StateData { state: string }
interface TokenResponse { access_token: string; refresh_token?: string; expires_in: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code, state, error } = req.query as Record<string, string>;
  const secret = process.env.SESSION_SECRET ?? '';

  if (error) return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  const cookies = parseCookies(req.headers['cookie']);
  if (!cookies[STATE_COOKIE]) return res.redirect('/?auth_error=missing_state');

  let stateData: StateData;
  try { stateData = unsealCookie<StateData>(cookies[STATE_COOKIE], secret); }
  catch { return res.redirect('/?auth_error=invalid_state'); }

  if (stateData.state !== state) return res.redirect('/?auth_error=state_mismatch');

  const appKey = process.env.DROPBOX_APP_KEY ?? '';
  const appSecret = process.env.DROPBOX_APP_SECRET ?? '';
  const redirectUri = process.env.DROPBOX_REDIRECT_URI ?? '';

  const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  if (!tokenRes.ok) {
    console.error('Dropbox token exchange failed:', await tokenRes.text());
    return res.redirect('/?auth_error=token_exchange_failed');
  }

  const tokens: TokenResponse = await tokenRes.json();
  const sealed = sealCookie(
    {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? '',
      expiresAt: Date.now() + tokens.expires_in * 1000,
    },
    secret
  );

  res.setHeader('Set-Cookie', [
    `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${TOKEN_COOKIE}=${sealed}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 24 * 60 * 60}`,
  ]);
  return res.redirect('/');
}
