# Changelog

## Phase 3 — Photos (2026-05-09)
Camera capture via `<input capture="environment">`, GPS tagging, EXIF stripping via canvas redraw, filename templating (`IMG_{ts}_{lat}_{lng}.jpg`), sequential upload to Dropbox `Photos/` subfolder with per-photo progress/retry UI, Airtable `Photos Count` and `Last Site Visit` writeback after each batch, photo grid with delete (calls new `DELETE /api/dropbox/file` endpoint and decrements count), and new `GET /api/dropbox/photos` endpoint that lists and returns 4-hour Dropbox temp links. Tab badge shows live count from Airtable.

## Phase 2 — Dropbox Integration (2026-05-09)
Dropbox OAuth login/callback (encrypted HTTP-only cookie), folder auto-creation on opportunity open (`Photos/`, `Sketches/`, `measurements.md`, `site-notes.md`), shared-link writeback to Airtable, multipart file upload, markdown append, live folder-stats endpoint, and Overview tab updated with real file counts.

## Phase 0 — Foundations (2026-05-09)
Initialized Vite + React + TypeScript project with Harris brand tokens, AppHeader component, react-router-dom routes, vite-plugin-pwa, ESLint, Prettier, and Vercel deploy config.
