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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = getToken(req.headers['cookie']);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  const { filePath, content } = req.body as { filePath?: string; content?: string };
  if (!filePath?.trim()) return res.status(400).json({ error: 'filePath required' });
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });

  try {
    // Download existing file content (if it exists)
    const downloadRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
      },
    });

    let existing = '';
    if (downloadRes.ok) {
      existing = await downloadRes.text();
    } else {
      const err = await downloadRes.json() as { error_summary?: string };
      if (!err.error_summary?.includes('not_found')) {
        throw new Error(`Dropbox download failed: ${JSON.stringify(err)}`);
      }
    }

    const separator = existing && !existing.endsWith('\n') ? '\n' : '';
    const updated = existing + separator + content;

    const uploadRes = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: filePath,
          mode: { '.tag': 'overwrite' },
          autorename: false,
          mute: true,
        }),
      },
      body: updated,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error('[dropbox/append-md] upload error', uploadRes.status, err);
      return res.status(500).json({ error: 'Dropbox upload failed', detail: err });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[dropbox/append-md]', err);
    return res.status(500).json({ error: 'Append failed', detail: String(err) });
  }
}
