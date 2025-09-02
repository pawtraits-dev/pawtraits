// lib/gemini-variation-service.ts
import { GoogleGenAI } from "@google/genai";
import type { Breed, Coat, Outfit, Format, BreedCoatDetail } from '@/lib/types';

export interface VariationConfig {
  originalImageData: string; // base64
  originalPrompt: string;
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
    this.ai = new GoogleGenAI({
      apiKey: apiKey || process.env.GEMINI_API_KEY
    });
  }

  /**
   * Generate breed variations from an original image
   */
  async generateBreedVariations(
    originalImageData: string,
    originalPrompt: string,
    targetBreeds: Breed[]
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const breed of targetBreeds) {
      try {
        const variationPrompt = this.createBreedVariationPrompt(originalPrompt, breed);
        
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
              variations.push({
                imageData: part.inlineData.data,
                prompt: variationPrompt,
                metadata: {
                  breed,
                  variation_type: 'breed'
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
    targetCoats: BreedCoatDetail[]
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const coat of targetCoats) {
      try {
        const variationPrompt = this.createCoatVariationPrompt(originalPrompt, breed, coat);
        
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
              variations.push({
                imageData: part.inlineData.data,
                prompt: variationPrompt,
                metadata: {
                  breed,
                  coat,
                  variation_type: 'coat'
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
    targetOutfits: Outfit[]
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const outfit of targetOutfits) {
      try {
        const variationPrompt = this.createOutfitVariationPrompt(originalPrompt, outfit);
        
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
              variations.push({
                imageData: part.inlineData.data,
                prompt: variationPrompt,
                metadata: {
                  outfit,
                  variation_type: 'outfit'
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
    targetFormats: Format[]
  ): Promise<GeneratedVariation[]> {
    const variations: GeneratedVariation[] = [];

    for (const format of targetFormats) {
      try {
        const variationPrompt = this.createFormatVariationPrompt(originalPrompt, format);
        
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
              variations.push({
                imageData: part.inlineData.data,
                prompt: variationPrompt,
                metadata: {
                  format,
                  variation_type: 'format'
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
   * Create breed variation prompt
   */
  private createBreedVariationPrompt(originalPrompt: string, targetBreed: Breed): string {
    return `Using the provided image as reference, create a new image with the same composition, pose, and lighting, but change the dog/cat to be a ${targetBreed.name.toLowerCase()}. Maintain the same scene, background, and overall aesthetic. The ${targetBreed.name.toLowerCase()} should have typical characteristics of the breed: ${targetBreed.personality_traits?.join(', ')}. ${originalPrompt}`;
  }

  /**
   * Create coat variation prompt
   */
  private createCoatVariationPrompt(originalPrompt: string, breed: Breed, targetCoat: BreedCoatDetail): string {
    return `Using the provided image as reference, create a new image with the same ${breed.name.toLowerCase()}, same composition, pose, and scene, but change the coat color to ${targetCoat.coat_name.toLowerCase()}. The coat should have a ${targetCoat.pattern_type} pattern. Maintain all other aspects of the image including lighting, background, and pose. ${originalPrompt}`;
  }

  /**
   * Create outfit variation prompt
   */
  private createOutfitVariationPrompt(originalPrompt: string, targetOutfit: Outfit): string {
    if (targetOutfit.name === 'No Outfit') {
      return `Using the provided image as reference, create a new image with the same pet, same composition, pose, and scene, but remove any clothing or accessories. The pet should appear natural without any outfits. Maintain all other aspects including lighting and background. ${originalPrompt}`;
    }

    return `Using the provided image as reference, create a new image with the same pet, same composition, pose, and scene, but change the outfit to: ${targetOutfit.clothing_description}. The outfit should fit naturally and look appropriate for the pet. Maintain all other aspects including lighting and background. ${originalPrompt}`;
  }

  /**
   * Create format variation prompt
   */
  private createFormatVariationPrompt(originalPrompt: string, targetFormat: Format): string {
    return `Using the provided image as reference, create a new image with the same pet and scene, but adjust the composition for a ${targetFormat.aspect_ratio} aspect ratio format suitable for ${targetFormat.use_case}. ${targetFormat.prompt_adjustments}. Maintain the same pet, lighting quality, and overall aesthetic. ${originalPrompt}`;
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