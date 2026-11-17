# Feature map: where things live

A lookup table so you can find the right files for a feature without exploring the whole repository. Paths and table names were checked against the code on 16 Nov 2026.
Verify before relying on it (open the file, check the column in `db/current-db/current-schema` or `db/migrations/`). When you change a feature, update its entry here.

## Customise flow and preview generation
A customer opens a design, uploads a pet photo (or picks a saved pet) and gets a watermarked painted preview; guests need no account.
- **Pages:** `app/customise/[imageId]/page.tsx`, `app/customise/[imageId]/CustomiseClient.tsx`, `app/shop/custom-portrait/[id]/page.tsx`
- **API:** `app/api/customers/custom-images/generate/route.ts`, `app/api/customers/custom-images/[id]/route.ts`, `app/api/customers/pets/analyze-photo/route.ts`
- **Logic:** `lib/customise/generate-job.ts` (the painting pipeline, shared with Offers), `lib/customise/painting.ts` (prompt and request), `lib/customise/detect-breed.ts` (Claude Haiku breed and coat of an uploaded photo), `lib/guest/access.ts` (`getRequester`, `canAccessCustomImage`, pt_vid guest cookie), `lib/catalog/design-page-data.ts` (data for the design page), `lib/print/print-master.ts` (4K master made after purchase)
- **Components:** `components/customise/`
- **Tables:** `customer_custom_images`, `image_catalog`, `pets`, `custom_image_events`, `breeds`, `coats`
- **Settings:** `guest_preview_daily_limit`, `guest_preview_ip_daily_limit`
- **Tests:** `scripts/test-painting.ts`, `scripts/test-multi-pet.ts`
- **Migration(s):** `db/migrations/2026-10-19-customisation-analytics.sql`, `db/migrations/2026-10-12-multi-pet-data.sql`
- **Watch out:** `lib/customise/generate-job.ts` is also used by `lib/offers/generate.ts`, so a change there changes Offers too. Guests can only upload photos; saved pets need an account (comment in the generate route).

## Checkout, payment and order creation
Basket to Stripe payment to a stored order, for signed-in customers, guests and stall "take it home now" prints.
- **Pages:** `app/shop/cart/page.tsx`, `app/shop/checkout/page.tsx`, `app/shop/order-confirmation/page.tsx`, `app/stall/buy/[imageId]/page.tsx`, `app/stall/paid/page.tsx`
- **API:** `app/api/payments/create-intent/route.ts`, `app/api/webhooks/stripe/route.ts`, `app/api/cart/route.ts`, `app/api/cart/reprice/route.ts`, `app/api/cart/validate/route.ts`, `app/api/shipping/options/route.ts`
- **Logic:** `lib/checkout/price-check.ts` (server check of the amount the browser sends), `lib/orders/order-items.ts` (order lines from the `pending_checkouts` snapshot), `lib/cart/items.ts` (stall pseudo-products), `lib/hybrid-cart-context.tsx` (the cart provider mounted in `app/layout.tsx`), `lib/guest/account.ts` (account created after a guest order), `lib/shipping/rates.ts` (flat delivery charges)
- **Components:** `components/checkout/`, `components/StripePaymentForm.tsx`
- **Tables:** `pending_checkouts`, `orders`, `order_items`, `cart_items`, `customers`, `user_profiles`, `commissions`, `account_claim_tokens`
- **Settings:** `stall_prices_pence`, `stall_online_discount_pct`
- **Tests:** `scripts/test-price-check.ts`, `scripts/test-guest-checkout.ts`, `scripts/test-shipping-rates.ts`
- **Migration(s):** `db/migrations/2026-09-28-guest-checkout.sql`
- **Watch out:** the browser sends the amount; `create-intent` refuses under half of the expected total and holds a "low" one for review (`PRICE_CHECK_MODE=log` turns that off). The Stripe webhook must create the order or fail with 500 so Stripe retries, and it is idempotent on `orders.payment_intent_id`. Stall prints are `stall_print_S|M|L|XL`, which have no `products` row. Do not change payment logic unless the task is about it (`CLAUDE.md`). Spec: `docs/specs/guest-checkout.md`.

## Orders, print files and fulfilment (self-print and Gelato)
After payment the owner prints, packs and posts each order from an admin queue; any order can be sent to Gelato instead.
- **Pages:** `app/admin/orders/page.tsx`, `app/admin/orders/[id]/page.tsx`, `app/shop/orders/page.tsx`, `app/orders/page.tsx`
- **API:** `app/api/admin/orders/route.ts`, `app/api/admin/orders/[id]/fulfilment/route.ts`, `app/api/admin/orders/fulfilment/route.ts`, `app/api/admin/orders/fulfilment/packing-slips/route.ts`, `app/api/webhooks/gelato/route.ts`
- **Logic:** `lib/fulfillment/order-fulfilment.ts` (stages to_print, printed, packed, posted), `lib/fulfillment/packing-slips.ts` (A4 slips and Click & Drop CSV), `lib/fulfillment/shared.ts` (stage labels, `postedItems`), `lib/orders/order-image.ts` (finds the picture and print files behind a line), `lib/print/print-geometry.ts` (one reference image to every size), `lib/gelato-service.ts` (Gelato API)
- **Components:** `components/admin/orders/`
- **Tables:** `orders`, `order_items`, `order_fulfillment_tracking`, `customer_custom_images`, `image_catalog`
- **Settings:** `default_fulfillment_provider`, `return_address`
- **Tests:** `scripts/test-self-print-fulfilment.ts`, `scripts/test-print-geometry.ts`
- **Migration(s):** `db/migrations/2026-09-29-self-print-fulfilment.sql`, `db/migrations/2026-09-30-print-crops.sql`
- **Watch out:** `order_items.image_id` is either an `image_catalog.id` or a `customer_custom_images.id` (`lib/orders/order-image.ts`). Reference images are only 1:1, 2:3, 3:2 or 2:1; S and L are centre-cropped from 2:3 (`lib/print/print-geometry.ts`). An order already sent to Gelato cannot be reset from admin. Spec: `docs/specs/self-print-fulfilment.md`.

