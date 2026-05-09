import { createHash, createDecipheriv } from 'crypto';
import type { IncomingMessage } from 'http';

const TOKEN_COOKIE = 'db_token';

export const config = { api: { bodyParser: false } };

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

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function indexOfBuffer(haystack: Buffer, needle: Buffer, start = 0): number {
  for (let i = start; i <= haystack.length - needle.length; i++) {
    if (haystack.subarray(i, i + needle.length).equals(needle)) return i;
  }
  return -1;
}

interface MultipartPart {
  filename?: string;
  contentType?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): Record<string, MultipartPart> {
  const results: Record<string, MultipartPart> = {};
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const nlBoundary = Buffer.from(`\r\n--${boundary}`);
  const headerEndBuf = Buffer.from('\r\n\r\n');

  let pos = indexOfBuffer(body, boundaryBuf, 0);
  if (pos === -1) return results;
  pos += boundaryBuf.length + 2; // skip \r\n after first boundary

  while (pos < body.length) {
    const hEnd = indexOfBuffer(body, headerEndBuf, pos);
    if (hEnd === -1) break;

    const headers = body.subarray(pos, hEnd).toString('utf8');
    const dataStart = hEnd + 4;
    const nextBoundary = indexOfBuffer(body, nlBoundary, dataStart);
    const data = body.subarray(dataStart, nextBoundary === -1 ? body.length : nextBoundary);

    const dispMatch = headers.match(
      /Content-Disposition:[^\r\n]*\bname="([^"]+)"(?:[^\r\n]*\bfilename="([^"]+)")?/i
    );
    const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);

    if (dispMatch) {
      results[dispMatch[1]] = {
        filename: dispMatch[2],
        contentType: ctMatch?.[1]?.trim(),
        data,
      };
    }

    if (nextBoundary === -1) break;
    pos = nextBoundary + nlBoundary.length;
    if (body.subarray(pos, pos + 2).toString() === '--') break;
    pos += 2; // skip \r\n after boundary line
  }

  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = getToken(req.headers['cookie']);
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  const contentType: string = req.headers['content-type'] ?? '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  if (!boundaryMatch) return res.status(400).json({ error: 'Expected multipart/form-data with boundary' });
  const boundary = boundaryMatch[1] ?? boundaryMatch[2];

  const body = await readBody(req as IncomingMessage);
  const parts = parseMultipart(body, boundary);

  const targetPath = parts['targetPath']?.data.toString('utf8').trim();
  const file = parts['file'];

  if (!targetPath) return res.status(400).json({ error: 'Missing targetPath field' });
  if (!file?.data?.length) return res.status(400).json({ error: 'Missing file field' });

  try {
    const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path: targetPath,
          mode: { '.tag': 'overwrite' },
          autorename: false,
          mute: false,
        }),
      },
      body: file.data,
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[dropbox/upload] Dropbox error', r.status, err);
      return res.status(500).json({ error: 'Dropbox upload failed', detail: err });
    }

    const result = await r.json() as { path_display: string; size: number };
    return res.status(200).json({ path: result.path_display, size: result.size });
  } catch (err) {
    console.error('[dropbox/upload]', err);
    return res.status(500).json({ error: 'Upload failed', detail: String(err) });
  }
}
