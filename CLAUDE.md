# CLAUDE.md

Pawtraits (pawtraits.pics) sells AI pet portraits ("Pawtraits") online and at London market stalls.
Next.js 16 App Router, React 19, TypeScript, Supabase, Stripe, Cloudinary, Resend, Vercel.
The owner, Steve, is not a developer: he directs the work in plain English and runs SQL himself.

This file is short on purpose. It is loaded into every session and every subagent, so keep it that way.
Detail lives in the files it points to; read them when the task needs them.

## How work is done here

One **lead** session talks to Steve, plans, delegates, checks and ships. The lead does not write large
amounts of code itself. Coding goes to cheaper models with a written brief; the lead reads the diff and
runs the checks before anything is pushed.

| Job | Who | Model |
|---|---|---|
| Talk to Steve, decide scope, review diffs, ship | lead session | Sonnet (Opus for a hard design question) |
| Find where something lives, confirm column names and labels | `scout` agent | Haiku |
| Design a large or risky feature and write its brief | `planner` agent | Opus |
| Write the code from a brief | `builder` agent | Sonnet |
| Run the checks and report the numbers | `checker` agent | Haiku |
| Review a risky diff before it ships | `reviewer` agent | Opus |
| Customer-facing words, emails, the operating manual | `copywriter` agent | Sonnet |

To build anything, follow the **`build-feature`** skill. It names the steps and when each agent is used.
Other skills: `write-brief`, `run-checks`, `ship-pr`, `sql-migration`, `house-voice`.
The owner's guide to all of this is `docs/claude/model-routing.md`.

Rules for delegating:
- A subagent knows nothing of the conversation. Its brief must stand alone (`write-brief`).
- Never report an agent's work as done until you have read its diff and re-run the checks yourself.
- Two agents at once need two checkouts: use a git worktree (`isolation: worktree`, or
  `git worktree add /home/claude/wt/<name> -b <branch> main` with `node_modules` symlinked).
- If a cheaper model has failed the same task twice, stop and move it up one tier with a better brief.

## Hard rules

1. **Never run SQL against the database.** Write a migration file (`sql-migration` skill) and give Steve the
   link; he runs it by hand. New code must work before the migration is run (feature quietly off).
2. **Never invent a column, table, route or button label.** Check `db/current-db/current-schema`, the
   files in `db/migrations/`, and the code that already reads it. Ask `scout` if unsure.
3. **Checks before every push** (`run-checks` skill): the type-error count must not exceed `.tsc-baseline`,
   and the relevant `scripts/test-*.ts` must pass. `next build` and `npm run lint` do not work in the
   cloud workspace: do not use them, and do not claim a build passed. Vercel's preview build is the build check.
4. **Money, payments and credentials:** do not change payment logic unless the task is about it. Never
   post test requests to live payment endpoints. Never put secrets in code, logs or briefs.
5. **Customer data:** never log email addresses. Marketing email goes only through
   `canEmail(supabase, email, topic)` in `lib/marketing/preferences.ts`; it fails closed. Never email an
   address that is not subscribed, and never re-subscribe one that unsubscribed.
6. **Admin API routes** start with `const denied = await requireAdmin(); if (denied) return denied;`
   (`@/lib/qr/server`). `scripts/check-admin-route-guards.ts` enforces it.
7. **Prices are never written into code or copy.** They come from the catalogue.
8. **Risky changes wait for Steve.** Anything touching checkout, payment, the picture-generation pipeline,
   sign-in, or sending email goes up as a pull request with a preview link and a short click-through list,
   and is merged only when he says so. Additive admin pages and copy fixes may be merged once checks and
   the Vercel build pass.
9. **Say what was not tested.** The cloud workspace cannot reach the live site or the database. State
   plainly what was checked by test and what still needs a real click.

## Traps that have cost time

- A stale `.next/` inflates the type-error count. Always `rm -rf .next` first.
- The TypeScript target does not allow `for...of` directly over a `Map` or `Set`. Use `Array.from(...)`.
- Two sibling dynamic folders with different names (`app/p/[code]` and `app/p/[token]`) break the
  production build although everything passes locally. Check siblings before adding one.
- Supabase returns at most 1,000 rows per request. Page with `.range()` (see `fetchAll` in
  `lib/marketing/audiences.ts`). No per-row queries.
- Many test scripts need dummy environment variables (listed in `run-checks`).
- ESLint is broken in this repo. Do not try to fix it as part of another task.
- Cloudinary, measured on the live account: `fl_relative` sizes and offsets are cut to two decimals, so
  frame layers use whole pixels; `b_blurred` is rejected (bleed uses `b_black`). See `lib/frames/`.
- Emails sent from a Vercel preview deployment must link back to that deployment (`lib/site-url.ts`):
  signed links are checked with the deployment's own secret.
- Ignore the `pawtraits-u346` Vercel project when reading commit statuses and deployments.
- `git diff main` on a branch that is behind `main` shows other people's merged work as deletions.
  Merge `main` in before reviewing.

## Where things live

`docs/claude/map.md` lists each feature with its main files, tables and tests. Read the relevant entry
before exploring. Quick pointers:

- Database truth: `db/current-db/current-schema`, then `db/migrations/` (dated files are the recent ones).
- App settings (switches, numbers): `lib/app-settings.ts`.
- Admin sidebar: `app/admin/layout.tsx`. Operating manual content: `lib/admin/manual/content.ts`.
- Architecture patterns (data access layers, auth, API clients): `docs/claude/architecture-reference.md`.
- Specs and plans Steve and Claude have written: the claude.ai Project docs (`claude/*.md`), not the repo.

## Words

Customer-facing and admin text follows the `house-voice` skill: plain British English, "Pawtrait" not
"portrait", "pet" not "dog", the artist is "Pawcasso", no emoji, no delivery-time or money-back promises.
Reports to Steve are plain English with the outcome first: what is live, what he must do (SQL, a click
to check), what was not tested. No code identifiers unless he needs to find something by that name.

## Keeping this file useful

When a mistake costs more than a few minutes, add one line to "Traps" or the relevant skill in the same
pull request as the fix. Do not add narrative, history or long examples here; put them in `docs/claude/`.
