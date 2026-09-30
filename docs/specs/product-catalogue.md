# Product catalogue — self-print first, Gelato optional

**Status:** Built 2026-09-30 · Migration: `db/migrations/2026-09-30-product-catalogue.sql`

## The model

- **A product is a size in a material, offered on a shape family** — not tied to one format or to a Gelato SKU.

| Family | Offered on | Notes |
|---|---|---|
| `rect_2x3` Portrait & landscape | 2:3 and 3:2 designs | Same product and price for both. Size is stored portrait (e.g. 20×30); landscape designs print turned (30×20). A landscape image never goes on a portrait print. |
| `square` | 1:1 designs | |
| `wide` Wide (mugs) | 2:1 designs | |
| `any` All designs | every design | Digital downloads |

- Legacy products with no family still match their single `format_id` and show under "Single format (legacy)" in admin.
- **Price:** the UK price lives on the product, stored as the current GB row in `product_pricing` (`sale_price`, `product_cost` = unit cost, `shipping_cost` = postage cost). There is one GB row per product (the database enforces product + country unique); saving updates it in place. Orders keep the price they sold at. Other countries fall back to the GB price.
- **Margin** shown in admin = price − unit cost − postage − card fees (estimated 1.5% + 20p).
- **Gelato is optional:** `gelato_sku` (portrait/square) and `gelato_sku_landscape` (if Gelato uses a different UID for landscape). Only "Send to Gelato" uses them; a product with no SKU can't be sent to Gelato.
- **Fulfilment default** is `manual` (self-print); digital downloads use `download`.

## Starter range (seeded by the migration)

| SKU | Size (portrait) | Family | Price |
|---|---|---|---|
| FOAMEX-S | 15×20 cm | rect_2x3 | £25.00 |
| FOAMEX-M | 20×30 cm | rect_2x3 | £35.00 |
| FOAMEX-L | 30×40 cm | rect_2x3 | £50.00 |
| DIGITAL | — | any | £9.99 |

Unit and postage costs start at 0 — fill them in on /admin/products to see margins.

## Admin

- **/admin/products** — products grouped by family: price, costs, margin, Gelato tick, in-shop switch; warns if an in-shop product has no price.
- **Add / edit form** — print or digital, material (from /admin/media), family, size name/code, size in cm with a portrait/landscape preview and crop note, price/unit cost/postage with live margin, optional Gelato SKUs, featured and sort order.
- **Delete** — products with orders or stock are deactivated rather than deleted.

## How the shop matches products to designs

Product APIs (`/api/public/products`, `/api/partners/products`, `/api/admin/products`) add `format_ids` to each product. Pages use `productMatchesFormat(product, formatId)` instead of comparing `format_id`. `/api/public/format-products` matches by family. Buy-sheet titles and print specs use `orientedSize` so landscape designs show 30×20.

## Knock-on fixes

- `/api/shipping/options` no longer requires a Gelato product UID (self-print checkout would have failed).
- `GelatoFulfillmentService.canFulfill` requires a `gelato_sku` (was: `fulfillment_method = 'gelato'`); landscape lines use `gelato_sku_landscape` when set.
- Admin product APIs now require an admin (`requireAdmin`).

## Delivery charges

Flat Royal Mail Tracked charge per order, whatever the size or number of prints: **UK £5 · Europe £10 · USA £15** (`lib/shipping/rates.ts`, which also lists the countries we deliver to). `/api/shipping/options` returns that single option; the payment price check uses the server's rate, not the browser's. Product "postage cost" is only for postage the delivery charge doesn't cover — usually 0.

`product_pricing.profit_margin_percent` / `markup_percent` were DECIMAL(5,2), so markups over 999% failed to save — widened by `db/migrations/2026-09-30-pricing-margin-columns.sql`.

## Not yet done

- `/admin/pricing` removed (2026-09-30). `/admin/pricing-management` is legacy (multi-country, Gelato cost based).

## Code

| Piece | File |
|---|---|
| Families (client-safe) | `lib/products/shape-family.ts` |
| Add `format_ids` | `lib/products/catalogue.ts` |
| Admin logic | `lib/products/catalogue-admin.ts` |
| Admin API | `app/api/admin/catalogue/products/route.ts`, `[id]/route.ts` |
| Admin UI | `app/admin/products/*`, `components/admin/products/ProductForm.tsx` |
| Tests | `scripts/test-product-catalogue.ts` (12 checks) |
