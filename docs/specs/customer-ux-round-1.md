# Customer UX — round 1

**Status:** Built 2026-10-01 · Review doc: "Pawtraits customer UX & design review" (Claude Docs) · Mock-ups: "Pawtraits home & design page mock-ups" (design canvas)

## What changed

### Home (`app/page.tsx`, rewritten)
- Hero leads with the proposition ("Your pet, painted into a masterpiece"), a featured design with a "your pet's photo" polaroid, **Make my pet's Pawtrait** and **Browse designs**, and "Prints from £X · Tracked UK delivery £5 · Instant downloads".
- How it works (3 steps), **Find your breed** (photo chips; only breeds that have designs, from `/api/public/breeds-with-designs`), designs as a 2-column grid with New / Popular / Staff picks, each card showing "Prints from £25", or "Digital download £X" plus a **Digital only** badge when the design has no print sizes.
- "Every design can be your pet" band; simple footer with Sign in / My orders.
- Removed: theme carousel, testimonials ("Real reviews from real pet parents" — reviews must come from real orders before they're shown), product modal, "Add to Basket" on cards.
- Admins/partners are redirected via `/api/auth/check` (no Supabase client in the page).

### Design page (`app/customise/[imageId]/page.tsx`)
- The single design page. `/shop/<design id>` redirects here (308, in `middleware.ts`) unless the link carries `partner` or `autoAdd` (partner discount flows still use the old page). `?ref=` is stored for checkout.
- Order: design at its true shape (share button) → breed · theme → title → **Put your pet in this picture** card → **Or buy it as it is** (sizes inline) → About this design → **More like this** (same breed, then theme; `components/customise/MoreLikeThis.tsx`).
- Sizes: `BuyOptionsSheet` gained an `inline` mode. Brand-voice lines — Small "Sweet and petite", Medium "Just right" (badge *Most popular*, preselected), Large "Large and in charge" — and **Includes bonus digital copy** on every print. No crop/"trimmed" notes. Prints listed before the download. Digital-only designs say so and hide the delivery line.

### Checkout and after payment
- Card route is two steps (Address → Payment); delivery shows in the summary as soon as a country is known (`shippingQuoteFor`).
- Confirmation page never says "Order not found" after payment: it shows **Payment received** (amount from `GET /api/payments/status`) and keeps checking for the order for ~4 minutes. Digital orders show a "Your download" box (guests: emailed account link; signed in: Go to my downloads) and no delivery rows.

### Basket
- Guest baskets are re-checked on load (`POST /api/cart/reprice`): discontinued products are removed and prices updated to today's, with a notice on the basket page. Stall lines and partner-discounted lines keep their price. Signed-in (server) baskets are not re-priced yet.

### Fixes
- Customer menu: My Orders → `/orders`, My Account → `/account` (were 404s).
- Browse: filter tabs scroll on their own (page no longer scrolls sideways on phones); "Put My Pet in This Pic" went to a missing `/create` page, now `/customise/<id>?start=photo`; breed view shows "Any design can star your <breed>".
- Carousels: markdown stripped and long text cut at a word with "…" (`lib/text/plain.ts`); icon buttons labelled.
- Phone menu: Make my pet's Pawtrait, My orders, Sign in; breeds limited to those with designs.
- Old bundle-price line removed from `/shop/[id]`; © year automatic.
- Test pages return 404 in production: `/quick-debug`, `/simple-login`, `/css-test`, `/ui-demo`, `/demo`, `/interactions-demo`, `/customer/test-cart`.

## Not in this round
- Square designs: re-make the most-viewed at 2:3 (catalogue work).
- Email sign-in link; customer menu cut to four; per-design page titles and share previews; one browse page with redirects; hiding empty themes; design tokens; faster images — done in [round 2](customer-ux-round-2.md).
- Catalogue copy errors in descriptions (e.g. "dignously") are data — fix in admin.

## Endpoints added
| Endpoint | Purpose |
|---|---|
| `GET /api/public/breeds-with-designs[?animal=]` | Breeds with ≥1 public design, most first, with a thumbnail design id |
| `GET /api/payments/status?payment_intent=` | Status and amount of a payment, for the confirmation page |
| `POST /api/cart/reprice` | Current active state and UK price for basket products |
