import { createHash, createDecipheriv } from 'crypto';

const TOKEN_COOKIE = 'at_token';
const BASE_ID = process.env.AIRTABLE_BASE_ID ?? '';
const TABLE = process.env.AIRTABLE_OPPORTUNITIES_TABLE ?? 'Project Opportunities';

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), decodeURIComponent(v.join('='))];
    })
  );
}
function getToken(cookieHeader: string | undefined): string | null {
  const secret = process.env.SESSION_SECRET ?? '';
  const sealed = parseCookies(cookieHeader)[TOKEN_COOKIE];
  if (!sealed) return null;
  try {
    const key = createHash('sha256').update(secret).digest();
    const buf = Buffer.from(sealed, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const data = JSON.parse(
      Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8')
    ) as { accessToken: string; expiresAt: number };
    if (Date.now() > data.expiresAt) return null;
    return data.accessToken;
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getToken(req.headers['cookie']);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  if (!BASE_ID) {
    console.error('[opportunities] AIRTABLE_BASE_ID not set');
    return res.status(500).json({ error: 'Server misconfigured: missing AIRTABLE_BASE_ID' });
  }

  try {
    const params = new URLSearchParams({
      filterByFormula: "NOT(OR({Status}='Closed',{Status}='Lost'))",
      'sort[0][field]': 'Name',
      'sort[0][direction]': 'asc',
    });
    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?${params}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) {
      const body = await r.text();
      console.error('[opportunities] Airtable error', r.status, body);
      return res.status(500).json({ error: 'Airtable request failed', detail: body });
    }
    return res.status(200).json(await r.json());
  } catch (err) {
    console.error('[opportunities]', err);
    return res.status(500).json({ error: 'Failed to fetch opportunities', detail: String(err) });
  }
}
