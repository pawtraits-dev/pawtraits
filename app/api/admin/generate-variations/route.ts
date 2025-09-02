import { NextRequest, NextResponse } from 'next/server';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { SupabaseService } from '@/lib/supabase';
import { uploadImagesDirectBatch } from '@/lib/cloudinary-client';

export async function POST(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();
    
    // Check admin authentication
    const admin = await supabaseService.getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { originalImageData, originalPrompt, currentBreed, variationConfig } = body;

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

    // Load data for variations
    const [breedsData, coatsData, outfitsData, formatsData] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/breeds`).then(r => r.json()).catch(() => []),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/breed-coats?breed_id=${currentBreed}`).then(r => r.json()).catch(() => []),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/outfits`).then(r => r.json()).catch(() => []),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/formats`).then(r => r.json()).catch(() => [])
    ]);

    // Generate breed variations
    if (variationConfig.breeds?.length > 0) {
      const targetBreeds = breedsData.filter((breed: any) => 
        variationConfig.breeds.includes(breed.id)
      );
      
      const breedVariations = await geminiService.generateBreedVariations(
        originalImageData,
        originalPrompt,
        targetBreeds
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
          targetCoats
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
        targetOutfits
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
        targetFormats
      );
      
      results.push(...formatVariations);
    }

    // Process variations for upload
    const processedVariations = geminiService.processVariationsForUpload(results);
    
    // Upload to Cloudinary and save to database
    const uploadResults = [];
    
    for (const variation of processedVariations) {
      try {
        // Upload buffer directly to Cloudinary
        const cloudinary = require('cloudinary').v2;
        
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'image',
              public_id: variation.filename.replace('.png', ''),
              tags: ['variation', 'gemini-generated', ...variation.metadata.tags],
              context: `variation_type=${variation.metadata.variation_type}`
            },
            (error: any, result: any) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(variation.imageBuffer);
        }) as any;
        
        if (uploadResult) {
          
          // Save to database
          const dbResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/images/cloudinary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cloudinary_public_id: uploadResult.public_id,
              cloudinary_secure_url: uploadResult.secure_url,
              cloudinary_signature: uploadResult.signature,
              original_filename: variation.filename,
              file_size: uploadResult.bytes,
              mime_type: 'image/png',
              width: uploadResult.width,
              height: uploadResult.height,
              prompt_text: variation.metadata.prompt,
              description: `Generated variation: ${variation.metadata.variation_type}`,
              tags: variation.metadata.tags,
              breed_id: variation.metadata.breed_id,
              coat_id: variation.metadata.coat_id,
              outfit_id: variation.metadata.outfit_id,
              format_id: variation.metadata.format_id,
              is_public: true,
              is_featured: false,
              rating: 4 // Auto-rate variations as 4 stars
            })
          });
          
          if (dbResponse.ok) {
            const dbResult = await dbResponse.json();
            uploadResults.push({
              success: true,
              variation_type: variation.metadata.variation_type,
              breed_name: results.find(r => r.metadata.breed?.id === variation.metadata.breed_id)?.metadata.breed?.name,
              coat_name: results.find(r => r.metadata.coat?.id === variation.metadata.coat_id)?.metadata.coat?.coat_name,
              outfit_name: results.find(r => r.metadata.outfit?.id === variation.metadata.outfit_id)?.metadata.outfit?.name,
              format_name: results.find(r => r.metadata.format?.id === variation.metadata.format_id)?.metadata.format?.name,
              cloudinary_url: uploadResult.secure_url,
              database_id: dbResult.id
            });
          } else {
            uploadResults.push({
              success: false,
              error: 'Database save failed',
              variation_type: variation.metadata.variation_type
            });
          }
        }
      } catch (error) {
        console.error('Error processing variation:', error);
        uploadResults.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          variation_type: variation.metadata.variation_type
        });
      }
    }

    return NextResponse.json(uploadResults);
    
  } catch (error) {
    console.error('Variation generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Variation generation failed' },
      { status: 500 }
    );
  }
}