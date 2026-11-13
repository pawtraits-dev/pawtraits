import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { LISTED_ONLY } from '@/lib/catalog/listing';
import { closestCoat } from '@/lib/catalog/coat-match';

/**
 * POST /api/images/recommended
 * Returns catalog images matching customer's pet breed+coat combinations
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const { petCombinations } = await request.json();

    if (!petCombinations || !Array.isArray(petCombinations) || petCombinations.length === 0) {
      return NextResponse.json({ images: [] });
    }

    // Use service role client for database operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Build query to match any of the breed combinations
    // Strategy: Match by breed AND coat for precise recommendations
    let query = supabaseAdmin
      .from('image_catalog')
      .select(`
        id,
        filename,
        public_url,
        prompt_text,
        description,
        tags,
        breed_id,
        coat_id,
        theme_id,
        style_id,
        format_id,
        rating,
        is_featured,
        created_at,
        breeds!inner (
          id,
          name,
          animal_type
        ),
        themes (
          id,
          name
        ),
        styles (
          id,
          name
        )
      `);

    // Build OR conditions for breed+coat combinations
    const validCombinations = petCombinations.filter((combo: any) => combo.breed_id && combo.coat_id);

    if (validCombinations.length > 0) {
      // Match images where BOTH breed AND coat match any pet combination
      const orConditions = validCombinations.map((combo: any) =>
        `and(breed_id.eq.${combo.breed_id},coat_id.eq.${combo.coat_id})`
      ).join(',');

      query = query.or(orConditions);
    } else {
      // Fallback to breed-only if no coat data available
      const breedIds = [...new Set(petCombinations.map((combo: any) => combo.breed_id).filter(Boolean))];

      if (breedIds.length > 0) {
        query = query.in('breed_id', breedIds);
      } else {
        // No valid combinations, return empty
        return NextResponse.json({ success: true, images: [] });
      }
    }

    // Limit results and order by rating (link-only designs left out)
    query = query
      .or(LISTED_ONLY)
      .order('rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(20);

    const { data: images, error } = await query;

    if (error) {
      console.error('Error fetching recommended images:', error);
      return NextResponse.json({ error: 'Failed to fetch recommended images' }, { status: 500 });
    }

    // Deduplicate by image ID (in case of overlaps)
    const uniqueImages = Array.from(
      new Map(images?.map(img => [img.id, img]) || []).values()
    );

    return NextResponse.json({
      success: true,
      images: uniqueImages
    });

  } catch (error) {
    console.error('Unexpected error fetching recommended images:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const RECOMMENDED_SELECT = `
  id, filename, public_url, prompt_text, description, tags, breed_id, coat_id, theme_id, style_id, format_id,
  rating, is_featured, created_at,
  breeds!inner ( id, name, animal_type ),
  themes ( id, name ),
  styles ( id, name )
`;
const RECOMMENDED_LIMIT = 24;

type Basis = { source: 'pet' | 'customisation' | 'quiz'; breed_id: string; coat_id: string | null };

/**
 * GET /api/images/recommended
 * Designs for the signed-in customer's "Recommended" tab, worked out on the server from everything
 * we know about their pets:
 *   1. pets they have added (breed and coat)
 *   2. photos they have used to personalise a design (detected breed and coat)
 *   3. the breed they chose when taking a Pawsonality quiz (breed only)
 * Where the pet's coat is known, only that breed in that coat is recommended; any coat is used
 * only for a quiz breed (no coat known). When no design exists in the pet's coat, the closest coat
 * colour available for that breed is used instead (lib/catalog/coat-match.ts).
 * Returns { images, basedOn } — basedOn lists the breeds used, for the heading.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore } as any);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const email = (user.email || '').toLowerCase();

    const { data: customer } = await db.from('customers').select('id').eq('user_id', user.id).maybeSingle();

    // Each source is optional: a failure in one must not hide the others
    const [petsRes, customRes, quizRes] = await Promise.all([
      db.rpc('get_user_pets', { user_uuid: user.id }),
      (() => {
        let q = db.from('customer_custom_images').select('pet_breed_id, pet_coat_id, created_at').not('pet_breed_id', 'is', null)
          .order('created_at', { ascending: false }).limit(50);
        if (customer?.id && email) q = q.or(`customer_id.eq.${customer.id},customer_email.eq.${email}`);
        else if (customer?.id) q = q.eq('customer_id', customer.id);
        else q = q.eq('customer_email', email || '__none__');
        return q;
      })(),
      (() => {
        let q = db.from('quiz_results').select('breed_id, created_at').not('breed_id', 'is', null)
          .order('created_at', { ascending: false }).limit(50);
        q = email ? q.or(`user_id.eq.${user.id},email.eq.${email}`) : q.eq('user_id', user.id);
        return q;
      })(),
    ]);

    const basis: Basis[] = [];
    const seen = new Set<string>();
    const add = (source: Basis['source'], breedId: unknown, coatId: unknown) => {
      if (typeof breedId !== 'string' || !breedId) return;
      const coat = typeof coatId === 'string' && coatId ? coatId : null;
      const key = `${breedId}:${coat ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      basis.push({ source, breed_id: breedId, coat_id: coat });
    };
    for (const p of (petsRes.data as any[] | null) ?? []) add('pet', p.breed_id, p.coat_id);
    for (const c of (customRes.data as any[] | null) ?? []) add('customisation', c.pet_breed_id, c.pet_coat_id);
    for (const q of (quizRes.data as any[] | null) ?? []) add('quiz', q.breed_id, null);

    if (basis.length === 0) {
      return NextResponse.json({ success: true, images: [], basedOn: [] });
    }

    const breedIds = Array.from(new Set(basis.map(b => b.breed_id)));
    const exactPairs = basis.filter(b => b.coat_id);
    const listed = () => db.from('image_catalog').select(RECOMMENDED_SELECT).eq('is_public', true).or(LISTED_ONLY)
      .order('rating', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(RECOMMENDED_LIMIT);

    // Where the coat is known, recommend that breed in that coat only
    const exactRes = exactPairs.length
      ? await listed().or(exactPairs.map(b => `and(breed_id.eq.${b.breed_id},coat_id.eq.${b.coat_id})`).join(','))
      : { data: [] as any[], error: null };
    if (exactRes.error) console.error('Recommended images (breed and coat) query failed:', exactRes.error);
    const exact: any[] = exactRes.data ?? [];

    // Any coat is shown only for a breed whose coat we do not know (a quiz answer), or for a breed
    // that has no design in the pet's coat yet, so the tab is not left empty
    const breedsWithExact = new Set(exact.map(img => img.breed_id));
    const breedsWithCoat = new Set(exactPairs.map(b => b.breed_id));
    const anyCoatBreedIds = breedIds.filter(id => !breedsWithCoat.has(id) || !breedsWithExact.has(id));
    // A breed with a known coat but no design in it: use the closest coat colour we do have
    // (an Apricot pet sees Golden, not Black) rather than every colour
    const closest: { breed_id: string; coat_id: string; coat_name: string | null }[] = [];
    const stillAnyCoat: string[] = [];
    const needClosest = anyCoatBreedIds.filter(id => breedsWithCoat.has(id));
    if (needClosest.length) {
      const [{ data: coatRows }, { data: available }] = await Promise.all([
        db.from('coats').select('id, name, hex_color'),
        db.from('image_catalog').select('breed_id, coat_id').eq('is_public', true).or(LISTED_ONLY)
          .in('breed_id', needClosest).not('coat_id', 'is', null).limit(5000),
      ]);
      const coatById = new Map((coatRows ?? []).map((c: any) => [c.id, c]));
      for (const breedId of needClosest) {
        const petCoats = exactPairs.filter(b => b.breed_id === breedId).map(b => coatById.get(b.coat_id as string)).filter(Boolean);
        const candidateIds = Array.from(new Set((available ?? []).filter((r: any) => r.breed_id === breedId).map((r: any) => r.coat_id)));
        const candidates = candidateIds.map(id => coatById.get(id)).filter(Boolean) as any[];
        const picks = new Map<string, any>();
        for (const petCoat of petCoats) {
          const best = closestCoat(petCoat as any, candidates);
          if (!best) continue;
          // Coats that share that exact colour count too (e.g. "Red" and "Red and White")
          for (const c of candidates) if (c.hex_color && c.hex_color === (best as any).hex_color) picks.set(c.id, c);
        }
        if (picks.size) for (const c of Array.from(picks.values())) closest.push({ breed_id: breedId, coat_id: c.id, coat_name: c.name ?? null });
        else stillAnyCoat.push(breedId);
      }
    }
    const anyCoatFinal = [...anyCoatBreedIds.filter(id => !breedsWithCoat.has(id)), ...stillAnyCoat];
    const closestRes = closest.length
      ? await listed().or(closest.map(c => `and(breed_id.eq.${c.breed_id},coat_id.eq.${c.coat_id})`).join(','))
      : { data: [] as any[], error: null };
    const breedRes = anyCoatFinal.length
      ? await listed().in('breed_id', anyCoatFinal)
      : { data: [] as any[], error: null };
    if (exactRes.error && breedRes.error) {
      console.error('Recommended images query failed:', breedRes.error);
      return NextResponse.json({ error: 'Failed to fetch recommended images' }, { status: 500 });
    }

    const byId = new Map<string, any>();
    for (const img of [...exact, ...(closestRes.data ?? []), ...(breedRes.data ?? [])]) if (!byId.has(img.id)) byId.set(img.id, img);
    const images = Array.from(byId.values()).slice(0, RECOMMENDED_LIMIT);

    const { data: breedRows } = await db.from('breeds').select('id, name').in('id', breedIds);
    const names = new Map((breedRows ?? []).map((b: any) => [b.id, b.name]));
    const basedOn = breedIds.map(id => ({
      breed_id: id,
      breed_name: names.get(id) ?? null,
      sources: Array.from(new Set(basis.filter(b => b.breed_id === id).map(b => b.source))),
      // 'exact' = the pet's own coat; 'closest' = nearest colour available; 'any' = coat not known or no colour data
      coat_match: breedsWithExact.has(id) ? 'exact' : closest.some(c => c.breed_id === id) ? 'closest' : 'any',
      closest_coats: Array.from(new Set(closest.filter(c => c.breed_id === id).map(c => c.coat_name).filter(Boolean))),
    }));

    return NextResponse.json({ success: true, images, basedOn });
  } catch (error) {
    console.error('Recommended images error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
