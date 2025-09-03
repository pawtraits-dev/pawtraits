import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Use service role for admin operations
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const { variations } = body;

    if (!variations || !Array.isArray(variations)) {
      return NextResponse.json({ error: 'Missing variations data' }, { status: 400 });
    }

    const uploadResults = [];

    for (const variation of variations) {
      try {
        // Upload buffer to Cloudinary
        const cloudinary = require('cloudinary').v2;
        
        const imageBuffer = Buffer.from(variation.imageData, 'base64');
        
        const cloudinaryResult = await new Promise((resolve, reject) => {
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
          ).end(imageBuffer);
        }) as any;
        
        if (cloudinaryResult) {
          // Save to database using the same API endpoint as admin generate
          const dbResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/images/cloudinary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cloudinary_public_id: cloudinaryResult.public_id,
              cloudinary_secure_url: cloudinaryResult.secure_url,
              cloudinary_signature: cloudinaryResult.signature,
              original_filename: variation.filename,
              file_size: cloudinaryResult.bytes,
              mime_type: 'image/png',
              width: cloudinaryResult.width,
              height: cloudinaryResult.height,
              prompt_text: variation.prompt,
              description: variation.description || `Generated variation: ${variation.metadata.variation_type}`,
              tags: variation.metadata.tags || [],
              breed_id: variation.metadata.breed_id || undefined,
              theme_id: variation.theme_id || undefined,
              style_id: variation.style_id || undefined,
              format_id: variation.metadata.format_id || undefined,
              coat_id: variation.metadata.coat_id || undefined,
              rating: variation.rating || 4,
              is_featured: variation.is_featured || false,
              is_public: variation.is_public !== false
            })
          });
          
          if (dbResponse.ok) {
            const dbResult = await dbResponse.json();
            uploadResults.push({
              success: true,
              variation_type: variation.metadata.variation_type,
              breed_name: variation.breed_name,
              coat_name: variation.coat_name,
              outfit_name: variation.outfit_name,
              format_name: variation.format_name,
              cloudinary_url: cloudinaryResult.secure_url,
              database_id: dbResult.id
            });
          } else {
            const errorData = await dbResponse.json().catch(() => ({ error: 'Unknown error' }));
            uploadResults.push({
              success: false,
              error: `Database save failed: ${errorData.error}`,
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
    console.error('Variation save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Variation save failed' },
      { status: 500 }
    );
  }
}