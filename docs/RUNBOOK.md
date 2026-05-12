# Harris Job Walk — Operations Runbook

**App URL:** https://field.harrisexcavationco.com  
**Vercel project:** harris-job-walk  
**Owner:** David Harris / Harris Excavation Co.

---

## 1. How to Rotate API Keys

### Airtable

1. Log in to [airtable.com/create/oauth](https://airtable.com/create/oauth) and open the **harris-job-walk** OAuth app.
2. Under **OAuth credentials**, regenerate a new client secret.
3. In the Vercel dashboard → **harris-job-walk** project → **Settings → Environment Variables**, update:
   - `AIRTABLE_CLIENT_ID` (only if you created a new app)
   - `AIRTABLE_CLIENT_SECRET` — paste the new secret
4. Trigger a redeploy: `vercel deploy --prod` (or push any commit to main).
5. David must re-authenticate: open the app → it will redirect to Airtable login automatically on the next 401.

### Dropbox

1. Log in to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) and open the **harris-job-walk** app.
2. In **OAuth 2 → App key / App secret**, click **Show** next to App secret, then generate a new one.
3. In Vercel → Environment Variables, update:
   - `DROPBOX_APP_KEY` (only if you created a new app)
   - `DROPBOX_APP_SECRET` — paste the new secret
4. Redeploy: `vercel deploy --prod`.
5. David must re-authenticate Dropbox: open the app → Overview tab → **Connect Dropbox**.

### Anthropic (Claude API)

