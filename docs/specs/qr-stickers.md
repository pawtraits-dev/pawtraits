# Spec — Sticker QR Codes, Point-of-Sale Locations & Scan Attribution

**Status:** Implemented (phases 1–3) · 2026-09-28 · Owner: Steve
**SQL:** `db/migrations/2026-09-28-qr-stickers-and-locations.sql` (run manually in Supabase)
**Builds toward:** `docs/specs/stock-print-batches.md` (same table names; this is its first slice)

## 1. Goal

Every catalogue image gets its own permanent QR code. The QR is printed on the removable sticker on the back of a print. When someone scans it, they land on `/customise/[imageId]` with that image already chosen, ready to go through scan → customise → checkout. If the sticker was printed for a particular stall or location, the scan, and any order that follows, is credited to that location.

## 2. Key design decisions

| Decision | Choice | Why |
|---|---|---|
| What the QR points at | A short link, `/s/{stock_ref}` | It isn't the `/customise/<uuid>` URL itself. The UUID URL needs a version-7 QR (45×45 modules); the short link needs version 3 (29×29). On a 20 mm sticker that makes the modules 0.61 mm instead of 0.41 mm, so the code scans much more reliably. The short link can also be repointed, and it records the scan before it redirects. |
| Unique id per image | `image_catalog.stock_ref`, an integer from a sequence starting at 1001. Assigned automatically, including to every existing image. | It's human-friendly: it can be read out, typed at the till, and printed as `Ref 1123`. It's the same field the stock spec already plans. |
| "Saved to the DB" | Save the **code**, not a PNG | The QR image is completely determined by the code, so it's generated on demand as SVG or PNG. Storing an image for every image × size × location adds nothing and can go stale. |
| URL format | All in capitals, with the location as a path segment: `HTTPS://PAWTRAITS.PICS/S/1123M/CAMDEN` | Capitals, digits and `/ : .` use the QR "alphanumeric" mode, which gives a smaller code than `?l=camden`. Domains don't care about case, and the route handles the path case-insensitively. |
| Size in the code | Optional suffix `S`, `M` or `L` | Lets the customise page pre-select the size, and lets the stall till identify the exact item from the same code. |
| Location | Optional final segment: a `stock_locations.code` of 2–8 capitals or digits | Fixed at the moment the sticker is printed (see §5). |
| QR rendering | Black on white, error correction Q, 4-module quiet zone | The current `lib/qr-code.ts` default is purple on a transparent background with a 2-module margin, which is not safe for print. |

Examples:
- `/s/1123` goes to image 1123 with no location. Use this for online use and generic stickers.
- `/s/1123M` goes to image 1123 with size M selected.
- `/s/1123M/CAMDEN` goes to image 1123, size M, credited to the Camden stall.

## 3. How a scan flows through

```
Phone camera → GET /s/1123M/CAMDEN
  1. Parse the ref, size and location code (case-insensitive; the old ?l= form is also accepted)
  2. Look up image_catalog by stock_ref, and stock_locations by code (active only)
  3. Set the pt_vid visitor cookie if missing (1 year)
  4. INSERT into qr_scans (is_bot from the user-agent, is_repeat if the same visitor
     scanned the same ref within 30 minutes, ip_hash)
  5. Set the pt_qr cookie = HMAC-signed {scanId, locationId, imageId, ts},
     30 days, httpOnly, SameSite=Lax
  6. 302 → /customise/{imageId}?src=qr&size=M&utm_source=stall&utm_medium=qr&utm_campaign=CAMDEN

Customise → generate → /shop/custom-portrait/[id] → cart → checkout
  7. POST /api/payments/create-intent reads the pt_qr cookie on the server, checks the HMAC,
     and adds metadata.qrScanId and metadata.posLocationId
  8. The Stripe webhook creates the order with orders.pos_location_id and orders.qr_scan_id,
     then UPDATEs qr_scans SET order_id, converted_at WHERE id = qrScanId AND order_id IS NULL
```

