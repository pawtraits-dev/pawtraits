// lib/gemini-variation-service.ts
import { GoogleGenAI } from "@google/genai";
import type { Breed, Coat, Outfit, Format, BreedCoatDetail } from '@/lib/types';

export interface VariationConfig {
  originalImageData: string; // base64
  originalPrompt: string;
  currentTheme?: any;
  currentStyle?: any;
  variations: {
    breeds?: Breed[];
    coats?: BreedCoatDetail[];
    outfits?: Outfit[];
    formats?: Format[];
  };
}

export interface GeneratedVariation {
  imageData: string; // base64
  prompt: string;
  metadata: {
    breed?: Breed;
    coat?: BreedCoatDetail;
    outfit?: Outfit;
    format?: Format;
    variation_type: string;
  };
}

export class GeminiVariationService {
  private ai: GoogleGenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Gemini API key is required');
    }
    this.ai = new GoogleGenAI({
      apiKey: key
    });
  }

  /**
   * Generate breed variations from an original image
   */
  async generateBreedVariations(
    originalImageData: string,
    originalPrompt: string,
    targetBreeds: Breed[],
    currentTheme?: any,
    currentStyle?: any
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const breed of targetBreeds) {
      try {
        const variationPrompt = this.createBreedVariationPrompt(originalPrompt, breed, currentTheme, currentStyle);
        
        const prompt = [
          { text: variationPrompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: originalImageData,
            },
          },
        ];

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: prompt,
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              // Generate Midjourney prompt for catalog storage
              const midjourneyPrompt = this.createMidjourneyPromptForBreed(originalPrompt, breed, currentTheme, currentStyle);
              
              variations.push({
                imageData: part.inlineData.data,
                prompt: midjourneyPrompt, // Store Midjourney prompt for catalog
                metadata: {
                  breed,
                  variation_type: 'breed',
                  gemini_prompt: variationPrompt // Store Gemini prompt for reference
                }
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to generate breed variation for ${breed.name}:`, error);
      }
    }

    return variations;
  }

  /**
   * Generate coat variations for a specific breed
   */
  async generateCoatVariations(
    originalImageData: string,
    originalPrompt: string,
    breed: Breed,
    targetCoats: BreedCoatDetail[],
    currentTheme?: any,
    currentStyle?: any,
    originalFormat?: any
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const coat of targetCoats) {
      try {
        const variationPrompt = this.createCoatVariationPrompt(originalPrompt, breed, coat, currentTheme, currentStyle);
        
        const prompt = [
          { text: variationPrompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: originalImageData,
            },
          },
        ];

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: prompt,
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              // Generate Midjourney prompt for catalog storage
              const midjourneyPrompt = this.createMidjourneyPromptForCoat(originalPrompt, breed, coat, currentTheme, currentStyle);
              
              variations.push({
                imageData: part.inlineData.data,
                prompt: midjourneyPrompt, // Store Midjourney prompt for catalog
                metadata: {
                  breed,
                  coat,
                  format: originalFormat, // Inherit original format for coat variations
                  variation_type: 'coat',
                  breed_id: breed.id,
                  coat_id: coat.id,
                  format_id: originalFormat?.id || null,
                  gemini_prompt: variationPrompt // Store Gemini prompt for reference
                }
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to generate coat variation for ${coat.coat_name}:`, error);
      }
    }

    return variations;
  }

  /**
   * Generate outfit variations
   */
  async generateOutfitVariations(
    originalImageData: string,
    originalPrompt: string,
    targetOutfits: Outfit[],
    currentTheme?: any,
    currentStyle?: any,
    originalFormat?: any,
    originalBreed?: any,
    originalCoat?: any
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const outfit of targetOutfits) {
      try {
        const variationPrompt = this.createOutfitVariationPrompt(originalPrompt, outfit, currentTheme, currentStyle);
        
        const prompt = [
          { text: variationPrompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: originalImageData,
            },
          },
        ];

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: prompt,
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              // Generate Midjourney prompt for catalog storage
              const midjourneyPrompt = this.createMidjourneyPromptForOutfit(originalPrompt, outfit, currentTheme, currentStyle);
              
              variations.push({
                imageData: part.inlineData.data,
                prompt: midjourneyPrompt, // Store Midjourney prompt for catalog
                metadata: {
                  outfit,
                  breed: originalBreed, // Inherit original breed for outfit variations
                  coat: originalCoat, // Inherit original coat for outfit variations
                  theme: currentTheme,
                  style: currentStyle,
                  format: originalFormat, // Inherit original format for outfit variations
                  variation_type: 'outfit',
                  breed_id: originalBreed?.id || null,
                  coat_id: originalCoat?.id || null,
                  theme_id: currentTheme?.id || null,
                  style_id: currentStyle?.id || null,
                  outfit_id: outfit.id,
                  format_id: originalFormat?.id || null,
                  gemini_prompt: variationPrompt // Store Gemini prompt for reference
                }
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to generate outfit variation for ${outfit.name}:`, error);
      }
    }

    return variations;
  }

  /**
   * Generate format variations (aspect ratio/style changes)
   */
  async generateFormatVariations(
    originalImageData: string,
    originalPrompt: string,
    targetFormats: Format[],
    currentTheme?: any,
    currentStyle?: any,
    originalBreed?: any,
    originalCoat?: any
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const format of targetFormats) {
      try {
        const variationPrompt = this.createFormatVariationPrompt(originalPrompt, format, currentTheme, currentStyle);
        
        const prompt = [
          { text: variationPrompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: originalImageData,
            },
          },
        ];

        const response = await this.ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: prompt,
        });

        if (response.candidates?.[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              // Generate Midjourney prompt for catalog storage
              const midjourneyPrompt = this.createMidjourneyPromptForFormat(originalPrompt, format, currentTheme, currentStyle);
              
              variations.push({
                imageData: part.inlineData.data,
                prompt: midjourneyPrompt, // Store Midjourney prompt for catalog
                metadata: {
                  format,
                  breed: originalBreed, // Inherit original breed for format variations
                  coat: originalCoat, // Inherit original coat for format variations
                  theme: currentTheme,
                  style: currentStyle,
                  variation_type: 'format',
                  breed_id: originalBreed?.id || null,
                  coat_id: originalCoat?.id || null,
                  theme_id: currentTheme?.id || null,
                  style_id: currentStyle?.id || null,
                  format_id: format.id, // Use the new target format for format variations
                  gemini_prompt: variationPrompt // Store Gemini prompt for reference
                }
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to generate format variation for ${format.name}:`, error);
      }
    }

    return variations;
  }

  /**
   * Generate all variations in batch mode for efficiency
   */
  async generateAllVariations(config: VariationConfig): Promise<GeneratedVariation[]> {
    const allVariations: GeneratedVariation[] = [];

    // Generate breed variations
    if (config.variations.breeds?.length) {
      const breedVariations = await this.generateBreedVariations(
        config.originalImageData,
        config.originalPrompt,
        config.variations.breeds
      );
      allVariations.push(...breedVariations);
    }

    // Generate coat variations
    if (config.variations.coats?.length) {
      // For coat variations, we need to determine the breed context
      const breedContext = config.variations.breeds?.[0]; // Use first breed as context
      if (breedContext) {
        const coatVariations = await this.generateCoatVariations(
          config.originalImageData,
          config.originalPrompt,
          breedContext,
          config.variations.coats
        );
        allVariations.push(...coatVariations);
      }
    }

    // Generate outfit variations
    if (config.variations.outfits?.length) {
      const outfitVariations = await this.generateOutfitVariations(
        config.originalImageData,
        config.originalPrompt,
        config.variations.outfits
      );
      allVariations.push(...outfitVariations);
    }

    // Generate format variations
    if (config.variations.formats?.length) {
      const formatVariations = await this.generateFormatVariations(
        config.originalImageData,
        config.originalPrompt,
        config.variations.formats
      );
      allVariations.push(...formatVariations);
    }

    return allVariations;
  }

  /**
   * Parse original Midjourney prompt to extract components
   */
  private parseOriginalPrompt(originalPrompt: string): {
    breed: string;
    coat: string;
    outfit: string;
    theme: string;
    style: string;
    aspectRatio: string;
  } {
    // Extract aspect ratio
    const arMatch = originalPrompt.match(/--ar\s+(\d+:\d+)/);
    const aspectRatio = arMatch ? arMatch[1] : '1:1';
    
    // Remove aspect ratio from prompt for parsing
    const promptWithoutAR = originalPrompt.replace(/--ar\s+\d+:\d+/, '').trim();
    
    // Try to parse the standard format: "A [BREED] with [COAT] fur, wearing [OUTFIT], [THEME], [STYLE]"
    const standardMatch = promptWithoutAR.match(/^A\s+(.+?)\s+with\s+(.+?)\s+fur,\s+wearing\s+(.+?),\s+(.+?),\s+(.+)$/i);
    
    if (standardMatch) {
      return {
        breed: standardMatch[1],
        coat: standardMatch[2],
        outfit: standardMatch[3],
        theme: standardMatch[4],
        style: standardMatch[5],
        aspectRatio
      };
    }
    
    // Fallback parsing for non-standard prompts
    return {
      breed: 'dog',
      coat: 'natural',
      outfit: 'no outfit',
      theme: promptWithoutAR,
      style: '',
      aspectRatio
    };
  }

  /**
   * Generate single breed variation with valid coat color
   */
  async generateSingleBreedVariationWithCoat(
    originalImageData: string,
    originalPrompt: string,
    targetBreed: Breed,
    validCoat: any,
    currentTheme?: any,
    currentStyle?: any,
    originalFormat?: any,
    originalBreed?: Breed,
    targetAge?: string
  ): Promise<GeneratedVariation | null> {
    const generationStartTime = Date.now();
    const maxRetries = 2; // Retry up to 2 times for 500 errors
    let lastError: any = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const retryDelay = 2000 * attempt; // Progressive delay: 2s, 4s
          console.log(`🔄 RETRY ${attempt}/${maxRetries}: ${targetBreed.name} after ${retryDelay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
        
        const variationPrompt = this.createBreedVariationPromptWithCoat(originalPrompt, targetBreed, validCoat, currentTheme, currentStyle, originalBreed, targetAge);
      
      const prompt = [
        { text: variationPrompt },
        {
          inlineData: {
            mimeType: "image/png",
            data: originalImageData,
          },
        },
      ];

      console.log(`🤖 GEMINI CALL START: ${targetBreed.name} (${targetBreed.animal_type}) + ${validCoat.coat_name}`);
      console.log(`📏 Image data size: ${Math.round((originalImageData.length * 3) / 4 / 1024)}KB`);
      console.log(`📝 Prompt length: ${variationPrompt.length} characters`);
      
      const geminiCallStart = Date.now();
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: prompt,
      });
      const geminiCallEnd = Date.now();
      const geminiDuration = geminiCallEnd - geminiCallStart;
      
      console.log(`🤖 GEMINI CALL END: ${targetBreed.name} (${geminiDuration}ms)`);

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const generationEndTime = Date.now();
            const totalDuration = generationEndTime - generationStartTime;
            
            const successMessage = attempt > 0 ? `✅ GEMINI RETRY SUCCESS: ${targetBreed.name} on attempt ${attempt + 1} (total: ${totalDuration}ms)` : `✅ GEMINI SUCCESS: ${targetBreed.name} generated image (total: ${totalDuration}ms)`;
            console.log(successMessage);
            
            // Generate Midjourney prompt for catalog storage with valid coat
            const midjourneyPrompt = this.createMidjourneyPromptForBreedWithCoat(originalPrompt, targetBreed, validCoat, currentTheme, currentStyle, originalBreed);
            
            return {
              imageData: part.inlineData.data,
              prompt: midjourneyPrompt,
              metadata: {
                breed: targetBreed,
                coat: validCoat,
                theme: currentTheme,
                style: currentStyle,
                format: originalFormat, // Inherit original format for breed variations
                variation_type: 'breed',
                breed_id: targetBreed.id,
                coat_id: validCoat.id,
                theme_id: currentTheme?.id || null,
                style_id: currentStyle?.id || null,
                format_id: originalFormat?.id || null,
                gemini_prompt: variationPrompt
              }
            };
          }
        }
      }
      
      const generationEndTime = Date.now();
      const totalDuration = generationEndTime - generationStartTime;
      console.log(`❌ GEMINI NO IMAGE: ${targetBreed.name} - no image data in response (total: ${totalDuration}ms)`);
      console.log(`📊 Response structure:`, {
        hasCandidates: !!response.candidates,
        candidatesLength: response.candidates?.length,
        firstCandidateHasContent: !!response.candidates?.[0]?.content,
        firstCandidateHasParts: !!response.candidates?.[0]?.content?.parts,
        partsLength: response.candidates?.[0]?.content?.parts?.length
      });
    } catch (error) {
      const generationEndTime = Date.now();
      const totalDuration = generationEndTime - generationStartTime;
      
      console.error(`🔥 GEMINI ERROR: ${targetBreed.name} with ${validCoat.coat_name} (${totalDuration}ms)`);
      console.error(`💀 Error details:`, error);
      
      // Add specific error handling for common Gemini issues
      if (error && typeof error === 'object') {
        if ('status' in error) {
          console.error(`🚨 HTTP Status: ${error.status}`);
          if (error.status === 500) {
            console.error('🚨 Gemini API 500 - possible quota exceeded or service unavailable');
          } else if (error.status === 429) {
            console.error('🚨 Gemini API 429 - rate limit exceeded');
          } else if (error.status === 400) {
            console.error('🚨 Gemini API 400 - bad request (possibly image too large or invalid format)');
          }
        }
        if ('message' in error) {
          console.error('🚨 Error message:', error.message);
        }
        if ('code' in error) {
          console.error('🚨 Error code:', error.code);
        }
      }
      
      lastError = error;
      
      // Only retry on 500 errors (server issues), not 400/429 errors
      if (error && typeof error === 'object' && 'status' in error && error.status === 500 && attempt < maxRetries) {
        console.log(`💡 Retryable error (500), will retry attempt ${attempt + 1}/${maxRetries}`);
        continue; // Continue to next retry attempt
      } else {
        // Non-retryable error or max retries reached
        break;
      }
    }
  }
  
  // All retries exhausted
  if (lastError) {
    const generationEndTime = Date.now();
    const totalDuration = generationEndTime - generationStartTime;
    console.log(`💀 ALL RETRIES EXHAUSTED: ${targetBreed.name} after ${maxRetries} retries (${totalDuration}ms total)`);
  }
  
  return null;
  }

  /**
   * Generate breed variations with valid coat colors (multiple coats per breed)
   */
  async generateBreedVariationsWithValidCoat(
    originalImageData: string,
    originalPrompt: string,
    targetBreeds: Breed[],
    validCoat: any,
    currentTheme?: any,
    currentStyle?: any
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const breed of targetBreeds) {
      const variation = await this.generateSingleBreedVariationWithCoat(
        originalImageData,
        originalPrompt,
        breed,
        validCoat,
        currentTheme,
        currentStyle
      );
      
      if (variation) {
        variations.push(variation);
      }
    }

    return variations;
  }

  /**
   * Create breed variation prompt for Gemini image editing (legacy method)
   */
  private createBreedVariationPrompt(
    originalPrompt: string, 
    targetBreed: Breed, 
    currentTheme?: any, 
    currentStyle?: any
  ): string {
    const { breed, coat, outfit } = this.parseOriginalPrompt(originalPrompt);
    
    // Get fur length instruction for the target breed
    const breedPhysicalTraits = targetBreed.physical_traits as any || {};
    const breedCoatLength = breedPhysicalTraits.coat;
    const furLengthInstruction = this.getFurLengthInstruction(targetBreed.name, breedCoatLength);
    
    return `Using the provided image of a ${breed.toLowerCase()} wearing ${outfit}, change the breed to a ${targetBreed.name.toLowerCase()}. Keep the same ${coat} fur color throughout ALL body parts (face, legs, paws, body, tail), clothing, pose, lighting, and overall composition.\n\n${furLengthInstruction}\n\nOnly change the dog/cat breed characteristics like head shape, ear type, body size, facial features, and fur length to match a ${targetBreed.name.toLowerCase()}. Ensure fur color remains consistent across all visible areas.`;
  }

  /**
   * Create breed variation prompt with valid coat color
   */
  private createBreedVariationPromptWithCoat(
    originalPrompt: string, 
    targetBreed: Breed, 
    validCoat: any,
    currentTheme?: any, 
    currentStyle?: any,
    originalBreed?: Breed,
    targetAge?: string
  ): string {
    const { breed, outfit } = this.parseOriginalPrompt(originalPrompt);
    
    // Detect cross-species transformation
    const isCrossSpecies = originalBreed && originalBreed.animal_type !== targetBreed.animal_type;
    const originalAnimalType = originalBreed?.animal_type || (breed.toLowerCase().includes('cat') ? 'cat' : 'dog');
    const targetAnimalType = targetBreed.animal_type;
    
    // Handle age transformation
    const ageInstruction = this.getAgeTransformationInstruction(targetAge, targetAnimalType);
    
    // Get fur length instruction for the target breed
    const breedPhysicalTraits = targetBreed.physical_traits as any || {};
    const breedCoatLength = breedPhysicalTraits.coat;
    const furLengthInstruction = this.getFurLengthInstruction(targetBreed.name, breedCoatLength);
    
    if (isCrossSpecies) {
      // Cross-species transformation prompt
      return `Using the provided image of a ${originalAnimalType} (${originalBreed?.name || breed}) wearing ${outfit}, transform this ${originalAnimalType} into a ${targetAnimalType} breed: ${targetBreed.name.toLowerCase()}. This is a ${originalAnimalType}-to-${targetAnimalType} transformation. Apply the ${validCoat.coat_name.toLowerCase()} coloring throughout ALL body parts:\n- Face and head fur\n- Body and torso fur\n- All four legs completely\n- All four paws and feet\n- Tail fur\n- Any visible undercoat\n\n${ageInstruction}\n\n${furLengthInstruction}\n\nTransform the anatomy and characteristics completely from ${originalAnimalType} to ${targetAnimalType}: change head shape, ear type, body size, facial features, and tail to match a ${targetBreed.name.toLowerCase()}. Ensure the ${validCoat.coat_name.toLowerCase()} fur color is realistic and consistent for this ${targetBreed.name.toLowerCase()} breed. Keep the same clothing, pose, lighting, and overall composition.`;
    } else {
      // Same species breed variation prompt
      return `Using the provided image of a ${breed.toLowerCase()} wearing ${outfit}, change the breed to a ${targetBreed.name.toLowerCase()} and change the fur color to ${validCoat.coat_name.toLowerCase()}. Apply the ${validCoat.coat_name.toLowerCase()} coloring throughout ALL body parts:\n- Face and head fur\n- Body and torso fur\n- All four legs completely\n- All four paws and feet\n- Tail fur\n- Any visible undercoat\n\n${ageInstruction}\n\n${furLengthInstruction}\n\nChange the breed characteristics (head shape, ear type, body size, facial features) and ensure the ${validCoat.coat_name.toLowerCase()} fur color is realistic and consistent for this ${targetBreed.name.toLowerCase()} breed. Keep the same clothing, pose, lighting, and overall composition.`;
    }
  }

  /**
   * Create coat variation prompt for Gemini image editing
   */
  private createCoatVariationPrompt(
    originalPrompt: string, 
    breed: Breed, 
    targetCoat: BreedCoatDetail,
    currentTheme?: any,
    currentStyle?: any
  ): string {
    const { coat, outfit } = this.parseOriginalPrompt(originalPrompt);
    
    // Determine appropriate fur length based on breed characteristics
    const breedPhysicalTraits = breed.physical_traits as any || {};
    const breedCoatLength = breedPhysicalTraits.coat;
    
    // Create fur length instruction based on breed
    const furLengthInstruction = this.getFurLengthInstruction(breed.name, breedCoatLength);
    
    return `Using the provided image of a ${breed.name.toLowerCase()} with ${coat} fur wearing ${outfit}, change the fur color throughout the ENTIRE body to ${targetCoat.coat_name.toLowerCase()}. This includes:
- Face and head fur
- Body and torso fur  
- All four legs completely
- All four paws and feet
- Tail fur
- Any visible undercoat or inner fur

${furLengthInstruction}

Ensure the ${targetCoat.coat_name.toLowerCase()} coloring is consistent across ALL visible fur areas. Keep the same breed characteristics, clothing, pose, lighting, and overall composition. Only change the fur/coat color, pattern, and length as specified.`;
  }

  /**
   * Get age transformation instruction
   */
  private getAgeTransformationInstruction(targetAge?: string, animalType?: string): string {
    if (!targetAge || targetAge === 'same') {
      return ''; // No age change
    }
    
    const youngTerm = animalType === 'cat' ? 'kitten' : 'puppy';
    const adultTerm = animalType === 'cat' ? 'adult cat' : 'adult dog';
    
    if (targetAge === 'young') {
      return `IMPORTANT: Transform this into a ${youngTerm} (young ${animalType}). Make the features smaller, rounder, and more juvenile:
- Larger eyes relative to head size
- Shorter muzzle and smaller nose
- Rounder, more proportioned head
- Smaller, more compact body
- Shorter legs relative to body
- Softer, fluffier fur texture appropriate for a ${youngTerm}
- Overall more adorable and youthful appearance`;
    }
    
    if (targetAge === 'adult') {
      return `IMPORTANT: Transform this into an ${adultTerm} (mature ${animalType}). Make the features more mature and fully developed:
- Properly proportioned adult eyes
- Full-sized muzzle and nose
- Adult head proportions
- Full-sized mature body
- Adult leg proportions
- Mature fur texture appropriate for an ${adultTerm}
- Overall mature and fully-grown appearance`;
    }
    
    return '';
  }

  /**
   * Get appropriate fur length instruction based on breed characteristics
   */
  private getFurLengthInstruction(breedName: string, breedCoatLength?: string): string {
    // Use breed data if available
    if (breedCoatLength) {
      switch (breedCoatLength.toLowerCase()) {
        case 'short':
          return 'Make sure the fur length is SHORT and close to the body, especially on the legs and paws.';
        case 'long':
          return 'Make sure the fur length is LONG and flowing, especially around the legs and paws.';
        case 'medium':
          return 'Make sure the fur length is MEDIUM length, not too short but not overly long.';
        default:
          break;
      }
    }
    
    // Fallback to breed-specific knowledge for common breeds
    const shortHairedBreeds = [
      'beagle', 'boxer', 'bulldog', 'chihuahua', 'dachshund', 'doberman', 
      'french bulldog', 'german shorthaired pointer', 'greyhound', 'jack russell',
      'labrador', 'pit bull', 'pug', 'rottweiler', 'whippet', 'weimaraner',
      'boston terrier', 'staffordshire', 'pointer', 'vizsla'
    ];
    
    const longHairedBreeds = [
      'afghan hound', 'australian shepherd', 'bernese mountain dog', 'border collie',
      'collie', 'cocker spaniel', 'golden retriever', 'irish setter', 'newfoundland',
      'old english sheepdog', 'pomeranian', 'shih tzu', 'tibetan mastiff', 'yorkshire terrier',
      'maltese', 'lhasa apso', 'pekingese', 'chow chow'
    ];
    
    const breedLower = breedName.toLowerCase();
    
    if (shortHairedBreeds.some(breed => breedLower.includes(breed))) {
      return 'Make sure the fur length is SHORT and close to the body, especially on the legs and paws. This breed should not have long or fluffy fur.';
    }
    
    if (longHairedBreeds.some(breed => breedLower.includes(breed))) {
      return 'Make sure the fur length is appropriately LONG for this breed, especially around the legs and paws.';
    }
    
    // Default instruction
    return 'Adjust the fur length to be appropriate for this breed type.';
  }

  /**
   * Create outfit variation prompt using standardized Midjourney format
   */
  private createOutfitVariationPrompt(
    originalPrompt: string, 
    targetOutfit: Outfit,
    currentTheme?: any,
    currentStyle?: any
  ): string {
    const { breed, coat, outfit } = this.parseOriginalPrompt(originalPrompt);
    
    const outfitText = targetOutfit.name === 'No Outfit' ? 'no outfit' : targetOutfit.clothing_description || targetOutfit.name.toLowerCase();
    
    return `Using the provided image of a ${breed} with ${coat} fur wearing ${outfit}, change the clothing/outfit to ${outfitText}. Keep the same breed, fur color, pose, lighting, and overall composition. Only change what the pet is wearing.`;
  }

  /**
   * Create format variation prompt for Gemini image editing
   */
  private createFormatVariationPrompt(
    originalPrompt: string, 
    targetFormat: Format,
    currentTheme?: any,
    currentStyle?: any
  ): string {
    const { breed, coat, outfit } = this.parseOriginalPrompt(originalPrompt);
    
    const aspectInstructions = targetFormat.aspect_ratio === '1:1' ? 'square format' :
                              targetFormat.aspect_ratio === '2:3' ? 'portrait format (2:3 aspect ratio)' :
                              targetFormat.aspect_ratio === '3:2' ? 'landscape format (3:2 aspect ratio)' :
                              `${targetFormat.aspect_ratio} aspect ratio`;
    
    return `Using the provided image of a ${breed} with ${coat} fur wearing ${outfit}, reframe and adjust the composition for ${aspectInstructions}. ${targetFormat.prompt_adjustments || ''}. Keep the same breed, fur color, clothing, pose, and lighting. Only change the aspect ratio and composition to fit the ${aspectInstructions}.`;
  }

  /**
   * Create Midjourney prompt for breed variation (for catalog storage)
   */
  private createMidjourneyPromptForBreed(
    originalPrompt: string, 
    targetBreed: Breed, 
    currentTheme?: any, 
    currentStyle?: any
  ): string {
    const { coat, outfit, aspectRatio } = this.parseOriginalPrompt(originalPrompt);
    
    const themePrompt = currentTheme?.base_prompt_template || '';
    const stylePrompt = currentStyle?.prompt_suffix || '';
    
    return `A ${targetBreed.name.toLowerCase()} with ${coat} fur, wearing ${outfit}, ${themePrompt}, ${stylePrompt}, --ar ${aspectRatio}`.replace(/,\s*,/g, ',').trim();
  }

  /**
   * Create Midjourney prompt for breed variation with valid coat (for catalog storage)
   */
  private createMidjourneyPromptForBreedWithCoat(
    originalPrompt: string, 
    targetBreed: Breed, 
    validCoat: any,
    currentTheme?: any, 
    currentStyle?: any,
    originalBreed?: Breed
  ): string {
    const { outfit, aspectRatio } = this.parseOriginalPrompt(originalPrompt);
    
    const themePrompt = currentTheme?.base_prompt_template || '';
    const stylePrompt = currentStyle?.prompt_suffix || '';
    
    // Detect cross-species transformation for Midjourney prompt
    const isCrossSpecies = originalBreed && originalBreed.animal_type !== targetBreed.animal_type;
    const crossSpeciesNote = isCrossSpecies ? `(${originalBreed?.animal_type}-to-${targetBreed.animal_type} transformation) ` : '';
    
    return `A ${targetBreed.name.toLowerCase()} ${crossSpeciesNote}with ${validCoat.coat_name.toLowerCase()} fur, wearing ${outfit}, ${themePrompt}, ${stylePrompt}, --ar ${aspectRatio}`.replace(/,\s*,/g, ',').trim();
  }

  /**
   * Create Midjourney prompt for coat variation (for catalog storage)
   */
  private createMidjourneyPromptForCoat(
    originalPrompt: string, 
    breed: Breed, 
    targetCoat: BreedCoatDetail,
    currentTheme?: any,
    currentStyle?: any
  ): string {
    const { outfit, aspectRatio } = this.parseOriginalPrompt(originalPrompt);
    
    const themePrompt = currentTheme?.base_prompt_template || '';
    const stylePrompt = currentStyle?.prompt_suffix || '';
    
    return `A ${breed.name.toLowerCase()} with ${targetCoat.coat_name.toLowerCase()} fur, wearing ${outfit}, ${themePrompt}, ${stylePrompt}, --ar ${aspectRatio}`.replace(/,\s*,/g, ',').trim();
  }

  /**
   * Create Midjourney prompt for outfit variation (for catalog storage)
   */
  private createMidjourneyPromptForOutfit(
    originalPrompt: string, 
    targetOutfit: Outfit,
    currentTheme?: any,
    currentStyle?: any
  ): string {
    const { breed, coat, aspectRatio } = this.parseOriginalPrompt(originalPrompt);
    
    const outfitText = targetOutfit.name === 'No Outfit' ? 'no outfit' : targetOutfit.clothing_description || targetOutfit.name.toLowerCase();
    const themePrompt = currentTheme?.base_prompt_template || '';
    const stylePrompt = currentStyle?.prompt_suffix || '';
    
    return `A ${breed} with ${coat} fur, wearing ${outfitText}, ${themePrompt}, ${stylePrompt}, --ar ${aspectRatio}`.replace(/,\s*,/g, ',').trim();
  }

  /**
   * Create Midjourney prompt for format variation (for catalog storage)
   */
  private createMidjourneyPromptForFormat(
    originalPrompt: string, 
    targetFormat: Format,
    currentTheme?: any,
    currentStyle?: any
  ): string {
    const { breed, coat, outfit } = this.parseOriginalPrompt(originalPrompt);
    
    const themePrompt = currentTheme?.base_prompt_template || '';
    const stylePrompt = currentStyle?.prompt_suffix || '';
    
    // Apply format-specific adjustments to theme
    const adjustedTheme = targetFormat.prompt_adjustments ? 
      `${themePrompt}, ${targetFormat.prompt_adjustments}` : themePrompt;
    
    return `A ${breed} with ${coat} fur, wearing ${outfit}, ${adjustedTheme}, ${stylePrompt}, --ar ${targetFormat.aspect_ratio}`.replace(/,\s*,/g, ',').trim();
  }

  /**
   * Process variations into upload-ready format
   */
  processVariationsForUpload(variations: GeneratedVariation[]): Array<{
    imageBuffer: Buffer;
    filename: string;
    metadata: any;
  }> {
    return variations.map((variation, index) => {
      const buffer = Buffer.from(variation.imageData, "base64");
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      let filename = `variation-${timestamp}-${index}`;
      
      // Add specific naming based on variation type
      if (variation.metadata.breed) {
        filename += `-${variation.metadata.breed.slug}`;
      }
      if (variation.metadata.coat) {
        filename += `-${variation.metadata.coat.coat_slug || variation.metadata.coat.coat_name.replace(/\s+/g, '-')}`;
      }
      if (variation.metadata.outfit) {
        filename += `-${variation.metadata.outfit.slug || variation.metadata.outfit.name.replace(/\s+/g, '-')}`;
      }
      if (variation.metadata.format) {
        filename += `-${variation.metadata.format.slug}`;
      }
      
      filename += '.png';

      return {
        imageBuffer: buffer,
        filename: filename.toLowerCase(),
        metadata: {
          prompt: variation.prompt,
          variation_type: variation.metadata.variation_type,
          breed_id: variation.metadata.breed?.id,
          coat_id: variation.metadata.coat?.id,
          outfit_id: variation.metadata.outfit?.id,
          format_id: variation.metadata.format?.id,
          tags: this.generateVariationTags(variation),
          is_variation: true,
          original_prompt: variation.prompt
        }
      };
    });
  }

  /**
   * Generate appropriate tags for variations
   */
  private generateVariationTags(variation: GeneratedVariation): string[] {
    const tags = ['ai-generated', 'gemini-variation'];
    
    if (variation.metadata.breed) {
      tags.push(variation.metadata.breed.slug, variation.metadata.breed.animal_type || 'dog');
    }
    
    if (variation.metadata.coat) {
      tags.push(variation.metadata.coat.coat_name.toLowerCase().replace(/\s+/g, '-'));
      tags.push(variation.metadata.coat.pattern_type);
    }
    
    if (variation.metadata.outfit) {
      tags.push(variation.metadata.outfit.name.toLowerCase().replace(/\s+/g, '-'));
    }
    
    if (variation.metadata.format) {
      tags.push(variation.metadata.format.slug);
      tags.push(variation.metadata.format.use_case);
    }
    
    tags.push(variation.metadata.variation_type);
    
    return tags;
  }
}