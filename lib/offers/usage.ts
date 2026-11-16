import { DAY_MS } from './settings';

/** Units of AI work in the last 24 hours: one per offer generated, plus one per picture replaced by hand (and one per offer being generated now) */
export function dayUsage(offers: { status: string; generated_at: string | null; designs: any[] | null }[], now: number): number {
  const since = now - DAY_MS;
  let used = 0;
  for (const o of offers) {
    if (o.status === 'generating') { used += 1; continue; }
    const at = o.generated_at ? Date.parse(o.generated_at) : NaN;
    if (!(at >= since)) continue;
    used += 1 + (o.designs ?? []).filter((d: any) => d?.replacedAt && Date.parse(d.replacedAt) >= since).length;
  }
  return used;
}