## Royal Mail labels and tracking
The owner makes Royal Mail labels for packed orders in bulk, and customers are emailed as the parcel moves.
- **Pages:** `app/admin/orders/page.tsx` (labels dialog: `components/admin/orders/RoyalMailLabelsDialog.tsx`)
- **API:** `app/api/admin/orders/fulfilment/royal-mail/route.ts`, `app/api/admin/orders/fulfilment/royal-mail/labels/route.ts`, `app/api/admin/orders/fulfilment/click-and-drop/route.ts`, `app/api/admin/orders/[id]/tracking/route.ts`, `app/api/cron/royal-mail-tracking/route.ts`
- **Logic:** `lib/shipping/royal-mail/server.ts` (`planShipment`, `makeLabels`, `refreshTracking`, `trackingSweep`), `lib/shipping/royal-mail/click-and-drop.ts` (Click & Drop client), `lib/shipping/royal-mail/tracking-api.ts` (Tracking v2 client), `lib/shipping/royal-mail/status.ts` (tracking stages and customer wording)
- **Tables:** `orders`
- **Settings:** `royal_mail`
- **Migration(s):** `db/migrations/2026-11-09-royal-mail.sql`
- **Watch out:** Click & Drop allows 5 calls a second, and fetching label PDFs from it is for OBA accounts only (comment in `click-and-drop.ts`). Needs `CLICK_AND_DROP_API_KEY` and the `ROYAL_MAIL_TRACKING_CLIENT_ID` / `ROYAL_MAIL_TRACKING_CLIENT_SECRET` env vars.

## Trade print orders (stall stock)
The owner orders foamex stall prints by hand from a trade printer, with print-ready files and sales to replace.
- **Pages:** `app/admin/stock/trade-orders/page.tsx`
- **API:** `app/api/admin/stock/trade-orders/route.ts`, `app/api/admin/stock/trade-orders/[id]/lines/route.ts`, `app/api/admin/stock/trade-orders/[id]/files/route.ts`, `app/api/admin/stock/trade-orders/[id]/labels/route.ts`, `app/api/admin/stock/trade-orders/sales/route.ts`
- **Logic:** `lib/stock/trade-prints.ts` (`stallSales`, `linePrint`: 300 dpi, no bleed), `lib/stock/print-labels.ts` (A4 sheets of 21 labels), `lib/print/print-geometry.ts`
- **Tables:** `trade_print_orders`, `trade_print_order_lines`, `order_items`
- **Migration(s):** `db/migrations/2026-10-22-trade-print-orders.sql`, `db/migrations/2026-11-10-print-range-and-xl.sql`
- **Watch out:** only for stall stock; online orders go through Gelato or self-print (comment in `lib/stock/trade-prints.ts`).

## Digital downloads and entitlements
Customers download full-quality pictures they bought, or the free "welcome gift" copy that comes with a print.
- **Pages:** `app/customer/downloads/page.tsx`
- **API:** `app/api/downloads/[id]/route.ts`, `app/api/customers/downloads/route.ts`, `app/api/orders/[id]/download/[itemId]/route.ts` (legacy, hands off to `/api/downloads`)
- **Logic:** `lib/orders/entitlements.ts` (`grantEntitlementsForOrder`, signed download links), `lib/orders/order-downloads.ts` (downloads shown on order pages), `lib/fulfillment/digital-download-service.ts` (digital fulfilment, called from the Stripe webhook via `lib/fulfillment/fulfillment-router.ts`)
- **Components:** `components/DigitalDownloadButton.tsx`
- **Tables:** `digital_entitlements`, `customer_custom_images`, `image_catalog`, `user_profiles`
- **Settings:** `welcome_gift_enabled`
- **Tests:** `scripts/test-framed-entitlements.ts`, `scripts/test-framed-download.ts`
- **Migration(s):** `db/migrations/2026-09-28-guest-checkout.sql`
- **Watch out:** one entitlement per design per order. Guest-order gifts are `locked` until the buyer activates the new account. The download redirects to a 7-day signed Cloudinary URL and may render a 4K master first (`maxDuration` 300).

## Framed cards (zodiac and tarot frames)
A design can carry an ornate frame with a zodiac sign or tarot card, sold as a print or a download.
- **Pages:** `app/customise/[imageId]/CustomiseClient.tsx` (toggle shown there)
- **API:** `app/api/admin/catalog/[id]/frame/route.ts`, `app/api/customers/custom-images/[id]/frame/route.ts`, `app/api/public/frame-status/route.ts`
- **Logic:** `lib/frames/frame.ts` (frame layers, client-safe), `lib/frames/server.ts` (`bakeFrame`, `applyFrameToDesign`, `frameIfCard`), `lib/frames/print.ts` (framed print file transformation), `lib/frames/switch.ts` (framed or unframed for a customer portrait), `lib/frames/rules.ts` (selling rule), `lib/zodiac.ts` and `lib/tarot.ts` (the cards)
- **Components:** `components/customise/FrameToggle.tsx`, `components/admin/FramePanel.tsx`
- **Tables:** `image_catalog`, `customer_custom_images`, `collections`, `pets`
- **Tests:** `scripts/test-frame.ts`, `scripts/test-frame-switch.ts`, `scripts/test-framed-download.ts`, `scripts/test-framed-entitlements.ts`, `scripts/test-zodiac.ts`
- **Migration(s):** `db/migrations/2026-11-13-framed-cards.sql`, `db/migrations/2026-11-13-pets-zodiac-sign.sql`
- **Watch out:** frame art is never painted by AI; the clean picture is kept in `image_catalog.frame_overlay` so variations never copy the frame. A design has a caption plate or a frame, never both. Framed cards are not sold as mugs or phone cases (`lib/frames/rules.ts`).

