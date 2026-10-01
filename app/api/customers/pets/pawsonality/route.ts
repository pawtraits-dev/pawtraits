/**
 * GET /api/customers/pets/pawsonality
 * For My pets: each of the signed-in customer's pets' Pawsonality (type code, name, result link),
 * their species, and which species' quizzes are live (so pets without a type can be offered it).
 * → { live: { dog, cat }, pets: { [petId]: { animal, code, name, shareCode } } }
 */
import { NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { sessionUserId } from '@/lib/quiz/server';
import { liveAnimals } from '@/lib/quiz/ways-in';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
  try {
    const supabase = serviceClient();
    const [live, { data: pets, error }] = await Promise.all([
      liveAnimals(),
      supabase.from('pets').select('id, animal_type, pawsonality_type, pawsonality_result_id').eq('user_id', userId),
    ]);
    if (error) throw error;

    const resultIds = (pets ?? []).map(p => p.pawsonality_result_id).filter(Boolean) as string[];
    const { data: results } = resultIds.length
      ? await supabase.from('quiz_results').select('id, share_code, quiz_id').in('id', resultIds)
      : { data: [] as any[] };
    const quizIds = Array.from(new Set((results ?? []).map(r => r.quiz_id)));
    const { data: types } = quizIds.length
      ? await supabase.from('quiz_result_types').select('quiz_id, code, name').in('quiz_id', quizIds)
      : { data: [] as any[] };

    const out: Record<string, { animal: string | null; code: string | null; name: string | null; shareCode: string | null }> = {};
    for (const p of pets ?? []) {
      const r = (results ?? []).find(x => x.id === p.pawsonality_result_id);
      const t = r && p.pawsonality_type ? (types ?? []).find(x => x.quiz_id === r.quiz_id && x.code === p.pawsonality_type) : null;
      out[p.id] = { animal: p.animal_type ?? null, code: p.pawsonality_type ?? null, name: t?.name ?? null, shareCode: r?.share_code ?? null };
    }
    return NextResponse.json({ live, pets: out });
  } catch (err) {
    console.error('pets pawsonality failed', err);
    return NextResponse.json({ error: 'Could not load Pawsonalities' }, { status: 500 });
  }
}
