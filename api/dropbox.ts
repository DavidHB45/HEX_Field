import type { IncomingMessage } from 'http';
import { getToken } from './_utils';

// Upload requires raw body; disable Vercel's parser globally and parse manually elsewhere.
export const config = { api: { bodyParser: false } };

async function dbPost(token: string, endpoint: string, body: unknown): Promise<Response> {
  return fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readErrorBody(r: Response): Promise<{ error_summary?: string; error?: unknown }> {
  const text = await r.text();
  try { return JSON.parse(text) as { error_summary?: string; error?: unknown }; }
  catch { return { error_summary: text }; }
}

function isNotFoundError(summary?: string): boolean {
  return summary?.includes('not_found') === true;
}

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJsonBody<T>(req: any): Promise<T> {
  const raw = await readRawBody(req as IncomingMessage);
  return JSON.parse(raw.toString('utf8')) as T;
}

async function createFolderIfMissing(token: string, path: string): Promise<void> {
  const r = await dbPost(token, 'files/create_folder_v2', { path, autorename: false });
  if (!r.ok) {
    const err = await readErrorBody(r);
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
    const err = await readErrorBody(r);
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
  const err = await readErrorBody(r) as {
    error_summary?: string;
    error?: { '.tag': string; metadata?: { url: string } };
  };
  if (err.error?.['.tag'] === 'shared_link_already_exists' && err.error.metadata?.url) {
    return err.error.metadata.url;
  }
  const listR = await dbPost(token, 'sharing/list_shared_links', { path, direct_only: true });
  if (listR.ok) {
    const listData = await listR.json() as { links: Array<{ url: string }> };
    if (listData.links.length > 0) return listData.links[0].url;
  }
  throw new Error(`Could not get or create shared link for "${path}": ${JSON.stringify(err)}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFolder(req: any, res: any, token: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { opportunityName } = await readJsonBody<{ opportunityName?: string }>(req);
  if (!opportunityName?.trim()) return res.status(400).json({ error: 'opportunityName required' });

  const safeName = opportunityName.trim().replace(/\//g, '-');
  const root = ('/' + (process.env.DROPBOX_ROOT_FOLDER ?? 'Current Opportunities').replace(/^\/+/, '')).replace(/\/$/, '');
  const oppFolder = `${root}/${safeName}`;

  try {
    if (root) await createFolderIfMissing(token, root);
    await createFolderIfMissing(token, oppFolder);
    await Promise.all([
      createFolderIfMissing(token, `${oppFolder}/Photos`),
      createFolderIfMissing(token, `${oppFolder}/Sketches`),
      uploadTextIfMissing(token, `${oppFolder}/measurements.md`,
        `# Measurements — ${safeName}\n\n| Label | Value |\n|-------|-------|\n`),
      uploadTextIfMissing(token, `${oppFolder}/site-notes.md`,
        `# Site Notes — ${safeName}\n\n`),
    ]);
    const folderUrl = await getOrCreateSharedLink(token, oppFolder);
    return res.status(200).json({ folderUrl, created: true });
  } catch (err) {
    console.error('[dropbox/folder]', err);
    return res.status(500).json({ error: 'Failed to create folder structure', detail: String(err) });
  }
}

async function countFiles(token: string, path: string): Promise<number> {
  const r = await dbPost(token, 'files/list_folder', { path, recursive: false });
  if (!r.ok) {
    const err = await readErrorBody(r);
    if (isNotFoundError(err.error_summary as string | undefined)) return 0;
    throw new Error(`list_folder failed for "${path}": ${JSON.stringify(err)}`);
  }
  const data = await r.json() as { entries: Array<{ '.tag': string }> };
  return data.entries.filter((e) => e['.tag'] === 'file').length;
}

