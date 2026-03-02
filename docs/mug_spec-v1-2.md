# Pawtraits Mug Product — Functional Specification
**Version 1.2 | March 2026 | Confidential**

> Updated: aligned with CLAUDE.md architectural patterns and existing DB schema.
> Changelog from v1.1: mug_generations aligned to customer_generated_images pattern; AdminSupabaseService specified throughout; credits system scoped out; env vars confirmed; npm flag added.

---

## 1. Overview & Objectives

Mugs are sold as standalone products. Each mug features a dynamically-assembled 2:1 composite image combining a personalised AI-generated pet image (left panel) with a zodiac or breed banner and description (right panel), printed full wrap-around via Gelato.

Four new capabilities:

- A single Gemini API call that personalises the pet image and recolours highlight elements to match the chosen mug colour — consistent with the existing Gemini integration (`GEMINI_API_KEY` already configured).
- Cloudinary-native composite assembly via the Transformation API. No new image processing libraries required.
- A standalone customer purchase flow: browse catalog → upload photo → enter pet name → select colour → preview → buy.
- A six-colour theming system (Gelato mug colour range) applied to text overlays and image highlights.

> ✅ **CLAUDE.md alignment:** Gemini integration exists. Use the same API call pattern as the existing image variation generation (`tsx scripts/test-image-variants.ts`). `GEMINI_API_KEY` env var is already present in the project.

---

## 2. Architectural Compliance Requirements

All mug feature code MUST follow the critical architectural patterns defined in CLAUDE.md.

### 2.1 Data Access Layer

- **Admin routes** (`/admin/mugs/*`): use `AdminSupabaseService` from `@/lib/admin-supabase` exclusively. Never use `SupabaseService` in admin routes.
- **Customer routes** (`/mugs/*`, `/api/mugs/*`): use `SupabaseService` and API endpoints with email authentication. Pattern: `fetch('/api/mugs/...?email=user@example.com')`.
- No direct Supabase `.from()` calls in any frontend component. All DB access goes through API routes or service classes.

```typescript
// ✅ CORRECT — Admin mug catalog management
import { AdminSupabaseService } from '@/lib/admin-supabase';
const adminService = new AdminSupabaseService();
const catalog = await adminService.getMugCatalog(); // add this method

// ✅ CORRECT — Customer mug API route
const { data: { user } } = await supabaseService.getClient().auth.getUser();
const res = await fetch(`/api/mugs/catalog?email=${user.email}`);

// ❌ WRONG — Never do this in a component
const { data } = await supabase.from('mug_catalog').select('*');
```

### 2.2 TypeScript & Types

- All mug-related types go in `/lib/product-types.ts` — do NOT create a separate `mug-types.ts` file.
- Database types follow existing pattern in `/lib/types.ts`.
- Use strict TypeScript — no `any` except in filter functions as per CLAUDE.md.

### 2.3 Dependencies

> ⚠️ **Note:** Any new npm packages must be installed with `npm install [package] --legacy-peer-deps` (React 19 compatibility requirement). Do not use `npm install` without this flag.

- No new image processing libraries (Sharp, node-canvas etc.) — Cloudinary handles all compositing.
- No new font embedding libraries — Life Savers and Spartan are Google Fonts natively supported by Cloudinary.
- The Cloudinary Node SDK is already installed. No additional Cloudinary packages needed.

### 2.4 Route Structure

- Customer-facing pages: `/mugs/*` and `/mugs/[slug]/personalise` — follow existing `/customer/*` layout patterns.
- API routes: `/api/mugs/*` for public/customer access; `/api/admin/mugs/*` for admin.
- Admin pages: `/admin/mugs/*` using `AdminSupabaseService`.
- Add test script: `tsx scripts/test-mug-generation.ts` following existing script conventions.

---

## 3. Product Design & Composite Layout

### 3.1 Physical Product

