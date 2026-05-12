import { getToken } from './_utils';

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? '';
const TABLE = process.env.AIRTABLE_OPPORTUNITIES_TABLE ?? 'Project Opportunities';
const WRITABLE = new Set(['Dropbox Folder URL', 'Last Site Visit', 'Photos Count']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const token = getToken(req.headers['cookie'], 'at_token');
  if (!token) return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });

  if (!BASE_ID) {
    console.error('[airtable] AIRTABLE_BASE_ID not set');
    return res.status(500).json({ error: 'Server misconfigured: missing AIRTABLE_BASE_ID' });
  }

  const { id } = req.query as { id?: string };

  if (req.method === 'GET') {
    try {
      const params = new URLSearchParams({
        filterByFormula: "{Status}='Lead'",
        'sort[0][field]': 'Opportunity Name',
        'sort[0][direction]': 'asc',
      });
      const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?${params}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const body = await r.text();
        console.error('[airtable] list error', r.status, body);
        return res.status(500).json({ error: 'Airtable request failed', detail: body });
      }
      return res.status(200).json(await r.json());
    } catch (err) {
      console.error('[airtable]', err);
      return res.status(500).json({ error: 'Failed to fetch opportunities', detail: String(err) });
    }
  }

  if (req.method === 'PATCH') {
    if (!id) return res.status(400).json({ error: 'Missing record id' });
    const incoming: Record<string, unknown> = req.body?.fields ?? {};
    const safeFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(incoming)) {
      if (WRITABLE.has(k)) safeFields[k] = v;
    }
    if (!Object.keys(safeFields).length) return res.status(400).json({ error: 'No writable fields' });

    try {
      const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}/${id}`;
      const r = await fetch(url, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: safeFields }),
      });
      if (!r.ok) {
        const body = await r.text();
        console.error('[airtable] update error', r.status, body);
        return res.status(500).json({ error: 'Airtable request failed', detail: body });
      }
      return res.status(200).json(await r.json());
    } catch (err) {
      console.error('[airtable]', err);
      return res.status(500).json({ error: 'Failed to update record', detail: String(err) });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
