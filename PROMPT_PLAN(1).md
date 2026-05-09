# Claude Code Prompt Plan — Harris Job Walk

A sequenced set of prompts to feed Claude Code, one per build phase. Each prompt is self-contained and assumes Claude Code has already loaded `CLAUDE.md`, `BUILD_PLAN.md`, the prototype file, and the brand doc.

## How to Use

1. Create a fresh repo: `mkdir harris-job-walk && cd harris-job-walk && git init`
2. Drop `CLAUDE.md`, `BUILD_PLAN.md`, the prototype `.jsx`, and the Harris Excavation brand `.md` into the repo:
   ```
   /CLAUDE.md
   /BUILD_PLAN.md
   /docs/BRAND.md
   /prototype/harris-job-walk-app.jsx
   ```
3. Run `claude` (Claude Code CLI) from the repo root.
4. Paste prompts in order. Wait for each phase to complete + verify before moving on.
5. After each phase: `git add -A && git commit -m "phase N: ..."` and deploy to a Vercel preview URL for testing.

---

## Prompt 0 — Kickoff & Project Init

```
Read CLAUDE.md, BUILD_PLAN.md, docs/BRAND.md, and prototype/harris-job-walk-app.jsx. Confirm you understand the project scope, brand requirements, architecture, and which phase comes first.

Then execute Phase 0 (Foundations) from BUILD_PLAN.md:

1. Initialize a Vite + React + TypeScript project in the current directory.
2. Install dependencies: react-router-dom, lucide-react, vite-plugin-pwa.
3. Create src/theme.ts exporting the brand color tokens (object named C) and a FontImports component (port from the prototype) that loads Norwester + Inter.
4. Set up the folder structure:
   - src/components/
   - src/pages/
   - src/lib/         (frontend API clients that call /api/*)
   - src/hooks/
   - api/             (Vercel serverless functions, currently empty)
   - docs/CHANGELOG.md
5. Create a minimal App.tsx with react-router-dom that has two routes: "/" (Opportunities List placeholder) and "/opportunity/:id" (Opportunity Detail placeholder). Both should render a styled AppHeader matching the prototype.
6. Add a vercel.json with the rewrites and headers needed for SPA routing + secure cookies.
7. Configure ESLint + Prettier with sensible defaults.
8. Add npm scripts per CLAUDE.md.

Run npm run typecheck and npm run build. When both pass, list what was created and stop. Do not start Phase 1 yet.
```

---

## Prompt 1 — Airtable Integration

```
Phase 1: Airtable Integration. Reference BUILD_PLAN.md section 6, Phase 1.

Tasks:

1. Add api/auth/airtable/login.ts — redirects to Airtable OAuth.
2. Add api/auth/airtable/callback.ts — exchanges code for token, stores token in an HTTP-only encrypted cookie. Use the SESSION_SECRET env var for encryption (use the 'iron-session' library — install it).
3. Add src/lib/airtable.ts — server-side helper that reads the cookie token and makes authenticated requests to the Airtable API.
4. Add api/airtable/opportunities.ts — GET handler returning active records from the Project Opportunities table. Filter to records where status is not "Closed" or "Lost".
5. Add api/airtable/opportunities/[id].ts — PATCH handler that updates a single record. Whitelist only these writable fields: "Dropbox Folder URL", "Last Site Visit", "Photos Count".
6. Build src/pages/OpportunitiesList.tsx — port from the prototype, but pull live data via fetch('/api/airtable/opportunities'). Include the search field.
7. Build src/pages/OpportunityDetail.tsx skeleton — header + tab bar matching prototype. Tabs are placeholders for now.
8. Add a "Connect Airtable" button visible until the user has a valid token. Tapping it goes to /api/auth/airtable/login.
9. Document the .env.local variables needed in README.md.

Critical: Never expose the Airtable token to the browser. All Airtable calls happen in /api routes.

When done: typecheck, lint, and confirm I can deploy this to Vercel preview and successfully list my real opportunities. Stop before Phase 2.
```

---

## Prompt 2 — Dropbox Integration

```
Phase 2: Dropbox Integration. Reference BUILD_PLAN.md section 6, Phase 2.

Tasks:

1. Mirror the Airtable OAuth pattern: api/auth/dropbox/login.ts and api/auth/dropbox/callback.ts. Store the Dropbox token in a separate HTTP-only encrypted cookie.
2. Add src/lib/dropbox.ts — server-side helper for Dropbox API requests.
3. Add api/dropbox/folder.ts — POST handler that takes { opportunityName } and creates the folder structure under the DROPBOX_ROOT_FOLDER if it doesn't exist:
   {opportunityName}/Photos/
   {opportunityName}/Sketches/
   {opportunityName}/measurements.md   (created empty with a header)
   {opportunityName}/site-notes.md     (created empty with a header)
   Returns the shared folder URL.
4. Add api/dropbox/upload.ts — POST handler accepting multipart/form-data with file + targetPath. Streams the upload to Dropbox.
5. Add api/dropbox/append-md.ts — POST handler for appending text to an existing markdown file in Dropbox (download → append → re-upload via the Dropbox API).
6. Wire the Opportunity Detail screen so that opening an opportunity that has no Dropbox Folder URL on its Airtable record triggers folder creation, then PATCHes the URL back to Airtable.
7. Build the Overview tab from the prototype, showing the live folder structure with file counts (counts come from a new GET /api/dropbox/folder-stats endpoint).

Critical: All file paths must use the DROPBOX_ROOT_FOLDER env var as the base — never hardcode "/Current Opportunities".

When done: typecheck, lint, deploy preview, confirm a fresh opportunity creates its folder + the URL appears on the Airtable record. Stop before Phase 3.
```

