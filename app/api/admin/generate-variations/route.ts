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
    const { originalImageData, originalPrompt, currentBreed, currentCoat, currentTheme, currentStyle, currentFormat, targetAge, variationConfig } = body;
    
    console.log('🚀 VARIATION GENERATION START');
    console.log('📊 Received variationConfig:', JSON.stringify(variationConfig, null, 2));
    console.log('🎯 Target age:', targetAge);
    console.log('📏 Image size:', Math.round((originalImageData.length * 3) / 4 / 1024), 'KB');

    if (!originalImageData || !originalPrompt) {
      console.error('❌ Missing required data');
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

    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
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

    // Get current theme, style, and format data for context
    const currentThemeData = themesData.find((t: any) => t.id === currentTheme);
    const currentStyleData = stylesData.find((s: any) => s.id === currentStyle);
    const originalFormatData = formatsData.find((f: any) => f.id === currentFormat);

    // Generate breed-coat combinations with batching for performance
    if (variationConfig.breedCoats?.length > 0) {
      console.log('🐕🐱 BREED-COAT GENERATION START');
      console.log('🔍 Processing variationConfig.breedCoats:', variationConfig.breedCoats);
      console.log('📊 Available breeds from database:', breedsData?.map(b => ({ id: b.id, name: b.name, type: b.animal_type })) || []);
      
      const batchSize = 3; // Reduced batch size for better success rate
      const breedCoatBatches = [];
      
      for (let i = 0; i < variationConfig.breedCoats.length; i += batchSize) {
        breedCoatBatches.push(variationConfig.breedCoats.slice(i, i + batchSize));
      }
      
      console.log(`🎯 Processing ${variationConfig.breedCoats.length} breed-coat combinations in ${breedCoatBatches.length} batches (size: ${batchSize})`);
      
      let totalAttempted = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;
      const startTime = Date.now();
      
      for (let batchIndex = 0; batchIndex < breedCoatBatches.length; batchIndex++) {
        const batch = breedCoatBatches[batchIndex];
        console.log(`\n📦 BATCH ${batchIndex + 1}/${breedCoatBatches.length} START (${batch.length} items)`);
        const batchStartTime = Date.now();
        
        const batchPromises = batch.map(async (breedCoat: any, itemIndex: number) => {
          const itemStartTime = Date.now();
          totalAttempted++;
          try {
            console.log(`🎯 Processing breed-coat pair ${itemIndex + 1}/${batch.length}:`, breedCoat);
            
            // Get breed data
            const targetBreed = breedsData.find((breed: any) => breed.id === breedCoat.breedId);
            if (!targetBreed) {
              console.error(`❌ Breed not found: ${breedCoat.breedId}`);
              console.error('Available breed IDs:', breedsData?.map(b => b.id) || []);
              return null;
            }
            
            console.log(`✅ Found target breed:`, { id: targetBreed.id, name: targetBreed.name });
            
            // Get coat data with breed relationship validation
            console.log(`🎨 Looking up breed-coat relationship: breed=${breedCoat.breedId}, coat=${breedCoat.coatId}`);
            
            const { data: breedCoatData, error: breedCoatError } = await supabase
              .from('breed_coats')
              .select(`
                id,
                breeds!inner(id, name, slug, animal_type),
                coats!inner(id, name, slug, hex_color, pattern_type, rarity)
              `)
              .eq('breeds.id', breedCoat.breedId)
              .eq('coats.id', breedCoat.coatId)
              .single();
              
            if (breedCoatError) {
              console.error(`❌ Database error querying breed-coat:`, breedCoatError);
              return null;
            }
              
            if (!breedCoatData) {
              console.error(`❌ Invalid breed-coat combination: ${breedCoat.breedId}-${breedCoat.coatId}`);
              
              // Debug: Check what breed-coat combinations exist
              const { data: debugBreedCoats } = await supabase
                .from('breed_coats')
                .select('breeds(id, name), coats(id, name)')
                .eq('breeds.id', breedCoat.breedId);
              
              console.error(`Available coats for breed ${breedCoat.breedId}:`, debugBreedCoats);
              return null;
            }
            
            console.log(`✅ Found breed-coat relationship:`, {
              breedName: breedCoatData.breeds.name,
              coatName: breedCoatData.coats.name,
              coatColor: breedCoatData.coats.hex_color
            });
            
            const validCoat = {
              id: breedCoatData.coats.id,
              breed_coat_id: breedCoatData.id,
              coat_name: breedCoatData.coats.name,
              coat_slug: breedCoatData.coats.slug,
              hex_color: breedCoatData.coats.hex_color,
              pattern_type: breedCoatData.coats.pattern_type,
              rarity: breedCoatData.coats.rarity
            };
            
            // Get original breed for cross-species detection
            const originalBreedData = breedsData.find((breed: any) => breed.id === currentBreed);
            
            const breedVariation = await geminiService.generateSingleBreedVariationWithCoat(
              originalImageData,
              originalPrompt,
              targetBreed,
              validCoat,
              currentThemeData,
              currentStyleData,
              originalFormatData,
              originalBreedData,
              targetAge
            );
            
            const itemEndTime = Date.now();
            const itemDuration = itemEndTime - itemStartTime;
            
            if (breedVariation) {
              totalSuccessful++;
              console.log(`✅ SUCCESS: Generated variation for ${targetBreed.name} with ${validCoat.coat_name} (${itemDuration}ms)`);
            } else {
              totalFailed++;
              console.log(`❌ FAILED: No variation generated for ${targetBreed.name} with ${validCoat.coat_name} (${itemDuration}ms)`);
            }
            return breedVariation;
          } catch (error) {
            const itemEndTime = Date.now();
            const itemDuration = itemEndTime - itemStartTime;
            totalFailed++;
            console.error(`🔥 EXCEPTION: Error generating ${breedCoat.breedId}-${breedCoat.coatId} (${itemDuration}ms):`, error);
            return null;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(result => result !== null);
        const batchEndTime = Date.now();
        const batchDuration = batchEndTime - batchStartTime;
        
        console.log(`📦 BATCH ${batchIndex + 1} COMPLETE: ${validResults.length}/${batchResults.length} successful (${batchDuration}ms)`);
        console.log(`📊 Current totals: ${totalSuccessful} success, ${totalFailed} failed, ${totalAttempted} attempted`);
        
        results.push(...validResults);
        
        // Add delay between batches to prevent API rate limiting
        if (batchIndex < breedCoatBatches.length - 1) {
          console.log('⏳ Waiting 2 seconds before next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased to 2 second delay
        }
      }
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      console.log(`\n🏁 BREED-COAT GENERATION COMPLETE:`);
      console.log(`📊 Final stats: ${totalSuccessful}/${totalAttempted} successful (${Math.round(totalSuccessful/totalAttempted*100)}% success rate)`);
      console.log(`⏱️  Total duration: ${totalDuration}ms (avg: ${Math.round(totalDuration/totalAttempted)}ms per item)`);
      console.log(`📈 Current results count: ${results.length}`);
    }
    
    // Legacy breed variations (maintained for backward compatibility)
    if (variationConfig.breeds?.length > 0) {
      const targetBreeds = breedsData.filter((breed: any) => 
        variationConfig.breeds.includes(breed.id)
      );
      
      for (const targetBreed of targetBreeds) {
        try {
          const { data: breedCoatsData } = await supabase
            .from('breed_coats')
            .select(`
              id,
              breeds!inner(id, name, slug, animal_type),
              coats!inner(id, name, slug, hex_color, pattern_type, rarity)
            `)
            .eq('breeds.id', targetBreed.id);

          if (breedCoatsData && breedCoatsData.length > 0) {
            const validCoats = breedCoatsData.map((item: any) => ({
              id: item.coats.id,
              breed_coat_id: item.id,
              coat_name: item.coats.name,
              coat_slug: item.coats.slug,
              hex_color: item.coats.hex_color,
              pattern_type: item.coats.pattern_type,
              rarity: item.coats.rarity
            }));

            const commonCoats = validCoats.filter((c: any) => c.rarity === 'common');
            const otherCoats = validCoats.filter((c: any) => c.rarity !== 'common');
            const selectedCoats = [...commonCoats, ...otherCoats].slice(0, 4);

            for (const selectedCoat of selectedCoats) {
              try {
                // Get original breed for cross-species detection
                const originalBreedData = breedsData.find((breed: any) => breed.id === currentBreed);
                
                const breedVariation = await geminiService.generateSingleBreedVariationWithCoat(
                  originalImageData,
                  originalPrompt,
                  targetBreed,
                  selectedCoat,
                  currentThemeData,
                  currentStyleData,
                  originalFormatData,
                  originalBreedData,
                  targetAge
                );
                
                if (breedVariation) {
                  results.push(breedVariation);
                }
              } catch (error) {
                console.error(`Error generating ${targetBreed.name} with ${selectedCoat.coat_name}:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`Error loading coats for breed ${targetBreed.name}:`, error);
        }
      }
    }

    // Legacy coat variations (maintained for backward compatibility)
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
          currentStyleData,
          originalFormatData
        );
        
        results.push(...coatVariations);
      }
    }

    // Generate outfit variations
    if (variationConfig.outfits?.length > 0) {
      const targetOutfits = outfitsData.filter((outfit: any) => 
        variationConfig.outfits.includes(outfit.id)
      );
      
      // Get original breed and coat data for inheritance
      const originalBreedData = breedsData.find((breed: any) => breed.id === currentBreed);
      const originalCoatData = coatsData.find((coat: any) => coat.id === currentCoat);
      
      const outfitVariations = await geminiService.generateOutfitVariations(
        originalImageData,
        originalPrompt,
        targetOutfits,
        currentThemeData,
        currentStyleData,
        originalFormatData,
        originalBreedData,
        originalCoatData
      );
      
      results.push(...outfitVariations);
    }

    // Generate format variations
    if (variationConfig.formats?.length > 0) {
      const targetFormats = formatsData.filter((format: any) => 
        variationConfig.formats.includes(format.id)
      );
      
      // Get original breed and coat data for inheritance
      const originalBreedData = breedsData.find((breed: any) => breed.id === currentBreed);
      const originalCoatData = coatsData.find((coat: any) => coat.id === currentCoat);
      
      const formatVariations = await geminiService.generateFormatVariations(
        originalImageData,
        originalPrompt,
        targetFormats,
        currentThemeData,
        currentStyleData,
        originalBreedData,
        originalCoatData
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
      gemini_prompt: variation.metadata.gemini_prompt, // Include Gemini prompt for display
      metadata: variation.metadata,
      variation_type: variation.metadata.variation_type,
      breed_name: results.find(r => r.metadata.breed?.id === variation.metadata.breed_id)?.metadata.breed?.name,
      coat_name: results.find(r => r.metadata.coat?.id === variation.metadata.coat_id)?.metadata.coat?.coat_name,
      outfit_name: results.find(r => r.metadata.outfit?.id === variation.metadata.outfit_id)?.metadata.outfit?.name,
      format_name: results.find(r => r.metadata.format?.id === variation.metadata.format_id)?.metadata.format?.name,
      theme_id: currentTheme,
      style_id: currentStyle
    }));

    console.log(`\n🎉 VARIATION GENERATION COMPLETE`);
    console.log(`📊 FINAL RESULTS: ${previewResults.length} variations generated for preview`);
    console.log(`🗂️  Result types:`, previewResults.map(r => `${r.breed_name}-${r.coat_name}`).join(', '));
    
    return NextResponse.json(previewResults);
    
  } catch (error) {
    console.error('Variation generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Variation generation failed' },
      { status: 500 }
    );
  }
}