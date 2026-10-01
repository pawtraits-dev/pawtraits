# Social loop & global social proof — design and plan

**Status:** Phases 1–3 (capture, photo check, opt-out, terms, Admin → Social, website feed, free previews option, Instagram carousel preview) built 1 Oct 2026. Phase 4 (live posting + emails) next. Source: Steve's "Functional Specification: Social Loop & Global Social Proof".

## Decisions (Steve, 1 Oct 2026)
- **Consent:** terms only, with an opt-out. Nothing asked at or after checkout.
- **Posting:** fully automatic when a batch reaches 5 paid custom orders. No manual approval.
- **Batches:** any 5 qualifying orders (stall and online mixed). Caption names the 5 pets plus where they're from (stall name for stall orders, town for online orders).
- **Website feed:** shows every paid custom order, before and after, with pet name and town, country.

## Safeguards built in (automatic, no friction)
- **Terms and privacy notice** updated to say paid custom portraits and the original photo may be shown on the website and Instagram, with a one-click opt-out. Wording for Steve to approve (not legal advice).
- **Opt-out link** in the order confirmation email and the "you're on Instagram" email. Opting out removes the order from the website feed and from any batch not yet posted. A post that's already live is flagged in admin for removal in the Instagram app, since the API may not remove it.
- **Automatic photo check** before an order joins a batch or the feed: an AI vision check rejects photos showing people's faces, children, readable text (house numbers, letters, screens), and failed or broken portraits. Rejected orders are skipped silently and listed in admin.
- **Kill switch** in admin: pause Instagram posting and/or the website feed instantly; hide a single order from both.
- **Only pet first names** in captions and the feed (first word of the pet name, letters only). No customer names, emails or addresses. Location = town/city and country only.

## Data
- `orders`: delivery town/country already stored; stall orders use the stall's town (`stock_locations`). Stripe billing city used if present, otherwise delivery town, otherwise country only.
- New `social_items` (one per paid custom order item): order, custom image, before (pet photo Cloudinary id) and after (generated image), pet first name, town, country, source (stall/online + stall name), check status, opted_out, batch id, feed visibility.
- New `social_batches`: status (filling / publishing / posted / failed), item ids in order, caption, Instagram media id and permalink, posted_at, emailed_at.

## Instagram
- Requires an Instagram professional account linked to a Facebook Page and a Meta app approved for content publishing.
- Carousel: 10 images (5 × before/after, chronological). JPEG at public Cloudinary URLs.
- 4:5 framing: portraits (2:3) padded to 4:5 with a soft brand border (no cropping); before photos framed to 4:5 with subject-aware fill and padding fallback so the pet is never cut off.
- Publishing: create 10 child containers → carousel container with caption → publish → read permalink. Retries with back-off; a failed batch is retried, then flagged in admin.
- Within 2 minutes of posting, each of the 5 customers gets an email with the post link (existing messaging service).

## Website feed
- Home page section "Recent custom creations around the world": slider of the latest paid custom orders, each with a drag divider revealing the before photo, and "📍 A custom portrait of Max was just ordered by a pet parent in Köln, Germany". Only paid, checked, not opted-out orders.

## Plan
1. Data, location capture, photo check, opt-out link, terms wording, admin list with kill switch.
2. Website feed with before/after reveal.
3. Carousel builder (4:5 images, caption) with an admin preview — testable before Meta approval.
4. Live Instagram publishing, batching trigger and the "you're on Instagram" email.

## Phase 1 (built)
Migration `db/migrations/2026-10-04-social-loop.sql`: `social_items`, `social_batches`, `social_opt_outs`, `stock_locations.town/country`, settings `social_feed_enabled` (on), `social_instagram_enabled` (off), `social_photo_check_enabled` (on).

