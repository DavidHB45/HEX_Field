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

async function dbPost(token: string, endpoint: string, body: unknown): Promise<Response> {
  return fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function createFolderIfMissing(token: string, path: string): Promise<void> {
  const r = await dbPost(token, 'files/create_folder_v2', { path, autorename: false });
  if (!r.ok) {
    const err = await r.json() as { error_summary?: string };
    if (!err.error_summary?.startsWith('path/conflict')) {
      throw new Error(`create_folder_v2 failed for "${path}": ${JSON.stringify(err)}`);
    }
  }
}

async function uploadTextIfMissing(token: string, path: string, content: string): Promise<void> {
  const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'add', autorename: false, mute: true }),
    },
    body: content,
  });
  if (!r.ok) {
    const err = await r.json() as { error_summary?: string };
    if (!err.error_summary?.startsWith('path/conflict')) {
      throw new Error(`upload failed for "${path}": ${JSON.stringify(err)}`);
    }
  }
}

async function getOrCreateSharedLink(token: string, path: string): Promise<string> {
  const r = await dbPost(token, 'sharing/create_shared_link_with_settings', {
    path,
    settings: { requested_visibility: { '.tag': 'public' } },
  });
  if (r.ok) {
    const data = await r.json() as { url: string };
    return data.url;
  }
  const err = await r.json() as {
    error_summary?: string;
    error?: { '.tag': string; metadata?: { url: string } };
  };
  if (err.error?.['.tag'] === 'shared_link_already_exists' && err.error.metadata?.url) {
    return err.error.metadata.url;
  }
  // Fall back to listing existing links
  const listR = await dbPost(token, 'sharing/list_shared_links', { path, direct_only: true });
  if (listR.ok) {
    const listData = await listR.json() as { links: Array<{ url: string }> };
    if (listData.links.length > 0) return listData.links[0].url;
  }
  throw new Error(`Could not get or create shared link for "${path}": ${JSON.stringify(err)}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = getToken(req.headers['cookie']);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  const { opportunityName } = req.body as { opportunityName?: string };
  if (!opportunityName?.trim()) return res.status(400).json({ error: 'opportunityName required' });

  const safeName = opportunityName.trim().replace(/\//g, '-');
  const root = (process.env.DROPBOX_ROOT_FOLDER ?? '/Current Opportunities').replace(/\/$/, '');
  const oppFolder = `${root}/${safeName}`;

  try {
    if (root) await createFolderIfMissing(token, root);
    await createFolderIfMissing(token, oppFolder);
    await createFolderIfMissing(token, `${oppFolder}/Photos`);
    await createFolderIfMissing(token, `${oppFolder}/Sketches`);
    await uploadTextIfMissing(
      token,
      `${oppFolder}/measurements.md`,
      `# Measurements — ${safeName}\n\n| Label | Value |\n|-------|-------|\n`
    );
    await uploadTextIfMissing(
      token,
      `${oppFolder}/site-notes.md`,
      `# Site Notes — ${safeName}\n\n`
    );

    const folderUrl = await getOrCreateSharedLink(token, oppFolder);
    return res.status(200).json({ folderUrl, created: true });
  } catch (err) {
    console.error('[dropbox/folder]', err);
    return res.status(500).json({ error: 'Failed to create folder structure', detail: String(err) });
  }
}
