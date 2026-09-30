# Print aspect ratios — one reference image for every size

**Status:** Built 2026-09-30 · Migration: `db/migrations/2026-09-30-print-crops.sql`

## The rule

- **Reference images come in four shapes only:** 1:1 (square), 2:3 (portrait), 3:2 (landscape), 2:1 (wide, for mugs).
- **Foamex sizes from a 2:3 / 3:2 reference:**

| Size | Blank | Shape | From the reference |
|---|---|---|---|
| S | 150 × 200 mm | 3:4 | centre crop — about 11% off the long edge (5.5% each end) |
| M | 200 × 300 mm | 2:3 | edge to edge, no crop |
| L | 300 × 400 mm | 3:4 | centre crop, same as S |

- **Orientation follows the image.** A 3:2 landscape reference prints landscape (M 300 × 200, S 200 × 150, L 400 × 300) and S/L lose a little at the sides. Product rows can store the size either way round.
- **Composition:** keep heads, paws and any text out of the outer 6% at the top and bottom (portrait) or left and right (landscape), so S and L never cut anything important.
- **2:1 mug art:** Gemini can't make 2:1, so it is generated at 21:9 and cropped to 2:1 when used.

## Where it's enforced

| Where | What happens |
|---|---|
| Formats (admin) | The aspect ratio is a dropdown of the four shapes. The API rejects anything else for an active format; the database constraint does too (`formats_aspect_ratio_allowed`, applies to new/edited rows). Legacy formats can still be deactivated. |
| Catalogue upload | The image's shape is matched to the nearest allowed ratio. More than 3% off → a warning to re-export (2:1 allows up to 20% so 21:9 mug art passes). |
| Gemini generation | Every call pins the output shape to the format's ratio (`imageConfig.aspectRatio`): catalogue variations and customer portraits alike. |

## Print files

Made when the order is created (`lib/orders/order-image.ts → buildPrintFiles`), per order line:

- `order_items.print_image_url` — explicit centre crop to the product's shape, scaled to the exact print size at 300 dpi. This is what Gelato gets (each line gets its own file, so M and L of one image differ).
- `order_items.self_print_file_url` — the same crop with **1.5 mm bleed** on every side, for printing onto pre-cut blanks.
- `order_items.print_file_meta` — source pixels, print size, crop, **effective dpi**, quality (good ≥ 250, ok ≥ 150, low below), and any mismatch (e.g. a square image on a rectangular product).

In `/admin/orders` each item's **Print file** link opens the self-print version and shows the dpi (amber when 150–249, red below 150). **Rebuild print files** (order menu) regenerates them, which is also how to fix orders placed before this change. Packing slips print the size and flag low resolution.

## What customers see

The buy sheet shows each size as a small thumbnail cut to that size's shape, and S/L say "Trimmed slightly top and bottom to fit" (or "at the sides" for landscape).

## Resolution (decided 2026-09-30)

1. **Previews at 2K on Nano Banana Pro** — customer previews and all admin variations (catalogue variation service, admin preview routes, public generate routes). On Pro, 1K and 2K cost the same ($0.134). Catalogue variations moved from Nano Banana 2 to Pro, roughly doubling their cost per image. Override with `GEMINI_PREVIEW_IMAGE_SIZE`.
2. **Cloudinary AI upscale for print files** when a file would be under 250 dpi: crop → shrink to ≤ 4.1 MP (the AI input limit) → `e_upscale` (4× each side) → scale to the print size. The 4× output must fit the Cloudinary plan's transformation limit — `CLOUDINARY_MAX_TRANSFORM_MP` (default 25; raise it if the plan allows more, which keeps more of the source). Upscales cost extra Cloudinary transformation credits. Files are pre-generated after the order (Cloudinary returns 423 while it works) and before anything is sent to Gelato.
3. **4K re-render for Large custom portraits** — when a custom portrait would print under 200 dpi from its 2K preview (in practice: L), Nano Banana Pro re-renders the approved preview at 4K (~$0.24) after the webhook has replied. The master is stored on `customer_custom_images.print_master_*`, reused by later orders, and the open order lines are rebuilt from it. Until it's ready the line uses the AI-upscaled 2K file; if it fails, admin shows "4K master failed — rebuild" and **Rebuild print files** retries.

| From a 2K 2:3 preview | S | M | L |
|---|---|---|---|
| Source dpi | ~287 | ~215 | ~144 |
| Print file | as is | AI upscale → 300 | 4K master (~287) |

## Code

| Piece | File |
|---|---|
| Geometry (pure, client-safe) | `lib/print/print-geometry.ts` |
| Cropped print URL | `lib/cloudinary.ts → getCroppedPrintUrl / getSourceDimensions` |
| Print files per order line | `lib/orders/order-image.ts → buildPrintFiles`, used by `lib/orders/order-items.ts` |
| Gemini shape | `lib/gemini-models.ts → toGeminiAspectRatio / geminiImageConfig`, `lib/gemini-variation-service.ts` |
| Admin | `components/admin/AspectRatioSelect.tsx`, `components/admin/orders/PrintFileLink.tsx`, action `rebuild_print_files` |
| Customer | `components/customise/BuyOptionsSheet.tsx` (shape thumbnails + trim note) |
| 4K masters | `lib/print/print-master.ts` (`ensurePrintMaster`, `finishPrintFiles`) — called from the Stripe webhook via `after()` and from Rebuild print files |
| Tests | `scripts/test-print-geometry.ts` (20 checks) |
