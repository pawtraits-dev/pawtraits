/**
 * Automatic photo check before an order is featured publicly (website feed, Instagram).
 * Claude looks at the customer's original photo and the finished portrait and rejects:
 *   - a person's face or body (anyone, especially children) in the original photo
 *   - readable personal details: house numbers, street signs, letters, screens, number plates
 *   - a failed portrait: no pet, deformed or duplicated pet, garbled faces, broken artwork
 *   - anything inappropriate (nudity, violence, injury, offensive gestures or text)
 * Server only. Never throws: an unusable answer comes back as status 'error' (retried later).
 */
import Anthropic from '@anthropic-ai/sdk';
import { createWithUsage } from '@/lib/ai/usage';

export type CheckReason = 'person' | 'child' | 'personal_details' | 'failed_portrait' | 'inappropriate' | 'no_pet' | 'unreadable';
export interface PhotoCheckResult { status: 'approved' | 'rejected' | 'error'; reasons: CheckReason[]; note?: string }

const MODEL = 'claude-haiku-4-5-20251001';
const REASONS: CheckReason[] = ['person', 'child', 'personal_details', 'failed_portrait', 'inappropriate', 'no_pet'];

const PROMPT = `You are checking two images before a pet portrait company features them publicly on its website and Instagram.
Image 1 is the customer's ORIGINAL phone photo of their pet. Image 2 is the PORTRAIT painted from it.

Reject if ANY of these apply:
- "person": any human face or recognisable person is visible in image 1 (a hand or arm holding the pet is fine).
- "child": a child appears anywhere in either image.
- "personal_details": readable house numbers, street or road signs, addresses, letters/post, screens, documents, or vehicle number plates in image 1.
- "no_pet": image 1 does not clearly show a pet.
- "failed_portrait": only for clear AI failures in image 2: no animal, two heads or a duplicated animal, extra or missing legs, a melted or garbled face, or the image visibly broken (glitches, half-rendered). Image 2 is meant to be stylised: pencil or sketch styles, partly coloured artwork, costumes, props, painterly lighting and a pose different from the photo are all normal and are NOT failures. When unsure, do not use this reason.
- "inappropriate": nudity, violence, injury, blood, offensive gestures or offensive text in either image.

Reply with JSON only, no other text: {"ok": true|false, "reasons": [...], "note": "<max 12 words>"}
"ok" is true only when "reasons" is empty.`;

let client: Anthropic | null = null;
function anthropic() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No Claude API key');
  return (client ??= new Anthropic({ apiKey }));
}

async function asBase64(url: string): Promise<{ data: string; media: 'image/jpeg' | 'image/png' | 'image/webp' }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`image fetch ${res.status}`);
  const type = (res.headers.get('content-type') || '').split(';')[0];
  const media = type === 'image/png' || type === 'image/webp' ? type : 'image/jpeg';
  return { data: Buffer.from(await res.arrayBuffer()).toString('base64'), media };
}

/** Parse the model's reply; anything unexpected is treated as unusable */
export function parseCheckReply(text: string): PhotoCheckResult {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return { status: 'error', reasons: ['unreadable'] };
  try {
    const v = JSON.parse(json);
    const reasons = (Array.isArray(v.reasons) ? v.reasons : []).filter((r: unknown): r is CheckReason => REASONS.includes(r as CheckReason));
    if (typeof v.ok !== 'boolean') return { status: 'error', reasons: ['unreadable'] };
    // Fail safe: "ok" with reasons, or "not ok" without a known reason, both count as rejected
    if (!v.ok || reasons.length) return { status: 'rejected', reasons: reasons.length ? reasons : ['unreadable'], note: String(v.note ?? '').slice(0, 120) };
    return { status: 'approved', reasons: [] };
  } catch {
    return { status: 'error', reasons: ['unreadable'] };
  }
}

export async function checkPhotos(beforeUrl: string, afterUrl: string): Promise<PhotoCheckResult> {
  try {
    const [before, after] = await Promise.all([asBase64(beforeUrl), asBase64(afterUrl)]);
    const response = await createWithUsage(anthropic(), { feature: 'photo-check' }, {
      model: MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: before.media, data: before.data } },
          { type: 'image', source: { type: 'base64', media_type: after.media, data: after.data } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });
    const text = response.content.map(c => (c.type === 'text' ? c.text : '')).join('');
    return parseCheckReply(text);
  } catch (err) {
    console.error('social photo check failed', err);
    return { status: 'error', reasons: ['unreadable'], note: err instanceof Error ? err.message.slice(0, 120) : undefined };
  }
}
