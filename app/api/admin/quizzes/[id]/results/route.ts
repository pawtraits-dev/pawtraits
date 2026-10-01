/**
 * GET /api/admin/quizzes/[id]/results?days=30
 * Completions, shares, saves and purchases in the period, results per type, where quiz takers
 * came from (entry_source), and the latest 25 results (pet name, type, breed, when, share code).
 * No emails or IPs. "Purchased" = the quiz taker ordered within 30 days (stripe webhook).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get('days')) || 30));
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const supabase = serviceClient();

  const { data: rows, error } = await supabase.from('quiz_results')
    .select('result_type, shared_at, email, user_id, converted_to_purchase, entry_source')
    .eq('quiz_id', id).gte('completed_at', since).limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byType: Record<string, number> = {};
  const bySource: Record<string, { completions: number; shared: number; purchased: number }> = {};
  let shared = 0, saved = 0, purchased = 0;
  for (const r of rows ?? []) {
    byType[r.result_type] = (byType[r.result_type] || 0) + 1;
    if (r.shared_at) shared++;
    if (r.email || r.user_id) saved++;
    if (r.converted_to_purchase) purchased++;
    const src = (bySource[r.entry_source || 'unknown'] ||= { completions: 0, shared: 0, purchased: 0 });
    src.completions++;
    if (r.shared_at) src.shared++;
    if (r.converted_to_purchase) src.purchased++;
  }

  const { data: recent } = await supabase.from('quiz_results')
    .select('share_code, pet_name, result_type, quiz_version, completed_at, shared_at, breeds:breed_id (name)')
    .eq('quiz_id', id).order('completed_at', { ascending: false }).limit(25);

  return NextResponse.json({
    days,
    completions: rows?.length ?? 0,
    shared, saved, purchased,
    byType,
    bySource,
    recent: (recent ?? []).map((r: any) => ({ ...r, breed: r.breeds?.name ?? null, breeds: undefined })),
  });
}
