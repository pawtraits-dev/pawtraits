import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CloudinaryImageService } from '@/lib/cloudinary';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Increase body size limit to 10MB for image uploads
// Base64 encoding adds ~33% overhead, so 4MB image becomes ~5.3MB
export const maxDuration = 60; // Allow up to 60 seconds for processing

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/admin/catalog/save
 *
 * Admin-only endpoint to save curated reference images to catalog
 * Uploads to Cloudinary and saves metadata to database
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📥 [ADMIN CATALOG SAVE] Request received');

    // Parse FormData instead of JSON to handle larger payloads
    const formData = await request.formData();

    // Extract fields from FormData
    const imageFile = formData.get('image') as File;
    const imageBase64 = formData.get('imageBase64') as string;
    const filename = formData.get('filename') as string;
    const marketingDescription = formData.get('marketingDescription') as string;
    const compositionAnalysis = formData.get('compositionAnalysis') as string;
    const isMultiSubject = formData.get('isMultiSubject') === 'true';
    const subjects = JSON.parse(formData.get('subjects') as string);
    const themeId = formData.get('themeId') as string;
    const styleId = formData.get('styleId') as string;
    const formatId = formData.get('formatId') as string;
    const tags = formData.get('tags') ? JSON.parse(formData.get('tags') as string) : [];
    const isFeatured = formData.get('isFeatured') === 'true';
    const isPublic = formData.get('isPublic') !== 'false';
    const variationPromptTemplate = formData.get('variationPromptTemplate') as string;
    const compositionMetadata = formData.get('compositionMetadata') ? JSON.parse(formData.get('compositionMetadata') as string) : null;

    // Validate required fields
    if ((!imageBase64 && !imageFile) || !filename || !marketingDescription) {
      console.log('❌ [ADMIN CATALOG SAVE] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: image (file or base64), filename, marketingDescription' },
        { status: 400 }
      );
    }

    if (!themeId || !styleId || !formatId) {
      console.log('❌ [ADMIN CATALOG SAVE] Missing metadata fields');
      return NextResponse.json(
        { error: 'Missing required metadata: themeId, styleId, formatId' },
        { status: 400 }
      );
    }

    if (!subjects || subjects.length === 0 || !subjects[0].breedId) {
      console.log('❌ [ADMIN CATALOG SAVE] Missing subject breed');
      return NextResponse.json(
        { error: 'At least one subject with breed is required' },
        { status: 400 }
      );
    }

    // Initialize services
    const cloudinaryService = new CloudinaryImageService();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get primary subject for metadata
    const primarySubject = subjects.find((s: any) => s.isPrimary) || subjects[0];

    // Get names for Cloudinary metadata
    const { data: breed } = await supabase
      .from('breeds')
      .select('name')
      .eq('id', primarySubject.breedId)
      .single();

    const { data: theme } = await supabase
      .from('themes')
      .select('name')
      .eq('id', themeId)
      .single();

    const { data: style } = await supabase
      .from('styles')
      .select('name')
      .eq('id', styleId)
      .single();

    const { data: format } = await supabase
      .from('formats')
      .select('name')
      .eq('id', formatId)
      .single();

    console.log('📤 [ADMIN CATALOG SAVE] Uploading to Cloudinary...');

    // Upload to Cloudinary - handle both File and base64
    let imageBuffer: Buffer;
    if (imageFile) {
      // Convert File to Buffer
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      console.log('📦 [ADMIN CATALOG SAVE] Using uploaded file, size:', imageFile.size);
    } else {
      // Convert base64 to Buffer
      const imageData = imageBase64.split(',')[1]; // Remove data:image/png;base64, prefix
      imageBuffer = Buffer.from(imageData, 'base64');
      console.log('📦 [ADMIN CATALOG SAVE] Using base64 data, size:', imageBuffer.length);
    }

    const uploadResult = await cloudinaryService.uploadAndProcessImage(
      imageBuffer,
      filename,
      {
        breed: breed?.name || 'unknown',
        theme: theme?.name || 'unknown',
        style: style?.name || 'unknown',
        format: format?.name || 'unknown',
        tags: tags || []
      }
    );

    if (!uploadResult) {
      console.error('❌ [ADMIN CATALOG SAVE] Cloudinary upload failed');
      throw new Error('Failed to upload image to Cloudinary');
    }

    console.log('✅ [ADMIN CATALOG SAVE] Uploaded to Cloudinary:', uploadResult.public_id);

    // Get public URL
    const publicUrl = cloudinaryService.getPublicVariantUrl(
      uploadResult.public_id,
      'catalog_watermarked'
    );

    // Calculate file size
    const fileSize = imageFile ? imageFile.size : imageBuffer.length;

    // Prepare catalog entry
    const catalogEntry = {
      filename: filename,
      original_filename: filename,
      file_size: fileSize,
      mime_type: 'image/png',
      storage_path: uploadResult.public_id,
      public_url: publicUrl,
      prompt_text: variationPromptTemplate || '',
      description: marketingDescription,
      tags: tags || [],
      breed_id: primarySubject.breedId,
      theme_id: themeId,
      style_id: styleId,
      format_id: formatId,
      coat_id: primarySubject.coatId || null,
      is_featured: isFeatured || false,
      is_public: isPublic !== false, // Default to true
      cloudinary_public_id: uploadResult.public_id,
      cloudinary_version: uploadResult.version,
      cloudinary_signature: uploadResult.cloudinary_signature,
      image_variants: uploadResult.variants,
      generation_parameters: {
        composition_analysis: compositionAnalysis,
        composition_metadata: compositionMetadata,
        is_multi_subject: isMultiSubject,
        subjects: subjects,
        variation_prompt_template: variationPromptTemplate
      }
    };

    console.log('💾 [ADMIN CATALOG SAVE] Saving to database...');

    // Save to database
    const { data: savedImage, error: saveError } = await supabase
      .from('image_catalog')
      .insert(catalogEntry)
      .select()
      .single();

    if (saveError) {
      console.error('❌ [ADMIN CATALOG SAVE] Database save failed:', saveError);
      throw new Error(`Database save failed: ${saveError.message}`);
    }

    console.log('✅ [ADMIN CATALOG SAVE] Saved to database:', savedImage.id);

    // Create entries in image_catalog_subjects junction table for multi-breed filtering
    console.log('💾 [ADMIN CATALOG SAVE] Creating subject entries...');
    const subjectEntries = subjects.map((subject: any) => ({
      image_catalog_id: savedImage.id,
      subject_order: subject.subjectOrder,
      is_primary: subject.isPrimary,
      breed_id: subject.breedId,
      coat_id: subject.coatId || null,
      outfit_id: subject.outfitId || null,
      position: subject.position,
      size_prominence: subject.sizeProminence,
      pose_description: subject.poseDescription,
      gaze_direction: subject.gazeDirection || null,
      expression: subject.expression || null
    }));

    const { data: subjectRows, error: subjectError } = await supabase
      .from('image_catalog_subjects')
      .insert(subjectEntries)
      .select();

    if (subjectError) {
      console.error('❌ [ADMIN CATALOG SAVE] Subject entries failed:', subjectError);
      // Don't fail the whole save if this fails - subjects are also in generation_parameters
      console.log('⚠️ [ADMIN CATALOG SAVE] Continuing without subject entries');
    } else {
      console.log(`✅ [ADMIN CATALOG SAVE] Created ${subjectRows.length} subject entries`);
    }

    return NextResponse.json({
      success: true,
      imageId: savedImage.id,
      publicUrl,
      cloudinaryPublicId: uploadResult.public_id,
      metadata: {
        isMultiSubject,
        subjectCount: subjects.length,
        primaryBreed: breed?.name,
        theme: theme?.name,
        style: style?.name,
        format: format?.name
      }
    });

  } catch (error: any) {
    console.error('❌ [ADMIN CATALOG SAVE] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Catalog save failed',
        message: error.message || 'An error occurred while saving to catalog.',
        details: error.stack
      },
      { status: 500 }
    );
  }
}
