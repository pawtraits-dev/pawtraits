---
name: write-brief
description: How to write a build brief that a cheaper model can carry out correctly without the conversation. Use before delegating any coding to the builder agent, and when a delegated task came back wrong.
when_to_use: Writing instructions for a subagent; "brief the builder"; a subagent misunderstood the task.
---

# Write a build brief

The reader is a capable model that has never seen this conversation, cannot ask questions, and will do
exactly what the words say. Most failed delegations are brief failures. Spend the effort here.

## Required sections, in this order

**1. Where and how you work.** Absolute directory, branch name (and whether to create it), what else is
running nearby ("another agent is working in X; do not touch it"), and the standing prohibitions: do not
push, open a pull request, run SQL, run `next build`, call AI/email/payment APIs or the live site.
The commit command and message trailers to use (copy the attribution lines from this session's instructions).

**2. Goal.** Two to five sentences: who the feature is for, what they will be able to do, and why.
Include the owner's decisions verbatim where wording matters.

**3. Read first.** The specific files to read before writing anything, including the existing feature
most like this one ("copy the pattern in `app/admin/audiences/page.tsx`"). Say "confirm every column in
`db/current-db/current-schema` and `db/migrations/`; do not guess names".

**4. Build.** Numbered parts. For each: the file to create or change, the function or route and its
inputs and outputs, the rules, and the edge cases. State rules as rules ("a person who is both counts
once, as a buyer"), not as hopes ("handle duplicates"). Give exact customer-facing wording in quotes.
Say what must NOT change ("do not change payment logic"; "the Buyers tab is unchanged"), and for a
read-only or additive task list the folders that must not be edited at all.

**5. Safety.** What can send email, spend AI money, take payment or change customer data, and the guard
for each. New features of that kind ship switched off and must do nothing before their migration is run.

**6. Tests.** The test script to add or extend and the cases it must cover, written as a list of
behaviours including the awkward ones (zero, missing, duplicate, boundary dates, the migration not run).

**7. Checks to run and pass.** Paste the commands from the `run-checks` skill, with the test scripts for
this area named. Include "no sibling dynamic route folders with differing param names" when adding routes.

**8. Report back.** Ask for: files changed; every name relied on and where it was confirmed; deviations
from the brief and why; what could not be verified; anything that looked wrong in code it read but was told not to change;
check results with numbers; the commit hash.

## Rules that make briefs work

- Name real things. Paths, table names, function names, labels: confirmed, not remembered.
- One brief, one mergeable piece. If two parts could ship separately, write two briefs.
- Decide, do not delegate decisions. If you are unsure, find out (`scout`) or ask the owner first.
- Give the reason for a rule when the reason helps the builder handle a case you did not list.
- "If this brief conflicts with how the code really works, follow the code and explain in your report."
- "If something you need does not exist, say so plainly; do not invent it."
- For a refactor: "behaviour must be identical; re-read your own diff and confirm line by line", and
  ask for a test that pins the old output.
- Length is fine. A long precise brief is cheaper than a second attempt.

A full worked example is in [example-brief.md](example-brief.md).
