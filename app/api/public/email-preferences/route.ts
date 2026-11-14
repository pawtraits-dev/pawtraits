/**
 * The email preferences page's API (lib/marketing/preferences.ts). Two ways in, no other:
 *   a signed link  ?p=<preference id>&t=<signature>   (from our marketing emails; the address is never in the link)
 *   a signed-in customer  ?me=1                        (their own address, from the account area)
 * GET   → { status: 'subscribed' | 'unsubscribed' | 'none', topics, maskedEmail }
 * POST  { p?, t?, me?, action: 'save', topics } | { action: 'stop' } | { action: 'subscribe' }
 *   save       the three switches (all off = unsubscribe; something on = they have chosen to hear from us)
 *   stop       stop all emails
 *   subscribe  "Yes please": all three on (a deliberate opt-in; signed-in customers with no row yet)
 * Bad link: 400, with nothing revealed about whether an address exists.
 */
import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/qr/server';
import { getRequester } from '@/lib/guest/access';
import { ALL_TOPICS_ON, getPreferences, getPreferencesById, maskEmail, normaliseEmail, setTopics, subscribe, unsubscribe, verifyPreferenceToken, type PreferenceRow } from '@/lib/marketing/preferences';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const BAD = () => NextResponse.json({ error: 'This link has expired or is incomplete.' }, { status: 400, headers: NO_STORE });

/** Who is this about? the link's row, or the signed-in customer's own address */
async function resolve(req: NextRequest, input: { p?: unknown; t?: unknown; me?: unknown }): Promise<{ email: string; mode: 'link' | 'account' } | NextResponse> {
  if (input.me) {
    const { user } = await getRequester(req);
    const email = normaliseEmail(user?.email);
    return email ? { email, mode: 'account' } : NextResponse.json({ error: 'Please sign in first.' }, { status: 401, headers: NO_STORE });
  }
  if (!verifyPreferenceToken(input.p, input.t)) return BAD();
  const row = await getPreferencesById(serviceClient(), input.p as string);
  return row ? { email: row.email, mode: 'link' } : BAD();
}

const view = (email: string, row: PreferenceRow | null) => ({
  status: row ? row.status : 'none',
  topics: row && row.status === 'subscribed' ? row.topics : { new_designs: false, pet_days: false, offers: false },
  maskedEmail: maskEmail(email),
});

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const who = await resolve(req, { p: sp.get('p'), t: sp.get('t'), me: sp.get('me') });
  if (who instanceof NextResponse) return who;
  const row = await getPreferences(serviceClient(), who.email);
  return NextResponse.json(view(who.email, row), { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const who = await resolve(req, body);
  if (who instanceof NextResponse) return who;
  const supabase = serviceClient();
  const source = who.mode === 'account' ? 'account' : 'preferences_page';
  try {
    if (body.action === 'stop') await unsubscribe(supabase, { email: who.email, source });
    else if (body.action === 'save') await setTopics(supabase, { email: who.email, topics: body.topics, source });
    else if (body.action === 'subscribe') await subscribe(supabase, { email: who.email, source, topics: ALL_TOPICS_ON });
    else return NextResponse.json({ error: 'Nothing to change' }, { status: 400, headers: NO_STORE });
    return NextResponse.json({ ok: true, ...view(who.email, await getPreferences(supabase, who.email)) }, { headers: NO_STORE });
  } catch (e) {
    console.error('email preferences save failed', e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers: NO_STORE });
  }
}
