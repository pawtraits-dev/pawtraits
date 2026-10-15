/**
 * Pawsonalities pages (/pawsonalities, /pawsonalities/[animal]/[slug]): the 16 types of the live
 * (published) quiz with their pictures. Server only.
 */
import { serviceClient } from '@/lib/qr/server';
import { getLiveQuiz } from '@/lib/quiz/server';
import type { AnimalType, Pole, QuizResultType } from '@/lib/quiz/types';
import { typeSlug } from '@/lib/quiz/type-slug';

export const QUIZ_SLUG = 'pawsonality';

/** Families of four, by the first two letters */
export const FAMILIES: { prefix: string; name: string; blurb: string }[] = [
  { prefix: 'ES', name: 'Energetic & Social', blurb: 'Busy, bouncy and happiest with company.' },
  { prefix: 'EN', name: 'Energetic & Independent', blurb: 'Plenty of get-up-and-go, on their own terms.' },
  { prefix: 'IS', name: 'Calm & Social', blurb: 'Laid-back souls who love their people.' },
  { prefix: 'IN', name: 'Calm & Independent', blurb: 'Quiet, self-contained and quietly fascinating.' },
];

/** What each letter means (cats' third dimension is Responsive / Own Agenda) */
export function dimensionGuide(animal: AnimalType): { title: string; poles: { letter: Pole; name: string; text: string }[] }[] {
  const pet = animal === 'cat' ? 'cat' : 'dog';
  return [
    { title: 'Energy', poles: [
      { letter: 'E', name: 'Energetic', text: 'Gets a buzz from activity and action.' },
      { letter: 'I', name: 'Internal', text: 'Recharges with rest and a calm spot.' } ] },
    { title: 'Social', poles: [
      { letter: 'S', name: 'Social', text: 'Thrives on company, human or animal.' },
      { letter: 'N', name: 'Neutral', text: 'Content with or without a crowd.' } ] },
    { title: animal === 'cat' ? 'Responsiveness' : 'Training', poles: animal === 'cat' ? [
      { letter: 'T', name: 'Responsive', text: 'Comes when called and likes a routine.' },
      { letter: 'F', name: 'Own Agenda', text: 'Does things their way, thank you.' } ] : [
      { letter: 'T', name: 'Trainable', text: 'Loves structure, learns quickly.' },
      { letter: 'F', name: 'Free-spirit', text: 'Prefers to make their own decisions.' } ] },
    { title: 'Boldness', poles: [
      { letter: 'B', name: 'Bold', text: `First to investigate anything new.` },
      { letter: 'C', name: 'Cautious', text: `A careful ${pet} who likes the familiar.` } ] },
  ];
}

export { typeSlug, typeHref } from '@/lib/quiz/type-slug';

/** A catalogue picture by id, through the watermarked image route */
export const pictureUrl = (imageId: string, w = 600) => `/api/secure-images/${imageId}?variant=mid_size&w=${w}`;

export interface TypePicture { id: string; title: string | null; style: string | null }
export interface PawsonalityType extends QuizResultType {
  slug: string;
  mainImageId: string | null;
  pictures: TypePicture[];
}

/** The 16 types of the live quiz for this species, with their designs (main first) */
export async function getPawsonalities(animal: AnimalType): Promise<PawsonalityType[] | null> {
  const quiz = await getLiveQuiz(QUIZ_SLUG, animal);
  if (!quiz) return null;
  const ids = Array.from(new Set(quiz.resultTypes.flatMap(t => t.designImageIds?.length ? t.designImageIds : t.designImageId ? [t.designImageId] : [])));
  const { data: imgs } = ids.length
    ? await serviceClient().from('image_catalog').select('id, description, styles:style_id (name)').in('id', ids)
    : { data: [] as any[] };
  const byId = new Map((imgs ?? []).map((i: any) => [i.id, i]));
  return quiz.resultTypes
    .slice().sort((a, b) => a.code.localeCompare(b.code))
    .map(t => {
      const list = (t.designImageIds?.length ? t.designImageIds : t.designImageId ? [t.designImageId] : []).filter(id => byId.has(id));
      return {
        ...t,
        slug: typeSlug(t.name),
        mainImageId: list[0] ?? null,
        pictures: list.map(id => ({ id, title: titleOf(byId.get(id)?.description), style: (byId.get(id) as any)?.styles?.name ?? null })),
      };
    });
}

function titleOf(description?: string | null): string | null {
  const m = (description || '').match(/\*\*(.+?)\*\*/);
  return m ? m[1].trim() : null;
}

/** Breeds of this species, most popular first (for the breed pickers) */
export async function speciesBreeds(animal: AnimalType): Promise<{ id: string; name: string }[]> {
  const { data } = await serviceClient().from('breeds').select('id, name').eq('animal_type', animal).eq('is_active', true)
    .order('popularity_rank', { ascending: true, nullsFirst: false }).order('name');
  return data ?? [];
}

/** Breed versions of the given main designs: sourceImageId → [{ breedId, imageId }] (done only) */
export async function breedVersions(sourceImageIds: string[], breedId?: string | null): Promise<Map<string, { breedId: string; imageId: string }[]>> {
  const out = new Map<string, { breedId: string; imageId: string }[]>();
  if (!sourceImageIds.length) return out;
  let q = serviceClient().from('quiz_breed_images').select('source_image_id, breed_id, image_id')
    .in('source_image_id', sourceImageIds).eq('status', 'done').not('image_id', 'is', null);
  if (breedId) q = q.eq('breed_id', breedId);
  const { data } = await q;
  for (const r of data ?? []) {
    const list = out.get(r.source_image_id) ?? [];
    list.push({ breedId: r.breed_id, imageId: r.image_id });
    out.set(r.source_image_id, list);
  }
  return out;
}
