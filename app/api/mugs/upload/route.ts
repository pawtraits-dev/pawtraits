import { NextRequest, NextResponse } from 'next/server';
import { getRequester, setGuestCookie } from '@/lib/guest/access';
import { v2 as cloudinary } from 'cloudinary';


if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// POST /api/mugs/upload
// Accepts FormData with 'file' field.
// Dual-mode auth: authenticated users validated; guests (session_id) accepted.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Auth check — attempt session auth; fall back to guest mode
    // Signed-in customer or guest (device cookie, created if needed)
    const requester = await getRequester(request, { createGuest: true });

    // Upload to Cloudinary
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = file.type;

    const uploadResult = await cloudinary.uploader.upload(
      `data:${mimeType};base64,${base64}`,
      {
        folder: 'pawtraits/mugs/pet-photos',
        resource_type: 'image',
        type: 'upload',
        tags: ['mug-upload', 'pet-photo'],
        transformation: [{ width: 1600, height: 1600, crop: 'limit' }],
        overwrite: false,
      }
    );

    return setGuestCookie(NextResponse.json({
      public_id: uploadResult.public_id,
      url: uploadResult.secure_url,
      width: uploadResult.width,
      height: uploadResult.height,
    }), requester);

  } catch (error) {
    console.error('Mug photo upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
