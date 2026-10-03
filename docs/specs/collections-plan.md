# Collections, tags and sports teams — plan

**Status:** Agreed in principle 3 Oct 2026; team outfit definitions written (`lib/collections/sports-teams.ts`). Build not started.

## Decisions
- Themes become internal (production recipes for generation). Customers browse by **breed** first and a few **collections** second; **tags** cover everything else through search and "see more" links.
- Collections: **Occasions** (Christmas, Halloween, Birthday, Valentine's, Easter, Mother's Day, Father's Day…), **Sports** (leagues and teams, named), **16 Pawsonalities**, **12 Zodiac signs**.
- Sports: leagues and team names shown directly (Steve's call). Kits are described by colours and patterns only (no crests, logos or sponsor marks): better AI results and less trademark exposure. Worth a quick legal check, particularly for the US leagues.
- College = the school, not a sport (e.g. University of Miami); the outfit is a varsity jacket in school colours, and the colours can be applied to any sports design.
- Sports designs: customers can **change the team** (any predefined team) **and change the pet**.
- Defaults for the questions not yet answered: auto-tags go live on upload (editable any time); occasions are promoted only in season (collection pages and search work all year).

## Team outfit definitions (done)
`lib/collections/sports-teams.ts`: 135 entries — Premier League 2026–27 (20, incl. promoted Coventry, Ipswich, Hull), NFL (32), NBA (30), NHL (32, incl. Utah Mammoth), College (21: top 20 by licensed-merchandise ranking + Miami).
Each: name, short name, nicknames for search, colours (name + hex, primary first), home kit in a sentence. `teamOutfit()` gives two prompts:
- **New design** — the league's full outfit in the team's colours.
- **Switch team** — garment-agnostic recolour, so any team can be applied to any sports design without changing pose, background or lighting.
Review page and CSV were sent in chat (sports-team-outfits.html / .csv).

## Data model (phase 1)
- `collections`: slug, name, kind (occasion | sport | pawsonality | zodiac), parent_id (Sports › Premier League › Arsenal; Zodiac › Leo), date window for occasions (e.g. Christmas 1 Nov–25 Dec), hero image, intro text, sort, active.
- `design_collections`: design ↔ collection (many to many).
- Sports teams are depth-2 collections (Sports › NFL › Kansas City Chiefs) with colours, nicknames, kit and recolour prompt in `metadata`, linked to an `outfits` row (`team-<league>-<slug>`, `clothing_description` = new-design prompt).
- `themes.default_collection_id`: existing designs are collected automatically by theme.
- Tags: keep `image_catalog.tags`, but descriptive only (outfit, props, setting, mood, colours); drop ai-generated / pet / portrait / format names. A synonyms list for search (xmas → christmas, footie → football, spurs → Tottenham *and* San Antonio).

## Phase 1 — built (2026-10-03)
- **Migrations:** `db/migrations/2026-10-07-collections.sql` (tables, `collection_design_counts` view, `apply_theme_collection()` and a trigger on `image_catalog` that files new designs by theme), then `2026-10-07-collections-seed.sql` (183 collections: 4 top, 11 occasions, 5 leagues, 135 teams, 16 Pawsonalities, 12 zodiac; 135 team outfits). Both safe to re-run; re-running the seed keeps admin edits and refreshes kit prompts.
- **Source of truth:** `lib/collections/definitions.ts` (occasions + seasons, zodiac dates, `inSeason`, `zodiacFor`, `suggestCollectionForTheme`) and `lib/collections/sports-teams.ts`. Regenerate the seed with `npm run build:collections-seed`.
- **Admin → Collections** (Catalog menu): the tree with design counts, team colours, season state ("Promoted right now: Halloween"); edit name, short name, description, seasons (several windows, can wrap New Year), search words, live on/off; add occasions, leagues and teams. **Themes → collections** tab: pick a collection per theme (files all its designs immediately, new ones automatically), "Use suggestions from theme names", "Re-file all designs". Theme-filed links move when a theme is remapped; links added by hand or by auto-tagging are never touched.
- **APIs:** `GET/POST /api/admin/collections`, `PATCH /api/admin/collections/[id]`, `PATCH /api/admin/collections/themes/[id]`, `POST /api/admin/collections/themes/apply-all` (all admin-only).
- **Tests:** `npm run test:collections` (46 unit checks); browser run against local Postgres + PostgREST (18 checks).
- Customer pages don't read collections yet (phase 3), so nothing changes for customers until then.

## Auto-tagging (phase 2)
On upload Claude looks at the image + prompt + theme and returns: collection(s) from the fixed list, team (if a sports kit is recognisable by colours), 5–10 descriptive tags. Saved straight away, editable in the catalogue. One-off backfill for the existing catalogue with a review screen.

## Phase 2 — built (2026-10-03)
- **Migration:** `db/migrations/2026-10-08-auto-tags-search.sql` (run after the two 2026-10-07 files; safe to re-run). Adds `image_catalog.display_tags` (customer-facing tags; the old `tags` column keeps its system markers), `display_tags_edited`, `auto_tag`, `auto_tagged_at`, `auto_tag_error`, `search_tsv`; `design_collections.excluded`; the `search_designs()` function; setting `auto_tag_enabled`.
- **Auto-tagging** (`lib/collections/auto-tag.ts`, Claude Haiku with the picture, prompt, theme, breed and outfit): collections from the fixed list (occasions, zodiac, Pawsonality), the team only if the kit is unmistakable, 5–10 descriptive tags, a confidence score. Runs after every catalogue save (`/api/admin/catalog/save`, `/api/images/cloudinary`, `/api/images`), never on customers' own customisations. A design whose outfit is a team kit is always that team; a quiz breed picture is always its type. Generic or internal words (pet, portrait, cute, AI…) are never kept as tags.
- **Admin rules:** tags edited by hand are kept when a design is re-tagged; "take out of a collection" is remembered and theme filing and auto-tagging won't put it back (Undo restores it).
- **Admin → Collections → Tagging:** progress, "Tag the catalogue" (batches of 12 until done; failed designs set aside, "Try failed ones again"), the automatic-tagging switch, and a review grid (filters: recently tagged, tagger unsure (< 60%), not tagged, failed, in a collection; find by title or tag) where each design's tags and collections can be edited, and "Re-tag".
- **Search** (`GET /api/public/search?q=&tag=&animal=&breed=&page=&typing=1`): one box for breeds, collections and designs. Each design has a weighted search document: its collections and their parents (with names, short names and search words, so "chiefs", "toon", "nfl" work), breed and alternative names first; tags, outfit and theme next; descriptions last. English stemming (crowns → crown), a synonym list in `lib/search/query.ts` (xmas → Christmas, mom → mum, sweater → jumper…), prefix matching while typing, `tag=` for "See more crown designs". Only public, listed catalogue designs. Kept current by triggers when tags, collections or collection words change.
- **Tests:** `npm run test:search` (28 unit checks), plus 25 integration and 15 browser checks against local Postgres + PostgREST. Not tested here: real Claude answers (no API key locally) — check the first "Tag the catalogue" batch in the Tagger-unsure view.
- The customer search box and "See more" links come in phase 3.

## Customer experience (phase 3)
- **Home:** Find your breed first; one seasonal band (in season only); four collection tiles.
- **Browse:** Dogs · Cats · Collections, plus one search box (breeds, collections, teams + nicknames, tags, synonyms). Narrow any result by breed ("Christmas designs for your Cocker Spaniel"; otherwise "any design can be your pet").
- **Collection pages** `/collections/<slug>` (and `/collections/sports/nfl/chiefs`), with page titles and share previews. Pawsonalities link to the quiz; Zodiac has "find your pet's sign" from their birthday.
- **Design page:** tag chips under the title → "See more crown designs"; More like this = same breed, then same collection, then shared tags. Themes removed from nav and captions; old theme links redirect.

## Phase 3 — built (2026-10-03)
- **Migration:** `db/migrations/2026-10-09-collections-browse.sql` (run after 2026-10-08; safe to re-run): read-only functions `collection_summary()` (design counts including collections inside, picture = admin's pick else most popular design), `collection_designs()` (paged, by animal or breed), `collection_breeds()`.
- **Pages:** `/collections` (Occasions with in-season ones first and badged, Sports leagues, 16 Pawsonalities with the quiz link, Zodiac); `/collections/<path>` (breadcrumb, intro, team colours / zodiac dates / Pawsonality type, collections inside it, Dogs·Cats filter and breed picker ("1 design for your Labrador Retriever"), Show more, "Any design can be your pet", neighbouring collections; Pawsonality pages link to the quiz; Zodiac has "Find your pet's sign" from a birthday); each with its own title, description and share picture. `/search` (search box that updates as you type, jump-to chips for collections and breeds, Dogs/Cats, `?tag=` for "See more" links, empty state). Only collections with designs are shown.
- **Collection pictures are circles**, the same as Find your breed (68px, light purple ring; purple ring + "In season" for occasions in season; team colour strip for teams; design count otherwise): sideways-scrolling rows on the home page and /collections, a wrapping grid when a collection has more than 8 inside (e.g. a league's teams). The seasonal band stays a banner.
- **Home:** one "In season" band (only while an occasion with designs is in season, e.g. Halloween in October) and the four collection tiles, after Find your breed.
- **Navigation:** Dogs · Cats · Collections · Search (Themes removed).
- **Design page:** collection chips and tag chips ("See more crown designs") under the title; back link returns to the collection you came from (`?from=`); More like this = same breed, then the design's collection, then its first tag; theme name no longer shown.
- **Themes out of customer view:** `/themes`, `/themes-redirect` and `/browse?type=themes[&theme=]` go to the theme's collection if it has one, else `/collections`; theme badges and the Themes tab removed from /browse (tab now links to Collections); home captions show breed only.
- **APIs:** `GET /api/public/collections`, `GET /api/public/collection?path=&animal=&breed=&page=`, `GET /api/public/designs/[id]/collections`. Search events go to GA4 (`search`) and Meta (`Search`).
- **Tests:** `npm run test:collections` (50 checks), 29 browser checks against local data (home band, index, team page and title, back link, chips, tag search, filters, zodiac finder, quiz link, unknown collection, search, nav, theme redirects, phone width).

## Sports team switcher (phase 4)
- Each sports design records its team. **Team variants** of a design are made with the "switch team" prompt (Gemini edit of the design), saved as link-only designs (like Pawsonality breed pictures) and tracked in `design_team_variants` (design, team, picture, status).
- Made in advance for the most popular teams (admin grid: design × team, "Make missing"), on demand for the rest (20–60 s, "Painting it in Chiefs colours…" overlay, then swap).
- **Design page:** a Team picker (search by name or nickname, grouped by league) swaps the picture to that team; **Add my pet's photo** then customises the team version with their pet. Buying it as it is buys the team version.
- Which teams a design offers: its own league by default (and colleges for college designs); admin can tick "any team" on a design.

## Phase 4 — built (2026-10-03)
- **Migration:** `db/migrations/2026-10-10-team-switcher.sql` (run after 2026-10-09; safe to re-run): table `design_team_variants` (design × team → version, status, attempts, who asked), `image_catalog.team_switch` (NULL = its league, 'any', 'off'), settings `team_switch_enabled`, `team_switch_hourly_limit` (6).
- **How it works** (`lib/collections/team-variants.ts`): a sports design is one filed under a team (or league). Its offered teams are its league's (colleges for college designs) unless set to any team or off; only teams with a kit/recolour prompt are offered. A version is a Gemini edit of the original with the team's recolour prompt ("Recolour the pet's sports outfit to Bills colours… colours only, no logos… keep the animal, style and background"), saved as a link-only design (tags `team-variant`, `team:<path>`, `quiz-generated`; same breed, format and theme; the team's outfit) so it never appears in listings, collections or search. Each design × team is made once; two people asking at once share one job; failed versions are retried once for customers, any time by admin.
- **Design page:** "Team: Kansas City Chiefs · Change team" on sports designs. The picker: search by name or nickname, grouped by league, Ready badges. A ready team opens that version's design page instantly (back link and from= kept); any other team shows "Painting it in Dolphins colours…" (about a minute) and then opens it; if painting fails, or the visitor hits the hourly limit, the picker says so and stays open. Because each version is its own design page, "Add my pet's photo" and buying use the team version unchanged. A version's chips show its team and league.
- **Admin → Collections → Team versions:** switch on/off, per-visitor hourly limit, every sports design with its team, offered scope (its league / any team / no switching) and "n of m ready"; open a design for a grid of its teams (version thumbnails, status, Make / Try again / Open) and "Make all missing" (one at a time, about a minute each, Stop after this one).
- **APIs:** `GET/POST /api/public/designs/[id]/teams`; `GET /api/admin/collections/team-versions`, `GET/PATCH/POST /api/admin/collections/team-versions/[id]`.
- **Tests:** 22 integration checks (league/any/off scopes, version made once and reused, working from a version, failure retries, admin retry, public API incl. peek and hourly limit, versions kept out of search and collections, version chips) and 18 browser checks (picker on phone, search by nickname, Escape, ready team opens version, painting overlay and failure message, back to original, non-sports designs, admin list, scope change, make). Not tested here: real Gemini repaints (no API key locally) — make a few versions in admin and check the colours before turning it on for customers.

## Phases
1. Collections + teams data, migration and seed, theme → collection mapping, Admin → Collections.
2. Auto-tagging on upload + backfill; search index and synonyms.
3. Browse / home / collection pages / design-page chips; themes out of customer view.
4. Sports team switcher.
