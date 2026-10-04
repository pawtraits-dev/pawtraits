# Designs with more than one pet: plan

Status: agreed 2026-10-04. Collection name: **Double Trouble**.

## Where we are

**Already works**
- Upload: the analysis finds every pet in a design (breed, coat, position left/centre/right, size, pose). Saved in `generation_parameters.subjects` and in `image_catalog_subjects` (one row per pet).
- Design page: a 2-pet design asks for 2 photos ("Pet 1", "Pet 2"); up to 5 are supported.
- Painting: every photo is sent to Gemini, with a relative-size instruction worked out from each pet's breed and weight (so a Chihuahua stays smaller than a Labrador).
- `/browse` breed filter finds a design if *any* of its pets is that breed.

**Gaps found**

| # | Gap | Effect |
|---|-----|--------|
| 1 | The painting prompt is written for one pet ("replace the subject with the pet in the second image") even when two or three photos are attached. Nothing says which photo replaces which pet. | Biggest quality risk: pets swapped, blended into one, or one ignored. |
| 2 | The design page says "Pet 1", "Pet 2" without saying which pet in the picture each is. | Customer can't choose who goes on the left. |
| 3 | **Bug from the team switcher:** a team version copies the design's columns but not `generation_parameters`, where the pet count is read from. A team version of a duo would ask for 1 photo. The recolour prompt also says "the pet's outfit" (singular). | Duo sports designs break when switched. Fix first. |
| 4 | Pet data lives in three places (`generation_parameters.subjects`, the `is_multi_subject`/`subjects` columns, and `image_catalog_subjects`), and upload never fills the columns. | New features read the wrong one, as in 3. |
| 5 | Search, the breed picker on collection pages, and auto-tagging only use the first pet's breed. | A Beagle + Persian design isn't found under "Persian". |
| 6 | Nothing on a design card says it's for 2 pets. | A one-pet customer clicks in and hits "Add 2 pet photos". |
| 7 | A customised image stores only the first pet's name. | Emails and titles say "Custom Pawtrait of Biscuit" for Biscuit and Luna; social captions name one pet; the Instagram "before" slide shows only the first pet's photo. |
| 8 | An older separate pair flow (`/create-pair`, `generate-pair-variation`, `preview-pair-variation`) duplicates the main one. | Two code paths to keep right. |

## Should duos be a collection? Yes, and an attribute too

A Christmas duo belongs in Christmas *and* should be easy to find by people with two pets. So:

1. **Pet count on every design**: a filter on browse, collection and search pages (*Any · 1 pet · 2+ pets*), and a small "2 pets" badge on design cards.
2. **A "Double Trouble" collection** (new top-level, beside Occasions, Sports, Pawsonalities and Zodiac), filled automatically from the pet count. Inside it:
   - Two dogs
   - Two cats
   - Dog & cat
   - Three or more

   Duos stay in their occasion or team collections as well.

## Making the swap work

1. **Slots.** Each design gets ordered "slots" built from its analysed pets, left to right: position, species, breed, pose, size.
2. **"Who goes where" on the design page.** One card per slot, e.g. "Left: currently a Beagle, sitting", each with its own photo picker.
   - A "Swap places" button changes the order.
   - Saved pets can be picked per slot, as now.
3. **A prompt written for several pets.** Each photo is named against its slot: "Image 2 replaces the LEFT pet (a sitting Beagle); Image 3 replaces the RIGHT pet (a lying Persian cat)". It also says:
   - every pet must appear, each in its own place;
   - never merge two pets;
   - keep each pet's own markings;
   - keep the existing relative-size rule;
   - a cat can take a dog's place (and vice versa), adapting the pose naturally.
4. **Photo checks per slot.** Each photo should show one pet. If a photo clearly shows two pets, say so ("This photo has two pets; please use one per slot").
   - Later option: "one photo of both", which crops each pet out for its slot.
