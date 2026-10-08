# Batch variations and AI cost tracking: findings and plan

Status: steps 1–3 built 2026-10-08 (cost tracking, Admin → AI costs, one-request-per-variation with 2K/4K choice); steps 4–5 not started.

## 1. Why batch variations have never worked reliably

The "Batch mode" switch in the variations window creates a `batch_jobs` row, one `batch_job_items` row per variation, then starts `processBatchJob()` **without waiting for it** and returns straight away (`app/api/admin/batch-jobs/route.ts`).

On Vercel a function is frozen as soon as it has sent its response. So:

- **Processing dies.** The loop is suspended mid-item, sometimes after one or two images, sometimes before the first. Nothing ever resumes it: items stay `running` or `pending` for ever. Locally (`npm run dev`) it works, which is why it looked fine in testing.
- **No time limit is set.** The route has no `maxDuration`. Even if the work kept going, each image takes 20–60 s, so a 30-item job needs 10–30 minutes in one function.
- **It skips review.** Each result goes straight into the catalogue as **public**. It has no `image_variants` (thumbnails and watermarks), no description, no pet data, and no auto-tagging or collections.
- **Other problems:**
  - No admin check on the route.
  - The full-size original is downloaded and resent with every item.
  - The "adaptive speed controller" only slows down between items, which doesn't fix any of the above.

The interactive path (`generate-variations`) has the same root problem at a smaller scale: everything happens in one request, so more than about 4–6 variations runs past 5 minutes.

## 2. What the Gemini Batch API offers

From Google's docs (Batch API and pricing pages, read 2026-10-08):

| | |
|---|---|
| How | Submit many `generateContent` requests as one job. Either inline (under 20 MB in total) or a JSONL file uploaded with the File API (up to 2 GB). |
| Image models | Supported, including Nano Banana 2.1. Images come back as base64 `inlineData` parts, just like now. |
| Input images | Upload the source design **once** with the File API and reference it from every request. Requests stay tiny. |
| Turnaround | Target 24 h, "in the majority of cases much quicker". Jobs not finished in 48 h expire with no results. |
| Price | **50% of standard** for every token type. |
| Results | A JSONL file, one line per request, matched by our own key. Kept for 6 weeks. |
| Status | Pending, running, succeeded, failed, cancelled, expired. Poll `batches.get`. Google also lists completion webhooks. |
| SDK | `@google/genai` (we have 2.24): `ai.batches.create / get / cancel / list`, `ai.files.upload / download`. |
| Limits | Higher rate limits than interactive calls. Creating a job twice makes two jobs, so we must guard against double-submits. |

So the Batch API fits **big, non-urgent runs**: filling the catalogue (e.g. 20 breeds × 5 coats on one design, or every Premier League team on a sports design) at half price, with no timeouts on our side. It does **not** fit anything a customer is waiting for.

## 3. Prices that matter (USD, per image)

| Model | 2K standard | 4K standard | 2K batch | 4K batch |
|---|---|---|---|---|
| Nano Banana Pro (`gemini-3-pro-image`), what we used until this week | $0.134 | $0.240 | $0.067 | $0.120 |
| Nano Banana 2 (`gemini-3.1-flash-image`) | $0.101 | $0.151 | $0.050 | $0.076 |
| **Nano Banana 2.1** (`gemini-nano-banana-2.1`), now our default | **$0.050** | **$0.113** | **$0.025** | **$0.057** |

**On your 4K point.** A 4K image on 2.1 ($0.113) is cheaper than the 2K images we were paying for on Pro ($0.134), and about what 2K cost on Nano Banana 2. In batch, 4K is $0.057.

That is the output image only. The other parts of each request cost more on 2.1:

| Per 1M tokens | Pro | 2.1 | 2.1 batch |
|---|---|---|---|
| Input (prompt + photos) | $2.00 | $1.50 | $0.75 |
| Thinking and text output | $12.00 | $7.50 | $3.75 |

(Against Nano Banana 2, which 2.1 replaces, input went from $0.50 to $1.50 and thinking from $3 to $7.50. Against Pro, both are cheaper.)

