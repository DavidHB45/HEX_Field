import { createHash, createDecipheriv } from 'crypto';

const TOKEN_COOKIE = 'db_token';

async function readErrorBody(r: Response): Promise<{ error_summary?: string }> {
  const text = await r.text();
  try { return JSON.parse(text) as { error_summary?: string }; }
  catch { return { error_summary: text }; }
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

interface DropboxEntry {
  '.tag': string;
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
  client_modified?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getToken(req.headers['cookie']);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  const { opportunityName } = req.query as { opportunityName?: string };
  if (!opportunityName?.trim()) return res.status(400).json({ error: 'Missing opportunityName' });

  const safeName = opportunityName.trim().replace(/\//g, '-');
  const root = ('/' + (process.env.DROPBOX_ROOT_FOLDER ?? 'Current Opportunities').replace(/^\/+/, '')).replace(/\/$/, '');
  const folderPath = `${root}/${safeName}/Photos`;

  // List the Photos folder
  let entries: DropboxEntry[] = [];
  try {
    const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: folderPath, limit: 200 }),
    });

    if (!listRes.ok) {
      const err = await readErrorBody(listRes);
      // Folder doesn't exist yet — return empty list
      if (err.error_summary?.includes('not_found')) {
        return res.status(200).json({ photos: [] });
      }
      console.error('[dropbox/photos] list_folder error', listRes.status, err);
      return res.status(500).json({ error: 'Failed to list photos', detail: JSON.stringify(err) });
    }

    const listData = await listRes.json() as { entries: DropboxEntry[] };
    entries = listData.entries.filter(
      (e) => e['.tag'] === 'file' && /\.(jpg|jpeg|png|heic|webp)$/i.test(e.name)
    );
  } catch (err) {
    console.error('[dropbox/photos] list_folder', err);
    return res.status(500).json({ error: 'Failed to list photos', detail: String(err) });
  }

  // Get temporary links in parallel (batches of 10 to avoid overwhelming Dropbox)
  const photos: { filename: string; path: string; url: string; size?: number }[] = [];

  const BATCH = 10;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const r = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ path: entry.path_display }),
        });
        if (!r.ok) throw new Error(`get_temporary_link failed for ${entry.name}`);
        const data = await r.json() as { link: string };
        return { filename: entry.name, path: entry.path_display, url: data.link, size: entry.size };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') photos.push(result.value);
    }
  }

  // Sort newest first by filename (which contains ISO timestamp)
  photos.sort((a, b) => b.filename.localeCompare(a.filename));

  return res.status(200).json({ photos });
}
