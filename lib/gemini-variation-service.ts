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
    targetCoats: BreedCoatDetail[],
    currentTheme?: any,
    currentStyle?: any
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
    targetOutfits: Outfit[],
    currentTheme?: any,
    currentStyle?: any
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
    targetFormats: Format[],
    currentTheme?: any,
    currentStyle?: any
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
   * Create breed variation prompt using standardized Midjourney format
   */
  private createBreedVariationPrompt(
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
   * Create coat variation prompt using standardized Midjourney format
   */
  private createCoatVariationPrompt(
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
   * Create outfit variation prompt using standardized Midjourney format
   */
  private createOutfitVariationPrompt(
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
   * Create format variation prompt using standardized Midjourney format
   */
  private createFormatVariationPrompt(
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