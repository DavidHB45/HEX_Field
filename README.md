# Harris Job Walk

Field capture PWA for Harris Excavation. Opens an Airtable Project Opportunity on-site and syncs photos, sketches, measurements, and voice notes to Dropbox.

## Development

```bash
npm install
npm run dev        # Vite dev server (frontend only — no API routes)
vercel dev         # Full stack with /api routes (recommended)
```

## Deploy

```bash
vercel deploy        # Preview
vercel deploy --prod # Production
```

## Environment Variables

Create a `.env.local` file at the project root (never commit it). Set the same variables in the Vercel project dashboard for preview/production.

```env
# ── Airtable OAuth ──────────────────────────────────────────────
AIRTABLE_CLIENT_ID=
AIRTABLE_CLIENT_SECRET=
# Must match the redirect URI registered in your Airtable OAuth app.
# Local dev: http://localhost:3000/api/auth/airtable/callback
# Production: https://field.harrisexcavationco.com/api/auth/airtable/callback
AIRTABLE_REDIRECT_URI=

# ── Airtable Data ───────────────────────────────────────────────
AIRTABLE_BASE_ID=
# Table name exactly as it appears in Airtable (default: "Project Opportunities")
AIRTABLE_OPPORTUNITIES_TABLE=Project Opportunities

# ── Dropbox OAuth (Phase 2) ──────────────────────────────────────
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REDIRECT_URI=
DROPBOX_ROOT_FOLDER=/Current Opportunities

# ── Anthropic (Phase 6) ──────────────────────────────────────────
ANTHROPIC_API_KEY=

# ── Session Encryption ───────────────────────────────────────────
# Must be at least 32 characters. Generate with: openssl rand -base64 32
SESSION_SECRET=

# ── App ──────────────────────────────────────────────────────────
APP_URL=https://field.harrisexcavationco.com
```

### Setting up Airtable OAuth

1. Go to [airtable.com/create/oauth](https://airtable.com/create/oauth)
2. Create a new OAuth app
3. Set **Redirect URI** to match `AIRTABLE_REDIRECT_URI` above
4. Enable scopes: `data.records:read`, `data.records:write`, `schema.bases:read`
5. Copy the **Client ID** and **Client Secret** into `.env.local`

## Architecture

All Airtable, Dropbox, and Anthropic calls happen in `/api` serverless routes. Tokens are stored in encrypted HTTP-only cookies using `iron-session`. The React frontend never sees raw API tokens.

See `BUILD_PLAN.md` for the full phased build plan.
