import { createHash, randomBytes } from 'crypto';
import { parseCookies, sealCookie, unsealCookie, TOKEN_MAX_AGE_SECONDS } from './_utils';

const AT_PKCE = 'at_pkce';
const AT_TOKEN = 'at_token';
const DB_STATE = 'db_state';
const DB_TOKEN = 'db_token';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function airtableLogin(req: any, res: any) {
  const clientId = process.env.AIRTABLE_CLIENT_ID;
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI;
  const secret = process.env.SESSION_SECRET ?? '';
  if (!clientId || !redirectUri) return res.status(500).json({ error: 'Airtable OAuth not configured' });

  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = randomBytes(16).toString('hex');

  res.setHeader('Set-Cookie', [
    `${AT_PKCE}=${sealCookie({ codeVerifier, state }, secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ]);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'data.records:read data.records:write schema.bases:read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return res.redirect(`https://airtable.com/oauth2/v1/authorize?${params}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function airtableCallback(req: any, res: any) {
  const { code, state, error } = req.query as Record<string, string>;
  const secret = process.env.SESSION_SECRET ?? '';

  if (error) return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  const cookies = parseCookies(req.headers['cookie']);
  if (!cookies[AT_PKCE]) return res.redirect('/?auth_error=missing_pkce');

  let pkce: { codeVerifier: string; state: string };
  try { pkce = unsealCookie(cookies[AT_PKCE], secret); }
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
    console.error('Airtable token exchange failed:', await tokenRes.text());
    return res.redirect('/?auth_error=token_exchange_failed');
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in: number };
  const sealed = sealCookie(
    { accessToken: tokens.access_token, refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000 },
    secret
  );
  res.setHeader('Set-Cookie', [
    `${AT_PKCE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${AT_TOKEN}=${sealed}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TOKEN_MAX_AGE_SECONDS}`,
  ]);
  return res.redirect('/');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dropboxLogin(req: any, res: any) {
  const appKey = process.env.DROPBOX_APP_KEY;
  const redirectUri = process.env.DROPBOX_REDIRECT_URI;
  const secret = process.env.SESSION_SECRET ?? '';
  if (!appKey || !redirectUri) return res.status(500).json({ error: 'Dropbox OAuth not configured' });

  const state = randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', [
    `${DB_STATE}=${sealCookie({ state }, secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ]);

  const params = new URLSearchParams({
    client_id: appKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    token_access_type: 'offline',
    scope: 'files.content.write files.content.read sharing.write',
  });
  return res.redirect(`https://www.dropbox.com/oauth2/authorize?${params}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dropboxCallback(req: any, res: any) {
  const { code, state, error } = req.query as Record<string, string>;
  const secret = process.env.SESSION_SECRET ?? '';

  if (error) return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  const cookies = parseCookies(req.headers['cookie']);
  if (!cookies[DB_STATE]) return res.redirect('/?auth_error=missing_state');

  let stateData: { state: string };
  try { stateData = unsealCookie(cookies[DB_STATE], secret); }
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
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
  });

  if (!tokenRes.ok) {
    console.error('Dropbox token exchange failed:', await tokenRes.text());
    return res.redirect('/?auth_error=token_exchange_failed');
  }

  const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number };
  const sealed = sealCookie(
    { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? '',
      expiresAt: Date.now() + tokens.expires_in * 1000 },
    secret
  );
  res.setHeader('Set-Cookie', [
    `${DB_STATE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    `${DB_TOKEN}=${sealed}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TOKEN_MAX_AGE_SECONDS}`,
  ]);
  return res.redirect('/');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { provider, action } = req.query as Record<string, string>;

  if (provider === 'airtable') {
    if (action === 'login') return airtableLogin(req, res);
    if (action === 'callback') return airtableCallback(req, res);
  }
  if (provider === 'dropbox') {
    if (action === 'login') return dropboxLogin(req, res);
    if (action === 'callback') return dropboxCallback(req, res);
  }

  return res.status(404).json({ error: 'Unknown auth route' });
}
