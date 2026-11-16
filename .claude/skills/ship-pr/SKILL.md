---
name: ship-pr
description: How Pawtraits changes go from a checked branch to the live site - commit format, pull request, waiting for the Vercel build, when to merge and when to hold for the owner, and confirming the deploy. Use once checks pass and the diff has been read.
when_to_use: "ship it", "open a PR", "merge", "is it live", after checks pass on a branch.
---

# Ship a change

Only after the diff has been read and `run-checks` passes. The repository is `pawtraits-dev/pawtraits`;
`main` deploys to production on Vercel automatically.

## 1. Commit and push

Branch names: `feat/…`, `fix/…`, `docs/…`, `chore/…`. Never commit to `main` directly.
Commit messages say what changed for the user, then why if it is not obvious, and end with the
attribution lines given in this session's instructions. Push with `git push -u origin <branch>`.

## 2. Pull request

Write the body to a file and create it with the API (the body is the record the owner and future
sessions read):

```bash
gh api repos/pawtraits-dev/pawtraits/pulls -f title="<plain-English title>" -f head=<branch> -f base=main -F body=@/tmp/pr.md --jq '.number'
```

Body sections: **What** (what the owner or customer can now do), **Safety** (switches, what cannot
happen), **Needs** (SQL file, environment variable) or "No SQL", **Checks** (the numbers, and what was
not exercised). End with the pull-request attribution lines from this session's instructions.

## 3. Wait for the Vercel build

```bash
n=<number>; for i in $(seq 1 24); do sha=$(gh api repos/pawtraits-dev/pawtraits/pulls/$n --jq .head.sha); r=$(gh api repos/pawtraits-dev/pawtraits/commits/$sha/status --jq '[.statuses[] | select(.context|test("u346")|not) | .state] | join(",")'); echo "$r" | grep -q "success\|failure\|error" && break; sleep 20; done; echo "build: $r"
```

Ignore the `pawtraits-u346` project. A failed build here is the real build check: read the Vercel log
link in the status, fix, push, wait again. The preview address for the owner:

```bash
d=$(gh api "repos/pawtraits-dev/pawtraits/deployments?sha=$sha" --jq '[.[]|select(.environment|test("u346")|not)|.id]|.[0]'); gh api repos/pawtraits-dev/pawtraits/deployments/$d/statuses --jq '.[0].environment_url'
```

## 4. Merge now, or hold for the owner?

**Hold** (give the preview address and a numbered click-through list; merge only when he says so) when
the change touches: checkout or payment; the picture-generation pipeline; sign-in or access to pictures
and downloads; anything that sends email; a refactor of shared code; anything he asked to see first.

**Merge once the build is green** when it is additive and low-risk: a new admin page or report, copy and
manual changes, a fix confined to one rule with tests.

When in doubt, hold. Before merging, check the pull request is still open and mergeable; if `main` has
moved, merge `main` into the branch, re-run the checks, push, and wait for the build again.

```bash
gh api -X PUT repos/pawtraits-dev/pawtraits/pulls/$n/merge -f merge_method=merge --jq '.sha'
```

Stacked pull requests: merge the lower one, then `gh api -X PATCH …/pulls/<upper> -f base=main`.

## 5. Confirm the deploy

```bash
sha=<merge sha>; for i in $(seq 1 24); do s=$(gh api "repos/pawtraits-dev/pawtraits/deployments?sha=$sha" --jq '[.[]|select(.environment|test("u346")|not)|.id]|.[0]'); [ -n "$s" ] && [ "$s" != "null" ] && st=$(gh api repos/pawtraits-dev/pawtraits/deployments/$s/statuses --jq '.[0].state') && { [ "$st" = success ] || [ "$st" = failure ] || [ "$st" = error ]; } && break; sleep 20; done; echo "deploy: $st"
```

Then `git checkout main && git pull`. "Deployed" means the build went out, not that the feature was
used. If a browser tool is available, open the live page and look; if not, say it was not looked at.

## 6. Report

Tell the owner: what is live; links to any SQL file **on `main`** (links to a branch die after merge);
what to click to confirm; what was not tested. If the change needs SQL that has not been run, say what
the site does until it is.

## If production breaks

Tell the owner at once and offer a revert: `git revert -m 1 <merge sha>` on a branch, pull request,
merge. Fix forward only if the fix is small and certain.
