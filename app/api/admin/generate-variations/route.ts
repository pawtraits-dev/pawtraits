import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GeminiVariationService } from '@/lib/gemini-variation-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const { originalImageData, originalPrompt, currentBreed, currentTheme, currentStyle, variationConfig } = body;

    if (!originalImageData || !originalPrompt) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Validate image data size (should be compressed on client)
    const imageSizeBytes = (originalImageData.length * 3) / 4; // Approximate base64 to bytes
    console.log(`Processing image of size: ${Math.round(imageSizeBytes / 1024)}KB`);
    
    if (imageSizeBytes > 2 * 1024 * 1024) { // 2MB limit
      return NextResponse.json({ 
        error: 'Image too large. Please compress image to under 2MB.' 
      }, { status: 413 });
    }

    const geminiService = new GeminiVariationService();
    const results = [];

    // Load data for variations directly from database
    const [breedsResult, coatsResult, outfitsResult, formatsResult, themesResult, stylesResult] = await Promise.all([
      supabase.from('breeds').select('*').eq('is_active', true),
      supabase.from('breed_coats').select(`
        id,
        breeds!inner(id, name, slug, animal_type),
        coats!inner(id, name, slug, hex_color, pattern_type, rarity)
      `).eq('breeds.id', currentBreed),
      supabase.from('outfits').select('*').eq('is_active', true),
      supabase.from('formats').select('*').eq('is_active', true),
      supabase.from('themes').select('*').eq('is_active', true),
      supabase.from('styles').select('*').eq('is_active', true)
    ]);

    const breedsData = breedsResult.data || [];
    const coatsData = (coatsResult.data || []).map((item: any) => ({
      id: item.coats.id,
      breed_coat_id: item.id,
      breed_name: item.breeds.name,
      coat_name: item.coats.name,
      coat_slug: item.coats.slug,
      hex_color: item.coats.hex_color,
      pattern_type: item.coats.pattern_type,
      rarity: item.coats.rarity,
      breed_slug: item.breeds.slug,
      coat_description: item.coats.description || '',
      is_common: item.coats.rarity === 'common',
      popularity_rank: 1,
      is_standard: true,
      notes: ''
    }));
    const outfitsData = outfitsResult.data || [];
    const formatsData = formatsResult.data || [];
    const themesData = themesResult.data || [];
    const stylesData = stylesResult.data || [];

    // Get current theme and style data for context
    const currentThemeData = themesData.find((t: any) => t.id === currentTheme);
    const currentStyleData = stylesData.find((s: any) => s.id === currentStyle);

    // Generate breed variations
    if (variationConfig.breeds?.length > 0) {
      const targetBreeds = breedsData.filter((breed: any) => 
        variationConfig.breeds.includes(breed.id)
      );
      
      const breedVariations = await geminiService.generateBreedVariations(
        originalImageData,
        originalPrompt,
        targetBreeds,
        currentThemeData,
        currentStyleData
      );
      
      results.push(...breedVariations);
    }

    // Generate coat variations
    if (variationConfig.coats?.length > 0) {
      const currentBreedData = breedsData.find((breed: any) => breed.id === currentBreed);
      const targetCoats = coatsData.filter((coat: any) => 
        variationConfig.coats.includes(coat.id)
      );
      
      if (currentBreedData && targetCoats.length > 0) {
        const coatVariations = await geminiService.generateCoatVariations(
          originalImageData,
          originalPrompt,
          currentBreedData,
          targetCoats,
          currentThemeData,
          currentStyleData
        );
        
        results.push(...coatVariations);
      }
    }

    // Generate outfit variations
    if (variationConfig.outfits?.length > 0) {
      const targetOutfits = outfitsData.filter((outfit: any) => 
        variationConfig.outfits.includes(outfit.id)
      );
      
      const outfitVariations = await geminiService.generateOutfitVariations(
        originalImageData,
        originalPrompt,
        targetOutfits,
        currentThemeData,
        currentStyleData
      );
      
      results.push(...outfitVariations);
    }

    // Generate format variations
    if (variationConfig.formats?.length > 0) {
      const targetFormats = formatsData.filter((format: any) => 
        variationConfig.formats.includes(format.id)
      );
      
      const formatVariations = await geminiService.generateFormatVariations(
        originalImageData,
        originalPrompt,
        targetFormats,
        currentThemeData,
        currentStyleData
      );
      
      results.push(...formatVariations);
    }

    // Process variations for preview - just return the generated images with metadata
    const processedVariations = geminiService.processVariationsForUpload(results);
    
    // Convert image buffers to base64 for frontend preview
    const previewResults = processedVariations.map((variation) => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      imageData: variation.imageBuffer.toString('base64'),
      filename: variation.filename,
      prompt: variation.metadata.prompt,
      metadata: variation.metadata,
      variation_type: variation.metadata.variation_type,
      breed_name: results.find(r => r.metadata.breed?.id === variation.metadata.breed_id)?.metadata.breed?.name,
      coat_name: results.find(r => r.metadata.coat?.id === variation.metadata.coat_id)?.metadata.coat?.coat_name,
      outfit_name: results.find(r => r.metadata.outfit?.id === variation.metadata.outfit_id)?.metadata.outfit?.name,
      format_name: results.find(r => r.metadata.format?.id === variation.metadata.format_id)?.metadata.format?.name,
      theme_id: currentTheme,
      style_id: currentStyle
    }));

    console.log(`Generated ${previewResults.length} variations for preview`);
    return NextResponse.json(previewResults);
    
  } catch (error) {
    console.error('Variation generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Variation generation failed' },
      { status: 500 }
    );
  }
}