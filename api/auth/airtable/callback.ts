import { sealCookie, unsealCookie, parseCookies } from '../../_lib';

const PKCE_COOKIE = 'at_pkce';
const TOKEN_COOKIE = 'at_token';

interface PkceData {
  codeVerifier: string;
  state: string;
}

interface AirtableTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query as Record<string, string>;
  const secret = process.env.SESSION_SECRET ?? '';

  if (error) return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });

  const cookies = parseCookies(req.headers['cookie']);
  const sealedPkce = cookies[PKCE_COOKIE];

  if (!sealedPkce) return res.redirect('/?auth_error=missing_pkce');

  let pkce: PkceData;
  try {
    pkce = unsealCookie<PkceData>(sealedPkce, secret);
  } catch {
    return res.redirect('/?auth_error=invalid_pkce');
  }

  if (pkce.state !== state) return res.redirect('/?auth_error=state_mismatch');

  const clientId = process.env.AIRTABLE_CLIENT_ID ?? '';
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET ?? '';
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI ?? '';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: pkce.codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    console.error('Airtable token exchange failed:', detail);
    return res.redirect('/?auth_error=token_exchange_failed');
  }

  const tokens: AirtableTokenResponse = await tokenRes.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  const sealedToken = sealCookie(
    { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt },
    secret
  );

  res.setHeader('Set-Cookie', [
    `${PKCE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    `${TOKEN_COOKIE}=${sealedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 24 * 60 * 60}`,
  ]);

  return res.redirect('/');
}
