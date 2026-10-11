import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin } from '@/lib/qr/server';
import { getSetting, setSetting } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';

const SIDES = ['pet', 'text'] as const;
type Side = (typeof SIDES)[number];

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

/** GET /api/admin/mugs/mockups — the blank mug photos the mug mockups are built on */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  return NextResponse.json({ photos: await getSetting('mug_mockup_photos') });
}

/**
 * POST /api/admin/mugs/mockups  FormData { side: 'pet' | 'text', file }
 *   pet  = mug with the handle on the RIGHT (shows the left half of the wrap: the pet and name)
 *   text = mug with the handle on the LEFT (shows the right half: heading and description)
 * Replaces that side's photo.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const form = await request.formData();
    const side = String(form.get('side') || '') as Side;
    const file = form.get('file');
    if (!SIDES.includes(side)) return NextResponse.json({ error: 'Choose which side this photo is' }, { status: 400 });
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) return NextResponse.json({ error: 'No photo' }, { status: 400 });
    const f = file as File;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return NextResponse.json({ error: 'Use a JPG, PNG or WebP photo' }, { status: 400 });
    if (f.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'Photo is over 15 MB' }, { status: 400 });

    configure();
    const buffer = Buffer.from(await f.arrayBuffer());
    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'pawtraits/mugs/mockups', public_id: `mug-${side}-side-${Date.now()}`, resource_type: 'image', tags: ['mug-mockup'] },
        (e, r) => (e ? reject(e) : resolve(r)),
      ).end(buffer);
    });

    const photos = { ...(await getSetting('mug_mockup_photos')) };
    photos[side] = { publicId: result.public_id, url: result.secure_url, width: result.width, height: result.height, uploadedAt: new Date().toISOString() };
    await setSetting('mug_mockup_photos', photos);
    return NextResponse.json({ photos });
  } catch (error) {
    console.error('Mug mockup upload failed:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
