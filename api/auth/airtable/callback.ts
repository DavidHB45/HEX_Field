import { unsealData, sealData } from 'iron-session';

const PKCE_COOKIE = 'at_pkce';
const TOKEN_COOKIE = 'at_token';
const SESSION_SECRET = process.env.SESSION_SECRET ?? '';

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

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).json({ error: 'Missing code or state' });
  }

  const cookies = parseCookies(req.headers['cookie']);
  const sealedPkce = cookies[PKCE_COOKIE];

  if (!sealedPkce) {
    return res.status(400).json({ error: 'Missing PKCE cookie — please try signing in again' });
  }

  let pkce: PkceData;
  try {
    pkce = await unsealData<PkceData>(sealedPkce, { password: SESSION_SECRET });
  } catch {
    return res.status(400).json({ error: 'Invalid PKCE cookie' });
  }

  if (pkce.state !== state) {
    return res.status(400).json({ error: 'State mismatch — possible CSRF' });
  }

  const clientId = process.env.AIRTABLE_CLIENT_ID!;
  const clientSecret = process.env.AIRTABLE_CLIENT_SECRET!;
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI!;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: pkce.codeVerifier,
  });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const tokenRes = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text();
    console.error('Airtable token exchange failed:', detail);
    return res.redirect(`/?auth_error=${encodeURIComponent('Token exchange failed')}`);
  }

  const tokens: AirtableTokenResponse = await tokenRes.json();
  const expiresAt = Date.now() + tokens.expires_in * 1000;

  const sealedToken = await sealData(
    { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt },
    { password: SESSION_SECRET, ttl: 0 } // managed via cookie Max-Age
  );

  const maxAge = 60 * 24 * 60 * 60; // 60 days (refresh token lifetime)

  res.setHeader('Set-Cookie', [
    // Clear the PKCE cookie
    `${PKCE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    // Store the sealed token
    `${TOKEN_COOKIE}=${sealedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  ]);

  return res.redirect('/');
}
