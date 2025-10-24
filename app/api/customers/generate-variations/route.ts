import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { GeminiVariationService } from '@/lib/gemini-variation-service';
import { uploadImageBufferToCloudinary } from '@/lib/cloudinary-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Rate limiting: max 3 concurrent, 20 per hour per customer
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(customerId: string): { allowed: boolean; remainingRequests?: number } {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;

  const userLimit = rateLimitMap.get(customerId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize limit
    rateLimitMap.set(customerId, {
      count: 1,
      resetTime: now + hourInMs
    });
    return { allowed: true, remainingRequests: 19 };
  }

  if (userLimit.count >= 20) {
    const remainingTime = Math.ceil((userLimit.resetTime - now) / 1000 / 60);
    return {
      allowed: false,
      remainingRequests: 0
    };
  }

  userLimit.count++;
  return { allowed: true, remainingRequests: 20 - userLimit.count };
}

export async function POST(request: NextRequest) {
  try {
    // Authentication using route handler client
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get customer profile
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, user_type, email')
      .eq('email', user.email)
      .single();

    if (!userProfile || userProfile.user_type !== 'customer') {
      return NextResponse.json({ error: 'Customer account required' }, { status: 403 });
    }

    const customerId = userProfile.id;

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(customerId);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded. Please try again later.',
        remainingRequests: 0
      }, { status: 429 });
    }

    const body = await request.json();
    const {
      originalImageData,
      originalImageId,
      originalPrompt,
      currentBreed,
      currentCoat,
      currentTheme,
      currentStyle,
      currentFormat,
      targetAge,
      variationConfig,
      isMultiAnimal,
      multiAnimalConfig,
      aiDescription
    } = body;

    console.log('🚀 CUSTOMER VARIATION GENERATION START');
    console.log('👤 Customer ID:', customerId);
    console.log('📊 Variation config:', JSON.stringify(variationConfig, null, 2));
    console.log('🐾 Multi-animal:', isMultiAnimal);

    if (!originalImageData || !originalPrompt) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 });
    }

    // Validate image size
    const imageSizeBytes = (originalImageData.length * 3) / 4;
    if (imageSizeBytes > 2 * 1024 * 1024) {
      return NextResponse.json({
        error: 'Image too large. Please compress image to under 2MB.'
      }, { status: 413 });
    }

    // Fetch feature credit costs from configuration
    const { data: featureCosts } = await supabaseAdmin
      .rpc('get_feature_credit_costs');

    const costs = featureCosts && featureCosts.length > 0 ? featureCosts[0] : {
      base_variation_cost: 1,
      multi_animal_cost: 2,
      format_variation_cost: 1,
      outfit_variation_cost: 1
    };

    console.log('💳 Using feature costs:', costs);

    // Calculate required credits based on configuration
    let requiredCredits = 0;

    if (isMultiAnimal) {
      // Multi-animal generation
      requiredCredits = costs.multi_animal_cost || 2;
      console.log(`🐾 Multi-animal generation: ${requiredCredits} credits`);
    } else {
      // Single animal: count each type of variation
      const breedCoatsCount = variationConfig.breedCoats?.length || 0;
      const outfitsCount = variationConfig.outfits?.length || 0;
      const formatsCount = variationConfig.formats?.length || 0;

      if (breedCoatsCount > 0) {
        requiredCredits += breedCoatsCount * (costs.base_variation_cost || 1);
      }
      if (outfitsCount > 0) {
        requiredCredits += outfitsCount * (costs.outfit_variation_cost || 1);
      }
      if (formatsCount > 0) {
        requiredCredits += formatsCount * (costs.format_variation_cost || 1);
      }

      // Ensure at least 1 credit if any variation selected
      requiredCredits = Math.max(1, requiredCredits);

      console.log(`💳 Single animal variations:`, {
        breedCoats: breedCoatsCount,
        outfits: outfitsCount,
        formats: formatsCount,
        totalCredits: requiredCredits
      });
    }

    console.log(`💳 Total required credits: ${requiredCredits}`);

    // Check and deduct credits
    const { data: creditCheckResult, error: creditCheckError } = await supabaseAdmin
      .rpc('deduct_customization_credit', {
        p_customer_id: customerId,
        p_credits_to_deduct: requiredCredits
      });

    if (creditCheckError || !creditCheckResult) {
      console.error('❌ Credit deduction failed:', creditCheckError);

      // Get current balance to inform user
      const { data: balance } = await supabaseAdmin
        .from('customer_customization_credits')
        .select('credits_remaining')
        .eq('customer_id', customerId)
        .single();

      return NextResponse.json({
        error: 'Insufficient credits',
        creditsRequired: requiredCredits,
        creditsAvailable: balance?.credits_remaining || 0,
        needToPurchase: true
      }, { status: 402 }); // Payment Required
    }

    console.log('✅ Credits deducted successfully');

    // Check Gemini API availability
    if (!process.env.GEMINI_API_KEY) {
      // Refund credits if API not available
      await supabaseAdmin.rpc('add_customization_credits', {
        p_customer_id: customerId,
        p_credits_to_add: requiredCredits,
        p_purchase_amount: 0
      });
      return NextResponse.json({ error: 'Image generation service unavailable' }, { status: 500 });
    }

    const geminiService = new GeminiVariationService();
    const results = [];

    // Load reference data from database
    const [breedsResult, coatsResult, outfitsResult, formatsResult, themesResult, stylesResult] = await Promise.all([
      supabaseAdmin.from('breeds').select('*').eq('is_active', true),
      supabaseAdmin.from('breed_coats').select(`
        id,
        breeds!inner(id, name, slug, animal_type, physical_traits),
        coats!inner(id, name, slug, hex_color, pattern_type, rarity)
      `).eq('breeds.id', currentBreed),
      supabaseAdmin.from('outfits').select('*').eq('is_active', true),
      supabaseAdmin.from('formats').select('*').eq('is_active', true),
      supabaseAdmin.from('themes').select('*').eq('is_active', true),
      supabaseAdmin.from('styles').select('*').eq('is_active', true)
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
      rarity: item.coats.rarity
    }));
    const outfitsData = outfitsResult.data || [];
    const formatsData = formatsResult.data || [];
    const themesData = themesResult.data || [];
    const stylesData = stylesResult.data || [];

    const currentThemeData = themesData.find((t: any) => t.id === currentTheme);
    const currentStyleData = stylesData.find((s: any) => s.id === currentStyle);
    const originalFormatData = formatsData.find((f: any) => f.id === currentFormat);
    const originalBreedData = breedsData.find((b: any) => b.id === currentBreed);

    let generationSuccessful = false;
    let generationErrors = [];

    try {
      // Check if we have BOTH breed/coat AND outfit - generate combined variation
      const hasBreedCoatChange = variationConfig.breedCoats?.length > 0;
      const hasOutfitChange = variationConfig.outfits?.length > 0;

      if (hasBreedCoatChange && hasOutfitChange) {
        console.log(`🎨 Generating combined breed-coat + outfit variation`);

        const breedCoat = variationConfig.breedCoats[0]; // Take first breed/coat
        const targetOutfits = outfitsData.filter((outfit: any) =>
          variationConfig.outfits.includes(outfit.id)
        );
        const targetOutfit = targetOutfits[0]; // Take first outfit

        const targetBreed = breedsData.find((breed: any) => breed.id === breedCoat.breedId);
        if (!targetBreed) {
          throw new Error(`Breed not found: ${breedCoat.breedId}`);
        }

        const { data: breedCoatData, error: breedCoatError } = await supabaseAdmin
          .from('breed_coats')
          .select(`
            id,
            breeds!inner(id, name, slug, animal_type, physical_traits),
            coats!inner(id, name, slug, hex_color, pattern_type, rarity)
          `)
          .eq('breeds.id', breedCoat.breedId)
          .eq('coats.id', breedCoat.coatId)
          .single();

        if (breedCoatError || !breedCoatData) {
          throw new Error(`Invalid breed-coat combination: ${breedCoat.breedId}-${breedCoat.coatId}`);
        }

        const validCoat = {
          id: breedCoatData.coats.id,
          breed_coat_id: breedCoatData.id,
          coat_name: breedCoatData.coats.name,
          coat_slug: breedCoatData.coats.slug,
          hex_color: breedCoatData.coats.hex_color,
          pattern_type: breedCoatData.coats.pattern_type,
          rarity: breedCoatData.coats.rarity
        };

        console.log(`📝 Generating combined: ${targetBreed.name} (${validCoat.coat_name}) + ${targetOutfit.name}`);

        const combinedVariation = await geminiService.generateSingleBreedVariationWithCoat(
          originalImageData,
          originalPrompt,
          targetBreed,
          validCoat,
          currentThemeData,
          currentStyleData,
          originalFormatData,
          originalBreedData,
          targetAge,
          targetOutfit // Pass the outfit for combined generation
        );

        if (combinedVariation) {
          results.push(combinedVariation);
          generationSuccessful = true;
          console.log(`✅ Successfully generated combined variation`);
        } else {
          generationErrors.push(`Failed to generate combined variation`);
        }
      } else if (hasBreedCoatChange) {
        // ONLY breed-coat change (no outfit)
        console.log(`🐕 Generating ${variationConfig.breedCoats.length} breed-coat variations`);

        for (let i = 0; i < variationConfig.breedCoats.length; i++) {
          const breedCoat = variationConfig.breedCoats[i];

          try {
            const targetBreed = breedsData.find((breed: any) => breed.id === breedCoat.breedId);
            if (!targetBreed) {
              console.error(`❌ Breed not found: ${breedCoat.breedId}`);
              continue;
            }

            const { data: breedCoatData, error: breedCoatError } = await supabaseAdmin
              .from('breed_coats')
              .select(`
                id,
                breeds!inner(id, name, slug, animal_type, physical_traits),
                coats!inner(id, name, slug, hex_color, pattern_type, rarity)
              `)
              .eq('breeds.id', breedCoat.breedId)
              .eq('coats.id', breedCoat.coatId)
              .single();

            if (breedCoatError || !breedCoatData) {
              console.error(`❌ Invalid breed-coat combination: ${breedCoat.breedId}-${breedCoat.coatId}`);
              continue;
            }

            const validCoat = {
              id: breedCoatData.coats.id,
              breed_coat_id: breedCoatData.id,
              coat_name: breedCoatData.coats.name,
              coat_slug: breedCoatData.coats.slug,
              hex_color: breedCoatData.coats.hex_color,
              pattern_type: breedCoatData.coats.pattern_type,
              rarity: breedCoatData.coats.rarity
            };

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

            if (breedVariation) {
              results.push(breedVariation);
              generationSuccessful = true;
              console.log(`✅ Generated ${targetBreed.name} with ${validCoat.coat_name}`);
            } else {
              generationErrors.push(`Failed to generate ${targetBreed.name} with ${validCoat.coat_name}`);
            }

            // Rate limiting delay between generations
            if (i < variationConfig.breedCoats.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error(`🔥 Error generating breed-coat variation:`, error);
            generationErrors.push(error instanceof Error ? error.message : 'Unknown error');
          }
        }
      } else if (hasOutfitChange) {
        // ONLY outfit change (no breed/coat change)
        console.log(`👔 Generating ${variationConfig.outfits.length} outfit variations`);

        const targetOutfits = outfitsData.filter((outfit: any) =>
          variationConfig.outfits.includes(outfit.id)
        );

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

        if (outfitVariations.length > 0) {
          results.push(...outfitVariations);
          generationSuccessful = true;
          console.log(`✅ Generated ${outfitVariations.length} outfit variations`);
        }
      }

      // Generate format variations
      if (variationConfig.formats?.length > 0) {
        console.log(`📐 Generating ${variationConfig.formats.length} format variations`);

        const targetFormats = formatsData.filter((format: any) =>
          variationConfig.formats.includes(format.id)
        );

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

        if (formatVariations.length > 0) {
          results.push(...formatVariations);
          generationSuccessful = true;
          console.log(`✅ Generated ${formatVariations.length} format variations`);
        }
      }

      // If no variations generated, refund credits
      if (results.length === 0) {
        console.error('❌ No variations generated, refunding credits');
        await supabaseAdmin.rpc('add_customization_credits', {
          p_customer_id: customerId,
          p_credits_to_add: requiredCredits,
          p_purchase_amount: 0
        });

        return NextResponse.json({
          error: 'Failed to generate variations. Credits have been refunded.',
          details: generationErrors
        }, { status: 500 });
      }

    } catch (error) {
      console.error('🔥 Generation error:', error);

      // Refund credits on error
      await supabaseAdmin.rpc('add_customization_credits', {
        p_customer_id: customerId,
        p_credits_to_add: requiredCredits,
        p_purchase_amount: 0
      });

      return NextResponse.json({
        error: 'Variation generation failed. Credits have been refunded.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

    // Process variations for preview
    const processedVariations = geminiService.processVariationsForUpload(results);

    // Save generated images to customer_generated_images table
    const savedImages = [];
    for (const variation of processedVariations) {
      try {
        // Upload to Cloudinary first
        console.log(`☁️  Uploading customer variation to Cloudinary: ${variation.filename}`);
        const cloudinaryResult = await uploadImageBufferToCloudinary(
          variation.imageBuffer,
          variation.filename,
          {
            folder: 'pawtraits/customer-variations',
            tags: ['customer-variation', 'watermarked'],
            breed: variation.metadata.breed_id?.toString(),
            theme: variation.metadata.theme_id?.toString(),
            style: variation.metadata.style_id?.toString()
          }
        );

        console.log(`✅ Cloudinary upload successful: ${cloudinaryResult.public_id}`);

        // Generate AI description for the variation
        console.log(`📝 Generating AI description for variation...`);
        let aiDescription = null;
        try {
          const targetBreed = variation.metadata.breed_id
            ? breedsData.find((b: any) => b.id === variation.metadata.breed_id)
            : originalBreedData;

          if (targetBreed) {
            const descriptionResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-description/base64`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageData: variation.imageBuffer.toString('base64'),
                breedName: targetBreed.name,
                breedSlug: targetBreed.slug
              })
            });

            if (descriptionResponse.ok) {
              const descData = await descriptionResponse.json();
              aiDescription = descData.description;
              console.log(`✅ AI description generated successfully (${aiDescription.length} chars)`);
            } else {
              console.warn(`⚠️  Description generation failed: ${descriptionResponse.status}`);
            }
          }
        } catch (descError) {
          console.error('Error generating AI description:', descError);
          // Don't fail the whole operation if description generation fails
        }

        const { data: savedImage, error: saveError } = await supabaseAdmin
          .from('customer_generated_images')
          .insert({
            customer_id: customerId,
            original_image_id: originalImageId,
            cloudinary_public_id: cloudinaryResult.public_id,
            public_url: cloudinaryResult.secure_url,
            prompt_text: variation.metadata.prompt,
            gemini_prompt: variation.metadata.gemini_prompt,
            breed_id: variation.metadata.breed_id,
            coat_id: variation.metadata.coat_id,
            outfit_id: variation.metadata.outfit_id,
            format_id: variation.metadata.format_id,
            theme_id: currentTheme,
            style_id: currentStyle,
            is_multi_animal: isMultiAnimal || false,
            multi_animal_config: multiAnimalConfig || null,
            generation_cost_credits: 1,
            generation_metadata: {
              variation_type: variation.metadata.variation_type,
              generated_at: new Date().toISOString(),
              api_version: 'gemini-2.5-flash-image-preview',
              ai_description: aiDescription || null,
              cloudinary_upload: {
                public_id: cloudinaryResult.public_id,
                width: cloudinaryResult.width,
                height: cloudinaryResult.height,
                format: cloudinaryResult.format,
                bytes: cloudinaryResult.bytes
              }
            },
            image_variants: {
              preview_watermarked: {
                data: variation.imageBuffer.toString('base64'),
                format: 'png',
                hasWatermark: true
              }
            }
          })
          .select()
          .single();

        if (!saveError && savedImage) {
          savedImages.push({
            id: savedImage.id,
            imageData: variation.imageBuffer.toString('base64'),
            filename: variation.filename,
            prompt: variation.metadata.prompt,
            metadata: variation.metadata,
            variation_type: variation.metadata.variation_type,
            cloudinary_public_id: cloudinaryResult.public_id,
            public_url: cloudinaryResult.secure_url,
            ai_description: aiDescription || null
          });
        }
      } catch (saveError) {
        console.error('Error saving generated image:', saveError);
      }
    }

    console.log(`✅ CUSTOMER VARIATION GENERATION COMPLETE`);
    console.log(`📊 Generated ${savedImages.length} variations`);
    console.log(`💳 Credits used: ${requiredCredits}`);

    // Get updated credit balance
    const { data: updatedBalance } = await supabaseAdmin
      .from('customer_customization_credits')
      .select('credits_remaining')
      .eq('customer_id', customerId)
      .single();

    return NextResponse.json({
      success: true,
      variations: savedImages,
      creditsUsed: requiredCredits,
      creditsRemaining: updatedBalance?.credits_remaining || 0,
      remainingRequests: rateLimitCheck.remainingRequests
    });

  } catch (error) {
    console.error('Customer variation generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Variation generation failed' },
      { status: 500 }
    );
  }
}