**Attribution rules**
- **Last scan wins, within 30 days.** A newer scan replaces the cookie.
- The order is credited to the location **even if the customer buys a different image**. The report shows "same image" and "other image" separately.
- Partner referral codes and discounts are unaffected. They are a separate dimension, and an order can carry both.
- Unknown or inactive location code: still redirect. Store the raw `location_code` and set `location_id` to null. This way a mistyped or retired code never breaks a sticker.
- Unknown ref, or an image that isn't public: redirect to `/browse?src=qr&missing=1123` and record the scan with `image_id` null.

## 4. Database changes (see the SQL file)

1. **`image_catalog.stock_ref`** (integer, NOT NULL, UNIQUE, default from the sequence). Existing images are numbered in creation order starting at 1001.
2. **`stock_locations`**: code, name, type (studio/stall/partner/other), optional partner link, at-market discount, active flag. The `STUDIO` row is created by the migration.
3. **`qr_scans`**: one row per scan, holding image, ref, size, location (id and raw code), visitor, repeat and bot flags, user-agent, referer, hashed IP, and the order it converted to.
4. **`orders.pos_location_id`** and **`orders.qr_scan_id`**.
5. RLS: admins can read and manage both new tables. Routes write with the service role.
6. View **`qr_location_daily`**: scans, unique visitors, orders and paid revenue, per location per day.

The existing `qr_code_tracking` table (a single counter per image and partner) is left as it is for partner QRs. Sticker scans don't use it.

**Changes this makes to the stock spec:**
- `stock_qr_scans` is replaced by `qr_scans`. A nullable `stock_sku_id` gets added when `stock_skus` is built.
- The label QR format becomes the uppercase path form above.

## 5. The location question: how to capture where a scan came from

A customer's phone can't know which stall it's standing at, so the location has to come from the sticker. There are three options:

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Location printed into the sticker** (recommended now) | `/s/1123M/CAMDEN`, chosen when printing the sticker sheet | Simple; works today; no stock system needed | If a print moves to another stall, its sticker still says CAMDEN. The stickers are removable, so the fix is to print new ones for moved stock (a "reprint stickers for location" action). |
| B. Stall-level QR on a sign | One QR per stall on a banner, leading to browse | Fine for "browse everything" | Doesn't go to the specific image |
| C. A code per physical print | Every unit gets its own code (`print_batch_units`), and the code → location mapping lives in the DB | Always correct, even after transfers; one code can show sold or unsold | Needs the stock batch system (stock spec §5 and §10). The QR is also a little denser. |

**Plan:** build A now, and make the route able to take a unit code later (C) without changing the URL scheme. For example, `/s/U7K2QX`, where the route treats a code containing letters beyond the size suffix as a unit code.

**Stickers without a location** (`/s/1123M`) are allowed. Use them for stock that hasn't been allocated yet, and the scan is recorded as location "NONE".

**Worth knowing:** a sold print goes home with its sticker. If the buyer's friend scans it next month, that is still credited to the stall that sold it. That's arguably right, because the stall's print earned the referral. The report shows the days between scan and sale so these can be told apart if needed.

## 6. Implementation plan

### Phase 1: foundation (about ½ day)
| # | Work | Files |
|---|---|---|
| 1.1 | Run the SQL migration and refresh `db/current-db/current-schema` | Supabase SQL editor |
| 1.2 | Types `StockLocation`, `QrScan`; add `stock_ref` to the image types | `lib/product-types.ts` |
| 1.3 | `buildStickerUrl({stockRef, size?, locationCode?})` and `parseStickerPath(segments)`, pure functions with unit tests | `lib/qr/sticker-url.ts` (new) |
| 1.4 | `renderStickerQr(url, {format:'svg'\|'png', sizePx})`: black on white, error correction Q, margin 4. Uses the `qrcode` package only, **not** `lib/qr-code.ts`, because that file imports `canvas`, which is heavy on Vercel. | `lib/qr/render.ts` (new) |
| 1.5 | Environment variables: `QR_ATTRIBUTION_SECRET` (HMAC key), `QR_IP_SALT`, `NEXT_PUBLIC_SHORT_LINK_BASE=https://pawtraits.pics` | Vercel + `.env.example` |