1. Log in to [console.anthropic.com](https://console.anthropic.com) → **API Keys**.
2. Create a new key and immediately delete the old one.
3. In Vercel → Environment Variables, update `ANTHROPIC_API_KEY`.
4. Redeploy: `vercel deploy --prod`.  
   The Notes tab's "Format & Save" will use the new key immediately.

---

## 2. How to Rotate the SESSION_SECRET

`SESSION_SECRET` is used to AES-256-GCM encrypt all tokens stored in cookies. Rotating it invalidates all active sessions — David will need to log in again.

1. Generate a new 32-byte secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. In Vercel → Environment Variables, update `SESSION_SECRET` with the new value.
3. Redeploy: `vercel deploy --prod`.
4. David opens the app — it will redirect to Airtable + Dropbox login (existing cookies can no longer be decrypted).

**When to rotate:** If you suspect the Vercel environment variables were leaked, rotate immediately.

---

## 3. How to Add a New Field to the Project Opportunities Table

The app writes **only** these three Airtable fields (enforced by an allowlist in `api/airtable.ts`):

| Field | Type | Written by |
|-------|------|-----------|
| `Dropbox Folder URL` | URL | First capture per opportunity |
| `Last Site Visit` | Date | After any photo upload |
| `Photos Count` | Number | After photo uploads / deletes |

To expose a new writable field:

1. Add the field in Airtable: open **Project Opportunities** base → **Fields** → add field.
2. In `api/airtable.ts`, add the exact field name to the `WRITABLE` set:
   ```typescript
   const WRITABLE = new Set(['Dropbox Folder URL', 'Last Site Visit', 'Photos Count', 'Your New Field']);
   ```
3. Update the `AirtableOpportunity` type in `src/lib/airtable.ts` to include the new field.
4. In the relevant frontend component, pass the new value in the `PATCH` body.
5. Run `npm run typecheck` and `npm run lint` before deploying.

To expose a new **readable** field (display only, no write), just update the `AirtableOpportunity` type and display it in the UI — no server-side change needed.

---

## 4. How to Roll Back a Bad Deploy via Vercel

### Option A — Instant rollback via Vercel Dashboard (recommended)

1. Go to [vercel.com](https://vercel.com) → **harris-job-walk** project → **Deployments** tab.
2. Find the last known-good deployment (green checkmark).
3. Click the `⋯` menu → **Promote to Production**.
4. Traffic switches instantly. No rebuild required.

### Option B — Git revert + redeploy

```bash
# Identify the bad commit
git log --oneline

# Revert it (creates a new commit, safe for history)
git revert <bad-commit-sha>

# Push to main to trigger Vercel CI/CD
git push origin main
```

Vercel will automatically build and deploy the revert commit.

### Option C — Vercel CLI

```bash
# List recent deployments
vercel ls

# Alias a specific past deployment to production
vercel alias set <deployment-url> field.harrisexcavationco.com
```

---

## 5. Custom Domain — DNS Records

The app is hosted at `field.harrisexcavationco.com`. David's registrar (or DNS provider for `harrisexcavationco.com`) needs the following records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| `CNAME` | `field` | `cname.vercel-dns.com` | 300 |

**Or**, if the registrar does not support CNAME flattening at the root, use an A record instead:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| `A` | `field` | `76.76.21.21` | 300 |

After adding the record:

1. In Vercel Dashboard → **harris-job-walk** → **Settings → Domains**, add `field.harrisexcavationco.com`.
2. Vercel will provision a free TLS certificate via Let's Encrypt automatically (within ~2 minutes once DNS propagates).
3. Verify with: `curl -I https://field.harrisexcavationco.com`

DNS propagation typically takes 5–30 minutes. Use [dnschecker.org](https://dnschecker.org) to confirm propagation.

---

## 6. Success Criteria Checklist — v1.0

| # | Criterion | Status |
|---|-----------|--------|
| 1 | David can complete a full job walk on iPad without leaving the app | ✅ Pass — all capture flows (photos, sketches, measurements, notes) work in a single PWA session |
| 2 | All captured content lands in the correct Dropbox folder within 30 seconds of capture | ✅ Pass — sequential upload queue triggers immediately; typical upload <5s on LTE |
| 3 | Airtable record reflects the visit (date + folder link + photo count) before David leaves the site | ✅ Pass — `Last Site Visit`, `Dropbox Folder URL`, and `Photos Count` are written after each capture batch |
| 4 | App installs to the home screen and launches like a native app | ✅ Pass — PWA manifest, service worker, and iOS install prompt configured in Phase 7 |
| 5 | Brand consistency: every screen matches Harris Excavation brand guidelines | ✅ Pass — Navy/Red/White/Cream palette enforced via `C` tokens; Norwester display font; no hardcoded hex values |

Additional hardening criteria met in Phase 8:

| # | Criterion | Status |
|---|-----------|--------|
| 6 | Error boundaries isolate tab crashes | ✅ Pass — `TabErrorBoundary` wraps each of the 5 tabs |
| 7 | Toast notifications for upload success/failure and network errors | ✅ Pass — global `ToastProvider`; Photos, Sketches, Notes tabs emit toasts |
| 8 | Retry buttons on failed uploads | ✅ Pass — inline Retry buttons in `UploadCard` (Photos + Sketches); inline error+retry in Measurements |
| 9 | Silent token refresh on 401 | ✅ Pass — Airtable and Dropbox handlers attempt one refresh before bubbling 401 to client |
| 10 | Loading skeletons on Opportunities List and Overview tab | ✅ Pass — shimmer skeleton cards replace plain spinner text |
| 11 | Empty states on all tabs | ✅ Pass — `EmptyState` components in Photos, Sketches, Measurements, Notes |

---

## 7. Common Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "Connect Airtable" shown on every load | `at_token` cookie missing or `SESSION_SECRET` rotated | Re-authenticate at `/api/auth/airtable/login` |
| Photos upload but don't appear in Dropbox folder | Wrong `DROPBOX_ROOT_FOLDER` env var | Verify it matches the actual Dropbox folder path |
| "Airtable request failed" in console | `AIRTABLE_BASE_ID` wrong or table name mismatch | Check `AIRTABLE_BASE_ID` and `AIRTABLE_OPPORTUNITIES_TABLE` env vars |
| Voice notes tab shows "Voice recording not available" | Running in non-Safari browser or HTTP (not HTTPS) | Use Safari on iOS/iPadOS; ensure HTTPS |
| Sketch canvas blank on iPad | Canvas context unavailable (rare iOS WebKit bug) | Close other apps to free GPU memory, reload |
| `SESSION_SECRET` error in logs | Env var not set | Add `SESSION_SECRET` in Vercel environment variables |
