/**
 * GET /api/admin/quizzes/designs?animal=dog|cat
 * Catalogue designs in the Pawsonalities theme (any theme whose name contains "Pawsonalit"),
 * for linking a design to each result type. Returns { theme, designs: [{id, description, breed}] }.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const animal = request.nextUrl.searchParams.get('animal');
  const supabase = serviceClient();

  const { data: themes } = await supabase.from('themes').select('id, name').ilike('name', '%pawsonalit%');
  if (!themes?.length) return NextResponse.json({ theme: null, designs: [] });

  const { data, error } = await supabase.from('image_catalog')
    .select('id, description, created_at, subjects, generation_parameters, breeds:breed_id (name, animal_type)')
    .in('theme_id', themes.map(t => t.id))
    .or('is_customer_generated.is.null,is_customer_generated.eq.false')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const designs = (data ?? [])
    .filter((d: any) => !animal || !d.breeds?.animal_type || d.breeds.animal_type === animal)
    // Type pictures are repainted as one pet's breed, so only single-pet designs qualify
    .filter((d: any) => Math.max(Array.isArray(d.subjects) ? d.subjects.length : 0, Array.isArray(d.generation_parameters?.subjects) ? d.generation_parameters.subjects.length : 0) <= 1)
    .map((d: any) => ({ id: d.id, description: d.description, breed: d.breeds?.name ?? null }));
  return NextResponse.json({ theme: themes[0].name, designs });
}
