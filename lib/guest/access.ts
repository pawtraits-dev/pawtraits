import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import type { User } from '@supabase/supabase-js';
import { VISITOR_COOKIE, VISITOR_MAX_AGE_S, validVisitorId, newVisitorId } from '@/lib/qr/attribution';

/**
 * Who is calling: a signed-in user, an anonymous guest (pt_vid cookie), or both.
 * The pt_vid cookie is shared with sticker-QR attribution, so a stall scan and the
 * previews that follow are tied to the same device.
 */
export interface Requester {
  user: User | null;
  guestId: string | null;
  /** true when we minted a new guest id that must be set on the response */
  newGuest: boolean;
}

export async function getRequester(request: NextRequest, opts: { createGuest?: boolean } = {}): Promise<Requester> {
  let user: User | null = null;
  try {
    const cookieStore = await cookies();
    const auth = createRouteHandlerClient({ cookies: () => cookieStore } as any);
    const { data } = await auth.auth.getUser();
    user = data.user ?? null;
  } catch {
    user = null;
  }
  let guestId = validVisitorId(request.cookies.get(VISITOR_COOKIE)?.value);
  let newGuest = false;
  if (!guestId && opts.createGuest) {
    guestId = newVisitorId();
    newGuest = true;
  }
  return { user, guestId, newGuest };
}

export function setGuestCookie(res: NextResponse, requester: Requester): NextResponse {
  if (requester.newGuest && requester.guestId) {
    res.cookies.set(VISITOR_COOKIE, requester.guestId, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: VISITOR_MAX_AGE_S,
    });
  }
  return res;
}

/** A custom image belongs to the caller if their email matches, or it was made on this device as a guest. */
export function canAccessCustomImage(
  row: { customer_email: string | null; guest_session_id?: string | null },
  requester: Requester
): boolean {
  if (requester.user?.email && row.customer_email && row.customer_email.toLowerCase() === requester.user.email.toLowerCase()) return true;
  if (requester.guestId && row.guest_session_id && row.guest_session_id === requester.guestId) return true;
  return false;
}

export function clientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null;
}
