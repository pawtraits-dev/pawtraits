# Customer email review & refresh

**Status:** Reviewed and rebuilt 2 Oct 2026, same process as customer UX rounds 1–2 (review against the design principles → redesign → build → test). Partner emails are next.

## Review: what we found (before)
Every customer email was rendered with real-looking data at phone width (390 px) and desktop (700 px).

**Across all emails**
- No shared design: four different looks (purple gradient, green, plain Times New Roman, bare Arial), three taglines, two button styles.
- Logo was an **SVG**, which Gmail and Outlook block, so every header showed a broken image.
- Styles lived in a `<style>` block; several mail apps strip it, so layouts fell apart. Full-width buttons overflowed the card on phones.
- No **preheader** (the grey line after the subject), so inboxes showed "Pawtraits" or alt text.
- Footer: "© 2025" hard-coded, Facebook/Twitter links to accounts that may not exist, and an **Unsubscribe link to a page that doesn't exist** (404) on order emails.
- Long and joke-heavy: the order confirmation was 3,000 px tall on a phone, with a joke in almost every paragraph.

**Order confirmation**
- Didn't show the Pawtrait they'd just bought.
- Headline "Your Masterpiece is On Its Way!" at the moment of ordering; same headline for stall orders (already taken home) and downloads.
- Promised "Within 7–10 business days" (we post within 2 working days, Tracked 48 arrives 2–3 days later); "Track Your Masterpiece" before there is any tracking.
- Digital orders showed "undefinedxundefinedcm", "Shipping £0.00" and a track button; country shown as "GB"; payment ID exposed in the footer.
- Subject "Order Confirmation #PW-1759333000-a1b2c3 - Pawtraits".

**Others**
- Posted: off-brand green, "What to expect" padding.
- Referral credit: unstyled, and named the friend who bought ("Tom just made a purchase") — a privacy leak.
- Credit pack: placeholders showing as "Previous: → New: credits", US spelling, mentions canvas/acrylic we don't sell. (Credit packs look retired; not rebuilt.)
- Sign-in and Pawsonality save: plain, no brand, no picture.
- Never sent (seeded only): order delivered, welcome, partner application/approved/payout.
- No plain-text versions; from address is noreply@ (replies go to support@, which is fine).

## The refresh (after)
**One system** — `lib/messaging/templates/partials/` registered as Handlebars partials (`lib/messaging/template-engine.ts`):
- `layout`: table-based, inline styles, 600 px card on lavender (#F6F2FC), PNG paw + live "Pawtraits" text header (readable with images off), preheader, one footer for all ("Questions? Just reply…", pawtraits.pics · Instagram · Help & delivery, optional note, unsubscribe only when a real link is given).
- `heading` (Life Savers where supported, falls back cleanly), `button` (full-width, 52 px, brand purple #9333ea, bulletproof), `portrait` (their Pawtrait, with alt text), `quiz-promo`.
- Brand voice: one light line per email, British English, "Pawtrait".

| Email | Subject | What changed |
|---|---|---|
| Order confirmed (print) | Order confirmed: Biscuit's Pawtrait is being printed 🎨 | Their portrait at the top; plain items ("Medium print · 30 × 45 cm · with free digital copy"); delivery service; Paid total; **What happens next** with real timings (posted within 2 working days, arrives 2–3 days later, by zone); address with full country name; one button; quiz and social notice kept. 3,047 → 1,880 px. |
| Receipt (stall) | Your Pawtraits receipt 🐾 | "It's yours, Sarah! You took your Pawtrait home from our stall at…"; no delivery or tracking. |
| Download ready (digital) | Your Pawtrait download is ready 🎨 | Download buttons first, no delivery rows or "undefined" sizes. |
| Account ready / free copy | Sarah, your free digital copy is waiting 🎁 | Same layout; quiz promo removed (it's already in the confirmation that arrives a moment earlier). |
| Posted | Your Pawtrait is on its way 📦 | Brand colours; portrait; **Expected: Sat 3 – Mon 5 October** (worked out from the posting date, Mon–Sat delivery); tracking number and Track my parcel; "When it arrives" tip. |
| Sign-in link | Your Pawtraits sign-in link | Branded; "works once, for 1 hour". |
| Save Pawsonality | Save Biscuit's Pawsonality 🐾 | Shows the type and its picture. |
| Referral credit | You've earned £5.00 credit 🎉 | Branded, balance panel, **no friend's name**. |
| On Instagram (new, for social phase 4) | Biscuit's on Instagram! 📸 | Portrait, See the post, "Rather it came down? Tell us". |

**Code**
- `lib/messaging/order-email.ts`: item descriptions, hero portrait, delivery service/days by zone, full country names, delivery window, pet name for subjects.
- Stripe webhook (`sendOrderConfirmationEmail`) passes the new variables; the posted email (`lib/fulfillment/order-fulfilment.ts`) adds portrait, country name and the delivery window; sign-in (`app/api/auth/email-link`) and Pawsonality save use `renderEmailFile` (`lib/messaging/render-file.ts`).
- Migration `db/migrations/2026-10-06-email-refresh.sql`: new subjects (with `{{{ }}}` so names aren't escaped), referral-credit body → its file, `customer_on_instagram` template row.
- Asset `public/assets/email/paw-96.png`.
- Tests `npm run test:emails` (135 checks): every email rendered through the senders' helpers; no leftover tags or "undefined"; preheader present; no SVG images; no broken unsubscribe; per-case wording (print/stall/digital, tracked/untracked, gift/no gift); subjects; names HTML-escaped; friend's name hidden.

## Still to do
- Partner emails (commission earned, approved) — same layout, partner voice.
- A real email preferences / unsubscribe page before any marketing email (e.g. "your preview is waiting").
- Plain-text versions (Resend can send `text` alongside HTML).
- Supabase's own auth emails (password reset, confirm signup) are edited in the Supabase dashboard — paste in the branded layout.
- Confirm the Instagram handle used in the footer (currently instagram.com/pawtraits).
- Credit packs: retire the old pages and email, or redesign if they're coming back.
