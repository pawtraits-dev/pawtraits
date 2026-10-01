/**
 * PATCH /api/admin/quizzes/[id]/types/[code] — edit a result type in the draft
 * (name, tagline, traits[], signature_move, owner_reality, share_quote, design_image_id).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { parseResultTypeInput } from '@/lib/quiz/admin-server';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; code: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id, code } = await params;
  if (!/^[EI][SN][TF][BC]$/.test(code)) return NextResponse.json({ error: 'Invalid type code' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = parseResultTypeInput(body);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = serviceClient();
  if (parsed.value.design_image_id) {
    const { data: img } = await supabase.from('image_catalog').select('id').eq('id', parsed.value.design_image_id).maybeSingle();
    if (!img) return NextResponse.json({ error: 'That design is not in the catalogue' }, { status: 400 });
  }

  const { data, error } = await supabase.from('quiz_result_types')
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq('quiz_id', id).eq('code', code).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Result type not found' }, { status: 404 });

  await supabase.from('quizzes').update({ has_unpublished_changes: true, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json(data);
}
