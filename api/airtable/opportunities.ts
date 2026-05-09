import { getTokenFromCookie, airtableGet } from '../_lib/airtable';

const BASE_ID = process.env.AIRTABLE_BASE_ID ?? '';
const TABLE = process.env.AIRTABLE_OPPORTUNITIES_TABLE ?? 'Project Opportunities';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = await getTokenFromCookie(req.headers['cookie']);
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated', code: 'UNAUTHENTICATED' });
  }

  try {
    const params = new URLSearchParams({
      // Exclude closed/lost records
      filterByFormula: "NOT(OR({Status}='Closed',{Status}='Lost'))",
      'sort[0][field]': 'Name',
      'sort[0][direction]': 'asc',
    });

    const encodedTable = encodeURIComponent(TABLE);
    const data = await airtableGet(token, `/${BASE_ID}/${encodedTable}?${params}`);

    return res.status(200).json(data);
  } catch (err) {
    console.error('[api/airtable/opportunities]', err);
    return res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
}
