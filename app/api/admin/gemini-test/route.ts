import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GeminiVariationService } from '@/lib/gemini-variation-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Gemini Test API - Starting test execution');
    
    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const { originalImageData, originalPrompt, testType = 'border_collie_coats' } = body;
    
    console.log('📥 Test request received:', { 
      testType, 
      hasImageData: !!originalImageData,
      promptLength: originalPrompt?.length || 0 
    });

    if (!originalImageData || !originalPrompt) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Check image size
    const imageSizeBytes = (originalImageData.length * 3) / 4;
    console.log(`🖼️  Processing image size: ${Math.round(imageSizeBytes / 1024)}KB`);
    
    if (imageSizeBytes > 2 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'Image too large. Please use an image under 2MB.' 
      }, { status: 413 });
    }

    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not found in environment');
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    console.log('✅ GEMINI_API_KEY found in environment');

    const geminiService = new GeminiVariationService();
    const results = [];

    // Get Border Collie breed data
    console.log('🔍 Looking up Border Collie breed data...');
    const { data: borderCollieData } = await supabase
      .from('breeds')
      .select('*')
      .ilike('name', '%border%collie%')
      .eq('is_active', true)
      .single();

    if (!borderCollieData) {
      console.error('❌ Border Collie breed not found in database');
      return NextResponse.json({ error: 'Border Collie breed not found' }, { status: 404 });
    }

    console.log('✅ Found Border Collie:', borderCollieData);

    // Get Border Collie coat variations
    console.log('🎨 Loading Border Collie coat variations...');
    const { data: coatData } = await supabase
      .from('breed_coats')
      .select(`
        id,
        breeds!inner(id, name, slug, animal_type),
        coats!inner(id, name, slug, hex_color, pattern_type, rarity)
      `)
      .eq('breeds.id', borderCollieData.id);

    if (!coatData || coatData.length === 0) {
      console.error('❌ No coat variations found for Border Collie');
      return NextResponse.json({ error: 'No coat variations found for Border Collie' }, { status: 404 });
    }

    console.log(`✅ Found ${coatData.length} coat variations:`, coatData.map(c => c.coats.name));

    // Get themes and styles for context
    const [themesResult, stylesResult, formatsResult] = await Promise.all([
      supabase.from('themes').select('*').eq('is_active', true),
      supabase.from('styles').select('*').eq('is_active', true),
      supabase.from('formats').select('*').eq('is_active', true)
    ]);

    const defaultTheme = themesResult.data?.find(t => t.slug === 'portrait') || themesResult.data?.[0];
    const defaultStyle = stylesResult.data?.find(s => s.slug === 'realistic') || stylesResult.data?.[0];
    const defaultFormat = formatsResult.data?.find(f => f.slug === 'square') || formatsResult.data?.[0];

    console.log('🎨 Using context:', {
      theme: defaultTheme?.name,
      style: defaultStyle?.name,
      format: defaultFormat?.name
    });

    // Generate variations for each coat
    console.log('🚀 Starting variation generation...');
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < Math.min(3, coatData.length); i++) { // Test first 3 coats
      const breedCoat = coatData[i];
      const coatInfo = {
        id: breedCoat.coats.id,
        breed_coat_id: breedCoat.id,
        coat_name: breedCoat.coats.name,
        coat_slug: breedCoat.coats.slug,
        hex_color: breedCoat.coats.hex_color,
        pattern_type: breedCoat.coats.pattern_type,
        rarity: breedCoat.coats.rarity
      };

      try {
        console.log(`🎯 Generating variation ${i + 1}: ${borderCollieData.name} with ${coatInfo.coat_name}`);
        
        const variation = await geminiService.generateSingleBreedVariationWithCoat(
          originalImageData,
          originalPrompt,
          borderCollieData,
          coatInfo,
          defaultTheme,
          defaultStyle,
          defaultFormat
        );

        if (variation) {
          console.log(`✅ Successfully generated ${borderCollieData.name} with ${coatInfo.coat_name}`);
          results.push({
            ...variation,
            testInfo: {
              coatIndex: i + 1,
              totalCoats: Math.min(3, coatData.length),
              timestamp: new Date().toISOString()
            }
          });
          successCount++;
        } else {
          console.log(`❌ Failed to generate ${borderCollieData.name} with ${coatInfo.coat_name} - null result`);
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ Error generating ${borderCollieData.name} with ${coatInfo.coat_name}:`, error);
        errorCount++;
        
        // Add error details to results for debugging
        results.push({
          error: true,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error,
          breed: borderCollieData.name,
          coat: coatInfo.coat_name,
          testInfo: {
            coatIndex: i + 1,
            totalCoats: Math.min(3, coatData.length),
            timestamp: new Date().toISOString()
          }
        });
      }

      // Add delay between generations to prevent rate limiting
      if (i < Math.min(3, coatData.length) - 1) {
        console.log('⏱️  Waiting 2 seconds before next generation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`🏁 Test completed: ${successCount} successful, ${errorCount} failed`);

    return NextResponse.json({
      success: true,
      summary: {
        totalAttempts: Math.min(3, coatData.length),
        successCount,
        errorCount,
        breed: borderCollieData.name,
        availableCoats: coatData.map(c => c.coats.name)
      },
      results,
      metadata: {
        testType,
        timestamp: new Date().toISOString(),
        imageSizeKB: Math.round(imageSizeBytes / 1024),
        geminiModel: 'gemini-2.5-flash-image-preview'
      }
    });
    
  } catch (error) {
    console.error('🚨 Gemini Test API error:', error);
    return NextResponse.json(
      { 
        error: 'Test execution failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}