| Field | Value |
|---|---|
| Product type | 11oz ceramic mug, white base |
| Print method | Full wrap-around sublimation via Gelato |
| Printable area | 200 × 96 mm |
| Print file | 2:1 JPEG covering full printable area |
| Gelato SKU | Confirm via Gelato API/dashboard — store in `products` table (`gelato_sku` field) |
| Fulfillment | Existing Gelato integration — no changes to submission logic |
| Pricing admin | Set via existing `product_pricing` table (multi-country). Admin product pages. |

### 3.2 Composite Image Specification

| Field | Value |
|---|---|
| Canvas dimensions | 2362 × 1134 px (200mm × 96mm @ 300 DPI) |
| Output format | JPEG quality 95, sRGB |
| Left panel | 1181 × 1134 px — personalised Gemini image + pet name |
| Right panel | 1181 × 1134 px — banner heading + sub-heading + description |
| Dividing line | 2px vertical rule at x=1181, full height, colour = mug colour hex |
| Background | White (#FFFFFF) |
| Assembly method | Cloudinary Transformation API — chained `l_` overlays, no server-side image processing |

> ⚠️ **Note:** Verify Gelato bleed requirements for their 11oz mug before finalising canvas size. Adjust if they require 2–3mm bleed per edge.

### 3.3 Typography

| Element | Font | Weight | Cloudinary `font_family` value | Colour |
|---|---|---|---|---|
| Pet name (left panel) | Life Savers | Regular | `Life Savers` | Mug colour hex |
| Banner heading (right) | Spartan | Bold | `Spartan` | Mug colour hex |
| Sub-heading (right) | Spartan | Bold | `Spartan` | #2D2926 (always) |
| Description body (right) | Spartan | Regular | `Spartan` | #555555 (always) |

> ✅ **CLAUDE.md alignment:** Both Life Savers and Spartan are Google Fonts — natively supported by Cloudinary with no upload, plan upgrade, or licensing required. Reference directly in transformation parameters.

---

## 4. Colour Theming System

### 4.1 The Six Gelato Mug Colours

| Name | Mug Hex | Text Hex | Cloudinary `co_` | Notes |
|---|---|---|---|---|
| Yellow | #FDD26E | #2D2926 | `rgb:FDD26E` | Dark ink on yellow |
| Navy | #012168 | #FDD26E | `rgb:012168` | Yellow gold on navy |
| Pink | #E4A9BB | #2D2926 | `rgb:E4A9BB` | Dark ink on pink |
| Green | #A4D65B | #012168 | `rgb:A4D65B` | Navy on green |
| Red | #D22730 | #FFFFFF | `rgb:D22730` | White on red |
| Black | #2D2926 | #FDD26E | `rgb:2D2926` | Yellow gold on black |

### 4.2 Colour Application Rules

- Pet name text → mug colour (`co_` parameter in Cloudinary).
- Banner heading text → mug colour (`co_` parameter in Cloudinary).
- Vertical divider → mug colour.
- Sub-heading and description → always dark (#2D2926 / #555555) regardless of mug colour.
- Background → always white (#FFFFFF).
- Image highlights (crown, collar, props) → recoloured by Gemini at generation time. Cannot change without a new Gemini call.

### 4.3 Database Schema — mug_colours

```sql
CREATE TABLE mug_colours (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,  -- 'Yellow', 'Navy', etc.
  slug        TEXT NOT NULL UNIQUE,  -- 'yellow', 'navy', etc.
  hex         TEXT NOT NULL,         -- 'FDD26E' (no hash)
  text_hex    TEXT NOT NULL,         -- contrast text ON mug body
  overlay_hex TEXT NOT NULL,         -- text colour IN composite image
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO mug_colours (name, slug, hex, text_hex, overlay_hex, sort_order) VALUES
  ('Yellow', 'yellow', 'FDD26E', '2D2926', 'FDD26E', 1),
  ('Navy',   'navy',   '012168', 'FDD26E', '012168', 2),
  ('Pink',   'pink',   'E4A9BB', '2D2926', 'E4A9BB', 3),
  ('Green',  'green',  'A4D65B', '012168', 'A4D65B', 4),
  ('Red',    'red',    'D22730', 'FFFFFF', 'D22730', 5),
  ('Black',  'black',  '2D2926', 'FDD26E', '2D2926', 6);
```

---

## 5. Customer Purchase Flow

### 5.1 Flow Overview

1. **Browse** `/mugs` — grid of catalog tiles filterable by Zodiac / Dog Breeds / Cat Breeds.
2. **Upload** — customer uploads pet photo at `/mugs/[slug]/personalise`.
3. **Name** — customer enters pet name (max 20 chars).
4. **Colour** — customer selects one of six mug colour swatches.
5. **Generate & Preview** — single Gemini call → Cloudinary composite → preview shown.
6. **Buy** — standard cart/Stripe/Gelato checkout — no changes to existing payment flow.

### 5.2 Mugs Catalog Page (`/mugs`)

- Grid of `mug_catalog` entries. Filter tabs: All / Zodiac / Dog Breeds / Cat Breeds.
- Each tile: `catalog_image_url` (Cloudinary), name, first ~120 chars of description.
- No authentication required to browse — public page.
- Follow existing `/customer` page layout and Tailwind component patterns.

### 5.3 Personalise Page (`/mugs/[slug]/personalise`)

Single page with progressive reveal sections (not multi-page wizard):

- **Photo upload:** use existing Cloudinary upload API route pattern. Accepts JPG/PNG, min 500×500px. Displays thumbnail on upload. Stores Cloudinary `public_id` in component state.
- **Pet name input:** single text field, max 20 chars, required. Real-time character count.
- **Colour picker:** six circular swatches from `mug_colours` table. Ring highlight on selection. Colour name below swatch.
- **Generate Preview:** disabled until all three fields complete. On click → `POST /api/mugs/generate`.
- **Loading:** use existing loading animation/spinner component. Message: *"Creating [PetName]'s mug…"*. Expected wait: 15–30s.
- **Preview:** `composite_preview_url` displayed on simple CSS mug mock-up overlay (no third-party library).
- **Colour change after preview:** calls `POST /api/mugs/recolour` (fast, no Gemini). Shows inline notice that highlight colour is fixed until Re-generate.

### 5.4 Credits System — Explicit Scope Decision

> ⚠️ **Note:** The existing `customer_customization_credits` system tracks generation credits. Mugs in Phase 1 do NOT consume credits — mug generation is charged at point of purchase (product price covers cost). This must be explicitly stated so Claude Code does not inadvertently wire up credit deduction for mug generations. This decision to be revisited in Phase 2 if a subscription/credit model for mugs is introduced.

### 5.5 Checkout

- Standard cart → Stripe → Gelato flow. No changes to `/app/api/payments/create-intent` or webhooks.
- At order confirmation (`payment_intent.succeeded` webhook): copy `composite_print_url` from `mug_generations` into `order_items.print_image_url` — this is the field Gelato submission reads.
- Pricing via existing `product_pricing` table. Set base cost £4.25 (Gelato cost), 70% margin gives RRP ~£14.17, round to £14.99 or £24.99. Admin configures via existing product admin UI.

---

## 6. Image Generation Pipeline

### 6.1 Architecture

| Stage | Description |
|---|---|
| Stage 1 — Gemini | Single API call: personalise pet into catalog scene + recolour highlights to mug colour. Uses existing `GEMINI_API_KEY`. Follow existing pattern in image variation generation code. |
| Stage 2 — Cloudinary | Build transformation URL server-side using existing Cloudinary SDK. No new packages. Returns URL — Cloudinary renders on first access and caches. |
| No Sharp / node-canvas | Cloudinary handles all image compositing and text rendering natively. |

### 6.2 Gemini Prompt Template

Substitute `[MUG_COLOUR_HEX]` server-side. Store rendered prompt in `mug_generations.gemini_prompt` for debugging.

```
Replace the animal in the reference scene image with the specific pet from the uploaded
photo. Preserve the exact composition, pose, background, props, and artistic style of
the reference scene. Match the uploaded pet's breed, coat colour, markings, and facial
features as closely as possible.
Recolour all decorative highlight elements (crown, collar, hat, ribbons, scarves, props)
to the colour hex #[MUG_COLOUR_HEX].
Maintain the original artistic style (sketch / illustration / painterly) exactly.
Do not add any text to the image.
Output a square image at the same resolution as the reference.
```

### 6.3 API Route: POST /api/mugs/generate

```typescript
// Request body
{
  catalog_slug:         string,   // e.g. 'aries'
  pet_photo_public_id:  string,   // Cloudinary public_id from upload
  pet_name:             string,   // max 20 chars
  mug_colour_slug:      string,   // e.g. 'red'
  customer_email:       string,   // for auth check (email pattern)
}

// Response
{
  generation_id:                string,  // mug_generations.id
  preview_url:                  string,  // Cloudinary URL (50% scale)
  print_url:                    string,  // Cloudinary URL (2362x1134)
  personalised_image_public_id: string,  // stored for recolour
}

// Error handling — follow CLAUDE.md standard pattern:
try {
  // ... generation logic
  return NextResponse.json(result);
} catch (error) {
  console.error('Mug generation failed:', error);
  // Update mug_generations.status = 'failed'
  return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
}
```

### 6.4 Cloudinary Composite Assembly

Build using the Cloudinary Node SDK already installed. Construct a chained transformation URL — Cloudinary renders lazily on first access and caches. No files are downloaded or re-uploaded server-side.

```typescript
// Stage 2: Build composite transformation URL
// Starting coordinates — tune visually during Phase 2 testing
const compositeUrl = cloudinary.url('pawtraits/mugs/white_canvas_2362x1134', {
  transformation: [
    // LEFT: personalised pet image
    { overlay: personalisedImagePublicId,
      width: 1020, height: 880, crop: 'fit',
      gravity: 'north_west', x: 80, y: 80 },

    // LEFT: pet name — Life Savers font
    { overlay: { font_family: 'Life Savers', font_size: 90,
                 font_weight: 'normal', text: petName },
      color: '#' + mugColourHex,
      gravity: 'north_west', x: 590, y: 1000,
      width: 1100, crop: 'fit' },

    // DIVIDER: 2px coloured vertical line
    { overlay: { font_family: 'Arial', font_size: 1, text: ' ' },
      background: '#' + mugColourHex,
      width: 2, height: 1134,
      gravity: 'north_west', x: 1180, y: 0 },

    // RIGHT: banner heading — Spartan Bold
    { overlay: { font_family: 'Spartan', font_size: 110,
                 font_weight: 'bold', text: bannerName.toUpperCase() },
      color: '#' + mugColourHex,
      gravity: 'north_west', x: 1241, y: 120,
      width: 1060, crop: 'fit' },

    // RIGHT: sub-heading — Spartan Bold
    { overlay: { font_family: 'Spartan', font_size: 52,
                 font_weight: 'bold', text: subHeading },
      color: 'rgb:2D2926',
      gravity: 'north_west', x: 1241, y: 290,
      width: 1060, crop: 'fit' },

    // RIGHT: description — Spartan Regular
    { overlay: { font_family: 'Spartan', font_size: 38,
                 font_weight: 'normal', text_align: 'center',
                 text: descriptionText },
      color: 'rgb:555555',
      gravity: 'north_west', x: 1241, y: 420,
      width: 1000, crop: 'fit' },

    // OUTPUT
    { quality: 95, fetch_format: 'jpg' }
  ]
});

// Preview URL: same transformation + w_1181,c_scale appended
```

> ⚠️ **Note:** x/y coordinates and font sizes above are starting values. Test and tune visually in Phase 2. Store layout constants in a config object for easy adjustment without code changes.

### 6.5 White Canvas Base Image

- One-time setup: upload a 2362×1134 white JPEG to Cloudinary with `public_id` `pawtraits/mugs/white_canvas_2362x1134`.
- Add to Phase 1 setup: `tsx scripts/setup-mug-canvas.ts` (following existing setup script conventions).

### 6.6 Recolour Without Re-generation

- `POST /api/mugs/recolour` — retrieve existing `mug_generation` by id, re-run Stage 2 only with new colour.
- Re-uses `personalised_image_public_id` stored on the generation record. No Gemini call.
- Returns new `preview_url` within ~1–2s (Cloudinary URL construction is near-instant).
- Update `mug_generations` record with new `colour_id` and composite URLs.

---

## 7. Database Schema

### 7.1 mug_colours

See Section 4.3.

### 7.2 mug_catalog (new table)

```sql
CREATE TABLE mug_catalog (
  id                      UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type                    TEXT NOT NULL CHECK (type IN ('zodiac', 'breed')),
  slug                    TEXT NOT NULL UNIQUE,  -- 'aries', 'golden-retriever'
  name                    TEXT NOT NULL,         -- 'Aries', 'Golden Retriever'
  sub_heading             TEXT NOT NULL,         -- 'The Fearless Adventurer'
  description             TEXT NOT NULL,         -- right panel full text
  description_short       TEXT,                  -- ≤250 chars if full text too long
  catalog_image_url       TEXT NOT NULL,         -- Cloudinary delivery URL
  catalog_image_public_id TEXT NOT NULL,         -- Cloudinary public_id for transforms
  animal_type             TEXT CHECK (animal_type IN ('dog', 'cat', 'both')),
  is_active               BOOLEAN DEFAULT true,
  sort_order              INTEGER DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);
-- RLS: public SELECT, admin-only INSERT/UPDATE/DELETE.
```

### 7.3 mug_generations (new table, aligned to customer_generated_images pattern)

> ✅ **CLAUDE.md alignment:** The existing `customer_generated_images` table stores Gemini generations for portraits. Mug generations are a separate product type — a new `mug_generations` table is correct, do NOT add mug records to `customer_generated_images`. However, follow the same field conventions: `cloudinary_public_id`, `gemini_prompt`, `status` tracking, `user_profiles` FK.

```sql
CREATE TABLE mug_generations (
  id                           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id                  UUID REFERENCES user_profiles(id),  -- matches existing FK pattern
  session_id                   TEXT,             -- guest users pre-auth
  mug_catalog_id               UUID REFERENCES mug_catalog(id),
  mug_colour_id                UUID REFERENCES mug_colours(id),
  pet_name                     TEXT NOT NULL,
  pet_photo_url                TEXT NOT NULL,    -- Cloudinary delivery URL
  pet_photo_public_id          TEXT NOT NULL,    -- Cloudinary public_id
  personalised_image_url       TEXT,             -- Gemini output URL
  personalised_image_public_id TEXT,             -- Cloudinary public_id for Stage 2
  composite_preview_url        TEXT,             -- 50% scale Cloudinary URL
  composite_print_url          TEXT,             -- full 2362x1134 Cloudinary URL
  status                       TEXT DEFAULT 'pending'
                               CHECK (status IN ('pending', 'generating', 'complete', 'failed')),
  gemini_prompt                TEXT,             -- stored for debugging (matches existing pattern)
  error_message                TEXT,
  generation_time_ms           INTEGER,
  created_at                   TIMESTAMPTZ DEFAULT now(),
  updated_at                   TIMESTAMPTZ DEFAULT now()
);
-- RLS: customers can SELECT their own rows only.
-- Admin has full access via service role (AdminSupabaseService).
```

### 7.4 order_items — Additive Change Only

```sql
ALTER TABLE order_items
  ADD COLUMN mug_generation_id UUID REFERENCES mug_generations(id);

-- At order confirmation (payment_intent.succeeded webhook):
-- Copy mug_generations.composite_print_url → order_items.print_image_url
-- This is what the existing Gelato submission reads.
```

### 7.5 products table — Mug Product Entry

- Add mug product via existing admin products UI — no schema changes.
- `product_type = 'physical_print'`, `fulfillment_method = 'gelato'`.
- Set `gelato_sku`, `gelato_product_id`, `width_cm = 20`, `height_cm = 9.6` (printable area).
- Pricing via `product_pricing` table (existing multi-country system). Admin-configurable.

---

## 8. Admin Interface

### 8.1 Mug Catalog (`/admin/mugs/catalog`)

> ✅ **CLAUDE.md alignment:** Use `AdminSupabaseService` for all data access. Add `getMugCatalog()`, `createMugCatalogEntry()`, `updateMugCatalogEntry()` methods to `AdminSupabaseService` — follow existing method patterns e.g. `getBreeds()`, `getThemes()`.

- CRUD interface following `/admin/breeds` or `/admin/themes` pattern exactly.
- Fields: type, slug, name, sub_heading, description (textarea with char count), description_short, catalog_image (Cloudinary upload — use existing upload component), animal_type, is_active, sort_order.
- Preview button: renders right panel text layout with current description for visual QA.

### 8.2 Mug Colours (`/admin/mugs/colours`)

- Read-only table with colour swatches and `is_active` toggle.
- Hex values not editable via UI (tied to physical Gelato variants — require developer change).

> ✅ **CLAUDE.md alignment:** Use `AdminSupabaseService.getMugColours()` — add this method.

### 8.3 Mug Generations (`/admin/mugs/generations`)

- Table of `mug_generations`, filterable by status, date, type.
- Columns: customer, pet name, catalog entry, colour swatch, status, `generation_time_ms`, links to preview/print URLs.
- Used for debugging and monitoring Gemini costs.

> ✅ **CLAUDE.md alignment:** Use `AdminSupabaseService.getMugGenerations()` — add this method.

---

## 9. New API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/mugs/catalog` | GET | Public | All active catalog entries. Query: `?type=zodiac&animal=dog` |
| `/api/mugs/catalog/[slug]` | GET | Public | Single entry with full description |
| `/api/mugs/colours` | GET | Public | All active mug colours |
| `/api/mugs/upload` | POST | Email auth | Upload pet photo → Cloudinary. Returns `public_id` + url |
| `/api/mugs/generate` | POST | Email auth | Gemini (Stage 1) + Cloudinary composite (Stage 2). Returns `preview_url`, `print_url`, `generation_id` |
| `/api/mugs/recolour` | POST | Email auth | Rebuild composite new colour only. No Gemini. Returns new `preview_url` |
| `/api/admin/mugs/catalog` | GET/POST/PATCH/DELETE | Admin (service role) | CRUD via `AdminSupabaseService` |
| `/api/admin/mugs/generations` | GET | Admin (service role) | Generation history + filtering |

---

## 10. Recommended Build Order

1. **Phase 1 — Data layer:** SQL for `mug_colours`, `mug_catalog`, `mug_generations` + RLS policies. Seed colour data. Add `AdminSupabaseService` methods. Admin CRUD pages.
2. **Phase 2 — Cloudinary composite:** Build and test Stage 2 transformation URL in isolation (`tsx scripts/test-mug-generation.ts`). Upload white canvas base image (`tsx scripts/setup-mug-canvas.ts`). Tune layout constants visually.
3. **Phase 3 — Gemini integration:** Build `POST /api/mugs/generate`. Wire Stage 1 + Stage 2. Test end-to-end with real photo. Confirm `gemini_prompt` stored on record.
4. **Phase 4 — Recolour:** Build `POST /api/mugs/recolour`. Test colour switching.
5. **Phase 5 — Customer UI:** `/mugs` catalog page and `/mugs/[slug]/personalise`. Wire all APIs. Colour picker, preview, loading states.
6. **Phase 6 — Checkout:** Wire `mug_generation_id` into `order_items`. Confirm `composite_print_url` → `print_image_url` at webhook. End-to-end order test.
7. **Phase 7 — Admin generations view.** Add mug product entry via admin UI.

---

## 11. Out of Scope (Phase 1)

- "Recommended for You" page updates based on pet zodiac/breed — Phase 2.
- Multi-pet mugs.
- Christmas/themed mugs — zodiac and breed only.
- Portrait + mug bundle pricing.
- Mug as add-on alongside portrait purchase.
- Credit system integration for mug generation — explicit non-goal in Phase 1 (see Section 5.4).

---

*Pawtraits Mug Functional Specification v1.2 | Confidential*
