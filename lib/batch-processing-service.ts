import { createClient } from '@supabase/supabase-js';
import { GeminiVariationService } from './gemini-variation-service';
import { uploadImageBufferToCloudinary } from './cloudinary-server';
import { ImageDescriptionGenerator } from './image-description-generator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export class BatchProcessingService {
  private supabase;
  private geminiService;
  private descriptionGenerator;

  constructor() {
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    this.geminiService = new GeminiVariationService();
    this.descriptionGenerator = new ImageDescriptionGenerator();
  }

  async processBatchJob(jobId: string): Promise<void> {
    console.log(`🚀 BATCH PROCESSING START: ${jobId}`);

    try {
      // Mark job as running
      await this.updateJobStatus(jobId, 'running', { started_at: new Date().toISOString() });

      // Get job configuration
      const { data: job } = await this.supabase
        .from('batch_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!job) {
        throw new Error('Job not found');
      }

      // Get original image data
      const { data: originalImage } = await this.supabase
        .from('image_catalog')
        .select('*')
        .eq('id', job.original_image_id)
        .single();

      if (!originalImage) {
        throw new Error('Original image not found');
      }

      // Get original image data from storage
      const originalImageData = await this.getImageAsBase64(originalImage.cloudinary_secure_url || originalImage.public_url);
      
      // Load reference data
      const [breedsResult, coatsResult, outfitsResult, formatsResult, themesResult, stylesResult] = await Promise.all([
        this.supabase.from('breeds').select('*').eq('is_active', true),
        this.supabase.from('breed_coats').select(`
          id,
          breeds!inner(id, name, slug, animal_type),
          coats!inner(id, name, slug, hex_color, pattern_type, rarity)
        `),
        this.supabase.from('outfits').select('*').eq('is_active', true),
        this.supabase.from('formats').select('*').eq('is_active', true),
        this.supabase.from('themes').select('*').eq('is_active', true),
        this.supabase.from('styles').select('*').eq('is_active', true)
      ]);

      const breedsData = breedsResult.data || [];
      const outfitsData = outfitsResult.data || [];
      const formatsData = formatsResult.data || [];
      const themesData = themesResult.data || [];
      const stylesData = stylesResult.data || [];

      const config = job.config;
      const currentThemeData = themesData.find((t: any) => t.id === config.currentTheme);
      const currentStyleData = stylesData.find((s: any) => s.id === config.currentStyle);
      const originalFormatData = formatsData.find((f: any) => f.id === config.currentFormat);
      const originalBreedData = breedsData.find((b: any) => b.id === config.currentBreed);

      // Get pending items
      const { data: items } = await this.supabase
        .from('batch_job_items')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'pending')
        .order('item_index');

      if (!items || items.length === 0) {
        console.log('No pending items found');
        await this.updateJobStatus(jobId, 'completed', { completed_at: new Date().toISOString() });
        return;
      }

      console.log(`📊 Processing ${items.length} items sequentially`);

      // Process items one by one with progressive saving
      for (let i = 0; i < items.length; i++) {
        // Check if job was cancelled
        const { data: currentJob } = await this.supabase
          .from('batch_jobs')
          .select('status')
          .eq('id', jobId)
          .single();

        if (currentJob?.status === 'cancelled') {
          console.log('🚫 Job was cancelled, stopping processing');
          return;
        }

        const item = items[i];
        console.log(`\n🔄 ITEM ${i + 1}/${items.length}: Processing item ${item.id}`);

        try {
          await this.processItem(
            item,
            originalImageData,
            config.originalPrompt,
            breedsData,
            currentThemeData,
            currentStyleData,
            originalFormatData,
            originalBreedData,
            job.target_age
          );

          // Update job progress after each successful item
          await this.updateJobProgress(jobId);
          
          // Add delay between items to prevent rate limiting
          if (i < items.length - 1) {
            console.log('⏳ Waiting 3 seconds before next item...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

        } catch (error) {
          console.error(`Failed to process item ${item.id}:`, error);
          // Continue with next item even if this one fails
          await this.updateJobProgress(jobId);
        }
      }

      // Mark job as completed
      await this.updateJobStatus(jobId, 'completed', { completed_at: new Date().toISOString() });
      console.log(`🏁 BATCH JOB COMPLETE: ${jobId}`);

    } catch (error) {
      console.error(`Batch job ${jobId} failed:`, error);
      await this.updateJobStatus(jobId, 'failed', {
        completed_at: new Date().toISOString(),
        error_log: [error instanceof Error ? error.message : 'Unknown error']
      });
    }
  }

  private async processItem(
    item: any,
    originalImageData: string,
    originalPrompt: string,
    breedsData: any[],
    currentThemeData: any,
    currentStyleData: any,
    originalFormatData: any,
    originalBreedData: any,
    targetAge?: string
  ): Promise<void> {
    const itemStartTime = Date.now();

    try {
      // Mark item as running
      await this.supabase
        .from('batch_job_items')
        .update({
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', item.id);

      let generatedVariation = null;

      // Process based on item type
      if (item.breed_id && item.coat_id) {
        // Breed-coat variation
        const targetBreed = breedsData.find((breed: any) => breed.id === item.breed_id);
        
        if (targetBreed) {
          // Get coat data
          const { data: breedCoatData } = await this.supabase
            .from('breed_coats')
            .select(`
              id,
              breeds!inner(id, name, slug, animal_type),
              coats!inner(id, name, slug, hex_color, pattern_type, rarity)
            `)
            .eq('breeds.id', item.breed_id)
            .eq('coats.id', item.coat_id)
            .single();

          if (breedCoatData) {
            const validCoat = {
              id: breedCoatData.coats.id,
              breed_coat_id: breedCoatData.id,
              coat_name: breedCoatData.coats.name,
              coat_slug: breedCoatData.coats.slug,
              hex_color: breedCoatData.coats.hex_color,
              pattern_type: breedCoatData.coats.pattern_type,
              rarity: breedCoatData.coats.rarity
            };

            const geminiStartTime = Date.now();
            generatedVariation = await this.geminiService.generateSingleBreedVariationWithCoat(
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
            const geminiDuration = Date.now() - geminiStartTime;

            if (generatedVariation) {
              // Generate AI description for the variation
              console.log('🧠 Generating AI description...');
              const descriptionStartTime = Date.now();
              
              try {
                const aiDescription = await this.generateAIDescription(
                  generatedVariation.imageData,
                  targetBreed
                );
                generatedVariation.description = aiDescription;
                console.log(`✅ AI description generated (${Date.now() - descriptionStartTime}ms)`);
              } catch (error) {
                console.warn('⚠️ AI description generation failed:', error);
                generatedVariation.description = `Generated ${targetBreed.name} with ${validCoat.coat_name} coat`;
              }

              // Save to database immediately
              const imageId = await this.saveGeneratedImage(generatedVariation);
              
              const itemEndTime = Date.now();
              await this.supabase
                .from('batch_job_items')
                .update({
                  status: 'completed',
                  generated_image_id: imageId,
                  gemini_duration_ms: geminiDuration,
                  total_duration_ms: itemEndTime - itemStartTime,
                  completed_at: new Date().toISOString()
                })
                .eq('id', item.id);

              console.log(`✅ ITEM SUCCESS: Saved image ${imageId} with AI description`);
              return;
            }
          }
        }
      }

      // If we get here, generation failed
      const itemEndTime = Date.now();
      await this.supabase
        .from('batch_job_items')
        .update({
          status: 'failed',
          error_message: 'Failed to generate variation',
          total_duration_ms: itemEndTime - itemStartTime,
          completed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      console.log(`❌ ITEM FAILED: No variation generated`);

    } catch (error) {
      const itemEndTime = Date.now();
      await this.supabase
        .from('batch_job_items')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          total_duration_ms: itemEndTime - itemStartTime,
          completed_at: new Date().toISOString()
        })
        .eq('id', item.id);

      console.error(`🔥 ITEM EXCEPTION:`, error);
      throw error; // Re-throw to be handled by caller
    }
  }

  private async saveGeneratedImage(variation: any): Promise<string> {
    try {
      // Convert base64 to buffer for server-side upload
      const imageBuffer = Buffer.from(variation.imageData, 'base64');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `batch-variation-${timestamp}.png`;

      // Upload to Cloudinary using server-side method
      const cloudinaryResult = await uploadImageBufferToCloudinary(
        imageBuffer,
        filename,
        {
          tags: ['batch-generated', 'gemini-variation', 'admin-upload'],
          breed: variation.metadata.breed?.name,
          theme: variation.metadata.theme?.name,
          style: variation.metadata.style?.name
        }
      );

      // Save to database - match the actual schema from complete_schema.sql
      const { data: savedImage, error } = await this.supabase
        .from('image_catalog')
        .insert({
          filename: filename, // Required field
          original_filename: filename,
          file_size: cloudinaryResult.bytes,
          mime_type: 'image/png',
          storage_path: `cloudinary:${cloudinaryResult.public_id}`,
          public_url: cloudinaryResult.secure_url,
          prompt_text: variation.prompt,
          description: variation.description || `Batch generated variation: ${variation.metadata.variation_type}`,
          tags: variation.metadata.tags || ['batch-generated', 'gemini-variation'],
          breed_id: variation.metadata.breed_id || null,
          theme_id: variation.metadata.theme_id || null,
          style_id: variation.metadata.style_id || null,
          format_id: variation.metadata.format_id || null,
          coat_id: variation.metadata.coat_id || null,
          cloudinary_public_id: cloudinaryResult.public_id,
          cloudinary_version: cloudinaryResult.version?.toString(),
          cloudinary_signature: cloudinaryResult.signature,
          rating: 4,
          is_featured: false,
          is_public: true
        })
        .select('id')
        .single();

      if (error || !savedImage) {
        throw new Error(`Database save failed: ${error?.message}`);
      }

      return savedImage.id;
    } catch (error) {
      console.error('Failed to save generated image:', error);
      throw error;
    }
  }

  private async getImageAsBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    } catch (error) {
      console.error('Failed to fetch image:', error);
      throw error;
    }
  }

  private async updateJobStatus(jobId: string, status: string, updates: any = {}): Promise<void> {
    await this.supabase
      .from('batch_jobs')
      .update({
        status,
        ...updates
      })
      .eq('id', jobId);
  }

  private async updateJobProgress(jobId: string): Promise<void> {
    // Get current counts from items
    const { data: statusCounts } = await this.supabase
      .from('batch_job_items')
      .select('status')
      .eq('job_id', jobId);

    if (statusCounts) {
      const completed = statusCounts.filter(item => ['completed', 'failed'].includes(item.status)).length;
      const successful = statusCounts.filter(item => item.status === 'completed').length;
      const failed = statusCounts.filter(item => item.status === 'failed').length;

      await this.supabase
        .from('batch_jobs')
        .update({
          completed_items: completed,
          successful_items: successful,
          failed_items: failed
        })
        .eq('id', jobId);
    }
  }

  private async generateAIDescription(imageData: string, breed: any): Promise<string> {
    try {
      // Create a File object from the base64 image data
      const imageBuffer = Buffer.from(imageData, 'base64');
      const tempFile = new File([imageBuffer], 'temp.png', { type: 'image/png' });

      // Get personality traits from breed data if available
      const personalityTraits = breed.personality_traits ? 
        (Array.isArray(breed.personality_traits) ? breed.personality_traits : [breed.personality_traits]) : 
        undefined;

      console.log(`🧠 Generating description for ${breed.name} with traits:`, personalityTraits);

      // Use ImageDescriptionGenerator directly - same as the working API endpoint
      const description = await this.descriptionGenerator.generateDescriptionFromFile(
        tempFile,
        breed.name,
        personalityTraits
      );

      return description;
      
    } catch (error) {
      console.error('Failed to generate AI description:', error);
      throw error;
    }
  }
}