import { NextRequest, NextResponse } from 'next/server';
import { ClaudeCompositionAnalyzer } from '@/lib/claude-composition-analyzer';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Initialize Supabase for breed/coat matching
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * POST /api/admin/analyze-composition
 *
 * Analyzes an uploaded image using Claude AI to generate:
 * - Marketing description
 * - Composition analysis
 * - Subject identification (breeds/coats)
 * - Variation prompt template
 *
 * Request body:
 * {
 *   imageBase64: string (data:image/jpeg;base64,...),
 *   themeId?: string,
 *   styleId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎨 [Analyze API] Request received');

    // TODO: Add admin authentication check
    // const { data: { user } } = await supabase.auth.getUser();
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Parse request body
    const body = await request.json();
    const { imageBase64, themeId, styleId } = body;

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Missing required field: imageBase64' },
        { status: 400 }
      );
    }

    // Validate base64 format
    const base64Match = imageBase64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json(
        { error: 'Invalid image format. Must be data:image/[jpeg|png|webp];base64,...' },
        { status: 400 }
      );
    }

    const imageFormat = `image/${base64Match[1]}` as 'image/jpeg' | 'image/png' | 'image/webp';
    const base64Data = base64Match[2];

    // Compress image to max 1024px for cost optimization (Claude API)
    console.log('🖼️  [Analyze API] Compressing image...');
    const originalBuffer = Buffer.from(base64Data, 'base64');
    const compressedBuffer = await sharp(originalBuffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .toFormat('png')
      .toBuffer();

    const compressedBase64 = compressedBuffer.toString('base64');
    console.log(`📦 [Analyze API] Compressed: ${originalBuffer.length} → ${compressedBuffer.length} bytes`);

    // Fetch context data (theme, style, breeds)
    console.log('📚 [Analyze API] Loading context data...');
    const [themesData, stylesData, breedsData, coatsData] = await Promise.all([
      themeId ? supabase.from('themes').select('*').eq('id', themeId).single() : null,
      styleId ? supabase.from('styles').select('*').eq('id', styleId).single() : null,
      supabase.from('breeds').select('id, name, display_name').eq('is_active', true),
      supabase.from('coats').select('id, name, display_name, breed_id')
    ]);

    const theme = themesData?.data;
    const style = stylesData?.data;
    const breeds = breedsData?.data || [];
    const coats = coatsData?.data || [];

    console.log('✅ [Analyze API] Context loaded:', {
      theme: theme?.name,
      style: style?.name,
      breedCount: breeds.length
    });

    // Initialize Claude analyzer
    const analyzer = new ClaudeCompositionAnalyzer();

    // Analyze image
    console.log('🤖 [Analyze API] Starting Claude analysis...');
    const analysis = await analyzer.analyzeImage({
      imageBase64: compressedBase64,
      imageFormat: 'image/png', // Always PNG after compression
      context: {
        theme: theme?.display_name || theme?.name,
        style: style?.display_name || style?.name,
        knownBreeds: breeds.map(b => b.display_name || b.name)
      }
    });

    console.log('✅ [Analyze API] Analysis complete');

    // Match AI-identified breeds/coats to database IDs
    console.log('🔗 [Analyze API] Matching breeds/coats to database...');
    const enrichedSubjects = analysis.subjects.map(subject => {
      // Find matching breed
      const matchedBreed = breeds.find(b => {
        const breedName = (b.display_name || b.name).toLowerCase();
        const identifiedName = subject.identifiedBreed.name.toLowerCase();
        return breedName === identifiedName ||
               breedName.includes(identifiedName) ||
               identifiedName.includes(breedName);
      });

      // Find matching coat (if breed matched)
      let matchedCoat = null;
      if (matchedBreed) {
        const breedCoats = coats.filter(c => c.breed_id === matchedBreed.id);
        matchedCoat = breedCoats.find(c => {
          const coatName = (c.display_name || c.name).toLowerCase();
          const identifiedPattern = subject.identifiedCoat.pattern.toLowerCase();
          return coatName.includes(identifiedPattern) ||
                 identifiedPattern.includes(coatName);
        });
      }

      return {
        subjectOrder: subject.subjectOrder,
        isPrimary: subject.isPrimary,
        suggestedBreed: matchedBreed ? {
          id: matchedBreed.id,
          name: matchedBreed.display_name || matchedBreed.name,
          confidence: subject.identifiedBreed.confidence / 10 // Convert 1-10 to 0-1
        } : undefined,
        suggestedCoat: matchedCoat ? {
          id: matchedCoat.id,
          name: matchedCoat.display_name || matchedCoat.name,
          confidence: subject.identifiedCoat.confidence / 10
        } : undefined,
        breedId: matchedBreed?.id,
        coatId: matchedCoat?.id,
        position: subject.position,
        poseDescription: `${subject.pose}, ${subject.gaze} gaze, ${subject.expression}`,
        gazeDirection: subject.gaze,
        expression: subject.expression,
        sizeProminence: subject.relativeSize,
        identifiedByAI: true,
        aiConfidence: subject.identifiedBreed.confidence / 10
      };
    });

    console.log('✅ [Analyze API] Breed/coat matching complete:', {
      totalSubjects: enrichedSubjects.length,
      matchedBreeds: enrichedSubjects.filter(s => s.breedId).length,
      matchedCoats: enrichedSubjects.filter(s => s.coatId).length
    });

    // Return enriched analysis
    const response = {
      marketingDescription: analysis.marketingDescription,
      compositionAnalysis: analysis.compositionAnalysis,
      subjects: enrichedSubjects,
      compositionMetadata: analysis.compositionMetadata,
      variationPromptTemplate: analysis.variationPromptTemplate,
      confidence: analysis.confidence
    };

    console.log('📤 [Analyze API] Returning response');
    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ [Analyze API] Error:', error);

    // Check for specific error types
    if (error.message?.includes('Claude analysis failed')) {
      return NextResponse.json(
        {
          error: 'AI Analysis Failed',
          message: 'Claude AI could not analyze the image. Please try a different image or contact support.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      );
    }

    if (error.message?.includes('CLAUDE_API_KEY')) {
      return NextResponse.json(
        {
          error: 'Configuration Error',
          message: 'Claude AI is not properly configured. Please contact administrator.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 500 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        error: 'Analysis Failed',
        message: 'An error occurred during image analysis. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Enable body parsing for base64 images (increase limit)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb' // Allow up to 15MB for base64 images
    }
  }
};
