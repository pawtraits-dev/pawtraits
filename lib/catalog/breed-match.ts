/**
 * Matches the breed Claude names in an uploaded design ("Cocker Spaniel", "Frenchie",
 * "Golden Retriever mix") to a breed in the database. Best guess first:
 *   1. exact name or alternative name
 *   2. the longest database breed whose whole name appears in the guess ("English Cocker Spaniel" → "Cocker Spaniel")
 *   3. a database breed whose name contains the guess ("Poodle" → "Toy Poodle" only if nothing better)
 * The species (dog / cat) must agree when both are known.
 */
export interface MatchableBreed { id: string; name: string; alternative_names?: string[] | null; animal_type?: string | null }

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const MIX = /\b(mix|mixed|cross|crossbreed|type|like|style)\b/g;
const words = (s: string) => ` ${s} `;

export function matchBreed<T extends MatchableBreed>(guess: string | null | undefined, breeds: T[], species?: string | null): T | null {
  const g = norm(guess ?? '').replace(MIX, ' ').replace(/\s+/g, ' ').trim();
  if (!g) return null;
  const pool = breeds.filter(b => !species || !b.animal_type || !['dog', 'cat'].includes(species) || b.animal_type === species);
  const names = (b: T) => [b.name, ...(b.alternative_names ?? [])].map(norm).filter(Boolean);

  const exact = pool.find(b => names(b).includes(g));
  if (exact) return exact;

  let best: { b: T; len: number } | null = null;
  for (const b of pool) for (const n of names(b)) {
    if (n.length >= 3 && words(g).includes(words(n)) && (!best || n.length > best.len)) best = { b, len: n.length };
  }
  if (best) return best.b;

  let wider: { b: T; len: number } | null = null;
  for (const b of pool) for (const n of names(b)) {
    if (g.length >= 4 && words(n).includes(words(g)) && (!wider || n.length < wider.len)) wider = { b, len: n.length };
  }
  return wider?.b ?? null;
}
