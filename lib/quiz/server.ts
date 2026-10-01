/**
 * Quiz engine data access (server only — API routes). Service-role client, RLS-only tables.
 */
import { createHash, randomBytes } from 'crypto';
import { serviceClient } from '@/lib/qr/server';
import type { AnimalType, QuizSnapshot, QuizQuestion, QuizResultType } from './types';

export function isAnimal(v: unknown): v is AnimalType {
  return v === 'dog' || v === 'cat';
}

/** 10-char lowercase share code (≈ 51 bits) */
export function newShareCode(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(10);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${process.env.QUIZ_IP_SALT || 'pawtraits-quiz'}:${ip}`).digest('hex').slice(0, 32);
}

/** Latest published version of a quiz, or null if it isn't live. */
export async function getLiveQuiz(slug: string, animal: AnimalType): Promise<QuizSnapshot | null> {
  const supabase = serviceClient();
  const { data: quiz } = await supabase
    .from('quizzes')
    .select('id, slug, animal_type, title, status, current_version')
    .eq('slug', slug).eq('animal_type', animal)
    .maybeSingle();
  if (!quiz || quiz.status !== 'live' || !quiz.current_version) return null;
  return getQuizVersion(quiz.id, quiz.current_version, quiz);
}

/** A specific published version (results are re-read against the version they were scored on). */
export async function getQuizVersion(
  quizId: string, version: number,
  quizRow?: { id: string; slug: string; animal_type: string; title: string },
): Promise<QuizSnapshot | null> {
  const supabase = serviceClient();
  const quiz = quizRow ?? (await supabase.from('quizzes').select('id, slug, animal_type, title').eq('id', quizId).maybeSingle()).data;
  if (!quiz) return null;
  const { data: v } = await supabase
    .from('quiz_versions').select('version, content')
    .eq('quiz_id', quizId).eq('version', version).maybeSingle();
  if (!v) return null;
  const content = v.content as { questions: QuizQuestion[]; resultTypes: QuizResultType[] };
  return {
    quizId: quiz.id, slug: quiz.slug, animalType: quiz.animal_type as AnimalType, title: quiz.title,
    version: v.version, questions: content.questions || [], resultTypes: content.resultTypes || [],
  };
}

/** Public URL for a question picture (Cloudinary public id), or null for the placeholder */
export function questionImageUrl(publicId: string | null | undefined, width = 800): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!publicId || !cloud) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto,c_limit,w_${width}/${publicId}`;
}

/** Signed-in user's auth id from the session cookie, or null (never throws). */
export async function sessionUserId(): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers');
    const { createRouteHandlerClient } = await import('@supabase/auth-helpers-nextjs');
    const cookieStore = await cookies();
    const auth = createRouteHandlerClient({ cookies: () => cookieStore } as any);
    const { data: { user } } = await auth.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
