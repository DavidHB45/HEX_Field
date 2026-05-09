import { getTokenFromCookie, airtablePatch } from '../../_lib/airtable';

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? '';
const TABLE = process.env.AIRTABLE_OPPORTUNITIES_TABLE ?? 'Project Opportunities';

// Only these three fields may be written by the app — never site notes, raw data, etc.
const WRITABLE_FIELDS = new Set(['Dropbox Folder URL', 'Last Site Visit', 'Photos Count']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = await getTokenFromCookie(req.headers['cookie']);
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }

  const { id } = req.query as { id: string };
  if (!id) {
    return res.status(400).json({ error: 'Missing record id' });
  }

  const incoming: Record<string, unknown> = req.body?.fields ?? {};

  // Strip any fields not in the whitelist
  const safeFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (WRITABLE_FIELDS.has(key)) {
      safeFields[key] = value;
    }
  }

  if (Object.keys(safeFields).length === 0) {
    return res.status(400).json({ error: 'No writable fields provided' });
  }

  try {
    const encodedTable = encodeURIComponent(TABLE);
    const data = await airtablePatch(token, `/${BASE_ID}/${encodedTable}/${id}`, {
      fields: safeFields,
    });
    return res.status(200).json(data);
  } catch (err) {
    console.error('[api/airtable/opportunities/[id]]', err);
    return res.status(500).json({ error: 'Failed to update opportunity' });
  }
}
