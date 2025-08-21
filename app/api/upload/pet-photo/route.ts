import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { SecureFileValidator } from '@/lib/secure-file-validation';

const supabaseService = new SupabaseService();

// For storage operations, we need to use the service role to bypass RLS temporarily
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const storageClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const petId = formData.get('petId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!petId) {
      return NextResponse.json(
        { error: 'Pet ID is required' },
        { status: 400 }
      );
    }

    // SECURITY: Comprehensive file validation with magic number checking
    const validationResult = await SecureFileValidator.validateFile(file);
    
    if (!validationResult.isValid) {
      console.error('File validation failed:', validationResult.errors);
      return NextResponse.json(
        { 
          error: 'File validation failed',
          details: validationResult.errors,
          fileHash: validationResult.fileHash 
        },
        { status: 400 }
      );
    }

    // Log warnings but continue
    if (validationResult.warnings.length > 0) {
      console.warn('File validation warnings:', validationResult.warnings);
    }

    try {
      // Generate secure filename using our validator
      const secureFileName = SecureFileValidator.generateSecureFilename(file.name, userId, petId);
      const fileName = `pet-photos/${secureFileName}`;

      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to Supabase Storage using service role client
      const { data, error } = await storageClient.storage
        .from('pet-photos')
        .upload(fileName, buffer, {
          contentType: validationResult.detectedMimeType || file.type, // Use detected MIME type
          upsert: false,
          // Additional security metadata
          metadata: {
            fileHash: validationResult.fileHash,
            originalName: file.name.substring(0, 100), // Truncate for safety
            uploadedBy: userId,
            validationPassed: 'true'
          }
        });

      if (error) {
        console.error('Storage upload error:', error);
        return NextResponse.json(
          { error: 'Failed to upload file to storage', details: error.message },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: { publicUrl } } = storageClient.storage
        .from('pet-photos')
        .getPublicUrl(fileName);

      // Store photo record in database using service role to bypass RLS
      try {
        const { data: photoRecord, error: dbError } = await storageClient
          .from('pet_photos')
          .insert({
            pet_id: petId,
            photo_url: publicUrl,
            is_primary: false, // TODO: Allow setting primary photo
            description: file.name
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database insert error:', dbError);
          // Still return success since file was uploaded, but log the error
        } else {
          // Also update the pets table with photo URLs for compatibility with get_user_pets function
          try {
            // Get all photos for this pet using service role client
            const { data: allPhotos } = await storageClient
              .from('pet_photos')
              .select('photo_url, is_primary')
              .eq('pet_id', petId)
              .order('created_at', { ascending: false });

            if (allPhotos && allPhotos.length > 0) {
              const photoUrls = allPhotos.map((p: any) => p.photo_url);
              const primaryPhoto = allPhotos.find((p: any) => p.is_primary)?.photo_url || allPhotos[0].photo_url;

              // Update pets table with photo URLs using service role client
              await storageClient
                .from('pets')
                .update({
                  photo_urls: photoUrls,
                  primary_photo_url: primaryPhoto
                })
                .eq('id', petId);
            }
          } catch (updateError) {
            console.error('Error updating pets table with photo URLs:', updateError);
          }
        }

        return NextResponse.json({
          url: publicUrl,
          path: fileName,
          size: file.size,
          type: validationResult.detectedMimeType || file.type,
          photo_id: photoRecord?.id,
          fileHash: validationResult.fileHash,
          warnings: validationResult.warnings,
          securityValidated: true
        });

      } catch (dbInsertError) {
        console.error('Database insert operation error:', dbInsertError);
        // Still return success since file was uploaded
        return NextResponse.json({
          url: publicUrl,
          path: fileName,
          size: file.size,
          type: validationResult.detectedMimeType || file.type,
          fileHash: validationResult.fileHash,
          warnings: validationResult.warnings,
          securityValidated: true
        });
      }

    } catch (storageError) {
      console.error('Storage operation error:', storageError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Pet photo upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}