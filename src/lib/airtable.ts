// Shared types only — no runtime code. API routes are fully self-contained.
export interface AirtableOpportunity {
  id: string;
  fields: {
    Name?: string;
    Client?: string;
    Address?: string;
    Status?: string;
    'Estimated Value'?: string | number;
    'Last Site Visit'?: string;
    'Photos Count'?: number;
    'Dropbox Folder URL'?: string;
    [key: string]: unknown;
  };
}
