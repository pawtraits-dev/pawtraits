# Spec: close open API routes (T1–T3)

Source: `claude/app-review-2026-11.md`, findings T1, T2, T3. Branch: `security/close-open-routes`.

## Goal

No API route that reads or writes private data, sends email, or changes the database may be callable without the right login. Remove debug, test and one-off routes from the deployed app. Nothing a real customer, partner or admin does today may stop working.

## Ground rules for every workstream

- Use the existing helpers in `lib/qr/server.ts`: `requireAdmin()` and `serviceClient()`. Do not write a new auth helper.
- Guard pattern, as the first statements of **every** exported handler (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) in a route file:
  ```ts
  const denied = await requireAdmin();
  if (denied) return denied;
  ```
- Before deleting any route or page, grep `app`, `components`, `lib`, `hooks`, `middleware.ts`, `vercel.json` for callers. If a live (non-debug) caller exists, fix the caller first or guard the route instead, and say so in your report.
- Do not change behaviour beyond what this spec says. No refactors, no log clean-ups, no formatting passes.
- Do not run `git commit`, `git push`, `npm install` or `next build`. Do not edit files owned by another workstream.
- Report back: files changed, files deleted, anything you guarded instead of deleting (and why), anything you were unsure about.

## Workstream A — guard admin routes (T1)

Owns: `app/api/admin/**` except the delete list in Workstream B; `app/api/customers/[id]/orders/route.ts`; `app/api/customers/[id]/pets/route.ts`; `lib/country-context.tsx`; `lib/gelato-service.ts` (line ~533 only); `scripts/check-admin-route-guards.ts`; `package.json` (one script line).

1. Add the guard pattern to every handler in every `app/api/admin/**/route.ts` that does not already call `requireAdmin()` or do its own `auth.getUser()` + `user_type === 'admin'` check. There are 69 such files; 16 of them are on Workstream B's delete list — skip those.
2. Add the same guard to `app/api/customers/[id]/orders` and `app/api/customers/[id]/pets`. Their only callers are in `app/admin/customers/[id]/page.tsx`.
3. `/api/admin/countries` is called from the public site. Change `lib/country-context.tsx` and `lib/gelato-service.ts` to call the public `/api/countries?supportedOnly=true` instead, then guard `/api/admin/countries` like the rest. Found during implementation: `/api/countries` was returning `[]` in production (it went through `AdminSupabaseService`, whose relative `fetch` fails on the server), so `app/api/countries/route.ts` was rewritten to read the `countries` table directly.
4. Check that no page outside `app/admin/**` and `components/admin/**` calls a route you have just guarded. If one does, stop and report it rather than guessing.
5. Add `scripts/check-admin-route-guards.ts`: walks `app/api/admin/**/route.ts`, and exits 1 listing any file where an exported handler does not contain `requireAdmin(` (or the inline `user_type` admin check). Add `"test:admin-guards": "npx tsx scripts/check-admin-route-guards.ts"` to `package.json`. It must pass when you finish (it may ignore files on B's delete list if they still exist).

## Workstream B — delete debug, test and one-off routes (T2)

Owns: everything it deletes; `app/pets/add/page.tsx` and `app/customer/pets/add/page.tsx` (the `check-user-no-auth` calls only); `middleware.ts` (`TEST_PAGES` only); `.eslintrc.json` (only to remove entries for deleted files).

Delete:
- `app/api/debug/**`
- `app/api/test/**`, `app/api/test-cloudinary`, `app/api/test-referral`, `app/api/migrate`, `app/api/update-functions`
- `app/api/interactions/fix-rls`, `app/api/interactions/test`
- `app/api/auth/test-login`
- `app/api/webhooks/stripe/test-secret`, `app/api/webhooks/stripe/debug`
- `app/api/cloudinary/test-variant` and `components/CloudinaryVariantsTest.tsx` (if nothing else uses it)
- Admin one-offs: `app/api/admin/{apply-product-schema,apply-schema,apply-storage-policies,check-tables,cleanup-auth,cleanup-auth-safe,debug-image-urls,debug-media,diagnose-gelato-urls,fix-gelato-urls,migrate-customers,migrate-sizes,setup-default-media,setup-hero-images-bucket,setup-storage-policies,test-hero-images-bucket}`. If an admin page still calls one, do not delete it: add the guard pattern instead and report it.
- Pages: `app/debug-env`, `app/debug-images`, `app/test`, `app/test-auth`, `app/test-raw-auth`, `app/test-cloudinary`, `app/test-hero-api`, `app/simple-login`. Remove `/simple-login` from `TEST_PAGES` in `middleware.ts`.

Live caller to fix first: `app/pets/add/page.tsx` and `app/customer/pets/add/page.tsx` each call `/api/debug/check-user-no-auth?email=…` twice as a fallback for loading the signed-in user's profile. Replace those calls with a route that identifies the caller from the session cookie and never accepts an email parameter. Use an existing one if it returns the profile (look at `/api/auth/check`); otherwise add `app/api/auth/profile/route.ts` (GET, `createRouteHandlerClient` for `auth.getUser()`, `serviceClient()` to read that user's own `user_profiles` row, 401 when not signed in) returning `{ userProfile }`. Keep the pages' existing behaviour otherwise.

