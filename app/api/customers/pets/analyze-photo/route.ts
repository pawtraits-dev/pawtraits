import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { ClaudeCompositionAnalyzer } from '@/lib/claude-composition-analyzer';

/**
 * Customer-Facing Pet Photo Analysis Endpoint
 *
 * Analyzes uploaded pet photos using Claude AI to detect:
 * - Breed with confidence scores
 * - Coat color and pattern
 * - Physical characteristics (pose, gaze, expression)
 * - Personality traits extracted from visual analysis
 *
 * This endpoint wraps the admin ClaudeCompositionAnalyzer for customer use
 * with proper authentication and error handling.
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('📸 [PET ANALYSIS] Starting customer pet photo analysis...');

  try {
    // Authenticate user using cookie-based auth
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('❌ [PET ANALYSIS] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log('✅ [PET ANALYSIS] User authenticated:', user.email);

    // Parse request body
    const { imageBase64, animalType } = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'Image data required' },
        { status: 400 }
      );
    }

    // Validate image format (should be data URL format)
    if (!imageBase64.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Invalid image format. Expected data URL format (data:image/jpeg;base64,...)' },
        { status: 400 }
      );
    }

    console.log('📊 [PET ANALYSIS] Analyzing image for animal type:', animalType || 'unknown');

    // Extract base64 data and media type from data URL
    const matches = imageBase64.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (!matches) {
      return NextResponse.json(
        { error: 'Could not parse image data' },
        { status: 400 }
      );
    }

    const mediaType = matches[1] as 'image/jpeg' | 'image/png' | 'image/webp';
    const base64Data = matches[2];

    // Convert base64 to File object for analyzer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const imageFile = new File([imageBuffer], 'pet-photo.jpg', { type: mediaType });

    // Analyze with Claude
    const analyzer = new ClaudeCompositionAnalyzer();
    const analysisContext = animalType ? { knownBreeds: [] } : undefined;

    const analysis = await analyzer.analyzeImageFromFile(imageFile, analysisContext);

    console.log('✅ [PET ANALYSIS] Claude analysis complete:', {
      subjectsFound: analysis.subjects.length,
      overallConfidence: analysis.confidence.overall
    });

    // Extract primary subject (first pet detected)
    const primarySubject = analysis.subjects.find(s => s.isPrimary) || analysis.subjects[0];

    if (!primarySubject) {
      return NextResponse.json(
        {
          error: 'No pet detected in image',
          suggestion: 'Please upload a clear photo with your pet as the main subject'
        },
        { status: 400 }
      );
    }

    // Extract personality traits from marketing description
    const personalityTraits = extractPersonalityTraits(analysis.marketingDescription);

    // Build customer-friendly analysis response
    const petAnalysis = {
      breed: primarySubject.identifiedBreed.name,
      breedConfidence: primarySubject.identifiedBreed.confidence,
      coat: primarySubject.identifiedCoat.pattern,
      coatConfidence: primarySubject.identifiedCoat.confidence,
      personalityTraits,
      physicalCharacteristics: {
        pose: primarySubject.pose,
        gaze: primarySubject.gaze,
        expression: primarySubject.expression,
        position: primarySubject.position
      },
      species: primarySubject.species,
      // Store full analysis for future use
      fullAnalysis: {
        compositionMetadata: analysis.compositionMetadata,
        variationPromptTemplate: analysis.variationPromptTemplate,
        marketingDescription: analysis.marketingDescription
      }
    };

    const duration = Date.now() - startTime;
    console.log(`✅ [PET ANALYSIS] Analysis complete in ${duration}ms`, {
      breed: petAnalysis.breed,
      confidence: petAnalysis.breedConfidence,
      traits: petAnalysis.personalityTraits
    });

    return NextResponse.json({
      success: true,
      analysis: petAnalysis,
      processingTime: duration
    });

  } catch (error) {
    console.error('❌ [PET ANALYSIS] Analysis failed:', error);

    return NextResponse.json(
      {
        error: 'Failed to analyze image',
        details: error instanceof Error ? error.message : 'Unknown error',
        fallback: true
      },
      { status: 500 }
    );
  }
}

/**
 * Extract personality traits from Claude's marketing description
 * Uses keyword matching to identify common personality adjectives
 */
function extractPersonalityTraits(description: string): string[] {
  const traits: string[] = [];
  const lowerDesc = description.toLowerCase();

  // Common personality traits to detect
  const traitKeywords: Record<string, string[]> = {
    'Playful': ['playful', 'fun', 'energetic', 'bouncy', 'lively'],
    'Friendly': ['friendly', 'social', 'outgoing', 'welcoming'],
    'Energetic': ['energetic', 'active', 'dynamic', 'vigorous'],
    'Calm': ['calm', 'relaxed', 'peaceful', 'serene', 'tranquil'],
    'Curious': ['curious', 'inquisitive', 'interested', 'alert'],
    'Loyal': ['loyal', 'devoted', 'faithful', 'dedicated'],
    'Intelligent': ['intelligent', 'smart', 'clever', 'bright'],
    'Gentle': ['gentle', 'soft', 'tender', 'mild'],
    'Confident': ['confident', 'assured', 'bold', 'self-assured'],
    'Affectionate': ['affectionate', 'loving', 'warm', 'cuddly']
  };

  // Check for each trait
  for (const [trait, keywords] of Object.entries(traitKeywords)) {
    if (keywords.some(keyword => lowerDesc.includes(keyword))) {
      traits.push(trait);
    }
  }

  // Return up to 3-4 traits to avoid overwhelming the user
  return traits.slice(0, 4);
}