**Rough cost of one customer painting** (prompt about 1,500 tokens, 2 images in, about 1,000 thinking tokens; real numbers will come from tracking):

| | Image | Input | Thinking | Total |
|---|---|---|---|---|
| Pro, 2K (before) | 0.134 | 0.005 | 0.012 | **≈ $0.15** |
| 2.1, 2K (now) | 0.050 | 0.004 | 0.008 | **≈ $0.06** |
| 2.1, 4K | 0.113 | 0.004 | 0.008 | **≈ $0.13** |
| 2.1, 4K, batch | 0.057 | 0.002 | 0.004 | **≈ $0.06** |

Unknowns that tracking will settle:

- how many tokens an input photo costs on 2.1 (Pro counts 560 per image; 2.1's docs don't say);
- how much 2.1 "thinks" at its default level (`medium`). We can set `thinkingLevel: 'minimal'` per request. Note that Pro's thinking can't be switched off; 2.1's can be turned down.

**4K for every preview** would let the print master be the exact picture the customer approved, with no second "make the 4K version" call when a Large print is ordered. That saves a step and removes the risk of the print looking different from the preview. The costs:

- slower generation while the customer waits (to be measured);
- files of about 15–25 MB, so uploads and displays must go through Cloudinary as links (now done for admin previews), never as base64 in a response.

Worth a timed test before switching.

## 4. Proposal

### A. AI usage and cost tracking (build first, small)

**What gets logged**

- **One wrapper for every AI call.** All Gemini image calls (about 10 files) and Claude calls (auto-tag, photo check, descriptions; about 10 files) go through `lib/ai/usage.ts`.
- **What it reads:** each response's usage numbers. Gemini's `usageMetadata` gives prompt, image-out, thinking and cached tokens. Claude's `usage` gives input and output tokens.
- **Where it goes:** one row per call in a new `ai_usage` table: when, feature (customer painting, admin variation, team version, print master, mug, auto-tag…), model, standard or batch, image size, each token count, **cost in USD**, design / customer image / batch job id, success or error, and duration.
- **Prices** live in one file (`lib/ai/prices.ts`) with the table above and an "as of" date. Cost is worked out when the call happens, so later price changes don't rewrite history.
- **Low risk:** logging never blocks or breaks a generation, because failures are swallowed.

**New page: Admin → AI costs**

- Today, last 7 and last 30 days: number of calls, spend, and average cost per image, by feature and by model.
- Daily spend chart.
- Cost per customer painting (all attempts for one order, including retries).
- Tokens split into input / thinking / image, to show whether the higher input and thinking prices matter.
- The most expensive recent calls, with links to the design or customer image.
- Optional later: a daily alert email when spend passes a threshold you set.

**Also cuts cost:** try `thinkingLevel: 'minimal'` on 2.1 for variations, compare quality, and keep it where it's no worse.

### B. Batch variations rebuilt

Two paths, picked automatically by size:

1. **Up to about 8 variations: "Now".**
   - The browser sends one request per variation, two at a time, each well within Vercel's limit.
   - Results appear one by one as previews (the same preview, approve and save flow as now).
   - No timeouts, and one failure doesn't lose the rest.
2. **More than that, or when you choose "Overnight, half price": Gemini Batch.**
   - **Submit:** upload the source design to the File API once, write one JSONL line per variation (keyed by our item id, with the same prompts as now), and create the batch job. Store Google's job name on `batch_jobs`.
   - **Check:** the existing every-minute cron also checks running Gemini batches. Webhooks are optional later.
   - **When done:** process results in chunks (e.g. 10 per run). Upload each image to Cloudinary as a **preview**, record tokens and cost, and mark the item "ready for review". Failures are marked with Gemini's reason.
   - **Review:** the batch page shows a grid of previews. Approve all, approve selected, or reject. Approval runs the normal save, so variants, description, pets, auto-tags and collections all work.
   - **Housekeeping:** cancel on our side cancels the Gemini job. Expired or failed jobs show clearly and can be resubmitted. Admin login required throughout.

Optional: offer 4K output in batch. At $0.057 it is cheaper than 2K standard on Pro.

### C. Later: customer generations