## Catalogue, browse, home and picture delivery
The designs customers browse and buy: listing, filters, home page, and the watermarked picture service.
- **Pages:** `app/browse/page.tsx`, `app/browse/BrowseClient.tsx`, `components/home/HomePage.tsx`, `app/admin/catalog/page.tsx`, `app/admin/catalog/upload/page.tsx`
- **API:** `app/api/public/browse/route.ts`, `app/api/public/catalog-images/[id]/route.ts`, `app/api/images/route.ts`, `app/api/images/cloudinary/route.ts`, `app/api/secure-images/[imageId]/route.ts`, `app/api/admin/catalog/save/route.ts`
- **Logic:** `lib/catalog/browse-server.ts` (one listing source for page and API), `lib/catalog/browse-params.ts` (URL to filters, pure), `lib/catalog/listing.ts` (`LISTED_ONLY`, unlisted designs), `lib/catalog/originals.ts` (uploads vs versions), `lib/picture-version.ts` (cache key `v`), `lib/catalog/register-image.ts` (Cloudinary image to design)
- **Tables:** `image_catalog`, `breeds`, `coats`, `themes`, `styles`, `outfits`, `formats`, `image_catalog_subjects`
- **Tests:** `scripts/test-browse-params.ts`, `scripts/test-browse-query.ts`, `scripts/test-coat-match.ts`, `scripts/test-picture-version.ts`, `scripts/test-title-hygiene.ts`, `scripts/test-search-tags.ts`
- **Migration(s):** `db/migrations/2026-10-12-multi-pet-data.sql`, `db/migrations/2026-10-23-picture-words.sql`, `db/migrations/2026-10-08-auto-tags-search.sql`, `db/migrations/2026-11-07-market-gap-breeds.sql`
- **Watch out:** designs tagged `quiz-generated` are link-only: kept out of browse, home and recommendations but still buyable (`lib/catalog/listing.ts`). Unwatermarked variants from `/api/secure-images` are for admins only. `v` on a picture address is only a cache key. Catalogue title is the first line of `image_catalog.description`.

## Variations and variation batches
Admin makes breed, coat, outfit and format versions of designs, singly or in bulk through the Gemini Batch API.
- **Pages:** `app/admin/variation-batches/page.tsx`, `app/admin/variation-batches/[id]/page.tsx`, `app/admin/generate/page.tsx`
- **API:** `app/api/admin/variation-runs/route.ts`, `app/api/admin/variation-runs/tick/route.ts`, `app/api/admin/variation-recipes/route.ts`, `app/api/admin/generate-variations/route.ts`, `app/api/admin/variations/save/route.ts`, `app/api/cron/variation-batches/route.ts`
- **Logic:** `lib/gemini-variation-service.ts` (Gemini variation prompts and calls), `lib/variations/batch.ts` (batch submit, check and store), `lib/variations/combos.ts` (combinations and planning, pure), `lib/catalog/variation-previews.ts` (previews held on Cloudinary), `lib/variation-prompt-builder.ts`
- **Tables:** `variation_runs`, `variation_run_items`, `variation_run_jobs`, `variation_recipes`, `image_catalog`
- **Tests:** `scripts/test-variations.ts`
- **Migration(s):** `db/migrations/2026-10-17-variation-batches.sql`, `db/migrations/2026-10-18-batch-descriptions.sql`
- **Watch out:** admin previews live on Cloudinary because four 2K PNGs exceed Vercel's 4.5 MB response limit (`lib/catalog/variation-previews.ts`). Versions link to their original through `image_catalog.variation_of`.

## Collections and captions
Occasion, sport, zodiac, tarot and Pawsonality collections, team versions of sports designs, and the gold name plate on zodiac and Pawsonality pictures.
- **Pages:** `app/collections/`, `app/admin/collections/page.tsx`, `app/admin/collections/captions/page.tsx`
- **API:** `app/api/public/collections/route.ts`, `app/api/public/collection/route.ts`, `app/api/admin/collections/route.ts`, `app/api/admin/collections/auto-tag/route.ts`, `app/api/admin/collections/team-versions/route.ts`, `app/api/admin/captions/route.ts`, `app/api/admin/catalog/[id]/caption/route.ts`
- **Logic:** `lib/collections/definitions.ts` (fixed collection tree), `lib/collections/auto-tag.ts` (Claude files a new design), `lib/collections/team-variants.ts` (sports team switcher), `lib/collections/public.ts` (customer reads), `lib/captions/caption.ts` (plate layers, client-safe), `lib/captions/server.ts` (`bakeCaption`, `applyCaptionToDesign`, `cleanPictureId`)
- **Components:** `components/collections/`, `components/admin/collections/`, `components/admin/CaptionPanel.tsx`
- **Tables:** `collections`, `design_collections`, `design_team_variants`, `kit_lettering_tests`, `image_catalog`, `themes`
- **Settings:** `auto_tag_enabled`, `team_switch_enabled`, `team_switch_hourly_limit`
- **Tests:** `scripts/test-collections.ts`, `scripts/test-auto-tag.ts`, `scripts/test-search-tags.ts`
- **Migration(s):** `db/migrations/2026-10-07-collections.sql`, `db/migrations/2026-10-09-collections-browse.sql`, `db/migrations/2026-10-10-team-switcher.sql`, `db/migrations/2026-10-20-personalised-kits.sql`, `db/migrations/2026-10-21-team-version-pages.sql`, `db/migrations/2026-11-08-captions.sql`
- **Watch out:** the Pawsonalities collection lives at `/pawsonalities`, not `/collections` (`lib/collections/href.ts`). Plates and slogans are Cloudinary text layers, never AI-painted; the clean picture is kept in `image_catalog.caption_overlay`. Spec: `docs/specs/collections-plan.md`.

