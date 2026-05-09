// Re-exports the canonical server-side helper so src/lib/airtable.ts remains a
// valid reference per CLAUDE.md. API routes import from api/_lib/airtable.ts
// directly to avoid cross-directory bundling issues in vercel dev.
export type { AirtableOpportunity } from '../../api/_lib/airtable';
