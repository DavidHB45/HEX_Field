# Harris Job Walk — Build Plan

**Project:** Harris Excavation Job Walk Field App
**Owner:** David Harris
**Target:** iPhone + iPad PWA, brand-aligned, Airtable + Dropbox integrated
**Stack:** React + Vite + TypeScript, Vercel hosting, Vercel serverless functions for API proxy
**Repo name:** `harris-job-walk`

---

## 1. Goal

Replace the current paper-and-camera-roll workflow for capturing in-person job walks. Field team opens an existing Project Opportunity from Airtable, captures photos, sketches, measurements, and voice-narrated site notes, and everything syncs to a structured Dropbox folder + back-references the Airtable record.

---

## 2. Scope

### In Scope (v1)
- Airtable OAuth login + read access to **Project Opportunities** table
- Dropbox OAuth login + write access to **Current Opportunities** folder
- Browse/search active opportunities
- Per-opportunity workspace with 4 capture types: Photos, Sketches, Measurements, Voice Notes
- Apple Pencil sketching on engineering paper grid background
- Native Web Speech API transcription, formatted to markdown via Claude API
- GPS + timestamp metadata on photos
- Dropbox folder auto-creation on first capture
- Writeback of `Dropbox Folder URL`, `Last Site Visit`, `Photos Count` to Airtable record
- PWA install support (iOS/iPadOS Safari "Add to Home Screen")

### Out of Scope (v1)
- Offline mode / sync queue
- Multi-user accounts (single David login for now)
- Editing existing photos/sketches after upload
- Generating proposals from captured data (future feature)
- Android support beyond best-effort

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│  iPhone / iPad (Safari PWA)                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │ React Frontend                                      │ │
│  │  - Opportunities List                               │ │
│  │  - Opportunity Workspace (tabs)                     │ │
│  │  - Capture flows (camera, canvas, mic)              │ │
│  └─────────────────┬──────────────────────────────────┘ │
└───────────────────┼─────────────────────────────────────┘
                    │ HTTPS
        ┌───────────┴────────────┐
        │                        │
