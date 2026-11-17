---
name: run-checks
description: The exact checks to run on Pawtraits code before committing or pushing, with the commands, the dummy environment variables and how to read the results. Use after any code change and before reporting work as done.
when_to_use: "run the checks", "is it safe to push", after a builder finishes, after merging main into a branch.
allowed-tools: Bash(rm -rf .next) Bash(node scripts/check-type-errors.mjs*) Bash(npx tsx scripts/*)
---

# Run the checks

Run from the repository (or worktree) root. `next build` and `npm run lint` do not work in the cloud
workspace; never use them and never claim a build passed. Vercel's preview build is the build check.

## 1. Type errors against the baseline

```bash
rm -rf .next && node scripts/check-type-errors.mjs | tail -1
```

Expect `Type errors: N (baseline M)` with N ≤ M. The repository has known old errors; the rule is that a
change adds none. Never edit `.tsc-baseline` to make this pass. Always remove `.next` first: stale
generated types inflate the count by a dozen or more.

The count alone is not enough: a change that removes two old errors and adds one new one still passes, and
some new errors break the production build. Compare by file and message against the base branch:

```bash
base=main   # or the branch this one is stacked on
npx tsc --noEmit -p . 2>&1 | grep -E "^(app|lib|components)/" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort > /tmp/tsc-new.txt
git stash -q; git checkout -q $base; rm -rf .next
npx tsc --noEmit -p . 2>&1 | grep -E "^(app|lib|components)/" | sed -E 's/\([0-9]+,[0-9]+\)//' | sort > /tmp/tsc-old.txt
git checkout -q -; git stash pop -q
comm -13 /tmp/tsc-old.txt /tmp/tsc-new.txt   # errors this change adds; must be empty (a type union printed in a different order is not new)
```

If N > M, list the new ones: `npx tsc --noEmit 2>&1 | grep -E "^(app|lib|components|scripts)/" | grep "<your file>"`.
A common cause is `for...of` directly over a `Map` or `Set`; use `Array.from(...)`.

## 2. Test scripts for the areas touched

Tests are plain-assert scripts, one per area, run with `tsx`. Many import server code that reads
environment variables at load, so always pass the dummy set:

```bash
E="NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x CLOUDINARY_CLOUD_NAME=x CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=x"
for t in test-offers test-preview-emails; do echo -n "$t: "; env $E npx tsx scripts/$t.ts 2>/dev/null | tail -1; done
```

Pick scripts by area (`ls scripts/test-*.ts`). Common ones:

| Changed | Run |
|---|---|
| `lib/frames`, downloads of framed cards | `test-frame`, `test-frame-switch`, `test-framed-download`, `test-framed-entitlements` |
| `lib/orders`, print files | `test-print-geometry`, `test-self-print-fulfilment`, `test-guest-checkout` |
| `lib/offers` | `test-offers` |
| `lib/previews` | `test-preview-emails` |
| `lib/marketing` | `test-email-preferences`, `test-audiences` |
| `lib/admin/popularity.ts` | `test-popularity` |
| `lib/tracking` | `test-meta-events` |
| `lib/admin/manual` or any admin label or page | `test-admin-manual` |
| `lib/site-url.ts` | `test-site-url` |

A few older scripts (`test-cloudinary`, `test-watermark`, `test-image-variants`, `test-image-security`)
need real credentials and fail in the cloud workspace; that is expected. Say so, do not count them as passes.

New logic gets a new or extended script: pure exported functions, plain asserts, a final
`console.log('<area>: N passed')`, non-zero exit on failure, no network and no database.

## 3. Admin route guards

```bash
env $E npx tsx scripts/check-admin-route-guards.ts | tail -1
```

Every handler under `app/api/admin/` must start with the `requireAdmin` guard.

## 4. Sibling dynamic folders (only when a route folder was added)

```bash
find app -type d -name '[[]*' | sed 's#/[^/]*$##' | sort | uniq -d
```

Any directory printed has two dynamic children. If their names differ (`[code]` and `[token]`), the
production build fails. Move one elsewhere.

## 5. For a refactor or a merge

Re-read your own diff: `git diff main...HEAD -- <the risky files>`. If the branch is behind `main`,
merge `main` in first and run everything again on the merged result.

## Reporting

Give the numbers exactly: `Type errors: 878 (baseline 878)`, `test-offers: 140 passed`. If something
could not be run, say which and why. "Not run against real data" is true of every check here; say it.