Customers can't wait hours, so they stay interactive. Tracking (A) will show the real cost per painting and whether `minimal` thinking or 4K previews are worth it.

## 5. Suggested order and size

| Step | What | Size |
|---|---|---|
| 1 | `ai_usage` table, prices file, wrapper on all Gemini + Claude calls | ~1 session |
| 2 | Admin → AI costs page | ~1 session |
| 3 | "Now" path: one request per variation from the browser | small |
| 4 | Gemini Batch path: submit, cron polling, results to previews, review grid; retire the old processor | ~1–2 sessions |
| 5 | Test: thinking level and 4K previews (speed, file size, quality), using the cost page | small, needs real Gemini |

## Steps 1–2: built (2026-10-08)

- **Migration** `db/migrations/2026-10-16-ai-usage.sql` (safe to re-run):
  - table `ai_usage`, server-only;
  - `ai_usage_summary(from, to)` gives totals by London day, feature and model.
- **Prices:** `lib/ai/prices.ts` covers Nano Banana 2.1 / Pro / 2 and Claude Haiku 4.5 / Sonnet 4.5, as of 2026-10-08, with batch at half price. A model not in the table still gets logged, with no cost and shown as "no price".
- **Logging:** `lib/ai/usage.ts` provides `generateWithUsage(ai, ctx, request)` and `createWithUsage(client, ctx, request)`. These are drop-in replacements for `ai.models.generateContent` and `anthropic.messages.create`.
  - Each call writes one row: input, cached, thinking, text and image tokens, cost split, feature, design / customer image / batch ids, duration, and success or error. Failed calls are logged too.
  - Logging never breaks a call: there's a 3 s cap and errors are swallowed. Setting `AI_USAGE_TRACKING=off` stops logging.
- **Wired in:** all 15 Gemini call sites (6 in `GeminiVariationService` via its `usage` field) and all 10 Claude call sites, each tagged with a feature (customer painting, admin variation, team version, print master, mug, auto-tag, pet count, …).
- **Admin → AI costs** (`/admin/ai-costs`, under Financial):
  - Today / 7 / 30 / 90 days.
  - Totals: spend, calls and failures, images, cost per image, cost per customer painting (average, median, retries).
  - Daily spend chart with hover.
  - Input / thinking / output split.
  - By-feature and by-model tables.
  - The 15 most expensive calls.
  - The prices used.
- **Tests:**
  - `npm run test:ai-usage` (13): price maths, Gemini/Claude token extraction.
  - 6 integration checks: rows written with the right cost, failures logged and rethrown, logging failure doesn't break the call, summary totals.
  - Page checks: admin only, totals match the database, 30 bars, Today, no sideways scroll on a phone.

## Step 3: built (2026-10-08)

- **Variations window** (catalogue card → Generate Variants; also opened from the details window):
  - It sends **one request per variation, two at a time**. Results appear as they finish, each with its AI description.
  - A progress bar shows "n of N done" with a **Stop** button. Failures are listed with their reason, and **Try failed again** reruns only those.
  - Saving is disabled until generation finishes.
- **Image size picker:** 2K (about $0.05) or **4K (about $0.11, the default)**.
  - It's sent as `imageSize` to `generate-variations`, which sets `GeminiVariationService.imageSize`.
  - Each preview shows its size and pixel dimensions, plus a "Full size" link.
  - Other callers stay at `GEMINI_IMAGE_SIZES.preview` (2K).
- **Catalogue cards** have a **Full size** link to the original upload (new tab).
- The old "Background Batch Mode" switch is gone. It started jobs that Vercel froze. The old batch-jobs route remains until step 4 replaces it.
- **Tests:** 12 browser checks with Gemini faked:
  - one request per variation, at 4K, with the design id;
  - never more than 2 at once;
  - failure reason shown and retry adds only the missing one;
  - previews, sizes and descriptions shown;
  - the Full size link on the card.

## Sources

- Gemini Batch API: https://ai.google.dev/gemini-api/docs/batch-mode
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Image generation (thinking levels, reference image limits): https://ai.google.dev/gemini-api/docs/image-generation
- Nano Banana 2.1 model page: https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1
