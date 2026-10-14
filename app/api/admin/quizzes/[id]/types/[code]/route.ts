/**
 * PATCH /api/admin/quizzes/[id]/types/[code] — edit a result type in the draft
 * (name, tagline, traits[], signature_move, owner_reality, share_quote, image_prompt,
 * design_image_ids[] — the first is the main design, mirrored into design_image_id).
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
  const ids = parsed.value.design_image_ids ?? (parsed.value.design_image_id ? [parsed.value.design_image_id] : []);
  if (ids.length) {
    const { data: imgs } = await supabase.from('image_catalog').select('id').in('id', ids);
    if ((imgs ?? []).length !== ids.length) return NextResponse.json({ error: 'A chosen design is not in the catalogue' }, { status: 400 });
  }
  // A design belongs to one type only
  if (ids.length) {
    const { data: others } = await supabase.from('quiz_result_types').select('code, design_image_id, design_image_ids').eq('quiz_id', id).neq('code', code);
    const clash = (others ?? []).find((o: any) => ids.some(x => x === o.design_image_id || (o.design_image_ids ?? []).includes(x)));
    if (clash) return NextResponse.json({ error: `A chosen design already belongs to ${clash.code}. Remove it there first.` }, { status: 409 });
  }
  // Setting only the single design keeps the list in step (it becomes the first)
  if (parsed.value.design_image_ids === undefined && parsed.value.design_image_id !== undefined) {
    const { data: cur } = await supabase.from('quiz_result_types').select('design_image_ids').eq('quiz_id', id).eq('code', code).maybeSingle();
    const rest = ((cur?.design_image_ids ?? []) as string[]).filter(x => x !== parsed.value.design_image_id);
    parsed.value.design_image_ids = parsed.value.design_image_id ? [parsed.value.design_image_id, ...rest] : rest;
    if (!parsed.value.design_image_id && rest.length) parsed.value.design_image_id = rest[0];
  }

  const { data, error } = await supabase.from('quiz_result_types')
    .update({ ...parsed.value, updated_at: new Date().toISOString() })
    .eq('quiz_id', id).eq('code', code).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Result type not found' }, { status: 404 });

  await supabase.from('quizzes').update({ has_unpublished_changes: true, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json(data);
}
