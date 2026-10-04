/**
 * "Slots" in a multi-pet design (docs/specs/multi-pet-plan.md, phase 2): one per pet in the
 * picture, ordered left to right, each with a label customers understand ("Left", "Right",
 * "Middle", or "Front"/"Back" when they're stacked) and what's there now ("a sitting Beagle").
 * The design page, the painting prompt and the admin test all use this order, so photo N always
 * replaces slot N. Client-safe (no server imports).
 */
export interface Slot {
  index: number;               // 0-based, left to right
  subjectIndex: number;        // position in the design's subjects list
  label: string;               // "Left", "Right", "Middle", "Front", "Back", "Pet 2"
  side: 'left' | 'middle' | 'right' | null;
  depth: 'front' | 'back' | null;
  breedId: string | null;
  breedName: string | null;
  animalType: 'dog' | 'cat' | null;
  pose: string | null;         // "sitting", "lying down"
  size: string | null;         // "primary", "secondary", "equal"…
}

export interface SubjectLike {
  subjectOrder?: number; isPrimary?: boolean; breedId?: string | null; position?: string | null;
  poseDescription?: string | null; sizeProminence?: string | null;
}

const SIDE_RANK = { left: 0, middle: 1, right: 2 } as const;

function sideOf(position?: string | null): Slot['side'] {
  const p = (position ?? '').toLowerCase();
  if (/\bleft\b/.test(p)) return 'left';
  if (/\bright\b/.test(p)) return 'right';
  if (/\b(cent(er|re)|middle)\b/.test(p)) return 'middle';
  return null;
}
function depthOf(position?: string | null): Slot['depth'] {
  const p = (position ?? '').toLowerCase();
  if (/\b(foreground|front)\b/.test(p)) return 'front';
  if (/\b(background|back|behind)\b/.test(p)) return 'back';
  return null;
}
function poseOf(desc?: string | null): string | null {
  const first = (desc ?? '').split(',')[0].trim().toLowerCase();
  return first && first.length <= 40 ? first : null;
}

export function buildSlots(subjects: SubjectLike[] | null | undefined, breeds: Map<string, { name: string; animal_type?: string | null }> = new Map()): Slot[] {
  const list = (Array.isArray(subjects) ? subjects : []).map((s, i) => ({ s, i, side: sideOf(s.position), depth: depthOf(s.position) }));
  list.sort((a, b) => {
    const ra = a.side ? SIDE_RANK[a.side] : 1, rb = b.side ? SIDE_RANK[b.side] : 1;
    if (ra !== rb) return ra - rb;
    const da = a.depth === 'front' ? 0 : a.depth === 'back' ? 2 : 1, db = b.depth === 'front' ? 0 : b.depth === 'back' ? 2 : 1;
    if (da !== db) return da - db;
    return (a.s.subjectOrder ?? a.i + 1) - (b.s.subjectOrder ?? b.i + 1);
  });
  const slots: Slot[] = list.map(({ s, i, side, depth }, index) => {
    const breed = s.breedId ? breeds.get(s.breedId) : undefined;
    const animal = breed?.animal_type === 'cat' ? 'cat' : breed?.animal_type === 'dog' ? 'dog' : null;
    return {
      index, subjectIndex: i, label: '', side, depth, breedId: s.breedId ?? null, breedName: breed?.name ?? null, animalType: animal,
      pose: poseOf(s.poseDescription), size: s.sizeProminence ?? null,
    };
  });
  // Labels: by side when each side is used once, else by depth, else by number
  const sideCounts = new Map<string, number>();
  for (const sl of slots) if (sl.side) sideCounts.set(sl.side, (sideCounts.get(sl.side) ?? 0) + 1);
  for (const sl of slots) {
    const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
    if (slots.length === 1) sl.label = 'Your pet';
    else if (sl.side && sideCounts.get(sl.side) === 1) sl.label = cap(sl.side);
    else if (sl.depth && slots.filter(x => x.depth === sl.depth).length === 1) sl.label = cap(sl.depth);
    else if (sl.depth && slots.filter(x => x.depth === sl.depth && x.side === sl.side).length === 1) sl.label = sl.side ? `${cap(sl.side)}, ${sl.depth}` : cap(sl.depth);
    else sl.label = `Pet ${sl.index + 1}`;
  }
  return slots;
}

/** "a sitting Beagle", "a cat", "a pet" */
export function slotNow(slot: Slot): string {
  const what = slot.breedName || slot.animalType || 'pet';
  const pose = slot.pose && !/^(primary|secondary|unknown)$/.test(slot.pose) ? `${slot.pose} ` : '';
  return `${/^[aeiou]/i.test(pose || what) ? 'an' : 'a'} ${pose}${what}`;
}
