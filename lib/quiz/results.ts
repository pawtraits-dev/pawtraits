/**
 * Public view of a saved quiz result (server only). Used by the result API and the result
 * page's metadata. Exposes no email, user, IP or raw answer data.
 */
import { serviceClient } from '@/lib/qr/server';
import { getQuizVersion } from './server';
import { scoreQuiz } from './scoring';
import type { AnimalType, DimensionScore, QuizResultType } from './types';

const CODE_RE = /^[a-z0-9]{8,12}$/;

export interface PublicQuizResult {
  shareCode: string;
  quizSlug: string;
  quizVersion: number;
  animalType: AnimalType;
  petName: string;
  breed: { id: string; name: string } | null;
  code: string;
  type: QuizResultType | null;
  dimensions: DimensionScore[];
  /** Breed-matched picture when made, else the type's design */
  imageId: string | null;
  /** Cloudinary public id of imageId (for server-made share cards) */
  imagePublicId: string | null;
  /** 'breed' = painted as their breed; 'design' = the type's standard design; null = no picture yet */
  imageKind: 'breed' | 'design' | null;
  /** True when a breed version could still be painted (breed given, design exists, not made yet) */
  canPaintBreed: boolean;
  completedAt: string;
}

export async function getPublicResult(shareCode: string): Promise<PublicQuizResult | null> {
  if (!CODE_RE.test(shareCode)) return null;
  const supabase = serviceClient();
  const { data: r } = await supabase
    .from('quiz_results')
    .select('share_code, quiz_id, quiz_type, quiz_version, animal_type, pet_name, answers, answer_order, result_type, result_image_id, completed_at, breeds:breed_id (id, name)')
    .eq('share_code', shareCode)
    .maybeSingle();
  if (!r) return null;

  const snapshot = await getQuizVersion(r.quiz_id, r.quiz_version);
  const type = snapshot?.resultTypes.find(t => t.code === r.result_type) ?? null;
  const dimensions = snapshot ? scoreQuiz(snapshot.questions, r.answers || {}, r.answer_order || []).dimensions : [];
  const breed = (r.breeds as any)?.id ? { id: (r.breeds as any).id, name: (r.breeds as any).name } : null;
  const imageId: string | null = r.result_image_id ?? type?.designImageId ?? null;
  const imageKind = r.result_image_id ? 'breed' as const : type?.designImageId ? 'design' as const : null;
  let imagePublicId: string | null = null;
  if (imageId) {
    const { data: img } = await supabase.from('image_catalog').select('cloudinary_public_id').eq('id', imageId).maybeSingle();
    imagePublicId = img?.cloudinary_public_id ?? null;
  }

  return {
    shareCode: r.share_code,
    quizSlug: r.quiz_type,
    quizVersion: r.quiz_version,
    animalType: r.animal_type,
    petName: r.pet_name,
    breed,
    code: r.result_type,
    type,
    dimensions,
    imageId,
    imagePublicId,
    imageKind,
    canPaintBreed: !!(breed && type?.designImageId && !r.result_image_id),
    completedAt: r.completed_at,
  };
}
