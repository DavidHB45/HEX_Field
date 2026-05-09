# CLAUDE.md

Persistent context for Claude Code working on the **Harris Job Walk** app.

## Project

Field capture PWA for Harris Excavation. Lets David Harris open an existing Airtable Project Opportunity on his iPhone/iPad during a site visit and capture photos, sketches, measurements, and voice-narrated notes — all syncing to a structured Dropbox folder for that opportunity.

## Stack

- **React 18 + Vite + TypeScript** — frontend
- **Vercel serverless functions** (Node, in `/api`) — proxy for Airtable, Dropbox, Anthropic
- **Vercel hosting** at `field.harrisexcavationco.com`
- **PWA** via `vite-plugin-pwa`
- **Drawing:** HTML Canvas + Pointer Events (no third-party drawing lib)
- **Speech:** browser-native Web Speech API (no third-party SDK)
- **Icons:** `lucide-react`
- **Routing:** `react-router-dom` v6
- **State:** React Context + `useReducer` (no Redux, no Zustand)

## Commands

```bash
npm run dev          # Vite dev server with API routes via vercel dev
npm run build        # Production build
npm run preview      # Preview production build locally
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
vercel deploy        # Deploy preview
vercel deploy --prod # Deploy to production
```

**Always run `npm run typecheck` after a series of edits.** Don't run the full test suite unless asked.

## Code Style

- TypeScript strict mode. No `any` unless commented with reason.
- ES modules (`import`/`export`), never CommonJS.
- Functional components only. Hooks for state.
- Destructure imports: `import { useState } from 'react'`.
- File naming: `PascalCase.tsx` for components, `camelCase.ts` for utilities.
- One component per file. Co-locate small sub-components only if they're not reused.
- No CSS frameworks. Use the brand tokens in `src/theme.ts` via inline style or CSS vars. Tailwind is NOT installed.
- Inline styles use the imported `C` color object — never hardcode hex values.

## Brand — non-negotiable

Brand guidelines live in `docs/BRAND.md`. Key rules Claude Code must enforce:

- **Colors:** Navy `#263E57`, Red `#B40000`, White `#FFFFFF`, Cream `#F0E6CC`, Gold `#E8A020` (logo only), Off-white `#F7F7F7`. Never invent new colors.
- **Never** put red text on navy or vice versa — fails contrast.
- **Fonts:** Norwester for display/headers (`.font-display` class), Inter for body (default). No other fonts.
- **Tagline:** "Build Smarter. Dig Deeper." — never paraphrase, never modify.
- **Buttons:** Primary = red bg + white text. Secondary = navy bg + white text. Both 4px border radius.
- **Total/summary rows:** Red bg + white bold text. Never green.

## Architecture Rules

- **All third-party API calls go through `/api/*` serverless routes.** Never call Airtable, Dropbox, or Anthropic from the browser. Tokens stay server-side.
- **Dropbox folder structure is fixed** — see `docs/BRAND.md` and `BUILD_PLAN.md`. Do not invent new subfolder names.
- **Airtable writes are minimal** — only `Dropbox Folder URL`, `Last Site Visit`, `Photos Count`. Never write site notes, measurements, or photo data into Airtable. Those live in Dropbox.
- **Voice notes are formatted by Claude via `/api/format-note`** before being saved. Use the system prompt in `api/format-note.ts` — don't change it without discussion.
- **Authentication is OAuth for both Airtable and Dropbox.** Tokens stored encrypted in HTTP-only cookies. Never in localStorage.

## Workflow

- Plan first for non-trivial changes. Show your plan before editing >1 file.
- For each phase from `BUILD_PLAN.md`, work in a feature branch named `phase-N-{slug}`.
- Run `npm run typecheck` and `npm run lint` before declaring a task done.
- When adding a new dependency, justify it in the commit message. Prefer zero-dep solutions.
- After implementing a phase, update `docs/CHANGELOG.md` with a one-line summary.

## Testing on Device

- The app must be tested on real iPhone and iPad before any phase is marked complete.
- Use `vercel deploy` for preview URLs that David can open on his devices.
- Speech recognition + camera + Apple Pencil cannot be tested in desktop browsers reliably.

## What NOT to Do

- Do **not** add offline mode in v1. Out of scope, will create complexity that burns time.
- Do **not** add user accounts or multi-tenancy. Single-user app for now.
- Do **not** install Tailwind, MUI, Chakra, or any UI framework. Brand requires custom styling.
- Do **not** use `localStorage` or `sessionStorage` for auth tokens. Cookies only.
- Do **not** modify the prototype reference at `prototype/harris-job-walk-app.jsx` — it's the source of truth for visual design. Read from it, port to TS, but don't edit it.
- Do **not** invent new fields on the Airtable Project Opportunities table beyond the three listed in `BUILD_PLAN.md`.

## Files Worth Knowing

- `BUILD_PLAN.md` — phased build plan, environment variables, success criteria
- `docs/BRAND.md` — full brand guidelines (copy of Harris Excavation brand doc)
- `prototype/harris-job-walk-app.jsx` — visual reference prototype, do not modify
- `src/theme.ts` — brand color + font tokens
- `api/format-note.ts` — Claude API call for voice note formatting
- `src/lib/airtable.ts` — Airtable API client (server-side only)
- `src/lib/dropbox.ts` — Dropbox API client (server-side only)
