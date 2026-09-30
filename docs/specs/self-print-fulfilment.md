# Self-print fulfilment (default) with optional Gelato

**Status:** Built 2026-09-29 · Migration: `db/migrations/2026-09-29-self-print-fulfilment.sql`

## What happens to a paid order

| Order contains | Where it goes |
|---|---|
| Prints to post | Setting `default_fulfillment_provider`: **`self_print`** (default) → queued in `/admin/orders` as **To print**; `gelato` → sent to Gelato automatically (old behaviour) |
| Downloads only / prints handed over at the stall | Not in the queue (nothing to post) |
| Price check "suspicious" | **On hold** — release it from the queue after checking Stripe |

The setting is changed from the "New orders go to" selector at the top of the queue.

## Self-print steps

`to_print → printed → packed → posted`, stored on `orders.self_print_status` with `printed_at`, `packed_at`, `shipped_at`.

- **Printed / Packed:** one click each (or in bulk for selected orders).
- **Posted:** choose the postage service (Royal Mail Tracked 48/24, 1st, 2nd, Special Delivery, other courier). Tracked services need a tracking number; the Royal Mail tracking link is filled in automatically. Sets `status = shipped`, `fulfillment_status = fulfilled`, and emails the customer (`order_shipped` template) unless unticked.
- **Move back a step** undoes a mis-click (posted → packed reopens the order; the email is not re-sent).
- **Send to Gelato instead** is available until the order is posted. It creates the Gelato order from the same print files. An order already at Gelato can't be switched back from the admin (cancel in Gelato first).
- Every change is written to `order_fulfillment_tracking` (audit trail).

## Paperwork

- **Packing slips (PDF):** one A4 page per order — a cut-out address label (with optional return address from the `return_address` setting), the items with thumbnail, size, quantity, per-item ref (`PW-1234-1`) and Printed/Packed tick boxes, packing note, thank-you footer. When several orders are selected, a **print-run pick list** comes first (blanks to pull by size, then every print).
- **Click & Drop CSV:** one row per order in Royal Mail's import format. Map the columns once in Click & Drop (Settings → Import) and save the mapping; weight and package size can be defaulted in the mapping.
- **Print file:** each item links to its full-resolution print file (`order_items.print_image_url`).

## Where the code is

| Piece | File |
|---|---|
| Routing on payment | `lib/fulfillment/fulfillment-router.ts` (+ `self-print-fulfillment-service.ts`) |
| Actions, queue, posted email | `lib/fulfillment/order-fulfilment.ts` |
| Shared helpers (client-safe) | `lib/fulfillment/shared.ts` |
| Packing slips + CSV | `lib/fulfillment/packing-slips.ts` |
| API | `GET /api/admin/orders/fulfilment`, `POST /api/admin/orders/[id]/fulfilment`, `GET …/fulfilment/packing-slips?ids=`, `GET …/fulfilment/click-and-drop?ids=` (all admin-only) |
| Service layer | `AdminSupabaseService.getFulfilmentQueue / updateOrderFulfilment / getPackingSlipsUrl / getClickAndDropCsvUrl` |
| UI | `components/admin/orders/FulfilmentQueue.tsx` (on `/admin/orders`), `OrderFulfilmentPanel.tsx` (on `/admin/orders/[id]`), `FulfilmentActions.tsx`, `MarkPostedDialog.tsx` |
| Tests | `scripts/test-self-print-fulfilment.ts` (20 checks) |

## Also fixed along the way

- `/api/admin/orders` and `/api/admin/orders/[id]` had no admin check — anyone could read every order and address. Now admin-only.
- `/admin/orders/[id]` read `params.id` directly, which is a Promise in Next 15+, so the page fetched `/api/admin/orders/undefined`. Now uses `useParams()`.
- The fulfilment router looked services up by class name, which isn't reliable after minification; it now keys by instance.
- The cookie banner no longer shows on `/admin` pages.

## Later (not built)

- Feeding self-print orders into print batches / bed layouts (stock-print-batches spec, Phase 2).
- Click & Drop API (push orders, pull tracking automatically).
- Emailing customers automatically when Gelato ships (the Gelato webhook records tracking but sends no email).
- Print files cropped/sized per blank at 300 dpi (currently the full-resolution original).
