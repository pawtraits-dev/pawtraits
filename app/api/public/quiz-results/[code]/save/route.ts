/**
 * POST /api/public/quiz-results/[code]/save  { email? }
 * "Save Biscuit's Pawsonality".
 * - Signed in: links the result to the account and saves the type on the pet (creating the pet
 *   if they don't have one by that name). → { saved: 'pet', petName }
 * - Not signed in: makes sure there's a customer account for the email (no password; same as
 *   guest checkout), records the email on the result, and emails a sign-in link that brings them
 *   back here with ?save=1, where the page calls this again signed in. → { saved: 'emailed' }
 * Limit: 3 emails per address per 15 minutes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { sessionUserId } from '@/lib/quiz/server';
import { createClaimToken, ensureCustomerAccount } from '@/lib/guest/account';
import { sendMessageImmediate } from '@/lib/messaging/message-service';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9]{8,12}$/.test(code)) return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const supabase = serviceClient();

  const { data: result } = await supabase.from('quiz_results')
    .select('id, share_code, pet_name, animal_type, breed_id, result_type, quiz_type, user_id, pet_id')
    .eq('share_code', code).maybeSingle();
  if (!result) return NextResponse.json({ error: 'Result not found' }, { status: 404 });

  try {
    const userId = await sessionUserId();
    if (userId) {
      const petId = await savePet(userId, result);
      await supabase.from('quiz_results').update({ user_id: userId, pet_id: petId }).eq('id', result.id);
      return NextResponse.json({ saved: 'pet', petName: result.pet_name });
    }

    const email = String(body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });

    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabase.from('account_claim_tokens').select('id', { count: 'exact', head: true })
      .eq('email', email).is('order_id', null).gte('created_at', since);
    if ((count ?? 0) >= 3) return NextResponse.json({ saved: 'emailed' });

    const account = await ensureCustomerAccount(supabase, { email });
    await supabase.from('quiz_results').update({ email, user_id: account.userId }).eq('id', result.id);

    const token = await createClaimToken(supabase, { userId: account.userId, customerId: account.customerId, email, orderId: null, expiresInHours: 72 });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const next = `/quiz/${result.quiz_type}/r/${result.share_code}?save=1`;
    const url = `${baseUrl}/auth/claim?t=${encodeURIComponent(token)}&login=1&next=${encodeURIComponent(next)}`;
    const pet = escapeHtml(result.pet_name);
    await sendMessageImmediate({
      channel: 'email',
      recipientEmail: email,
      subject: `${result.pet_name}'s Pawsonality is ready to save`,
      body: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1d1828">
        <p>Hi,</p>
        <p>Tap the button to save ${pet}'s Pawsonality to your Pawtraits account. You'll be signed in, no password needed. The link works for 3 days.</p>
        <p style="margin:28px 0"><a href="${url}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold;display:inline-block">Save ${pet}'s Pawsonality</a></p>
        <p style="color:#5f5870;font-size:13px">Didn't ask for this? You can ignore this email.</p>
      </div>`,
    });
    return NextResponse.json({ saved: 'emailed' });
  } catch (err) {
    console.error('quiz save failed', err);
    return NextResponse.json({ error: 'Could not save just now. Please try again.' }, { status: 500 });
  }
}

/** The pet with this name (any case) on the account, updated with the type; created if missing */
async function savePet(userId: string, r: { id: string; pet_name: string; animal_type: string; breed_id: string | null; result_type: string; pet_id: string | null }) {
  const supabase = serviceClient();
  const fields = { pawsonality_type: r.result_type, pawsonality_result_id: r.id, updated_at: new Date().toISOString() };

  const { data: pets } = await supabase.from('pets').select('id, name, animal_type, breed_id')
    .eq('user_id', userId).eq('is_active', true);
  const match = (pets ?? []).find(p => p.id === r.pet_id)
    ?? (pets ?? []).find(p => p.name?.trim().toLowerCase() === r.pet_name.toLowerCase() && p.animal_type === r.animal_type);
  if (match) {
    await supabase.from('pets').update({ ...fields, ...(match.breed_id ? {} : { breed_id: r.breed_id }) }).eq('id', match.id);
    return match.id;
  }

  const { data: profile } = await supabase.from('user_profiles').select('customer_id').eq('user_id', userId).maybeSingle();
  const { data: pet, error } = await supabase.from('pets').insert({
    user_id: userId, customer_id: profile?.customer_id ?? null, name: r.pet_name, breed_id: r.breed_id,
    animal_type: r.animal_type, ...fields,
  }).select('id').single();
  if (error) throw error;
  return pet.id;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