## Stall, QR stickers, scans and attribution
Stickers on stall prints send a phone to the design; scans are recorded with the stall location and credit later sales to it.
- **Pages:** `app/admin/stock/stickers/page.tsx`, `app/admin/stock/qr-report/page.tsx`, `app/admin/stock/dividers/page.tsx`, `app/admin/stock/locations/page.tsx`, `app/admin/settings/guest-and-stall/page.tsx`, `app/stall/buy/[imageId]/page.tsx`
- **API:** `app/s/[...slug]/route.ts` (sticker scan resolver), `app/api/qr/track/route.ts`, `app/api/stall/offer/route.ts`, `app/api/stall/receipt/route.ts`, `app/api/admin/stock/stickers/route.ts`, `app/api/admin/stock/qr-report/route.ts`, `app/api/admin/stock/locations/route.ts`, `app/api/admin/stock/dividers/route.ts`, `app/api/admin/settings/app/route.ts`
- **Logic:** `lib/qr/attribution.ts` (signed `pt_qr` cookie, `pt_vid` visitor id, 30 days), `lib/qr/sticker-url.ts` (`/S/1123M/CAMDEN` links), `lib/qr/sticker-sheet.ts` (A4 sticker PDF), `lib/stall/offer.ts` (`getStallOffer`), `lib/stock/divider-cards.ts`, `lib/stock/print-labels.ts`
- **Components:** `components/admin/ImageQrPanel.tsx`
- **Tables:** `qr_scans`, `stock_locations`, `qr_code_tracking`, `image_catalog`, `qr_location_daily` (a view)
- **Settings:** `stall_prices_pence`, `stall_online_discount_pct`, `guest_preview_daily_limit`, `guest_preview_ip_daily_limit`
- **Tests:** `scripts/test-qr-stickers.ts`
- **Migration(s):** `db/migrations/2026-09-28-qr-stickers-and-locations.sql`, `db/migrations/2026-11-10-print-range-and-xl.sql`
- **Watch out:** `middleware.ts` rewrites upper-case `/S/` to `/s/` (smaller QR). The scan route never fails the customer: any error still ends in a redirect. A stall offer only shows if a located sticker was scanned in the last 12 hours (`STALL_SCAN_FRESH_HOURS`). Set `QR_ATTRIBUTION_SECRET` in Vercel. Spec: `docs/specs/qr-stickers.md`.

## Email preferences and marketing consent
One place decides who may get marketing email, with the consent wording and evidence stored.
- **Pages:** `app/email-preferences/page.tsx`
- **API:** `app/api/public/email-preferences/route.ts`, `app/api/public/email-preferences/unsubscribe/route.ts`, `app/api/public/email-preferences/photo-optout/route.ts`, `app/api/admin/customers/[id]/marketing/route.ts`
- **Logic:** `lib/marketing/preferences.ts` (`canEmail`, subscribe and unsubscribe, signed links), `lib/marketing/consent-copy.ts` (the only place the opt-in words live; bump `CONSENT_VERSION` when they change), `lib/marketing/pages.ts` (no-JS unsubscribe pages), `lib/marketing/admin.ts` (admin view of the choice)
- **Components:** `components/marketing/MarketingOptIn.tsx`, `components/marketing/MarketingOptOut.tsx`
- **Tables:** `email_preferences`, `email_preference_events`
- **Tests:** `scripts/test-email-preferences.ts`
- **Migration(s):** `db/migrations/2026-11-14-email-preferences.sql`
- **Watch out:** every marketing send must be gated by `canEmail(supabase, email, topic)`, which fails closed; never re-subscribe an unsubscribed address; links carry the row id and a signature, never the address.

## Preview emails ("Email me this preview")
A visitor asks for their preview by email and gets a signed link that reopens it on any device.
- **Pages:** `app/pv/[token]/route.ts` (the link in the email), `components/previews/EmailPreviewCard.tsx`
- **API:** `app/api/public/previews/email/route.ts`
- **Logic:** `lib/previews/server.ts` (request, send, open), `lib/previews/email-link.ts` (sign and verify token, limits; pure), `lib/previews/copy.ts` (wording), `lib/messaging/templates/customer-preview-link.html`
- **Tables:** `preview_email_requests`, `customer_custom_images`
- **Tests:** `scripts/test-preview-emails.ts`
- **Migration(s):** `db/migrations/2026-11-14-preview-emails.sql`
- **Watch out:** a message the person asked for, not marketing: sent whatever their marketing choice and never calls `canEmail`. The token carries the request id and an expiry (30 days), never the address; bot user agents are redirected and nothing is granted. Before the migration runs the `MISSING` check turns errors into 503 `unavailable`.

