import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { searchParams } = new URL(request.url);
    const breedId = searchParams.get('breedId');

    if (breedId) {
      // Get specific breed-coat combinations
      const { data: breedCoats, error } = await supabase
        .from('breed_coats')
        .select(`
          id,
          breed_id,
          coat_id,
          breeds(id, name, slug),
          coats(id, name, slug, hex_color)
        `)
        .eq('breed_id', breedId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        breedId,
        breedCoats,
        count: breedCoats?.length || 0
      });
    } else {
      // Get all breed-coat combinations for debugging
      const { data: allBreedCoats, error } = await supabase
        .from('breed_coats')
        .select(`
          id,
          breed_id,
          coat_id,
          breeds(id, name, slug),
          coats(id, name, slug, hex_color)
        `)
        .limit(50);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Group by breed for easier debugging
      const groupedByBreed = allBreedCoats?.reduce((acc, bc) => {
        const breedName = bc.breeds.name;
        if (!acc[breedName]) {
          acc[breedName] = {
            breedId: bc.breed_id,
            coats: []
          };
        }
        acc[breedName].coats.push({
          coatId: bc.coat_id,
          coatName: bc.coats.name,
          breedCoatId: bc.id
        });
        return acc;
      }, {} as any);

      return NextResponse.json({
        totalCombinations: allBreedCoats?.length || 0,
        breedCoatsByBreed: groupedByBreed
      });
    }
  } catch (error) {
    console.error('Debug breed-coats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch breed-coat data' },
      { status: 500 }
    );
  }
}