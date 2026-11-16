# Building Pawtraits with lower-cost models: the owner's guide

Written 16 November 2026, at the end of the Fable 5.2 trial. It explains how the build process is set
up so that most of the work is done by cheaper models, and how to use it.

## The idea

A build has four kinds of work, and they need very different amounts of intelligence:

1. **Deciding what to build** and spotting what could go wrong. Hard. Small in volume.
2. **Finding things** in the code. Easy. Lots of reading.
3. **Writing the code** from clear instructions. Medium. The bulk of the cost.
4. **Checking** that it is right. Running tests is easy; judging a risky change is hard.

Using the top model for all four pays top price for a lot of easy reading and typing. The setup in this
repository gives each kind of work to the cheapest model that does it well, and keeps the expensive
model for the two places where mistakes are costly: the design of a risky feature, and the review of a
risky change.

What made this work during the trial was not the top model writing code. It was the **written brief**:
a precise, self-contained instruction that a mid-tier model can follow without the conversation. That
method is now written down (the `write-brief` skill) so any model leading a session uses it.

## Which model does what

| Work | Agent | Model | Why |
|---|---|---|---|
| Talking to you, scoping, reading diffs, shipping | the session itself (the "lead") | **Sonnet 5.5** | Good judgement at a fraction of the cost; it follows the written process |
| Finding files, columns, labels | `scout` | **Haiku 5.5** | Pure lookup; fastest and cheapest |
| Designing a large or risky feature, writing its brief | `planner` | **Opus 5.5** | The one step where depth pays for itself |
| Writing code from a brief | `builder` | **Sonnet 5.5** | Did nearly all the coding during the trial, under briefs |
| Running the checks, reporting numbers | `checker` | **Haiku 5.5** | Mechanical |
| Reviewing a risky change | `reviewer` | **Opus 5.5** | Reads a small diff carefully; cheap in volume, high in value |
| Customer wording, emails, the operating manual | `copywriter` | **Sonnet 5.5** | Follows the house voice |

"Risky" means: checkout or payment, the code that paints previews, sign-in or who can reach a picture or
download, anything that sends email, a database change with behaviour attached, or a tidy-up of shared code.

Rule of thumb for cost: Haiku is the cheapest by a wide margin, Sonnet is the everyday model, Opus costs
several times Sonnet. Check current prices on Anthropic's pricing page; they are not written here because
they change. Opus is used here only for short, high-value steps, so it should stay a small share of the bill.

## How it is configured

Everything is in the repository, so every new session picks it up:

| File | What it does |
|---|---|
| `CLAUDE.md` | The short rule book every session and every agent reads: how work is done, hard rules, known traps |
| `.claude/settings.json` | Makes Sonnet the default model for sessions in this repository |
| `.claude/agents/*.md` | The six agents above, each with its model, its tools and its instructions |
| `.claude/skills/*/SKILL.md` | The six procedures: `build-feature`, `write-brief`, `run-checks`, `ship-pr`, `sql-migration`, `house-voice` |
| `docs/claude/map.md` | Where each feature lives, so cheap models do not explore from scratch |
| `docs/claude/architecture-reference.md` | The old long CLAUDE.md, kept as reference |

The old `CLAUDE.md` was 1,200 lines and was read in full by every session and every agent, including
instructions that no longer worked (it told sessions to run a build and a linter that cannot run in the
cloud workspace). The new one is about 100 lines. That alone cuts cost and removes a source of mistakes.

## How to use it

**Start a session on Sonnet.** It is the default in this repository. If the app's model picker shows
something else, choose Sonnet there; the picker wins over the file.

**Ask the way you do now.** "Build X", "fix Y", "let's do item 3". The lead follows `build-feature`:
it sizes the job, looks things up with `scout`, writes a brief (or has `planner` write it for a risky
job), sends it to `builder`, checks the result, and ships. You can also type `/build-feature <what you want>`
to invoke the process explicitly.

**When to switch the session itself to Opus** (in the model picker, for that conversation):
- You want to think something through before any building: a marketing plan, a pricing decision, the
  shape of a new product line.
- A session on Sonnet is going round in circles or has got something wrong twice.
- A production problem where being wrong is expensive.
Switch back to Sonnet for the build that follows.

**Useful things to say:**
- "Plan this first and show me the brief before building." Use for anything you are unsure about.
- "Have the reviewer look at this before you ship." Forces the Opus review on any change.
- "Use a cheaper model for this." or "Do this one on Opus." You can always override the routing.
- "What did you not test?" It should have told you; ask if it has not.

**What you still do:** run the SQL files, click through previews of risky changes before saying "merge",
and make the calls that are yours (wording, money, who gets contacted).

## What to expect to be different from the trial

- **Slightly more back-and-forth on vague requests.** A Sonnet lead will ask one or two more questions
  where the top model would have inferred your meaning. Answer them; it is cheaper than a wrong build.
- **Less volunteered insight.** It is less likely to notice a problem you did not ask about (for example
  the unwatermarked-picture hole found by reading code during the web-guidance review). To compensate,
  every so often start an Opus session and ask for a review of one area: "review how downloads are
  protected and tell me what could go wrong".
- **Long sessions drift.** Start a fresh session for each new piece of work rather than one very long
  conversation; the rule book and the feature map mean a new session is productive quickly, and short
  sessions cost less because every message re-reads the conversation so far.
- **The process matters more.** A cheaper lead that skips "read the diff and re-run the checks" will ship
  mistakes. If you see "the agent reports it passes" without numbers, say "run the checks yourself".

## Keeping it good

- When something goes wrong and costs time, ask for it to be added to "Traps" in `CLAUDE.md` or to the
  relevant skill, in the same change as the fix. That is how the process learns.
- When a feature's files change, its entry in `docs/claude/map.md` should change too.
- If one kind of task keeps failing on its assigned model, move that agent up a tier by editing the
  `model:` line at the top of its file in `.claude/agents/`. If one keeps succeeding easily, try moving
  it down.
- Keep `CLAUDE.md` short. Anything long belongs in `docs/claude/` or a skill, where it is only read when needed.

## First run (16 November 2026)

The Customer Referrals admin page was built through this process on the day it was written: Haiku traced
the data, Sonnet built from the brief, Haiku ran the checks, and the page merged first time. Two things
were learned and are now in the instructions. First, the Haiku scout, asked to trace what the code really
writes, turned up three faults in the referral scheme that nobody had asked about; so scouts are now told
to list what looks wrong, and the lead to confirm it by reading before reporting. Second, a table can look
complete in the schema while nothing writes half its columns; briefs must say which columns to trust.

## Limits of this setup

- It was written from Claude Code's documentation as of November 2026 and has not yet been run for a
  full build without the top model leading. Expect to adjust the agents after the first week.
- Whether the web app applies `.claude/settings.json`'s default model to new sessions could not be
  tested from inside a session. If new sessions do not start on Sonnet, choose it in the picker.
- The agents' model names are the general aliases (`sonnet`, `opus`, `haiku`), so they move to newer
  versions automatically. That is usually what you want; pin a version in an agent's file if not.
