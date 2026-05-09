import { createHash, createDecipheriv } from 'crypto';

const TOKEN_COOKIE = 'db_token';

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

async function readErrorBody(r: Response): Promise<{ error_summary?: string }> {
  const text = await r.text();
  try { return JSON.parse(text) as { error_summary?: string }; }
  catch { return { error_summary: text }; }
}

async function countFiles(token: string, path: string): Promise<number> {
  const r = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, recursive: false }),
  });
  if (!r.ok) {
    const err = await readErrorBody(r);
    if (err.error_summary?.includes('not_found') || err.error_summary?.includes('path/not_found')) {
      return 0;
    }
    throw new Error(`list_folder failed for "${path}": ${JSON.stringify(err)}`);
  }
  const data = await r.json() as { entries: Array<{ '.tag': string }> };
  return data.entries.filter((e) => e['.tag'] === 'file').length;
}

async function fileExists(token: string, path: string): Promise<boolean> {
  const r = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (r.ok) return true;
  const err = await readErrorBody(r);
  if (err.error_summary?.includes('not_found') || err.error_summary?.includes('path/not_found')) {
    return false;
  }
  throw new Error(`get_metadata failed for "${path}": ${JSON.stringify(err)}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getToken(req.headers['cookie']);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  const { opportunityName } = req.query as { opportunityName?: string };
  if (!opportunityName?.trim()) return res.status(400).json({ error: 'opportunityName required' });

  const safeName = opportunityName.trim().replace(/\//g, '-');
  const root = (process.env.DROPBOX_ROOT_FOLDER ?? '/Current Opportunities').replace(/\/$/, '');
  const oppFolder = `${root}/${safeName}`;

  try {
    const [photos, sketches, measurementsExists, notesExists] = await Promise.all([
      countFiles(token, `${oppFolder}/Photos`),
      countFiles(token, `${oppFolder}/Sketches`),
      fileExists(token, `${oppFolder}/measurements.md`),
      fileExists(token, `${oppFolder}/site-notes.md`),
    ]);

    return res.status(200).json({ photos, sketches, measurementsExists, notesExists });
  } catch (err) {
    console.error('[dropbox/folder-stats]', err);
    return res.status(500).json({ error: 'Failed to get folder stats', detail: String(err) });
  }
}