- **Capture** (`lib/social/capture.ts`): the Stripe webhook, after a paid order (not held), runs `captureSocialItems` in `after()`. Each order line that is a customised portrait (`order_items.image_id` = `customer_custom_images.id`, generated) becomes one item (one per portrait, even if bought again). Pet first names only (`lib/social/privacy.ts`: first word, letters only, placeholders like "Uploaded Pet" dropped; two pets → "Biscuit & Mochi"). Location: stall orders → the stall's town (Admin → Social → Stall towns) + "Old Spitalfields Market"; online → Stripe billing city if the card form collected it, else delivery town; towns with digits (postcodes, house numbers) are dropped and only the country shown. Countries shown as "UK", "Germany", "USA".
- **Photo check** (`lib/social/photo-check.ts`): Claude Haiku looks at the original photo and the portrait; rejects people, children, readable personal details, no clear pet, a broken portrait, anything inappropriate. Fail-safe parsing; an unusable answer or outage is "error" and retried (up to 3 attempts; "Run waiting checks" in admin). Can be switched off in admin (then everything is approved).
- **Opt-out** (`lib/social/opt-out.ts`): order confirmation email (orders with a customised Pawtrait) says pets may be featured, with "Keep my pet out of it" → `/social/opt-out?o=<order>&t=<signature>` (no email in the link) → confirm button → `POST /api/public/social/opt-out`. Covers every order from that email, past and future; items leave the feed and unposted carousels; posted carousels are flagged "Take these Instagram posts down" in admin.
- **Terms and privacy**: "Featuring your Pawtrait" paragraph in Terms §5 (licence, what's shown, automatic check, opt-out, removal) and a privacy bullet. The old line "We do not share or sell your personal photos" now reads "We do not sell your personal photos or share your identifying information". Have a lawyer check the wording.
- **Admin → Social** (Communications): switches (website feed, Instagram, photo check), removal alerts, stall towns, items with before/after thumbnails, status and reasons; tabs All / Featured / Left out / Checking / Opted out / Hidden; actions Hide / Show again, Feature anyway, Re-check.

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/social?view=` | Switches, counts, items, stalls, removals |
| `PATCH /api/admin/social/items/[id]` | hide / unhide / approve / recheck |
| `PATCH /api/admin/social/stalls/[id]` | Stall town |
| `POST /api/admin/social/retry-checks` | Run waiting checks |
| `POST /api/public/social/opt-out` | Customer opt-out (signed link) |

Tests: `npm run test:social` (39 checks: names, towns, countries, check-reply parsing). Integration run against a real PostgREST over the full schema (18 checks): online/stall/abroad locations, placeholder names, repeat purchase, check outage + retry, signed links, opt-out across orders and batches (posted flagged, unposted refilled, others kept), future orders opted out. Browser: opt-out page (bad signature refused, confirm), Admin → Social (removal alert, feature anyway, kill switch, stall town, hide). Not testable here: the real Claude photo check (needs the live key) and Stripe billing lookup.

## Phase 2: website feed (built)
- **Home page** "Recent custom creations around the world" (`components/social/RecentCreations.tsx`), between Find your breed and the quiz band. Each card is a before/after reveal (`components/social/BeforeAfter.tsx`): the original photo on the left of a divider, the Pawtrait on the right. Mouse: divider follows the pointer (resets on leave). Touch: tap or drag on the picture (vertical scrolling still works). Keyboard: focus the handle, arrow keys / Home / End. Caption: "📍 A custom portrait of Max was ordered 2 hours ago by a pet parent in Köln, Germany" (no name → "A custom portrait…"; no town → country only; no place → left out).
- Phones: one card at a time with arrows ("1 of 8"); desktop: three. No swipe-scrolling, so dragging the divider never fights the carousel. Up to 12 latest orders.
- **Frames**: both pictures in the same 4:5 frame. Photo: Cloudinary `c_fill,g_auto` (centred on the pet). Portrait: `c_pad` with a blurred fill so nothing is cropped, plus the watermark (the raw generated image is never shown).
- **Data** `GET /api/public/social/feed` (`lib/social/feed.ts`, edge-cached 2 min): photo check approved, not opted out, not hidden, order `payment_status = paid` and not cancelled/refunded/on hold; empty while "Website feed" is off in Admin → Social (section disappears). Returns pet first name, "Town, Country", the two image URLs and the time — nothing else.
- Tested on a phone and desktop against a real PostgREST (14 checks): rejected, opted-out, hidden, refunded and unpaid orders excluded; no emails/postcodes in the response; one card on phones, three on desktop; tap, hover and keyboard move the divider; paging; switching the feed off hides the section.

## Free previews as content (built)
Migration `db/migrations/2026-10-05-social-previews-carousels.sql`: `social_items.source` ('purchase' | 'preview'), `order_id` now optional, `ig_excluded`; `social_batches.caption_edited`; setting `social_include_previews` (off).
- **Admin → Social → "Include free previews"**: customisations people made but haven't bought are featured too (website feed and Instagram). Each finished preview is added and photo-checked automatically (`capturePreviews` after generation); **"Import previews from the last 30 days"** brings in existing ones (40 per click). Previews the customer rated 1–2 stars are skipped; opted-out emails are respected.
- Previews have no location (no order), so captions read "A custom portrait of Max was created 2 hours ago". If a preview is later bought, its item becomes a purchase (order, town, time) instead of a duplicate.
- Switching the option off removes previews from the feed and from unposted carousels at once.
- The customise page's photo note now says favourites may be shown with the pet's first name only (link to terms); Terms §5 and the privacy bullet cover previews as well as purchases. Guests who made a preview without an email can only opt out by emailing support.

## Phase 3: Instagram carousel preview (built)
- **Batching** (`lib/social/carousel.ts` `fillBatches`): featured pets (approved, not opted out/hidden/removed from Instagram; previews only when on) fill carousels of 5, oldest first. Full = `ready`. Runs after every capture, check, opt-out, admin change and when the preview opens. Carousels that lose a pet regroup so there's only ever one filling carousel; full and posted carousels aren't reshuffled; overfills are trimmed.
- **Slides**: 10 per carousel, photo → Pawtrait per pet, 1080×1350 JPEG. Photo `c_fill,g_auto`; Pawtrait `c_pad` with blurred fill (never cropped) + watermark. Pets whose pictures aren't in Cloudinary are flagged (automatic posting needs Cloudinary IDs).
- **Caption** (automatic, editable): "Five pets, five masterpieces 🎨🐾 / Swipe to watch Biscuit, Mochi, Lotte, Max and Pip go from phone photo to Pawtrait 👉 / 📍 Old Spitalfields Market · Derby · Köln / Want your pet painted? … pawtraits.pics / hashtags". Unnamed pets → "one shy friend". Stall names then towns, up to 4. Under 2,200 characters and 30 hashtags.
- **Admin → Social → Instagram carousels**: each carousel in a phone-style Instagram frame (slide arrows, n/10, dots, caption with "… more"), status (Filling n of 5 / Ready to post / Posted), the 5 pets with Remove (off Instagram only, stays on the website) and per-slide downloads (numbered 01–10), caption edit / "Use automatic caption" / Copy caption, and **Mark as posted** with the Instagram link (for posting by hand before the Meta app is approved). Posted carousels are listed underneath.

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/social/carousels` | Carousels with slides and captions (tops up first) |
| `PATCH /api/admin/social/carousels/[id]` | `{caption}` / reset_caption / mark_posted |
| `POST /api/admin/social/import-previews` | Import recent previews |
| `PATCH /api/admin/social/items/[id]` | adds ig_exclude / ig_include |

Tests: `npm run test:social` now 47 (captions added). Integration against a real PostgREST (15 checks): purchases group 5 + 2 oldest first; previews ignored while off, imported when on (low ratings skipped), no location; carousels top up; opt-out reopens a full carousel; previews off regroups; bought preview upgraded, not duplicated; ig_excluded removed; overfill trimmed; posted untouched. Browser (14 checks): switch, import button, badges, phone preview slides, caption save/reset, download links, bad link refused, mark posted, remove pet, previews off clears carousels.

Next (phase 4): publish ready carousels via the Instagram Graph API when "Instagram posting" is on, and email the 5 customers the post link within 2 minutes (also when marked posted by hand).
