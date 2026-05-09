// Type-only re-export so src/lib/airtable.ts remains a valid reference per CLAUDE.md.
// Runtime code lives in api/_lib/airtable.ts (server-side only).
export type { AirtableOpportunity } from '../../api/_lib/airtable';
