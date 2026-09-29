# Spec — Guest customise → checkout, stall "pay on your phone", account + free download

**Status:** Implemented · 2026-09-28 · Owner: Steve
**SQL:** `db/migrations/2026-09-28-guest-checkout.sql` (run after `2026-09-28-qr-stickers-and-locations.sql`)

## 1. What it does

- **Anyone can customise.** No account needed to upload a pet photo and get a preview. Free previews are limited per device per 24 hours; the limit is an admin setting (default 20).
- **Two equal choices on every customise page:** "Put my pet in this picture" and "Buy this print". On phones both are pinned to the bottom of the screen.
- **"Buy this print":**
  - From a stall sticker: *take it home now — pay on your phone*. The price comes from admin settings, and the customer sees a big green **PAID** screen to show the stallholder.
  - Anyone else: the normal delivered-print options.
- **Guest checkout** for prints and digital downloads, all in one basket. A downloads-only basket skips the address and shipping steps.
- **After payment:**
  1. The normal order confirmation email.
  2. An account is created automatically (email pre-confirmed, no password).
  3. An **"account ready" email** with a one-tap sign-in link, valid for 14 days. The link unlocks a **free digital download** of the design they bought (switch in admin).
- **Tracking:** Google (GA4 + optional Ads) and the Meta Pixel on every page, behind a UK-compliant consent banner, with events on the customise and checkout steps. The purchase is also sent server-side through the Meta Conversions API, only when the customer consented.

## 2. Customer journey

```
Sticker scan /S/1123M/CAMDEN ──► /customise/[id]?src=qr&size=M
                                   │
         ┌─────────────────────────┴──────────────────────────┐
  🐾 Put my pet in                                       🛍️ Buy this print
  photo (camera/library, resized on phone)          stall scan (<12h, located)? ──no──► /shop/[id] (delivered)
  → preview (guest, limit N/day)                         │ yes
  → /shop/custom-portrait/[id]                      /stall/buy/[id] — name, email, Apple/Google Pay
  → basket → /shop/checkout (guest OK)              → /stall/paid  "PAID ✓ show the stallholder"
         │                                               │
         └──────────── Stripe payment_intent.succeeded ──┘
                        webhook: order + items (from pending_checkouts) → guest account
                        → fulfilment (Gelato / downloads / collected) → emails → Meta CAPI
```

## 3. Data (see SQL)

| Object | Purpose |
|---|---|
| `app_settings` | Admin key/value settings: `guest_preview_daily_limit` (20), `guest_preview_ip_daily_limit` (200), `stall_prices_pence` {S 2500, M 3500, L 5000}, `stall_online_discount_pct` (0), `welcome_gift_enabled` (true) |
| `customer_custom_images.guest_session_id / ip_hash` | Guest previews are tied to the device cookie `pt_vid` (shared with sticker scans). `customer_email` is now optional. |
| `pending_checkouts` | Server-side copy of the basket for each PaymentIntent. The webhook builds `order_items` from it (all items, not just the 3 that fit in Stripe metadata), and it also carries the consent flag and client info for Meta. |
| `orders.is_guest_checkout / guest_session_id / sales_channel` | `sales_channel = stall_online_payment` for stall sales; `fulfillment_type = collected`. |
| `orders_payment_intent_unique` | Guarantees one order per payment, so a webhook retry can't create a duplicate. |
| `account_claim_tokens` | Only a hash of each email link is stored. Clicking the link exchanges it for a fresh Supabase magic-link session. |
| `digital_entitlements` | `purchase` (available immediately) and `welcome_gift` (locked for guests until they activate the account). Downloads are served only through `/api/downloads/[id]`. |
| `message_templates.guest_account_ready` | Email template → `lib/messaging/templates/customer-guest-account-ready.html` |

## 4. Fixes made along the way (important)

1. **Paid orders had no line items (since 10 Feb 2026, commit `a2662b7`),** so nothing was sent to Gelato. Line items are now created in the webhook from `pending_checkouts`.
2. **The Gelato router passed the raw DB order to Gelato,** which rejects it. It now sends the proper v4 payload, saves `gelato_order_id`, and records failures in `orders.error_message`.
3. **Custom portraits couldn't be printed or downloaded,** because the image lookup checked only `image_catalog`. `lib/orders/order-image.ts` now also resolves `customer_custom_images`.
4. **The old code printed a stock Wikipedia dog** if it couldn't find an image. That fallback is removed; a missing image now fails loudly.
5. **Digital downloads served the watermarked file behind a guessable URL.** They now go through an entitlement check and a signed, full-quality Cloudinary URL.
6. **`/api/shop/orders?email=` returned anyone's orders without a login.** It now requires the matching signed-in user or an admin, and lookups by order number hide personal details from non-owners.
7. **The browser-supplied price is now checked** against current catalogue pricing. Anything below half price is **held** (`status = on_hold`, not sent to Gelato) for review rather than blocked.
8. **The custom-portrait purchase page called APIs that don't exist,** so it showed no products. It now uses `/api/public/format-products`.
9. **Customise and "Customise" buttons required sign-up.** They're open now; the account is created at checkout.
10. **Custom-image generation now runs inside `after()`** with `maxDuration = 300`, so Vercel keeps the function alive until the image is ready.

## 5. Tracking & consent

- **Consent cookie:** `pt_consent=v1.a{0|1}.m{0|1}`.
  - The banner offers equal-weight Accept and Reject buttons, with "Choose" toggles for analytics and marketing.
  - Call `openConsentSettings()` from `lib/tracking/consent.ts` to reopen it (e.g. from a footer link).
- **Google:** the tag loads with **Consent Mode v2 set to denied** for everything; accepting updates it.
- **Meta:** the Pixel script isn't loaded at all until the customer gives marketing consent.
- **Events** (`lib/tracking/events.ts`):

| Moment | Google event | Meta event |
|---|---|---|
| Customise page viewed | `view_item` | `ViewContent` (the retargeting audience) |
| Pet photo added | `pet_photo_added` | `PetPhotoAdded` |
| Preview requested | `generate_preview` | `CustomizeProduct` |
| Preview ready | `preview_ready` | `PreviewReady` |
| "Buy this print" tapped | `select_item` | — |
| Added to basket | `add_to_cart` | `AddToCart` |
| Checkout started | `begin_checkout` | `InitiateCheckout` |
| Payment completed | `purchase` | `Purchase` |

  - The browser `Purchase` uses `eventID` = PaymentIntent id, which is the same id the server-side Conversions API sends, so Meta counts each purchase once.

## 6. Environment variables

`NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`, `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_TEST_EVENT_CODE`, `DOWNLOAD_LINK_SECRET`. The QR-sticker variables `QR_ATTRIBUTION_SECRET` and `QR_IP_SALT` are also used.

## 7. Before going live

- Run both SQL migrations.
- **Stripe:**
  - Verify your domain for Apple Pay (Dashboard → Settings → Payment method domains).
  - Make sure the `payment_intent.succeeded` webhook points at `/api/webhooks/stripe`.
- **Supabase:** Auth → URL configuration → add the site URL. Magic links are generated server-side, so no email template change is needed.
- **Update the privacy policy** to mention Google Analytics/Ads, the Meta Pixel and Conversions API, and automatic account creation after an order.
- **Review orders placed since 10 Feb 2026** that have no `order_items`.

## 8. Tests

- `npx tsx scripts/test-qr-stickers.ts` (22 checks)
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1 SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-guest-checkout.ts` (14 checks)