## Offers (paint from a kept photo)
Pawcasso paints a kept pet photo into new designs and emails the offer in rounds, with birthday, zodiac and hand-started campaigns and a one-off notice to past buyers.
- **Pages:** `app/admin/offers/page.tsx`, `app/po/[token]/route.ts`, `app/po/[token]/birthday/route.ts`
- **API:** `app/api/admin/offers/route.ts`, `app/api/admin/offers/run/route.ts`, `app/api/admin/offers/settings/route.ts`, `app/api/admin/offers/campaigns/route.ts`, `app/api/admin/offers/notice/route.ts`, `app/api/cron/offers/route.ts`
- **Logic:** `lib/offers/run.ts` (one cron pass: queue, generate, send), `lib/offers/eligibility.ts` (who is due, pure), `lib/offers/allowed.ts` (checks repeated before generating and sending), `lib/offers/generate.ts` (paints via `lib/customise/generate-job.ts`), `lib/offers/select-designs.ts` (`pickOfferDesigns`), `lib/offers/send.ts`, `lib/offers/notice.ts`, `lib/offers/dates.ts` (birthday and zodiac dates, pure)
- **Tables:** `preview_offers`, `offer_campaigns`, `preview_email_requests`, `email_preferences`, `customer_custom_images`
- **Settings:** `offers_enabled`, `offers_auto_send`, `offers_round1_days`, `offers_round2_days`, `offers_per_run`, `offers_per_day`, `offers_zodiac_days_before`, `offers_birthday_days_before`, `offers_notice_grace_days`
- **Tests:** `scripts/test-offers.ts`
- **Migration(s):** `db/migrations/2026-11-16-preview-offers.sql`, `db/migrations/2026-11-16-offers-campaigns.sql`
- **Watch out:** nothing happens while `offers_enabled` is off (the default). Every send is gated by `canEmail(..., 'offers')` and re-checked immediately before sending. The past-buyers notice is only ever sent by the admin pressing the button, never by the cron. `MISSING` in `lib/offers/settings.ts` detects an unrun migration.

## Audiences and Popularity (admin reports)
Audiences lists buyers, preview emailers and stall scanners (with a Meta customer-list download); Popularity ranks designs by scans, previews and sales.
- **Pages:** `app/admin/audiences/page.tsx`, `app/admin/popularity/page.tsx`
- **API:** `app/api/admin/audiences/route.ts`, `app/api/admin/popularity/route.ts`
- **Logic:** `lib/marketing/audiences.ts` (loaders, segments, `fetchAll`, CSV), `lib/admin/popularity.ts` (grouping functions are pure), `lib/catalog/originals.ts` (versions count towards their original)
- **Tables:** `orders`, `order_items`, `preview_email_requests`, `qr_scans`, `customer_custom_images`, `stock_locations`, `email_preferences`
- **Tests:** `scripts/test-audiences.ts`, `scripts/test-popularity.ts`
- **Watch out:** the Meta CSV includes only subscribed addresses. Queries stop at `ROW_CAP` (20,000) rows and report `truncated`. Orders that are cancelled, refunded or failed are not sales (`NOT_A_SALE`).

