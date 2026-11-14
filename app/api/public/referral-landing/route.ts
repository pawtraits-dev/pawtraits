import { NextRequest, NextResponse } from 'next/server';
import { getRequester } from '@/lib/guest/access';
import { serviceClient } from '@/lib/qr/server';
import { referralEligible } from '@/lib/checkout/price-check';
import { isListed } from '@/lib/catalog/listing';
import { isUuid, normaliseCode, safeFirstName } from '@/lib/referrals/text';

export const dynamic = 'force-dynamic';

/**
 * GET /api/public/referral-landing?code=<CODE>[&d=<design id>]
 * For a friend arriving by a customer's link: is the code one we will honour, who is it from (first name only,
 * letters only) and which design should they land on.
 *   { valid: false }  invalid, not a registered customer's code, the visitor's own code, or the signed-in visitor
 *                     has already had their first-order discount. The site then carries on as normal.
 *   { valid: true, firstName, designId }
 * This only decides what to SHOW. The discount itself is still checked on the server at payment.
 * designId: the design in the link if it exists and is public; otherwise the most recent design the referrer bought.
 */
export async function GET(request: NextRequest) {
  const no = NextResponse.json({ valid: false }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const params = new URL(request.url).searchParams;
    const code = normaliseCode(params.get('code'));
    if (!code) return no;
    const db = serviceClient();

    const { data: owner } = await db.from('customers').select('id, first_name, email, is_registered').eq('personal_referral_code', code).maybeSingle();
    if (!owner || !owner.is_registered || !owner.email) return no;

    // Self-referral, or a friend who has already used a first-order discount: nothing to offer
    const { user } = await getRequester(request);
    if (user?.email) {
      if (user.email.toLowerCase() === String(owner.email).toLowerCase()) return no;
      if (!(await referralEligible(code, user.email))) return no;
    }

    const usable = async (id: string): Promise<string | null> => {
      const { data } = await db.from('image_catalog').select('id, is_public, is_customer_generated, tags').eq('id', id).maybeSingle();
      return data && data.is_public !== false && !data.is_customer_generated && isListed(data as any) ? data.id : null;
    };

    let designId: string | null = null;
    const wanted = params.get('d');
    if (isUuid(wanted)) designId = await usable(wanted);
    if (!designId) {
      // The referrer's most recent bought design (their own custom portraits count through the design they came from)
      const { data: orders } = await db.from('orders').select('id').eq('customer_email', owner.email).eq('payment_status', 'paid').order('created_at', { ascending: false }).limit(5);
      const ids = (orders ?? []).map((o: any) => o.id);
      if (ids.length) {
        const { data: items } = await db.from('order_items').select('image_id, order_id').in('order_id', ids);
        for (const orderId of ids) {
          for (const it of (items ?? []).filter((i: any) => i.order_id === orderId)) {
            if (!isUuid(it.image_id)) continue;
            designId = await usable(it.image_id);
            if (!designId) {
              const { data: custom } = await db.from('customer_custom_images').select('catalog_image_id').eq('id', it.image_id).maybeSingle();
              if (custom?.catalog_image_id) designId = await usable(custom.catalog_image_id);
            }
            if (designId) break;
          }
          if (designId) break;
        }
      }
    }

    return NextResponse.json({ valid: true, firstName: safeFirstName(owner.first_name), designId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.warn('referral landing lookup failed', e);
    return no;
  }
}
