/**
 * How many pets are in a customer's photo (server only), for multi-pet designs where each photo
 * should show one pet (docs/specs/multi-pet-plan.md, phase 2). Claude Haiku, one short answer.
 * Never throws: null when it can't tell (the page then says nothing).
 */
import Anthropic from '@anthropic-ai/sdk';
import { createWithUsage } from '@/lib/ai/usage';

const MODEL = 'claude-haiku-4-5-20251001';
let client: Anthropic | null = null;

export function parseCountReply(text: string): number | null {
  const m = /\{[\s\S]*\}/.exec(text)?.[0];
  if (!m) return null;
  try {
    const v = JSON.parse(m);
    const n = Number(v.pets);
    return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
  } catch { return null; }
}

export async function countPets(base64: string, media: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<number | null> {
  try {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    client ??= new Anthropic({ apiKey });
    const res = await createWithUsage(client, { feature: 'pet-count' }, {
      model: MODEL, max_tokens: 30,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: media, data: base64 } },
        { type: 'text', text: 'How many pets (dogs, cats or other animals) can be clearly seen in this photo? Count each animal once; ignore toys, pictures of animals and people. Reply with JSON only: {"pets": <number>}' },
      ] }],
    });
    return parseCountReply(res.content.map(c => (c.type === 'text' ? c.text : '')).join(''));
  } catch (err) {
    console.warn('countPets failed', err);
    return null;
  }
}