## Referrals
Customers and partners share a personal code and a friend landing link, with credit or commission on first orders.
- **Pages:** `app/referrals/page.tsx`, `app/referrals/create/page.tsx`, `app/c/[code]/page.tsx` (friend landing link `/c/CODE`), `app/r/[code]/page.tsx`, `app/r/customer/[code]/page.tsx`, `app/r/partner/[code]/page.tsx`, `app/admin/referrals/page.tsx`, `app/admin/customer-referrals/page.tsx` (admin report: code use, sales, descendants)
- **API:** `app/api/c/[code]/route.ts`, `app/api/referrals/route.ts`, `app/api/referrals/mine/route.ts`, `app/api/referrals/validate/route.ts`, `app/api/referrals/customer/route.ts`, `app/api/customers/referral-code/route.ts`, `app/api/customer-referrals/verify/[code]/route.ts`
- **Logic:** `lib/referrals/share.ts` (a customer's code, link and QR), `lib/referrals/text.ts` (wording and link building, pure), `lib/referrals/code.ts` (unique code), `lib/commissions/customer-credit.ts` (credit earned), `lib/referrals/admin-report.ts` (the admin report: referral graph, descendants, pure functions)
- **Components:** `components/referrals/`
- **Tables:** `customer_referrals`, `referrals`, `customers`, `partners`, `commissions`, `pre_registration_codes`
- **Tests:** `scripts/test-referral-share.ts`, `scripts/test-referral-report.ts`
- **Watch out:** a code is only returned for a registered customer; the share link is `<site>/c/<CODE>` with optional `?d=<design id>` (`lib/referrals/text.ts`). Checkout takes 10% off a first order with a valid code, checked server-side in `lib/checkout/price-check.ts`.
- **How it is really recorded (read 16 Nov 2026, by code not by running):** the code a friend used is on `orders.referral_code` (set only when a discount was applied); the buyer is `orders.customer_email` (no customer id on orders). A referrer's credit is a `commissions` row with `commission_type = 'customer_credit'` and `recipient_id` = the referrer's `customers.id`, written by `handleCustomerCredit` in `app/api/webhooks/stripe/route.ts`, and only when the friend's `customers` row has `referral_type = 'CUSTOMER'` and `referrer_id` (set at signup by `app/api/referrals/verify/[code]/route.ts`). Link opens are `customer_referrals.qr_scans_count` (one row per code), written only by the older `/r/…` pages, not by `/c/CODE`. Nothing reliable writes `customers.referred_by_customer_id`, `total_referrals`, `successful_referrals`, `rewards_earned`, `referral_scans_count`, or the status and order columns of `customer_referrals`.
- **Rules (17 Nov 2026):** a customer code gives the friend a discount only when signed in, buying under their account email, a new customer (no earlier paid order that stands) and not already referred by someone else (`lib/referrals/eligibility.ts`, used by the price check, `/api/referrals/validate` and the landing route). Rates are the settings `referral_friend_discount_pct` and `referral_referrer_credit_pct` (`referralRates()`, edited on Admin → Customer Referrals; public read `/api/public/referral-rates`; wording via `referralCopy(rates)` in `lib/referrals/text.ts`). create-intent records the referral only as confirmed by the server and capped at what the browser took off (`referralToRecord`), with the owner id (`referralOwnerId`); the webhook links an unlinked friend to that owner at purchase. Referrer credit: friend's first order only, once per friend (`referrerEarnsCredit`), at the setting rate. Credit spent at checkout is deducted once, in pence (`handleCreditRedemption`, `balanceAfterRedemption`); only confirmed credit is recorded (`redemptionToRecord`). Partner codes keep a fixed 10% and their own rules. A referral the server could not check is kept as `referralUnconfirmed` in the order metadata (`lib/referrals/unconfirmed.ts`).
- **Known gaps:** two payments started together can spend the same credit; a held order still pays referral credit; credit packs have no duplicate protection; `/api/customers/balance`, `/api/customers/referrals`, `/api/customers/referral-code` and `/api/referrals/customer` return data for any email without sign-in; `app/api/referrals/verify/[code]/route.ts` stores a fixed 10% in `referral_discount_applied`.

## Messaging and email templates
Order, account and marketing emails: HTML templates, a queue processed every minute, and instant sends.
- **Pages:** `app/admin/messaging/page.tsx`, `app/admin/messaging/[templateKey]/page.tsx`, `app/admin/messaging/queue/page.tsx`, `app/admin/messaging/test/page.tsx`
- **API:** `app/api/messaging/process/route.ts` (queue cron), `app/api/messaging/send/route.ts`, `app/api/messaging/webhooks/resend/route.ts`, `app/api/admin/templates/route.ts`
- **Logic:** `lib/messaging/message-service.ts` (`sendMessage` queues, `sendMessageImmediate` sends now), `lib/messaging/message-queue.ts`, `lib/messaging/render-file.ts` (`renderEmailFile` for the HTML files), `lib/messaging/templates/` (one `.html` per email, shared layout in `partials/`), `lib/messaging/order-email.ts` (order wording)
- **Tables:** `message_templates`, `message_queue`, `message_events`, `user_messages`
- **Tests:** `scripts/test-emails.ts`
- **Migration(s):** `db/migrations/2026-10-06-email-refresh.sql`
- **Watch out:** subject lines live in `message_templates`, bodies in the `.html` files. Marketing mail must go through `canEmail` and carry the unsubscribe links (`marketingEmailExtras`). The queue cron route is scheduled in `vercel.json` but sits under `app/api/messaging`, not `app/api/cron`. Spec: `docs/specs/email-refresh.md`.

## Tracking and consent (GA4, Meta pixel, Conversions API)
Analytics and ad tags load only after cookie consent; Meta also gets server-side purchase events.
- **Pages:** `components/tracking/ConsentBanner.tsx`, `components/tracking/TrackingScripts.tsx` (both mounted in `app/layout.tsx`)
- **Logic:** `lib/tracking/consent.ts` (`pt_consent` cookie), `lib/tracking/events.ts` (client events, no-ops until tags load), `lib/tracking/meta-capi.ts` (server events), `lib/tracking/meta-request.ts` (fbp, fbc, ip, ua)
- **Tests:** `scripts/test-meta-events.ts`
- **Watch out:** marketing and analytics tags only after opt-in. `lib/tracking/meta-capi.ts` is only called when the buyer gave marketing consent, and is de-duplicated against the browser pixel by `event_id` (the Stripe PaymentIntent id).

## Social loop (before and after posts)
Paid customisations become before/after items for a website feed and Instagram carousels, after an automatic photo check.
- **Pages:** `app/admin/social/page.tsx`, `app/social/opt-out/page.tsx`, `components/social/RecentCreations.tsx`, `components/social/BeforeAfter.tsx`
- **API:** `app/api/admin/social/route.ts`, `app/api/admin/social/items/[id]/route.ts`, `app/api/admin/social/carousels/route.ts`, `app/api/public/social/feed/route.ts`, `app/api/public/social/opt-out/route.ts`
- **Logic:** `lib/social/capture.ts` (after a paid order, called from the Stripe webhook), `lib/social/photo-check.ts` (Claude check), `lib/social/privacy.ts` (what may be shown), `lib/social/feed.ts`, `lib/social/carousel.ts`, `lib/social/opt-out.ts`
- **Tables:** `social_items`, `social_batches`, `social_opt_outs`, `customer_custom_images`
- **Settings:** `social_feed_enabled`, `social_instagram_enabled`, `social_photo_check_enabled`, `social_include_previews`, `social_hero_item_id`
- **Tests:** `scripts/test-social.ts`
- **Migration(s):** `db/migrations/2026-10-04-social-loop.sql`, `db/migrations/2026-10-05-social-previews-carousels.sql`
- **Watch out:** public output is the pet's first name plus town and country only (`lib/social/privacy.ts`). Capture never throws and runs in `after()` so it cannot delay Stripe. `social_instagram_enabled` is off by default. Spec: `docs/specs/social-loop.md`.

## Quizzes (Pawsonality and others)
A swipe quiz gives a pet one of 16 Pawsonality types, with type pages and breed-matched pictures.
- **Pages:** `app/quiz/pawsonality/page.tsx`, `app/quiz/pawsonality/r/[code]/page.tsx`, `app/pawsonalities/page.tsx`, `app/pawsonalities/[animal]/[slug]/page.tsx`, `app/admin/quizzes/page.tsx`, `app/admin/quizzes/[id]/page.tsx`
- **API:** `app/api/public/quiz/[slug]/route.ts`, `app/api/public/quiz/[slug]/results/route.ts`, `app/api/public/quiz-results/[code]/route.ts`, `app/api/admin/quizzes/route.ts`, `app/api/admin/quizzes/[id]/publish/route.ts`, `app/api/cron/quiz-images/route.ts`
- **Logic:** `lib/quiz/scoring.ts` (pure; browser and server), `lib/quiz/server.ts` (data access), `lib/quiz/breed-batch.ts` (Gemini Batch breed pictures), `lib/quiz/breed-images.ts` (on-the-spot breed picture), `lib/quiz/pawsonalities.ts` (type pages), `lib/quiz/ways-in.ts` (entry links)
- **Components:** `components/quiz/`, `components/pawsonalities/`, `components/admin/quiz/`
- **Tables:** `quizzes`, `quiz_versions`, `quiz_questions`, `quiz_result_types`, `quiz_results`, `quiz_breed_images`, `quiz_image_runs`, `quiz_image_run_jobs`, `quiz_image_run_items`, `quiz_question_breed_images`
- **Tests:** `scripts/test-quiz-scoring.ts`
- **Migration(s):** `db/migrations/2026-10-01-quiz-engine.sql`, `db/migrations/2026-10-02-quiz-breed-pictures.sql`, `db/migrations/2026-10-03-quiz-ways-in.sql`, `db/migrations/2026-10-14-quiz-type-prompts-and-designs.sql`, `db/migrations/2026-10-15-pawsonality-type-pages.sql`, `db/migrations/2026-10-15-quiz-breed-batches.sql`
- **Watch out:** the engine is quiz-agnostic: a quiz is a published snapshot (`quiz_versions`). Every way in is shown only while the quiz is live. Breed pictures are made once per design and breed. Spec: `docs/specs/pawsonality-quiz.md`.

## Mugs and phone cases
Customers put their pet on a mug wrap or a phone case made from a design.
- **Pages:** `app/mugs/page.tsx`, `app/mugs/[slug]/page.tsx`, `app/mugs/design/[id]/page.tsx`, `app/phone-cases/page.tsx`, `app/phone-cases/design/[id]/page.tsx`, `app/admin/mugs/catalog/page.tsx`, `app/admin/mugs/mockups/page.tsx`, `app/admin/phone-cases/page.tsx`, `app/admin/phone-cases/case-art/page.tsx`
- **API:** `app/api/mugs/generate/route.ts`, `app/api/mugs/catalog/route.ts`, `app/api/public/mug-designs/route.ts`, `app/api/public/phone-cases/route.ts`, `app/api/phone-cases/composite/route.ts`, `app/api/admin/phone-cases/case-art/route.ts`
- **Logic:** `lib/mugs/server.ts` (a mug is stored as a customised portrait), `lib/mugs/painting.ts` (same painting prompt as customise), `lib/mugs/mockup-url.ts`, `lib/cloudinary-mug.ts` (mug print file URLs), `lib/phone-cases/case-art.ts` (background extension of a design), `lib/phone-cases/composite.ts` (customer painting into the case art), `lib/phone-cases/geometry.ts`
- **Tables:** `mug_catalog`, `phone_models`, `phone_layout_groups`, `customer_custom_images`, `image_catalog`, `products`
- **Settings:** `mug_mockup_photos`
- **Tests:** `scripts/test-mug-generation.ts` (manual: prints URLs, needs Cloudinary keys)
- **Migration(s):** `db/migrations/2026-11-11-mug-painting-prompt.sql`, `db/migrations/2026-11-11-phone-case-art.sql`, `db/migrations/2026-11-11-phone-cases.sql`
- **Watch out:** a finished mug is a `customer_custom_images` row whose picture is the 2362x1134 (2:1) wrap, so orders and fulfilment need nothing special. The phone-case slot never moves once approved. The tables `mug_generations` and `mug_colours` are used by code but are not in `db/current-db/current-schema` or `db/migrations/`.

## Pricing and products
Product catalogue (shape families, UK price, costs) and the pricing admin; prices are never written into code or copy.
- **Pages:** `app/admin/products/page.tsx`, `app/admin/products/[id]/edit/page.tsx`, `app/admin/products/new/page.tsx`, `app/admin/pricing-management/page.tsx`, `app/admin/catalogue-checks/page.tsx`
- **API:** `app/api/admin/products/route.ts`, `app/api/admin/catalogue/products/route.ts`, `app/api/admin/pricing/route.ts`, `app/api/public/products/route.ts`, `app/api/public/pricing/route.ts`
- **Logic:** `lib/products/catalogue-admin.ts` (list, create, update with price history), `lib/products/shape-family.ts` (which products go on which designs), `lib/products/catalogue.ts`, `lib/pricing/lowest-prices.ts` (copy such as "from X" reads live prices), `lib/pricing/use-lowest-prices.ts`, `lib/bundle-pricing-service.ts` (digital bundle tiers)
- **Components:** `components/admin/products/ProductForm.tsx`
- **Tables:** `products`, `product_pricing`, `formats`, `media`, `countries`
- **Tests:** `scripts/test-product-catalogue.ts`
- **Migration(s):** `db/migrations/2026-09-30-product-catalogue.sql`, `db/migrations/2026-09-30-pricing-margin-columns.sql`, `db/migrations/2026-11-10-print-range-and-xl.sql`
- **Watch out:** a price change closes the old `product_pricing` row and adds a new one (`is_current`), so history is kept. Delivery charges are flat per zone in `lib/shipping/rates.ts`, not in the database. Spec: `docs/specs/product-catalogue.md`.

## Admin shell, auth and guards
The admin area and the rule that every admin API route checks the caller.
- **Pages:** `app/admin/layout.tsx` (sidebar and client-side admin redirect), `app/admin/page.tsx` (dashboard)
- **API:** `app/api/admin/dashboard/route.ts`, `app/api/admin/settings/app/route.ts`
- **Logic:** `lib/qr/server.ts` (`requireAdmin`, `serviceClient`, `getAdminIdentity`), `lib/app-settings.ts` (`getSetting`, `SETTING_DEFAULTS`), `lib/admin/dashboard.ts`, `middleware.ts` (session refresh, rate limits, CSP, redirects)
- **Tables:** `user_profiles`, `app_settings`
- **Tests:** `scripts/check-admin-route-guards.ts`
- **Watch out:** `middleware.ts` does not stop non-admins reaching `/admin` pages (the layout checks in the browser), so each admin route handler must call `requireAdmin()` itself. Settings need a default in `SETTING_DEFAULTS` and a case in `validateSetting`; values are cached for 60 seconds.

## Operating manual
The owner's daily, market-day, weekly and monthly checklists, with ticks saved per day.
- **Pages:** `app/admin/manual/page.tsx`
- **API:** `app/api/admin/manual/ticks/route.ts`
- **Logic:** `lib/admin/manual/content.ts` (the tasks, plain data), `lib/admin/manual/dates.ts` (Europe/London dates, weeks start Monday)
- **Tables:** `ops_checklist_ticks`
- **Tests:** `scripts/test-admin-manual.ts`
- **Migration(s):** `db/migrations/2026-11-16-ops-checklist.sql`
- **Watch out:** a task `key` is its stored tick identity, so never rename one in use. Use exact sidebar page names and button labels, and never write a price (the file header lists the rules; the test checks most of them).

## Security and site health
Content Security Policy (enforced plus a stricter report-only trial) and a store of browser violation reports.
- **Pages:** `app/admin/security/csp-reports/page.tsx`, `components/security/`
- **API:** `app/api/csp-report/route.ts`, `app/api/admin/csp-reports/route.ts`, `app/api/security/violations/route.ts`
- **Logic:** `lib/security/csp.ts` (one directive list for both policies), `lib/security/csp-reports.ts` (parse and aggregate, pure), `middleware.ts` (sends the headers; own rate limiter for reports)
- **Tables:** `csp_reports`
- **Tests:** `scripts/test-csp.ts`, `scripts/check-admin-route-guards.ts`
- **Migration(s):** `db/migrations/2026-11-15-csp-reports.sql`
- **Watch out:** the enforced policy is pinned byte-for-byte in `scripts/test-csp.ts`; change `DIRECTIVES` and the test together. The report-only trial is on unless the `CSP_REPORT_ONLY` env var is `off`. Spec: `docs/specs/security-close-open-routes.md`.

## AI usage and costs
Every Gemini and Claude call is logged with tokens and cost, shown in Admin AI costs.
- **Pages:** `app/admin/ai-costs/page.tsx`, `components/admin/AiCallsTable.tsx`
- **API:** `app/api/admin/ai-usage/route.ts`, `app/api/admin/ai-usage/calls/route.ts`
- **Logic:** `lib/ai/usage.ts` (`trackGemini`, `trackClaude`, `generateWithUsage`, `createWithUsage`; the `AiFeature` list), `lib/ai/prices.ts` (USD prices, update `PRICES_AS_OF` with them), `lib/ai/feature-labels.ts` (labels), `lib/ai/period.ts`
- **Tables:** `ai_usage`
- **Tests:** `scripts/test-ai-usage.ts`
- **Migration(s):** `db/migrations/2026-10-16-ai-usage.sql`
- **Watch out:** wrap every new AI call and add its feature to `AiFeature` and `lib/ai/feature-labels.ts`. Logging failures are swallowed on purpose. Cost is stored on each row, so a later price change never rewrites history.

## Cron jobs
Five jobs, all scheduled in `vercel.json`; four live under `app/api/cron/`, the messaging queue under `app/api/messaging/`.
- `app/api/cron/variation-batches/route.ts`: every 2 minutes, submit, check and read saved Gemini batch jobs.
- `app/api/cron/quiz-images/route.ts`: every 2 minutes, breed versions of quiz pictures (submit, check, store).
- `app/api/cron/royal-mail-tracking/route.ts`: every 15 minutes, tracking check for posted parcels.
- `app/api/cron/offers/route.ts`: hourly (minute 17), one Offers pass; does nothing while `offers_enabled` is off.
- `app/api/messaging/process/route.ts`: every minute, send pending queued messages.
- Handlers are `GET` and check `Authorization: Bearer CRON_SECRET` when that env var is set. Long-running ones also have `maxDuration` entries in `vercel.json`.

## Conventions seen everywhere
- Missing-migration tolerance: new code works before the SQL is run. Copy `MISSING` in `lib/previews/server.ts` or `lib/offers/settings.ts`: match the error text, then answer "unavailable" or leave the feature off.
- Paging past 1000 rows: `fetchAll` in `lib/marketing/audiences.ts` (used by `lib/admin/popularity.ts`).
- Signed links that carry an id and an expiry, never an address: `lib/previews/email-link.ts` (also `lib/offers/link.ts`).
- Admin route guard is the first line of every handler: `const denied = await requireAdmin(); if (denied) return denied;` (see `app/api/admin/offers/route.ts`; imported from `@/lib/qr/server`).
- Service-role Supabase client in routes: `serviceClient()` from `lib/qr/server.ts`.
- Settings: read with `getSetting` from `lib/app-settings.ts`.
- Pure functions plus a plain-assert script: logic goes in a client-safe file with no database, tested by a `test-<name>.ts` script in `scripts/` (copy `scripts/test-preview-emails.ts`; many need dummy env vars shown in the file's first line); run with `npx tsx scripts/test-<name>.ts`.
- Marketing email only through `canEmail` in `lib/marketing/preferences.ts`.
- Cron routes: copy `app/api/cron/variation-batches/route.ts`.