5. **Any pets, not just your own.** Each slot simply takes a photo, so someone with one pet adds their own plus any other (a friend's, a relative's, one that's passed away). The page says so ("Add a photo for each pet; they don't all have to be yours"). Every slot needs a photo before painting. A "Prefer a solo design?" link points to single-pet designs.
6. **Admin test.** The upload page's Test Variation panel takes one photo per slot. Before launch, run a test set: 6 duo designs × 5 photo pairs (dog+dog, cat+cat, dog+cat, big+small, similar-looking pets) and check every pet is right and in place.

## Other fixes

- **Team versions** keep the pet count and slots. The recolour prompt becomes "every pet's outfit, all in the same team colours".
- **Names:** a customised image keeps all pet names ("Biscuit & Luna"). Titles become "Custom Pawtrait of Biscuit & Luna", emails use "Biscuit & Luna's", and social captions name every pet.
- **Instagram/website "before"** for a duo becomes a side-by-side of the customer's photos (Cloudinary overlay), so the before/after is honest.
- **Search, collection breed picker, auto-tagging** use every pet's breed.
- **Pawsonality quiz** only uses single-pet designs for type pictures.
- **Retire `/create-pair`** and its two API routes once the main flow covers them. Check its traffic first.

## Phases

1. **Fixes and one source of truth.**
   - New column `subject_count`. The `subjects` column becomes the master copy, filled from `generation_parameters` for existing designs and kept in step on save and in team versions.
   - Fix team versions (gap 3), all pet names (gap 7), and all breeds in search and filters (gap 5).
   - Small; no customer-visible change except correct duo team versions.
2. **Swap quality.** Slots, the multi-pet prompt, "who goes where" on the design page, per-slot photo checks, the 2-photo admin test, then the test set above.
3. **Finding duos.** "2 pets" badges, the pet-count filter, and the auto-filled "Double Trouble" collection with its four children.
4. **Polish.** Duo before-slides and captions on social, retiring the old pair flow.

## Phase 1 — built (2026-10-04)

- **Migration** `db/migrations/2026-10-12-multi-pet-data.sql` (after 2026-10-11; safe to re-run):
  - New column `image_catalog.subject_count`.
  - A trigger keeps `subjects`, `subject_count` and `is_multi_subject` in step, copying `generation_parameters.subjects` when `subjects` is empty. Every existing design is backfilled.
  - `image_catalog_subjects` is backfilled for multi-pet designs, and now cascades when a design is deleted (before, deleting a multi-pet design failed).
  - Search documents include every pet's breed.
  - Search and collection Dogs/Cats and breed filters match any pet (`design_has_breed`, `design_has_animal`), and the collection breed picker lists every pet's breed.
- **Design page pet count** reads `subjects` (falls back to `generation_parameters`), so it works before and after the migration.
- **Upload save** also fills the `subjects` / `is_multi_subject` columns.
- **Team versions** of duos:
  - They copy the pets (`subjects`, `generation_parameters` and the per-pet rows), so they ask for the right number of photos.
  - The recolour prompt becomes "There are 2 pets. Recolour every pet's sports outfit, all in the same team kit…", and Gemini is told to keep every animal and the same number of animals.
- **Names:**
  - A customised image's `pet_name` is every pet ("Biscuit & Luna"), so titles read "Custom Pawtrait of Biscuit & Luna", downloads "Biscuit & Luna's Pawtrait", and emails "Biscuit & Luna's". The first pet's id, breed and coat stay as before.
  - Social already used every name.
- **Auto-tagging** is told every pet's breed.
- **Pawsonality quiz** type-picture picker only offers single-pet designs.
- **Tests:**
  - test:collections 56: pet names, recolour wording for duos.
  - test:emails 137: duo possessives.
  - 12 integration checks: trigger, design page count, search / Dogs-Cats / breed filters by the second pet, duo team version keeps both pets and its wording, delete cascade.
  - The earlier team-switcher (22) and tagging/search (25) checks still pass.

## Phase 2 — built (2026-10-04)

- **Slots** (`lib/catalog/slots.ts`): one per pet, ordered left to right from each pet's analysed position.
  - Labels customers understand: "Left", "Right", "Middle", or "Front"/"Back" when stacked. Otherwise "Pet 1", "Pet 2".
  - Each slot also describes what's there now ("a sitting Labrador Retriever").
  - The design page, the painting prompt and the admin test all use the same order, so photo N always replaces slot N.
- **Design page** for multi-pet designs:
  - Copy reads "Put two pets in this picture" and "Add the pets' photos".
  - The photo step says "Add a photo for each of the 2 pets. One pet per photo… They don't all have to be yours."
  - One card per place ("Left · currently a sitting Labrador Retriever").
  - "Swap left and right" exchanges two photos; any warning moves with its photo.
  - `/api/public/catalog-images/[id]` now returns `slots`.
- **Photo check** (`POST /api/public/photo-check`, Claude Haiku): when a photo is added to a multi-pet design, it counts the pets.
  - Two or more pets in one photo: "This photo has 2 pets. Use a photo of just one pet for each place."
  - No pet: a matching hint.
  - Advice only, never blocks. Capped at 40 checks per visitor per hour.
- **Painting prompt for several pets** (`buildMultiSubjectReplacementPrompt`):
  - Names each photo against its place: "IMAGE 2 replaces the LEFT pet (currently a sitting Beagle): this is Biscuit, a Cockerpoo".
  - Demands exactly N pets, never merged or swapped, each keeping its own markings, and cat ↔ dog allowed.
  - Keeps the composition template and the size rule.
  - Used by customer generation whenever there's more than one photo and the count matches the design's pets (otherwise it falls back to the general prompt and logs it).
- **Admin test** (upload page → Test Variation):
  - One photo per pet (2–5), labelled by place.
  - Sent with the pets' positions, so the server uses the same slots and prompt as customers.
  - `preview-pair-variation` is now admin-only.
- **Tests:** `npm run test:multipet` (21: slots and labels, prompt wording, photo-check replies) and 11 browser checks (duo copy, slot labels in order, two-pets warning, swap and warning moving with the photo, photos sent left first). Real Gemini output still needs the test set below; it can't be run here.

**Next before launch:** run the test set in admin (6 duo designs × 5 photo pairs: dog+dog, cat+cat, dog+cat, big+small, look-alikes) and note any design whose prompt template needs editing.

## Phase 3 — built (2026-10-04)

- **Migration** `db/migrations/2026-10-13-double-trouble.sql` (after 2026-10-12; safe to re-run):
  - New collection kind `group` and link source `pets`.
  - Adds **Double Trouble** (top level, between Sports and 16 Pawsonalities) with Two dogs, Two cats, Dog & cat and Three or more.
  - `file_design_by_pets()` plus triggers on `image_catalog` and `image_catalog_subjects` file every design with 2+ pets into the right group from its pet count and species. Unknown species go to Double Trouble itself.
  - Designs are refiled when their pets change, never for customers' own images. "Take out" in admin sticks.
  - Existing designs are filed straight away.
  - `search_designs()` and `collection_designs()` take `p_pets` (1 = one pet, 2 = two or more).
- `lib/collections/definitions.ts` knows the new collections, and the regenerated `2026-10-07-collections-seed.sql` includes them. There's no need to re-run the seed; the migration adds them.
- **Pet-count filter** ("Any number · 1 pet · 2+ pets"):
  - On collection pages, shown only when the collection has duos and isn't Double Trouble itself. The choice is kept when changing animal or breed.
  - On the search page.
  - API: `?pets=1|2` on `/api/public/collection` and `/api/public/search`.
- **"2 pets" / "3 pets" badges** on design cards: collection and search grids, home page designs, /browse and More like this.
- **Admin → Collections:** Double Trouble has no "Add" button and shows a note that it fills itself.
- **Tests:**
  - test:collections 56 (188 collections).
  - 16 checks (8 API, 8 browser): filing by species and count, refile when a pet's breed changes, admin exclusion sticks, customer images never filed, filters, badges, Double Trouble page, /collections section, the design-page chip.

## Decisions (Steve, 2026-10-04)

- Collection name: **Double Trouble** (children: Two dogs, Two cats, Dog & cat, Three or more).
- A duo design is open to anyone: one photo per pet, and the pets don't all have to be the customer's own. No "paint the same pet twice" mode.
