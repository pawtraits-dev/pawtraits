import { NextRequest, NextResponse } from 'next/server';
import { ClaudeCompositionAnalyzer } from '@/lib/claude-composition-analyzer';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/analyze-composition
 *
 * Analyzes an uploaded image using Claude AI (following established pattern from /api/generate-description/file)
 */
export async function POST(req: NextRequest) {
  try {
    console.log('🎨 [Analyze API] Received composition analysis request');

    // Parse FormData (following established pattern)
    const formData = await req.formData();
    const file = formData.get('image') as File;
    const themeId = formData.get('themeId') as string | null;
    const styleId = formData.get('styleId') as string | null;

    console.log('📦 [Analyze API] Request data:', {
      hasFile: !!file,
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      themeId,
      styleId
    });

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Please upload an image.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
    }

    // Fetch context data (theme, style, breeds, coats)
    console.log('📚 [Analyze API] Loading context data...');
    const [themesData, stylesData, breedsData, coatsData] = await Promise.all([
      themeId ? supabase.from('themes').select('*').eq('id', themeId).single() : Promise.resolve({ data: null }),
      styleId ? supabase.from('styles').select('*').eq('id', styleId).single() : Promise.resolve({ data: null }),
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

    // Initialize analyzer and process image
    console.log('🤖 [Analyze API] Starting Claude analysis...');
    const analyzer = new ClaudeCompositionAnalyzer();

    const analysis = await analyzer.analyzeImageFromFile(file, {
      theme: theme?.display_name || theme?.name,
      style: style?.display_name || style?.name,
      knownBreeds: breeds.map(b => b.display_name || b.name)
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
          confidence: subject.identifiedBreed.confidence / 10
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
    console.log('📤 [Analyze API] Returning response');
    return NextResponse.json({
      marketingDescription: analysis.marketingDescription,
      compositionAnalysis: analysis.compositionAnalysis,
      subjects: enrichedSubjects,
      compositionMetadata: analysis.compositionMetadata,
      variationPromptTemplate: analysis.variationPromptTemplate,
      confidence: analysis.confidence
    });

  } catch (error) {
    console.error('❌ [Analyze API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to analyze image: ${errorMessage}` },
      { status: 500 }
    );
  }
}
