---
name: house-voice
description: The Pawtraits writing rules - customer-facing copy, emails, consent wording, admin text, and how to report to the owner. Use whenever writing words a customer, a member of staff or the owner will read.
when_to_use: Writing page text, an email, a button label, a consent line, the operating manual, or a summary for the owner.
---

# House voice

## Customer-facing

- British English. Warm, playful, a little cheeky; short sentences. Puns are welcome when they are easy
  ("This link has gone walkies"), never forced, never more than one per screen.
- **Pawtrait**, not portrait. **Pet**, not dog (cats are customers too), unless the text is about one animal.
- The artist is **Pawcasso**. Pets may be given human jobs and airs ("Chief Relaxation Officer").
- No emoji. No exclamation-mark pile-ups.
- No prices in copy or code: they come from the catalogue.
- No delivery-time promises and no money-back guarantee.
- Support address: support@pawtraits.pics.
- Dr Katrina Warren's name appears only with the Pawsonality and behaviour content. Never with zodiac
  or tarot.
- Say what will happen in the person's terms: "We'll email it to you", not "Your request has been queued".

## Consent and data wording

Cute and consistent with the site, never heavy legal, but the meaning must be complete and true:
what we will send, what we keep, how to stop. The agreed lines live in `lib/marketing/consent-copy.ts`
and `lib/previews/copy.ts`; reuse them. A change to these words changes what people agreed to: bump the
recorded version and get the owner's approval of the exact text.

## Emails

Subject under about 50 characters, the pet's name when known, with a fallback when it is not.
One idea per email, one main button. Marketing emails carry the unsubscribe and preferences links and
headers from `marketingEmailExtras`, and a line saying why the person is receiving it.

## Admin text and the operating manual

Plain, imperative, second person: "Open **Orders**, then press **Printed**." Use the exact on-screen
labels. Explain what a switch does in one line under it. Empty, loading and error states say what to do
next. No jargon without a glossary entry in the manual.

## Reports to the owner

He is not a developer and is usually switching in from other work.

- First sentence: the outcome. "X is merged and live (PR #N, no SQL)." or "X is ready for you to check."
- Then, as needed, short labelled groups: what changed; what he must do (SQL link, clicks to check);
  decisions made on his behalf, so he can object; what was not tested; what is still open.
- Plain English. No function names, file paths or internal labels unless he needs to find something by
  that name (a migration file, a button). Explain a term the first time it appears.
- Say plainly when something is unverified, when an earlier statement was wrong, or when a choice
  reverses a decision he made before.
- Ask at most the questions that are truly his: wording, money, who is contacted, anything irreversible.