---

## Prompt 3 — Photos Tab

```
Phase 3: Photos. Reference BUILD_PLAN.md section 6, Phase 3.

Tasks:

1. Build src/pages/tabs/PhotosTab.tsx — port the prototype's PhotosTab visually, but real uploads.
2. Use <input type="file" accept="image/*" capture="environment" multiple> for camera capture.
3. On capture, call navigator.geolocation.getCurrentPosition() to get GPS coordinates. Embed lat/lng + ISO timestamp into the filename: IMG_{ISO_timestamp}_{lat}_{lng}.jpg.
4. Strip EXIF before upload for privacy (use a tiny library like 'piexifjs' or write a minimal stripper).
5. POST each photo to /api/dropbox/upload with the target path {opportunityName}/Photos/{filename}.
6. After all uploads in a batch succeed, PATCH the Airtable record:
   - "Photos Count" += number of new photos
   - "Last Site Visit" = today's date if not already set today
7. Show upload progress in the UI. On failure, allow retry per photo.
8. Display the photo grid with delete buttons. Delete should call DELETE /api/dropbox/file (new endpoint you'll add) and decrement the Airtable count.

When done: typecheck, lint, deploy preview, take 3 photos on iPhone and confirm they land in the correct Dropbox subfolder with metadata in filenames + the Airtable count updates. Stop before Phase 4.
```

---

## Prompt 4 — Sketches Tab

```
Phase 4: Sketches with Apple Pencil. Reference BUILD_PLAN.md section 6, Phase 4 and the prototype's SketchCanvas component.

Tasks:

1. Port SketchCanvas from the prototype to TypeScript at src/components/SketchCanvas.tsx. Preserve:
   - Engineering paper background (pale green base, quarter-inch grid, bolder lines every 4 squares)
   - Pointer Events with pressure sensitivity
   - Color picker (navy, red, near-black, gold)
   - Undo, clear, save
2. Build src/pages/tabs/SketchesTab.tsx with the new sketch button + thumbnail grid.
3. On save, export the canvas as PNG (preserving the engineering paper grid) and upload via /api/dropbox/upload to {opportunityName}/Sketches/sketch_{ISO_timestamp}.png.
4. Test pressure sensitivity behavior: if e.pressure is 0 or undefined (non-pressure-sensitive input), fall back to a fixed line weight of 2px.
5. Make the canvas full-screen on iPad — it should rotate gracefully.

When done: typecheck, lint, deploy preview, draw a sketch on iPad with Apple Pencil and confirm:
- Pressure sensitivity works (thicker lines with harder press)
- The exported PNG includes the grid background
- The file lands in Dropbox

Stop before Phase 5.
```

---

## Prompt 5 — Measurements Tab

```
Phase 5: Measurements. Reference BUILD_PLAN.md section 6, Phase 5.

Tasks:

1. Build src/pages/tabs/MeasurementsTab.tsx — label text input + decimal feet number input + add button. Match the prototype.
2. On add, call POST /api/dropbox/append-md with:
   - filePath: {opportunityName}/measurements.md
   - text: a single markdown table row formatted as: | {label} | {value.toFixed(2)} ft | {ISO timestamp} |
3. On the FIRST add for an opportunity, the append handler should detect the file is empty (just the header) and write the table header row first:
   ```
   | Label | Value | Recorded |
   |-------|-------|----------|
   ```
4. Display the running list locally (fetch the file from Dropbox on tab open via a new GET /api/dropbox/file?path=... endpoint, parse the markdown table back into rows).
5. Delete row UI: tapping delete removes that row from the in-memory list AND rewrites the entire markdown file via PUT /api/dropbox/file (overwrite). This is the only mutation that does an overwrite — everything else appends.

When done: typecheck, lint, deploy preview, add and remove measurements, then open measurements.md in Dropbox and confirm it's a clean readable markdown table. Stop before Phase 6.
```

---

## Prompt 6 — Voice Notes with AI Formatting

