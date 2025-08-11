import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get overall pet statistics
    const { data: pets, error: petsError } = await supabase
      .from('pets')
      .select(`
        id,
        name,
        breed_id,
        coat_id,
        gender,
        age,
        created_at,
        breeds:breed_id (
          id,
          name,
          slug
        ),
        coats:coat_id (
          id,
          name,
          hex_color
        )
      `);

    if (petsError) {
      console.error('Error fetching pets:', petsError);
      return NextResponse.json(
        { error: 'Failed to fetch pets data' },
        { status: 500 }
      );
    }

    // Calculate analytics
    const totalPets = pets?.length || 0;
    
    // Pets by breed
    const breedCounts = pets?.reduce((acc: Record<string, any>, pet) => {
      const breedName = (pet.breeds as any)?.name || 'Unknown';
      const breedId = pet.breed_id || 'unknown';
      
      if (!acc[breedId]) {
        acc[breedId] = {
          id: breedId,
          name: breedName,
          count: 0,
          pets: []
        };
      }
      acc[breedId].count++;
      acc[breedId].pets.push({
        id: pet.id,
        name: pet.name,
        gender: pet.gender,
        age: pet.age,
        created_at: pet.created_at
      });
      return acc;
    }, {}) || {};

    // Pets by coat
    const coatCounts = pets?.reduce((acc: Record<string, any>, pet) => {
      const coatName = (pet.coats as any)?.name || 'Unknown';
      const coatId = pet.coat_id || 'unknown';
      const coatColor = (pet.coats as any)?.hex_color;
      
      if (!acc[coatId]) {
        acc[coatId] = {
          id: coatId,
          name: coatName,
          hex_color: coatColor,
          count: 0,
          pets: []
        };
      }
      acc[coatId].count++;
      acc[coatId].pets.push({
        id: pet.id,
        name: pet.name,
        gender: pet.gender,
        age: pet.age,
        created_at: pet.created_at
      });
      return acc;
    }, {}) || {};

    // Gender distribution
    const genderCounts = pets?.reduce((acc: Record<string, number>, pet) => {
      const gender = pet.gender || 'unknown';
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {}) || {};

    // Age distribution (in years)
    const ageGroups = pets?.reduce((acc: Record<string, number>, pet) => {
      if (!pet.age) {
        acc['Unknown'] = (acc['Unknown'] || 0) + 1;
        return acc;
      }
      
      const ageInYears = Math.floor(pet.age / 12);
      let ageGroup = '';
      
      if (ageInYears < 1) ageGroup = 'Puppy (< 1 year)';
      else if (ageInYears < 3) ageGroup = 'Young (1-2 years)';
      else if (ageInYears < 7) ageGroup = 'Adult (3-6 years)';
      else ageGroup = 'Senior (7+ years)';
      
      acc[ageGroup] = (acc[ageGroup] || 0) + 1;
      return acc;
    }, {}) || {};

    // Recent pets (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentPets = pets?.filter(pet => 
      new Date(pet.created_at) > thirtyDaysAgo
    ) || [];

    // Top breeds (sorted by count)
    const topBreeds = Object.values(breedCounts)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    // Top coats (sorted by count)
    const topCoats = Object.values(coatCounts)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      summary: {
        totalPets,
        totalBreeds: Object.keys(breedCounts).length,
        totalCoats: Object.keys(coatCounts).length,
        recentPetsCount: recentPets.length
      },
      distributions: {
        byBreed: Object.values(breedCounts),
        byCoat: Object.values(coatCounts),
        byGender: genderCounts,
        byAge: ageGroups
      },
      topBreeds,
      topCoats,
      recentPets: recentPets.slice(0, 10) // Show last 10 recent pets
    });

  } catch (error) {
    console.error('Error in pets analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}