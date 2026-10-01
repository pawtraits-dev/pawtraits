# Pawtraits customer design rules

**Status:** proposed 2026-10-01 for Steve to agree. Applies to customer-facing pages (home, browse, design page, basket, checkout, account). Admin and partner pages are out of scope.

Tokens live in `tailwind.config.js` (`brand-*`, `ink-*`, `shadow-card`, `shadow-sheet`, `rounded-card`, `rounded-sheet`). They match the purple/gray utilities already used on the new home and design pages, so either spelling renders the same; use the token names in new work.

## Type
| Role | Style | Example |
|---|---|---|
| Page title (h1) | `text-2xl md:text-3xl font-bold text-ink` (Fraunces/serif on marketing heroes only) | Design title, "Welcome back" |
| Section title (h2) | `text-lg font-bold text-ink` | "More like this" |
| Body | `text-base text-ink-body` (16px — never smaller for paragraphs on phones) | Descriptions |
| Secondary | `text-sm text-ink-muted` | "Breed · theme", delivery lines |
| Small print | `text-xs text-ink-muted` — labels and badges only, never sentences people must read | "Most popular" |

- Sentence case everywhere ("Add my pet's photo", not "Add My Pet's Photo").
- Say **Pawtrait**, not portrait; say **pet**, not dog (we do cats too).
- No `text-gray-400`/`500` for text on white — it fails contrast. `ink-muted` is the lightest text colour.

## Colour
- **One primary colour:** `brand` (purple) for the main button, links and selected states. One primary button per screen; everything else is outline or text.
- Orange and green from the old palette are for badges/feedback only (sale, success), not buttons.
- Errors: red-700 text on red-50. Success: green-700 on green-50.
- Page background white; alternate sections `ink-wash`. No gradients behind text.

## Buttons
- Primary: `h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-strong`, full width on phones.
- Secondary: `h-12 rounded-xl border border-brand-line text-brand-strong font-semibold`.
- Minimum tap target 44×44px (icon buttons included, with an `aria-label`).

## Cards
- Design cards: image at the design's true shape (2:3 by default), `rounded-card`, no border, title below in `text-sm font-semibold`, price on its own line. No buttons on cards — the whole card is the link.
- Panels (options, info): `rounded-card border border-ink-line bg-white p-4`; selected = `border-brand bg-brand-soft`.
- Shadows: `shadow-card` at most. Bottom sheets and the basket dock use `shadow-sheet` and `rounded-sheet` top corners.

## Icons
- lucide-react only, outline style, `h-5 w-5` in buttons and lists (`h-4 w-4` inline with small text), `aria-hidden="true"` when next to a text label.
- No emoji in UI text.

## Images
- Catalogue images: `<CatalogImage>` (lazy, responsive widths via the image proxy, edge-cached). Pass `sizes` when the image isn't a grid card, and `priority` for the one above-the-fold hero.
- Never show a design cropped in a way that cuts the pet; use `object-contain` on the design page hero.
- Banner/hero images from carousels go through `lib/images/delivery.ts` (Cloudinary `f_auto,q_auto`).

## Spacing and layout
- Phone first at 390px: 16px side gutter, 24px between sections (32px on desktop).
- Sticky bottom actions respect the iPhone home bar (`env(safe-area-inset-bottom)`).
