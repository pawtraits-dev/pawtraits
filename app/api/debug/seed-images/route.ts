import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role client to bypass RLS issues
function getServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

const sampleImages = [
  // Popular images (high like counts)
  {
    original_filename: 'golden_retriever_portrait_1.jpg',
    public_url: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400',
    description: 'Beautiful Golden Retriever portrait with warm lighting',
    prompt_text: 'A majestic golden retriever sitting in a park, professional photography, warm golden hour lighting, detailed fur texture',
    ai_model: 'Midjourney v6',
    rating: 5,
    is_featured: false,
    is_public: true,
    like_count: 47,
    view_count: 156,
    tags: ['golden retriever', 'portrait', 'warm lighting', 'professional'],
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'husky_winter_portrait.jpg',
    public_url: 'https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=400',
    description: 'Siberian Husky in winter wonderland setting',
    prompt_text: 'Siberian husky with piercing blue eyes, snow background, winter portrait, detailed fur',
    ai_model: 'Midjourney v6',
    rating: 5,
    is_featured: false,
    is_public: true,
    like_count: 38,
    view_count: 203,
    tags: ['husky', 'winter', 'blue eyes', 'snow'],
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'labrador_family_portrait.jpg',
    public_url: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=400',
    description: 'Friendly Labrador family portrait',
    prompt_text: 'Happy labrador retriever family, mother and puppies, heartwarming scene, soft lighting',
    ai_model: 'DALL-E 3',
    rating: 4,
    is_featured: false,
    is_public: true,
    like_count: 35,
    view_count: 178,
    tags: ['labrador', 'family', 'puppies', 'heartwarming'],
    created_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'border_collie_action.jpg',
    public_url: 'https://images.unsplash.com/photo-1551717743-49959800b1f6?w=400',
    description: 'Border Collie in action shot',
    prompt_text: 'Border collie running through a field, dynamic action shot, motion blur background, energetic',
    ai_model: 'Midjourney v6',
    rating: 4,
    is_featured: false,
    is_public: true,
    like_count: 29,
    view_count: 145,
    tags: ['border collie', 'action', 'running', 'field'],
    created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString()
  },

  // New images (recent dates)
  {
    original_filename: 'french_bulldog_modern.jpg',
    public_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400',
    description: 'Modern French Bulldog portrait with urban backdrop',
    prompt_text: 'French bulldog with urban city backdrop, modern portrait style, shallow depth of field',
    ai_model: 'Midjourney v6',
    rating: 4,
    is_featured: false,
    is_public: true,
    like_count: 12,
    view_count: 67,
    tags: ['french bulldog', 'urban', 'modern', 'city'],
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'german_shepherd_hero.jpg',
    public_url: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=400',
    description: 'Heroic German Shepherd portrait',
    prompt_text: 'German shepherd in heroic pose, dramatic lighting, professional K9 portrait style',
    ai_model: 'DALL-E 3',
    rating: 5,
    is_featured: false,
    is_public: true,
    like_count: 8,
    view_count: 43,
    tags: ['german shepherd', 'heroic', 'dramatic', 'K9'],
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'corgi_playful_portrait.jpg',
    public_url: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=400',
    description: 'Playful Corgi with tongue out',
    prompt_text: 'Adorable corgi with tongue out, playful expression, bright natural lighting, joyful mood',
    ai_model: 'Midjourney v6',
    rating: 4,
    is_featured: false,
    is_public: true,
    like_count: 15,
    view_count: 89,
    tags: ['corgi', 'playful', 'tongue', 'joyful'],
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'beagle_garden_portrait.jpg',
    public_url: 'https://images.unsplash.com/photo-1618330876892-3b9c7738a15d?w=400',
    description: 'Beagle in beautiful garden setting',
    prompt_text: 'Beagle sitting in a flower garden, spring portrait, natural lighting, peaceful mood',
    ai_model: 'DALL-E 3',
    rating: 4,
    is_featured: false,
    is_public: true,
    like_count: 9,
    view_count: 52,
    tags: ['beagle', 'garden', 'flowers', 'spring'],
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },

  // Featured images (is_featured = true)
  {
    original_filename: 'aussie_shepherd_featured.jpg',
    public_url: 'https://images.unsplash.com/photo-1605568230815-4e23683f0c8f?w=400',
    description: 'Featured Australian Shepherd masterpiece',
    prompt_text: 'Australian shepherd with heterochromia, stunning eye detail, award-winning portrait photography',
    ai_model: 'Midjourney v6',
    rating: 5,
    is_featured: true,
    is_public: true,
    like_count: 67,
    view_count: 234,
    tags: ['australian shepherd', 'heterochromia', 'award-winning', 'detailed'],
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'poodle_elegant_featured.jpg',
    public_url: 'https://images.unsplash.com/photo-1616190265687-b7ebf7ae17ff?w=400',
    description: 'Elegant Poodle in classical style',
    prompt_text: 'Standard poodle with elegant grooming, classical portrait style, sophisticated lighting',
    ai_model: 'DALL-E 3',
    rating: 5,
    is_featured: true,
    is_public: true,
    like_count: 54,
    view_count: 198,
    tags: ['poodle', 'elegant', 'grooming', 'sophisticated'],
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'rottweiler_noble_featured.jpg',
    public_url: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400',
    description: 'Noble Rottweiler portrait',
    prompt_text: 'Rottweiler with noble expression, regal portrait style, dramatic studio lighting, powerful presence',
    ai_model: 'Midjourney v6',
    rating: 5,
    is_featured: true,
    is_public: true,
    like_count: 43,
    view_count: 167,
    tags: ['rottweiler', 'noble', 'regal', 'powerful'],
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    original_filename: 'dachshund_whimsical_featured.jpg',
    public_url: 'https://images.unsplash.com/photo-1629549050085-b5ee45334a00?w=400',
    description: 'Whimsical Dachshund portrait',
    prompt_text: 'Dachshund in whimsical artistic style, creative composition, playful colors, unique perspective',
    ai_model: 'DALL-E 3',
    rating: 4,
    is_featured: true,
    is_public: true,
    like_count: 31,
    view_count: 124,
    tags: ['dachshund', 'whimsical', 'artistic', 'playful'],
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient();
    
    console.log('Seeding sample image data...');
    
    // First check if we already have images
    const { data: existingImages, error: checkError } = await supabase
      .from('image_catalog')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing images:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing images', details: checkError.message },
        { status: 500 }
      );
    }
    
    if (existingImages && existingImages.length > 0) {
      return NextResponse.json({
        message: 'Sample images already exist in database',
        existing_count: existingImages.length
      });
    }
    
    // Insert sample images
    const { data: insertedImages, error: insertError } = await supabase
      .from('image_catalog')
      .insert(sampleImages)
      .select('id, original_filename, is_featured, like_count');
    
    if (insertError) {
      console.error('Error inserting sample images:', insertError);
      return NextResponse.json(
        { error: 'Failed to insert sample images', details: insertError.message },
        { status: 500 }
      );
    }
    
    // Create some sample user interactions for popular images
    const popularImages = insertedImages?.filter(img => (img.like_count || 0) > 20) || [];
    
    if (popularImages.length > 0) {
      const interactions = popularImages.flatMap(img => 
        Array.from({ length: Math.min(img.like_count || 0, 10) }, (_, i) => ({
          user_id: null,
          session_id: `sample_session_${img.id}_${i}`,
          image_id: img.id,
          interaction_type: 'like',
          created_at: new Date().toISOString()
        }))
      );
      
      const { error: interactionError } = await supabase
        .from('user_interactions')
        .insert(interactions);
      
      if (interactionError) {
        console.warn('Warning: Could not create sample interactions:', interactionError);
      }
    }
    
    const result = {
      success: true,
      message: 'Sample images seeded successfully!',
      inserted_count: insertedImages?.length || 0,
      popular_images: insertedImages?.filter(img => (img.like_count || 0) > 20).length || 0,
      featured_images: insertedImages?.filter(img => img.is_featured).length || 0,
      new_images: insertedImages?.filter((img: any) => {
        const createdAt = new Date(img.created_at || '');
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        return createdAt > threeDaysAgo;
      }).length || 0
    };
    
    console.log('Seeding result:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in image seeding:', error);
    return NextResponse.json(
      { error: 'Seeding failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}