### Phase 2: scan resolver and attribution (about 1 day)
| # | Work | Files |
|---|---|---|
| 2.1 | `GET` route handler for §3 steps 1–6. Node runtime, `AdminSupabaseService`, never cached (`dynamic = 'force-dynamic'`) | `app/s/[...slug]/route.ts` (new) |
| 2.2 | Check that `middleware.ts` doesn't rate-limit or auth-redirect `/s/*` | `middleware.ts` |
| 2.3 | Read and verify the `pt_qr` cookie, and add `qrScanId` and `posLocationId` to the Stripe metadata | `app/api/payments/create-intent/route.ts`, `lib/qr/attribution.ts` (new) |
| 2.4 | Write `pos_location_id` and `qr_scan_id` on the order, and mark the scan converted | `app/api/webhooks/stripe/route.ts` |
| 2.5 | Customise page: read `src=qr` and `size`, pre-select the size further down the flow, and show a light "Found you from the stall!" welcome line | `app/customise/[imageId]/page.tsx` |

### Phase 3: admin (about 1–1½ days)
| # | Work | Files |
|---|---|---|
| 3.1 | Endpoint for a single QR as SVG or PNG, with optional `size` and `loc` | `app/api/admin/qr/[imageId]/route.ts` (new) |
| 3.2 | Catalogue image panel (in the `/admin/catalog` pop-up): show `Ref 1123`, a QR preview large enough to scan off-screen, a location dropdown, a size picker, copy link, **Test link**, SVG/PNG download, and a jump to the sticker sheet builder | `/admin/catalog` image detail component |
| 3.3 | Locations page: create, edit and deactivate locations; codes are validated as `^[A-Z0-9]{2,8}$` | `app/admin/stock/locations/page.tsx`, `app/api/admin/stock/locations/route.ts` |
| 3.4 | **Sticker sheet generator**: pick images, a size for each, a location, and a quantity, and get an A4 PDF. The default is 8 per sheet on 99.1 × 67.7 mm labels, with a "start at label position N" option. Each label has the QR (about 32 mm of code), a **thumbnail of the design** (on by default, can be turned off; fetched from Cloudinary with no watermark, embedded once per design), the call to action, `Ref 1123-M`, the short URL, the location code and a `n/total` sequence number so labels can be matched to prints during a production run. This is a simplified version of the labels in stock spec §8, which gets merged into the batch labels later. Adds the `pdf-lib` dependency. | `app/admin/stock/stickers/page.tsx`, `app/api/admin/stock/stickers/route.ts`, `lib/qr/sticker-sheet.ts` |
| 3.5 | QR report: by location (scans, unique visitors, orders, conversion %, revenue) and top scanned images, with a date range, built on `qr_location_daily` | `app/admin/stock/qr-report/page.tsx` |

### Phase 4: verification
- Unit tests for build/parse: case variants, unknown size letters, over-long codes, the old `?l=` form, and injection attempts such as `../`.
- Print one test sheet. Scan it with an iPhone camera, an Android camera and Google Lens at arm's length. Check the redirect lands on the right image with the size selected.
- End to end in Stripe test mode: scan → customise → checkout → the order row has `pos_location_id`, and the `qr_scans.order_id` is filled in.
- Link-preview check: pasting the URL into WhatsApp gives `is_bot = true` and doesn't overwrite a real visitor's cookie.

## 7. Dependency to check before starting: the guest "express" flow

`/customise/[imageId]` loads the user's pets with `/api/customers/pets`, and custom-image generation is a customer API. For a true scan-and-go flow, someone standing at a stall who isn't logged in must be able to:
1. upload a photo,
2. generate, and
3. check out,

with at most an email-only quick signup. **I haven't verified this yet.** If generation needs a full account today, that's the bigger blocker for stall conversion, and it should be the next piece of work. The QR work is useful regardless.

## 8. Open questions
1. **Attribution window:** is 30 days right? Stall shoppers who go home and think it over might need longer.
2. Should a stall location ever earn commission, e.g. a partner-run stall? `stock_locations.partner_id` allows for it, but it isn't wired to commissions here.
3. **Short-link domain:** use `pawtraits.pics`, or buy a shorter one? A shorter domain makes a smaller QR.
4. Should stickers without a location be allowed for stall stock, or should the sticker generator require a location?