```
Phase 6: Voice Notes. Reference BUILD_PLAN.md section 6, Phase 6.

Tasks:

1. Build src/pages/tabs/NotesTab.tsx — port the prototype's mic button, live transcript, and saved notes list.
2. Use the Web Speech API (SpeechRecognition / webkitSpeechRecognition). Continuous mode, interim results on, lang en-US.
3. On stop + user confirmation, POST the raw transcript to /api/format-note.
4. Build api/format-note.ts:
   - Accepts { transcript: string, opportunityName: string, opportunityAddress: string }.
   - Calls the Anthropic API (use claude-opus-4-7 or current latest model — verify by calling the API once with a simple prompt).
   - System prompt: instruct Claude to format the transcript as a clean markdown site note with these sections (only include sections that have content): Site Conditions, Access, Existing Utilities, Scope Observations, Concerns, Next Steps. Add a top-level header "## Site Visit — {date} {time}". Preserve specific numbers, distances, and proper nouns exactly.
   - Returns { markdown: string }.
5. After receiving the formatted markdown, append it to {opportunityName}/site-notes.md via /api/dropbox/append-md with two blank lines between entries.
6. Display saved notes in reverse chronological order in the tab. Source-of-truth display: re-fetch site-notes.md on tab open and parse out entries by the "## Site Visit" header.
7. Handle the case where Web Speech API is unavailable (older browsers): show a textarea fallback for typed notes.
8. Show the "Formatting with AI..." state while the API call is in flight.

When done: typecheck, lint, deploy preview, narrate a 30-second test note about a fictional site walk on iPhone, confirm the formatted markdown lands in Dropbox with the right structure. Stop before Phase 7.
```

---

## Prompt 7 — PWA Polish

```
Phase 7: PWA. Reference BUILD_PLAN.md section 6, Phase 7.

Tasks:

1. Configure vite-plugin-pwa in vite.config.ts.
2. Generate a manifest.json with:
   - name: "Harris Job Walk"
   - short_name: "Job Walk"
   - theme_color: #263E57
   - background_color: #263E57
   - display: standalone
   - orientation: portrait
   - icons: 192x192 and 512x512 PNGs derived from the Harris Excavation logo (place placeholders in public/icons/ and document that David needs to provide the actual logo PNG)
3. Generate Apple-specific touch icons + splash screens for iPhone (sizes: 1170x2532, 1284x2778) and iPad (sizes: 1668x2388, 2048x2732). Use a navy background with the centered logo. Document a script or process for regenerating these.
4. Add the necessary <meta> tags to index.html:
   - apple-mobile-web-app-capable
   - apple-mobile-web-app-status-bar-style: black-translucent
   - apple-touch-icon links
5. Service worker: cache the app shell (HTML, CSS, JS, fonts) but NEVER cache /api/* responses. The brief is "no offline mode in v1" — the SW exists only to enable installability and faster cold starts.
6. Add an install prompt component that appears once for users on iOS Safari, instructing them to tap Share → Add to Home Screen.

When done: typecheck, lint, build, deploy preview, install to iPhone home screen, launch from home screen and confirm it opens in standalone mode (no Safari chrome). Stop before Phase 8.
```

---

## Prompt 8 — QA, Hardening, Production Cutover

```
Phase 8: Hardening. Reference BUILD_PLAN.md section 6, Phase 8 and section 8 (Success Criteria).

Tasks:

1. Add error boundaries around each tab so a crash in one capture flow doesn't kill the app.
2. Add a global toast/snackbar system for showing upload success, upload failure, and network errors.
3. Add retry buttons to every failed upload, displayed inline.
4. Add token refresh logic to src/lib/airtable.ts and src/lib/dropbox.ts — on 401 from either API, attempt one silent refresh before bubbling the error to the user.
5. Add loading skeletons for the Opportunities List and the Overview tab.
6. Add empty states (already in the prototype) to every tab.
7. Write a docs/RUNBOOK.md covering:
   - How to rotate API keys
   - How to rotate the SESSION_SECRET
   - How to add a new field to the Project Opportunities table
   - How to roll back a bad deploy via Vercel
8. Walk through every Success Criterion in BUILD_PLAN.md section 8 and confirm each is met. Output a checklist with pass/fail.
9. Set up the production Vercel deployment with the custom domain field.harrisexcavationco.com. Document DNS records David needs to add at his registrar.
10. Bump version to 1.0.0 in package.json. Tag the release as v1.0.0 in git.

When done: produce a final summary of what's deployed, what's tested, and what the next sensible v1.1 enhancements would be (likely: offline mode, sketch on top of photo, generate proposal from captured data).
```

---

## Inter-Phase Checklist (paste before each new phase)

Before starting the next phase, verify:

- [ ] Previous phase passes `npm run typecheck` and `npm run lint`
- [ ] Previous phase deployed to a Vercel preview URL successfully
- [ ] Manually tested on iPhone AND iPad
- [ ] `docs/CHANGELOG.md` updated
- [ ] Committed to git with a clear message
- [ ] No new dependencies added without justification

If anything is no, fix before continuing.

---

## Tips for Working with Claude Code on This Project

- **Reference the prototype constantly.** When in doubt about visual design, point Claude Code at `prototype/harris-job-walk-app.jsx` — that file IS the design spec.
- **Brand violations are bugs.** If Claude generates a screen with off-brand colors or fonts, treat it as a defect, not a preference. Ask for a fix.
- **Push back on scope creep.** If Claude suggests adding offline mode, multi-user support, or a fancy UI library, say no and reference `CLAUDE.md`.
- **Test on real devices early.** Web Speech API, Apple Pencil, and camera capture all behave differently in desktop browsers. Don't ship a phase without device testing.
