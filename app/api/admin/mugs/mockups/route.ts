import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin } from '@/lib/qr/server';
import { getSetting, setSetting } from '@/lib/app-settings';
import { serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';

const SIDES = ['pet', 'text'] as const;
type Side = (typeof SIDES)[number];

function configure() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
  }
}

/** GET /api/admin/mugs/mockups — the blank mug photos, plus the latest mug wrap to preview them with */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { data: latest } = await serviceClient().from('mug_generations').select('composite_print_url')
    .eq('status', 'complete').not('composite_print_url', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  // Stored wraps are customer-custom-images/mugs/<id>: the public id from the URL
  const sampleWrap = latest?.composite_print_url?.match(/\/image\/upload\/(?:v\d+\/)?(customer-custom-images\/mugs\/[^.?]+)/)?.[1] ?? null;
  return NextResponse.json({ photos: await getSetting('mug_mockup_photos'), sampleWrap });
}

/** PATCH { side, face: { x, y, w, h } (fractions 0–1), background?: 'e5e5e5' } — where the mug's face is in that photo */
export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { side, face, background } = await request.json().catch(() => ({}));
  if (!SIDES.includes(side)) return NextResponse.json({ error: 'Unknown side' }, { status: 400 });
  const ok = face && ['x', 'y', 'w', 'h'].every((k) => typeof face[k] === 'number' && face[k] >= 0 && face[k] <= 1);
  if (!ok) return NextResponse.json({ error: 'Face must be x, y, w, h between 0 and 1' }, { status: 400 });
  const photos = { ...(await getSetting('mug_mockup_photos')) };
  if (!photos[side as Side]) return NextResponse.json({ error: 'Upload a photo first' }, { status: 400 });
  photos[side as Side] = { ...photos[side as Side]!, face: { x: face.x, y: face.y, w: face.w, h: face.h }, ...(typeof background === 'string' && /^[0-9a-f]{6}$/i.test(background) ? { background } : {}) };
  await setSetting('mug_mockup_photos', photos);
  return NextResponse.json({ photos });
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
