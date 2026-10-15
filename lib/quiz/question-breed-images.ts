/**
 * Quiz takers: question pictures painted as their breed (made by lib/quiz/breed-batch.ts).
 * Kept separate so the public quiz route doesn't load the batch machinery.
 */
import type { SupabaseClient } from '@supabase/supabase-js';


/** questionId → breed version public id, for versions made from each question's current picture */
export async function questionBreedImages(supabase: SupabaseClient, breedId: string, questions: { id: string; imagePublicId?: string | null }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const withPics = questions.filter(q => q.imagePublicId);
  if (!withPics.length) return out;
  const { data } = await supabase.from('quiz_question_breed_images').select('question_id, source_public_id, image_public_id')
    .eq('breed_id', breedId).in('question_id', withPics.map(q => q.id));
  const current = new Map(withPics.map(q => [q.id, q.imagePublicId]));
  for (const r of data ?? []) if (current.get(r.question_id) === r.source_public_id) out.set(r.question_id, r.image_public_id);
  return out;
}