## Workstream C — internal and semi-public endpoints (T3)

Owns: `app/api/commissions/**`; `app/api/webhooks/stripe/route.ts` (the `/api/commissions/customer` call only); a new `lib/commissions/customer-credit.ts`; `app/api/messaging/{send,enqueue,process}`; `app/api/partners/by-email/[email]`; `app/api/customers/lookup`; `app/api/auth/confirm-user`; `app/api/auth/confirm-user-by-email`.

1. **Commissions.** Move the body of `app/api/commissions/customer/route.ts` into an exported function in `lib/commissions/customer-credit.ts` (same inputs, same database writes, returns the same data the route returned or throws). In `app/api/webhooks/stripe/route.ts` (`handleCustomerCreditFromMetadata`, around line 1306) replace the HTTP `fetch` with a direct call to that function, keeping the surrounding success/failure handling equivalent. Then delete both `app/api/commissions/customer` and `app/api/commissions/partner` (the partner one has no callers — confirm).
2. **Messaging.** `send`: add the admin guard (only caller is `app/admin/messaging/test/page.tsx`). `enqueue`: delete if it has no callers, else guard. `process` (called by Vercel cron and by `app/admin/messaging/queue/page.tsx`): in both handlers allow the request when `CRON_SECRET` is set and the `Authorization` header equals `Bearer ${CRON_SECRET}`; otherwise require `requireAdmin()`. Exception, to avoid stopping email delivery on deploy: if `CRON_SECRET` is **not set**, keep today's behaviour for the handler the cron uses and log one `console.warn` saying `CRON_SECRET` is not set. Remove the "any Bearer token or no header" allowance.
3. **`partners/by-email`.** Called by the public page `app/r/partner/[code]/page.tsx`. Return only the fields that page actually renders; in particular stop returning `commission_rate` and `lifetime_commission_rate`.
4. **`customers/lookup`.** No callers found — confirm and delete. If there is a caller, require the signed-in user's email to equal the `email` parameter.
5. **`confirm-user` and `confirm-user-by-email`.** These are part of signup (called from `app/api/auth/signup/customer/route.ts`, `app/signup/partner/page.tsx`, `app/signup/user-qr/page.tsx`, `lib/supabase.ts`). Keep the request and response shapes, but only confirm an account that (a) is not already confirmed and (b) was created in the last 10 minutes. Otherwise return 403 with `{ error: 'Confirmation not allowed' }` and change nothing. Already-confirmed accounts should return the same success shape as today without calling the admin API.

## Out of scope (logged for later)

Server-side order totals (T4), middleware default-deny, other unauthenticated routes under `/api/referrals`, `/api/customers/*`, `/api/mugs/*`, `/api/upload`, `/api/generate-description`, removing the pages already blocked by `TEST_PAGES`.

## Acceptance checks

1. `npm run test:admin-guards` passes.
2. No file under `app`, `components`, `lib`, `hooks` references a deleted route path.
3. `npx tsc --noEmit` reports no more errors than the baseline of 914, and no new errors in changed files.
4. `next lint` reports no new errors in changed files.
5. Signed out, every `/api/admin/*` route returns 401; signed in as admin, the admin pages still load their data.
6. Pet add page, partner referral landing page, customer and partner signup, the Stripe webhook's customer-credit step, and the message queue cron still work.

## Deploy note

Set `CRON_SECRET` in Vercel (Production, Preview) if it is not already set, then the message queue and the other cron routes reject outside callers.
