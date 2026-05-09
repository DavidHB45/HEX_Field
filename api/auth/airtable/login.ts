import { createHash, randomBytes } from 'crypto';
import { sealData } from 'iron-session';

const COOKIE_NAME = 'at_pkce';
const SESSION_SECRET = process.env.SESSION_SECRET ?? '';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.AIRTABLE_CLIENT_ID;
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'Airtable OAuth not configured' });
  }

  // PKCE: Airtable requires it
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  const state = randomBytes(16).toString('hex');

  // Seal the verifier + state in a short-lived cookie so the callback can read them
  const sealed = await sealData(
    { codeVerifier, state },
    { password: SESSION_SECRET, ttl: 600 } // 10 min
  );

  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${sealed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
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
