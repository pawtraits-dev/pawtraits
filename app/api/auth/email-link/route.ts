/**
 * POST /api/auth/email-link  { email, returnTo? }
 * "Email me a sign-in link": the main way back in for customers, many of whom checked out as
 * guests and never set a password. Reuses the account-claim link (POST-only exchange at
 * /auth/claim, so inbox link scanners can't use it up), valid for 1 hour.
 * Always answers the same way, so it can't be used to find out who has an account.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { createClaimToken } from '@/lib/guest/account';
import { sendMessageImmediate } from '@/lib/messaging/message-service';

export const dynamic = 'force-dynamic';

const OK = { ok: true, message: 'If there’s an account for that email, a sign-in link is on its way. It works for 1 hour.' };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const returnTo = typeof body?.returnTo === 'string' && body.returnTo.startsWith('/') && !body.returnTo.startsWith('//') ? body.returnTo : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });

  const admin = serviceClient();
  const { data: profile } = await admin
    .from('user_profiles').select('id, user_id, customer_id, first_name, user_type').ilike('email', email).maybeSingle();
  if (!profile?.user_id) return NextResponse.json(OK);

  // At most 3 links per email per 15 minutes
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await admin.from('account_claim_tokens').select('id', { count: 'exact', head: true })
    .eq('email', email).is('order_id', null).gte('created_at', since);
  if ((count ?? 0) >= 3) return NextResponse.json(OK);

  try {
    const token = await createClaimToken(admin, { userId: profile.user_id, customerId: profile.customer_id ?? null, email, orderId: null, expiresInHours: 1 });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const url = `${baseUrl}/auth/claim?t=${encodeURIComponent(token)}&login=1${returnTo ? `&next=${encodeURIComponent(returnTo)}` : ''}`;
    const name = profile.first_name ? `Hi ${escapeHtml(profile.first_name)},` : 'Hi,';
    await sendMessageImmediate({
      channel: 'email',
      recipientEmail: email,
      subject: 'Your Pawtraits sign-in link',
      body: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1d1828">
        <p>${name}</p>
        <p>Tap the button to sign in to Pawtraits. The link works for 1 hour.</p>
        <p style="margin:28px 0"><a href="${url}" style="background:#7c3aed;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold;display:inline-block">Sign in to Pawtraits</a></p>
        <p style="color:#5f5870;font-size:13px">Didn’t ask for this? You can ignore this email; nobody can sign in without it.</p>
      </div>`,
    });
  } catch (e) {
    console.error('email-link failed', e);
  }
  return NextResponse.json(OK);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
