# Customer UX — round 2

**Status:** Built 2026-10-01 · Follows [round 1](customer-ux-round-1.md) · Design rules: [docs/design-tokens.md](../design-tokens.md)

## Email sign-in link
- `/auth/login` now leads with **Email me a sign-in link**; "Use a password instead" keeps the old form.
- `POST /api/auth/email-link {email, returnTo}` — looks up the account, creates a 1-hour, single-use claim token (`account_claim_tokens`, `order_id` null) and emails `/auth/claim?t=…&login=1&next=…`. Always answers with the same message (doesn't reveal whether an account exists). Limit: 3 links per email per 15 minutes.
- `/auth/claim` shows "Sign in to Pawtraits / Sign me in" for login links; `/api/auth/claim` refuses a used login link (410) and sends the person to `next` (same-site paths only), else `/customer`.
- No new table or migration (reuses `account_claim_tokens`).

## Customer menu: four places
- **Orders** (`/orders`), **My Pawtraits** (`/customer/gallery`), **Share & earn** (`/referrals`), **Account** (`/account`). Downloads, My pets, Inbox and Browse designs sit as small links under them in the drawer.
- Phone tab bar with the same four (`components/customer/CustomerTabBar.tsx`) on the customer layout and on `/orders`, `/account`, `/referrals` (customers only).
- Header: search and country selector hidden on phones; menu button labelled.

## Per-design titles and share previews
- `app/customise/[imageId]/layout.tsx` (server) sets the tab title ("<design title> | Pawtraits"), description, canonical URL and Open Graph / Twitter card.
- Preview image: `cloudinaryService.getSharePreviewUrl()` — 1200×630, design padded on brand lilac, watermarked.
- Customers' own images and hidden designs get a generic title and `noindex`.

## One browse page
- 308 redirects in `middleware.ts` (query string kept): `/products`, `/customer/shop`, `/customer/products` → `/browse`; `/dogs`, `/cats`, `/themes` (and the `-redirect` pages) → `/browse?type=…`; `/home` → `/`.
- Not redirected: `/gallery` (partners use it), `/customer/gallery` (customer's own Pawtraits), `/catalog` (admin shortcut).
- Nav links go straight to `/browse?type=…`.

## Hide empty breeds and themes
- `GET /api/public/themes-with-designs` (like breeds-with-designs). Nav shows only themes with designs, most first.
- Browse page lists only breeds and themes that appear in the loaded designs.

## Faster images
- `CatalogImage` is now a plain lazy `<img>` with `srcset` (300/400/600/800 wide) pointing at the image proxy — no JavaScript fetch before loading. `priority` for the home hero; `sizes` for non-grid uses.
- Image proxy (`/api/secure-images/[id]`): accepts `w`, passes the browser's `Accept` header so Cloudinary can send WebP/AVIF, and caches public catalogue variants (`public, max-age=1d, s-maxage=7d`, `Vary: Accept`). Customers' images stay `private`.
- Cloudinary public variants use `f_auto,q_auto` (thumbnail, mid_size, full_size, catalog_watermarked).
- Carousel/hero banners: `lib/images/delivery.ts` adds `f_auto,q_auto,w_1600` to Cloudinary URLs. Supabase-hosted banners go through Cloudinary fetch only when `CLOUDINARY_FETCH_REMOTE=true` (first allow "Fetched URL" in Cloudinary → Settings → Security).

## Design tokens
- `tailwind.config.js`: `brand`, `ink`, `shadow-card`, `shadow-sheet`, `rounded-card`, `rounded-sheet`. Rules for type, colour, buttons, cards and icons in `docs/design-tokens.md` (proposed — to agree).

## Still to do
- Re-make square designs at 2:3 (Steve).
- Signed-in baskets aren't re-priced on load.
- Move existing pages onto the token names as they're touched.
