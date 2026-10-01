/**
 * POST   /api/admin/quizzes/[id]/questions/[questionId]/image — multipart `file` (jpg/png/webp, ≤ 10 MB)
 *        Uploads the question's base picture to Cloudinary at
 *        quiz/<slug>_<animal>/<questionId>/base (spec 5.8 naming) and stores the public id.
 * DELETE same path — clears the picture (placeholder shows).
 */
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAdmin, serviceClient } from '@/lib/qr/server';
import { questionImageUrl } from '@/lib/quiz/server';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string; questionId: string }> };

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

async function loadQuestion(id: string, questionId: string) {
  const { data } = await serviceClient().from('quiz_questions')
    .select('id, quiz_id, quizzes:quiz_id (slug, animal_type)')
    .eq('id', questionId).eq('quiz_id', id).maybeSingle();
  return data as any;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id, questionId } = await params;

  const q = await loadQuestion(id, questionId);
  if (!q) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a picture to upload' }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: 'Use a JPG, PNG or WebP picture' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Picture must be 10 MB or smaller' }, { status: 400 });

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: 'Cloudinary is not configured' }, { status: 500 });
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });

  const folder = `quiz/${q.quizzes.slug}_${q.quizzes.animal_type}/${questionId}`;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { public_id: 'base', folder, overwrite: true, invalidate: true, resource_type: 'image', tags: ['quiz', q.quizzes.slug, q.quizzes.animal_type] },
        (err, res) => (err ? reject(err) : resolve(res)),
      ).end(buffer);
    });

    const supabase = serviceClient();
    const { data, error } = await supabase.from('quiz_questions')
      .update({ image_public_id: uploaded.public_id, updated_at: new Date().toISOString() })
      .eq('id', questionId).select('*').single();
    if (error) throw error;
    await supabase.from('quizzes').update({ has_unpublished_changes: true, updated_at: new Date().toISOString() }).eq('id', id);
    return NextResponse.json({ ...data, image_url: `${questionImageUrl(data.image_public_id, 400)}?v=${uploaded.version}` });
  } catch (err) {
    console.error('quiz picture upload failed', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id, questionId } = await params;
  const supabase = serviceClient();
  const { data, error } = await supabase.from('quiz_questions')
    .update({ image_public_id: null, updated_at: new Date().toISOString() })
    .eq('id', questionId).eq('quiz_id', id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  await supabase.from('quizzes').update({ has_unpublished_changes: true, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ ...data, image_url: null });
}
