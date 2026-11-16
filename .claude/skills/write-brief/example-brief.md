# Example brief (the admin Audiences page, November 2026)

This brief produced a working feature first time on a mid-tier model. Note what it does: it fixes the
directory and branch, lists files to read, states rules instead of intentions, names the checks, and asks
for a report that makes review quick.

---

You are working in the git repo at /home/claude/repo/pawtraits (Next.js 16 App Router, React 19,
TypeScript, Supabase, Tailwind). You are on branch `feat/admin-audiences`. Work ONLY in this directory.
Do not push, do not open a PR, do not run SQL against any database, do not run `next build`.
Commit your work on this branch when done using `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -m "<message>"`,
the message ending with the attribution lines for this session.

## Goal
Pawtraits sells AI pet portraits online and at market stalls. Prints at stalls carry QR codes; people
scan, optionally make a free preview with their pet's photo, optionally ask for the preview by email, and
some buy. The owner wants one admin page where he can see three groups of people, and download the first
two as a customer list for Meta ads:
1. **Buyers**: people with at least one paid order.
2. **Preview emails**: people who asked for "Email me this preview" and have NOT bought.
3. **Scanners**: anonymous devices that scanned a stall QR code, by default those who have NOT bought.

## Read first (do not skip)
- `CLAUDE.md`.
- `db/migrations/2026-09-28-qr-stickers-and-locations.sql` (`qr_scans`, `stock_locations`).
- `db/migrations/2026-11-14-preview-emails.sql`, `db/migrations/2026-11-14-email-preferences.sql`.
- `lib/marketing/admin.ts` (`marketingStates`) and `lib/marketing/preferences.ts`.
- `app/api/admin/stock/qr-report/route.ts` and `app/api/admin/customers/route.ts` for the existing
  patterns (auth with `requireAdmin` from `@/lib/qr/server`, service-role client).
- Find the real column names before writing queries: check `db/current-db/current-schema` and how
  existing code reads `orders`. Do not guess column names.

## Build
### 1. `lib/marketing/audiences.ts` (server only)
Pure, testable helpers plus loaders that take a service-role Supabase client:
- `loadBuyers(supabase, filters)`: one row per lower-cased email with name, number of paid orders, total
  spent in pounds, first and last order date, stall name(s), marketing status
  ('subscribed' | 'unsubscribed' | 'not asked').
- ... (each loader, its fields, its default filter)
- No N+1 queries: fetch in batches and join in memory. Supabase returns at most 1000 rows per request,
  so page with `.range()` until exhausted (cap at 20,000 rows and report `truncated: true` if hit).
- `toMetaCsv(rows)`: header exactly `email,fn,ln,zip,country,value`. Include ONLY rows whose marketing
  status is 'subscribed'. Neutralise spreadsheet formula injection.

### 2. API `app/api/admin/audiences/route.ts`
- First line of the handler: `const denied = await requireAdmin(); if (denied) return denied;`.
- ... (params, response shape, CSV headers) ... Never log email addresses.

### 3. Page, 4. Sidebar ...

### 5. Test script `scripts/test-audiences.ts`
Cover the pure parts: grouping orders by email (case-insensitive), stage calculation for scanners,
`toMetaCsv` (only subscribed rows, header, quoting, formula-injection guard, value formatting).

## Checks you must run and pass before committing
1. `rm -rf .next && node scripts/check-type-errors.mjs` — the total must be at or below the baseline.
2. `npx tsx scripts/test-audiences.ts` passes.
3. `npx tsx scripts/check-admin-route-guards.ts` passes.
4. No dynamic route folder that clashes with a sibling.

## Report back
Files added/changed, the exact column names you relied on and where you confirmed each, any assumption
you could not verify from the repo, results of the checks, and the commit hash. If any table or column
you need does not exist, say so plainly instead of inventing it.
