---
name: build-feature
description: The Pawtraits build process from request to live. Use for any feature, fix or change to the site or admin, to decide which agents and models do which step and what must be checked before shipping.
when_to_use: The owner asks for something to be built, changed or fixed; "build", "add", "fix", "let's do item N", "make it so that".
argument-hint: "[what to build]"
---

# Build a feature

You are the lead. You talk to the owner, decide, delegate, check and ship. Keep your own context for
judgement: do not read large files or write large amounts of code yourself when an agent can.

Request: $ARGUMENTS

## 1. Size it (a minute, no agents)

| Size | Signs | Route |
|---|---|---|
| **Small** | One file or one clear rule; copy or config; under ~50 lines | Do it yourself, then steps 5–7 |
| **Standard** | One feature area; a page, a route, a report; follows an existing pattern | `scout` if needed → you write the brief → `builder` |
| **Large or risky** | Several areas; or touches checkout, payment, picture generation, sign-in, email sending; or needs a migration with behaviour | `scout` → `planner` writes the brief → `builder` → `reviewer` |

Ask the owner before building only when a wrong guess would be costly: who gets contacted, wording with
consent weight, prices, anything irreversible. Otherwise choose a sensible default and say which you chose.

## 2. Look before briefing

Read the feature's entry in `docs/claude/map.md`. Send `scout` for anything you would otherwise guess:
exact columns, the existing pattern to copy, a label's exact text. Several scout questions can run at once.

Give `scout` numbered, specific questions and the files to start from ("when a friend orders with a code,
which tables and columns are written? Start at the Stripe webhook"). Ask it to trace what the code really
writes, not what the column names suggest: half the columns in an old table may be written by nothing.

If a scout or builder reports something that looks like a bug, **read that code yourself before telling
the owner**. Cheap models are good at spotting oddities and less reliable at judging them. Report what you
confirmed, say it was confirmed by reading and not by running, and do not fix it inside an unrelated task.

## 3. Brief

Write the brief with the `write-brief` skill (or have `planner` write it). One brief per independently
mergeable piece. If the feature needs SQL, the brief includes the migration (`sql-migration` skill).

## 4. Build

Spawn `builder` with the whole brief. Run it in the background so the owner can keep talking.
Two builders at once must each have their own worktree and must not own the same files.
While it runs, tell the owner in plain words what is being built and what choices you made.

## 5. Check (never skip, never trust a report alone)

1. Read the diff yourself: `git diff main...<branch> --stat`, then the risky files in full.
   If the branch is behind `main`, merge `main` in first.
2. Run `checker` (or the `run-checks` commands yourself for a small change).
3. For anything in the "risky" row above, run `reviewer` and fix every blocker before shipping.
   Send fixes back to `builder` with the finding quoted; small ones you may make yourself.

A builder's report says what it believes. The diff and the checks say what is true.

## 6. Ship

Follow the `ship-pr` skill: push, pull request, wait for the Vercel build, then either merge (additive,
low-risk) or hold for the owner with a preview link and a short click-through list (risky).

## 7. Tell the owner

Outcome first, in plain English (`house-voice`, "Reports to the owner"): what is live or waiting; what he
must do (SQL file link, a click to check); decisions you made on his behalf; what was not tested.
If the change affects how staff work, update the operating manual (`copywriter`).

## When it goes wrong

- Checks fail after a builder says they pass: send the exact output back to the same builder once.
- Same task failed twice on a cheaper model: do not try a third time. Improve the brief (what was
  ambiguous?) and move it up one tier, or use `planner` to redesign.
- Something broke in production: say so immediately, give the owner the choice of a revert, then fix.
- Add one line to `CLAUDE.md` "Traps" or the relevant skill for any mistake that cost real time.
