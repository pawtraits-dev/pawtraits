/** Server helper: a design's slots with breed names (see ./slots) */
import { buildSlots, type Slot, type SubjectLike } from './slots';

export function subjectsOf(row: { subjects?: unknown; generation_parameters?: any } | null | undefined): SubjectLike[] {
  if (Array.isArray(row?.subjects) && row!.subjects.length) return row!.subjects as SubjectLike[];
  if (Array.isArray(row?.generation_parameters?.subjects)) return row!.generation_parameters.subjects as SubjectLike[];
  return [];
}

export async function loadSlots(supabase: any, subjects: SubjectLike[]): Promise<Slot[]> {
  if (subjects.length < 2) return buildSlots(subjects);
  const ids = Array.from(new Set(subjects.map(s => s.breedId).filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x))));
  const { data } = ids.length ? await supabase.from('breeds').select('id, name, animal_type').in('id', ids) : { data: [] };
  return buildSlots(subjects, new Map((data ?? []).map((b: any) => [b.id, { name: b.name, animal_type: b.animal_type }])));
}