async function fileExists(token: string, path: string): Promise<boolean> {
  const r = await dbPost(token, 'files/get_metadata', { path });
  if (r.ok) return true;
  const err = await readErrorBody(r);
  if (isNotFoundError(err.error_summary as string | undefined)) return false;
  throw new Error(`get_metadata failed for "${path}": ${JSON.stringify(err)}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFolderStats(req: any, res: any, token: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { opportunityName } = req.query as { opportunityName?: string };
  if (!opportunityName?.trim()) return res.status(400).json({ error: 'opportunityName required' });

  const safeName = opportunityName.trim().replace(/\//g, '-');
  const root = ('/' + (process.env.DROPBOX_ROOT_FOLDER ?? 'Current Opportunities').replace(/^\/+/, '')).replace(/\/$/, '');
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

interface DropboxEntry {
  '.tag': string;
  name: string;
  path_lower: string;
  path_display: string;
  size?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePhotos(req: any, res: any, token: string) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { opportunityName } = req.query as { opportunityName?: string };
  if (!opportunityName) return res.status(400).json({ error: 'Missing opportunityName' });

  const root = (process.env.DROPBOX_ROOT_FOLDER ?? '/Current Opportunities').replace(/\/$/, '');
  const folderPath = `${root}/${opportunityName}/Photos`;

  let entries: DropboxEntry[] = [];
  try {
    const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: folderPath, limit: 200 }),
    });
    if (!listRes.ok) {
      const err = await listRes.json() as { error_summary?: string };
      if (err.error_summary?.startsWith('path/not_found')) return res.status(200).json({ photos: [] });
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

  const photos: { filename: string; path: string; url: string; size?: number }[] = [];
  const BATCH = 10;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const r = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  photos.sort((a, b) => b.filename.localeCompare(a.filename));
  return res.status(200).json({ photos });
}

function indexOfBuffer(haystack: Buffer, needle: Buffer, start = 0): number {
  for (let i = start; i <= haystack.length - needle.length; i++) {
    if (haystack.subarray(i, i + needle.length).equals(needle)) return i;
  }
  return -1;
}
interface MultipartPart { filename?: string; contentType?: string; data: Buffer }
function parseMultipart(body: Buffer, boundary: string): Record<string, MultipartPart> {
  const results: Record<string, MultipartPart> = {};
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const nlBoundary = Buffer.from(`\r\n--${boundary}`);
  const headerEndBuf = Buffer.from('\r\n\r\n');

  let pos = indexOfBuffer(body, boundaryBuf, 0);
  if (pos === -1) return results;
  pos += boundaryBuf.length + 2;

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
      results[dispMatch[1]] = { filename: dispMatch[2], contentType: ctMatch?.[1]?.trim(), data };
    }
    if (nextBoundary === -1) break;
    pos = nextBoundary + nlBoundary.length;
    if (body.subarray(pos, pos + 2).toString() === '--') break;
    pos += 2;
  }
  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUpload(req: any, res: any, token: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const contentType: string = req.headers['content-type'] ?? '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/i);
  if (!boundaryMatch) return res.status(400).json({ error: 'Expected multipart/form-data with boundary' });
  const boundary = boundaryMatch[1] ?? boundaryMatch[2];

  const body = await readRawBody(req as IncomingMessage);
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
        'Dropbox-API-Arg': JSON.stringify({ path: targetPath, mode: { '.tag': 'overwrite' }, autorename: false, mute: false }),
      },
      body: file.data,
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[dropbox/upload] error', r.status, err);
      return res.status(500).json({ error: 'Dropbox upload failed', detail: err });
    }
    const result = await r.json() as { path_display: string; size: number };
    return res.status(200).json({ path: result.path_display, size: result.size });
  } catch (err) {
    console.error('[dropbox/upload]', err);
    return res.status(500).json({ error: 'Upload failed', detail: String(err) });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFile(req: any, res: any, token: string) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  const { path } = req.query as { path?: string };
  if (!path) return res.status(400).json({ error: 'Missing path query parameter' });

  try {
    const r = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[dropbox/file] delete error', r.status, err);
      return res.status(500).json({ error: 'Dropbox delete failed', detail: err });
    }
    return res.status(200).json({ deleted: true });
  } catch (err) {
    console.error('[dropbox/file]', err);
    return res.status(500).json({ error: 'Delete failed', detail: String(err) });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAppendMd(req: any, res: any, token: string) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { filePath, content } = await readJsonBody<{ filePath?: string; content?: string }>(req);
  if (!filePath?.trim()) return res.status(400).json({ error: 'filePath required' });
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });

  try {
    const downloadRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: filePath }) },
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
        'Dropbox-API-Arg': JSON.stringify({ path: filePath, mode: { '.tag': 'overwrite' }, autorename: false, mute: true }),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const token = getToken(req.headers['cookie'], 'db_token');
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  const { action } = req.query as { action?: string };

  switch (action) {
    case 'folder':       return handleFolder(req, res, token);
    case 'folder-stats': return handleFolderStats(req, res, token);
    case 'photos':       return handlePhotos(req, res, token);
    case 'upload':       return handleUpload(req, res, token);
    case 'file':         return handleFile(req, res, token);
    case 'append-md':    return handleAppendMd(req, res, token);
    default:             return res.status(404).json({ error: 'Unknown dropbox action' });
  }
}
