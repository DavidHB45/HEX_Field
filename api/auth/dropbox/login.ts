import { createHash, randomBytes, createCipheriv } from 'crypto';

const STATE_COOKIE = 'db_state';

function sealCookie(data: unknown, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const appKey = process.env.DROPBOX_APP_KEY;
  const redirectUri = process.env.DROPBOX_REDIRECT_URI;
  const secret = process.env.SESSION_SECRET ?? '';

  if (!appKey || !redirectUri) {
    return res.status(500).json({ error: 'Dropbox OAuth not configured' });
  }

  const state = randomBytes(16).toString('hex');

  res.setHeader('Set-Cookie', [
    `${STATE_COOKIE}=${sealCookie({ state }, secret)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  ]);

  const params = new URLSearchParams({
    client_id: appKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    token_access_type: 'offline',
  });

  return res.redirect(`https://www.dropbox.com/oauth2/authorize?${params}`);
}