┌───────▼─────────┐    ┌─────────▼──────────────┐
│ Vercel          │    │ Vercel Serverless API  │
│ Static Hosting  │    │  /api/airtable/*       │
│                 │    │  /api/dropbox/*        │
│                 │    │  /api/format-note      │
└─────────────────┘    └──┬──────┬───────┬──────┘
                          │      │       │
                  ┌───────▼──┐ ┌─▼───┐ ┌─▼─────────────┐
                  │ Airtable │ │Drop │ │ Anthropic API │
                  │   API    │ │ box │ │  (Claude)     │
                  └──────────┘ └─────┘ └───────────────┘
```

**Why a backend proxy:** Airtable + Dropbox + Anthropic API tokens never touch the client. The PWA calls our own API routes; routes hold tokens server-side.

---

## 4. Data Model

### Airtable — Project Opportunities table (additions only)

| Field Name            | Type     | Notes                                    |
|-----------------------|----------|------------------------------------------|
| `Dropbox Folder URL`  | URL      | Set by app on first capture              |
| `Last Site Visit`     | Date     | Auto-set on first capture per visit      |
| `Photos Count`        | Number   | Updated by app after each photo upload   |

### Dropbox — folder structure

```
Current Opportunities/
  └── {Opportunity Name}/
        ├── Photos/
        │     IMG_{timestamp}_{lat}_{lng}.jpg
        ├── Sketches/
        │     sketch_{timestamp}.png
        ├── measurements.md
        └── site-notes.md
```

`measurements.md` and `site-notes.md` are append-only running documents owned by the app.

---

## 5. Tech Stack

| Layer            | Choice                                  | Reason                                                       |
|------------------|-----------------------------------------|--------------------------------------------------------------|
| Framework        | React 18 + Vite + TypeScript            | Fast dev, PWA-friendly, type safety                          |
| Styling          | CSS variables (brand tokens) + minimal CSS-in-JS | Matches brand guidelines exactly, no Tailwind dependency |
| Icons            | lucide-react                            | Already used in prototype                                    |
| Routing          | react-router-dom v6                     | Two-screen app, lightweight                                  |
| State            | React Context + useReducer              | No Redux needed at this scale                                |
| PWA              | vite-plugin-pwa                         | Manifest, service worker, install prompt                     |
| Speech           | Web Speech API (browser-native)         | Free, works on iOS Safari                                    |
| Drawing          | HTML Canvas + Pointer Events            | Native pressure sensitivity for Apple Pencil                 |
| Hosting          | Vercel                                  | Free tier, edge functions, custom domain                     |
| API proxy        | Vercel serverless functions (Node)      | Same repo, zero-config                                       |
| Auth             | OAuth 2.0 (Airtable + Dropbox)          | Tokens stored in Vercel KV or encrypted cookies              |
| Domain           | `field.harrisexcavationco.com`          | Subdomain on existing site                                   |

---

## 6. Build Phases

### Phase 0 — Foundations (½ day)
- Initialize Vite + React + TypeScript project
- Install dependencies, set up brand tokens, font loading
- Configure ESLint, Prettier, Vercel deploy
- Create empty page shells matching prototype routes
- **Deliverable:** Deployable skeleton with Harris branding visible

### Phase 1 — Airtable Integration (1 day)
- OAuth flow: redirect to Airtable, exchange code, store token
- API route: `GET /api/airtable/opportunities` — list active records
- API route: `PATCH /api/airtable/opportunities/:id` — update record
- Schema migration script: add the 3 new fields if not present
- Frontend: Opportunities List screen pulls live data
- **Deliverable:** App lists real opportunities from David's Airtable

### Phase 2 — Dropbox Integration (1 day)
- OAuth flow: same pattern as Airtable
- API route: `POST /api/dropbox/folder` — create folder if missing
- API route: `POST /api/dropbox/upload` — upload binary file
- API route: `POST /api/dropbox/append-md` — append to a markdown file
- Frontend: Overview tab shows live folder structure
- **Deliverable:** Selecting an opportunity creates its Dropbox folder

### Phase 3 — Photos (½ day)
- Camera capture via `<input type="file" capture="environment">`
- Geolocation API call on capture
- EXIF stripping + filename templating
- Upload to `Photos/` subfolder
- Update `Photos Count` and `Last Site Visit` on Airtable record
- **Deliverable:** Photos taken in-app land in Dropbox + count updates

### Phase 4 — Sketches (1 day)
- Canvas component with engineering paper background (port from prototype)
- Pointer Events for Apple Pencil pressure sensitivity
- Color picker, undo, clear
- Export as PNG with grid baked in
- Upload to `Sketches/` subfolder
- **Deliverable:** Drawings sync to Dropbox

### Phase 5 — Measurements (½ day)
- Form for label + decimal feet
- Local list view
- On add, append a row to `measurements.md` in Dropbox
- **Deliverable:** Running measurements doc accumulates in Dropbox

### Phase 6 — Voice Notes (1 day)
- Web Speech API recognition with start/stop
- Live transcript display
- API route: `POST /api/format-note` — calls Anthropic with system prompt to structure transcript as markdown
- Append formatted note (with timestamp header) to `site-notes.md`
- **Deliverable:** Voice → AI-formatted markdown → Dropbox

### Phase 7 — PWA Polish (½ day)
- App manifest with Harris logo + colors
- Service worker for offline shell (no data sync, just cached HTML/CSS)
- "Add to Home Screen" prompt on iOS
- Splash screens for iPhone + iPad sizes
- **Deliverable:** Installs as a home-screen app

### Phase 8 — QA & Hardening (½ day)
- Field-test on actual iPhone + iPad
- Error boundaries + retry on failed uploads
- Token refresh flows
- Loading states + empty states
- **Deliverable:** v1.0 ready for real job walks

**Total estimated effort:** ~6 working days for a solo developer comfortable with React + serverless.

---

## 7. Environment Variables

```
# Airtable
AIRTABLE_CLIENT_ID=
AIRTABLE_CLIENT_SECRET=
AIRTABLE_REDIRECT_URI=
AIRTABLE_BASE_ID=
AIRTABLE_OPPORTUNITIES_TABLE=Project Opportunities

# Dropbox
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REDIRECT_URI=
DROPBOX_ROOT_FOLDER=/Current Opportunities

# Anthropic
ANTHROPIC_API_KEY=

# App
APP_URL=https://field.harrisexcavationco.com
SESSION_SECRET=
```

---

## 8. Success Criteria

- David can complete a full job walk on iPad without leaving the app
- All captured content lands in the correct Dropbox folder within 30 seconds of capture
- The Airtable record reflects the visit (date + folder link + photo count) before David leaves the site
- The app installs to the home screen and launches like a native app
- Brand consistency: every screen matches the Harris Excavation brand guidelines

---

## 9. Risks & Mitigations

| Risk                                              | Mitigation                                                  |
|---------------------------------------------------|-------------------------------------------------------------|
| Spotty cell service at remote sites               | v1.1 will add offline queue; v1.0 fails fast with retry UI  |
| iOS Safari Web Speech API behavior changes        | Fall back to manual text entry if recognition unavailable   |
| Dropbox/Airtable rate limits on bulk photo upload | Sequential uploads with progress UI                         |
| Apple Pencil pressure not detected on all devices | Fall back to fixed line weight                              |
| OAuth token expiry mid-walk                       | Silent refresh on every API call                            |
