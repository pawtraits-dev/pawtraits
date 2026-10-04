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

## Decisions (Steve, 2026-10-04)

- Collection name: **Double Trouble** (children: Two dogs, Two cats, Dog & cat, Three or more).
- A duo design is open to anyone: one photo per pet, and the pets don't all have to be the customer's own. No "paint the same pet twice" mode.
