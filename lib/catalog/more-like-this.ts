/**
 * "More like this" ordering (client-safe, pure): other versions of the same design first, then the
 * same breed, then (only if still short) the collection and tag fallbacks. Tested in scripts/test-scan-page.ts.
 */
export interface MoreItem { id: string; description?: string; public_url?: string; image_url?: string; subject_count?: number }

/** Merge ranked lists: skip the current design and duplicates, stop at max */
export function mergeMoreLikeThis(lists: MoreItem[][], currentId: string, max: number): MoreItem[] {
  const seen = new Set<string>([currentId]);
  const out: MoreItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (out.length >= max) return out;
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/** Fallbacks (collection, tag) are only fetched when versions and breed left the list short */
export const needsFallback = (found: number, max: number) => found < max;
