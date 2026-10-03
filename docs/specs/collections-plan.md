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

## Customer experience (phase 3)
- **Home:** Find your breed first; one seasonal band (in season only); four collection tiles.
- **Browse:** Dogs · Cats · Collections, plus one search box (breeds, collections, teams + nicknames, tags, synonyms). Narrow any result by breed ("Christmas designs for your Cocker Spaniel"; otherwise "any design can be your pet").
- **Collection pages** `/collections/<slug>` (and `/collections/sports/nfl/chiefs`), with page titles and share previews. Pawsonalities link to the quiz; Zodiac has "find your pet's sign" from their birthday.
- **Design page:** tag chips under the title → "See more crown designs"; More like this = same breed, then same collection, then shared tags. Themes removed from nav and captions; old theme links redirect.

## Sports team switcher (phase 4)
- Each sports design records its team. **Team variants** of a design are made with the "switch team" prompt (Gemini edit of the design), saved as link-only designs (like Pawsonality breed pictures) and tracked in `design_team_variants` (design, team, picture, status).
- Made in advance for the most popular teams (admin grid: design × team, "Make missing"), on demand for the rest (20–60 s, "Painting it in Chiefs colours…" overlay, then swap).
- **Design page:** a Team picker (search by name or nickname, grouped by league) swaps the picture to that team; **Add my pet's photo** then customises the team version with their pet. Buying it as it is buys the team version.
- Which teams a design offers: its own league by default (and colleges for college designs); admin can tick "any team" on a design.

## Phases
1. Collections + teams data, migration and seed, theme → collection mapping, Admin → Collections.
2. Auto-tagging on upload + backfill; search index and synonyms.
3. Browse / home / collection pages / design-page chips; themes out of customer view.
4. Sports team switcher.
