/**
 * Social loop capture (server only). After a paid order, each line that is a customised portrait
 * becomes a social item: before (customer photo) + after (watermarked portrait), pet first name,
 * town + country. Then the automatic photo check runs. Called from the Stripe webhook in
 * `after()` so it never delays Stripe's reply. Never throws.
 */
import { serviceClient } from '@/lib/qr/server';
import { getSetting } from '@/lib/app-settings';
import { checkPhotos } from './photo-check';
import { cleanTown, countryLabel, petNames } from './privacy';
import { fillBatches } from './carousel';

const MAX_CHECK_ATTEMPTS = 3;

type Location = { town: string | null; country: string | null; source: 'billing' | 'shipping' | 'stall' | 'none'; channel: 'online' | 'stall'; stallName: string | null };

/** Cloudinary delivery URL for a public id, sized for checks and slides */
export function cldUrl(publicId: string, transform = 'c_limit,w_900,h_900/f_jpg,q_80'): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return cloud && publicId ? `https://res.cloudinary.com/${cloud}/image/upload/${transform}/${publicId}` : null;
}

const usablePublicId = (id: string | null | undefined) => (id && !['unknown', 'non-cloudinary'].includes(id) ? id : null);

/** Billing city/country from the Stripe charge, when the card form collected them */
async function billingFromStripe(chargeId: string | null | undefined): Promise<{ city: string | null; country: string | null } | null> {
  if (!chargeId || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const { stripe } = await import('@/lib/stripe-server');
    const charge = await stripe.charges.retrieve(chargeId);
    const a = charge.billing_details?.address;
    return a ? { city: a.city ?? null, country: a.country ?? null } : null;
  } catch (err) {
    console.warn('social: billing address lookup failed', err);
    return null;
  }
}

export async function resolveLocation(supabase: any, order: any, chargeId?: string | null): Promise<Location> {
  // Market orders: the stall's town (and name, for the caption)
  if (order.pos_location_id) {
    const { data: loc } = await supabase.from('stock_locations').select('name, town, country').eq('id', order.pos_location_id).maybeSingle();
    if (loc) {
      return { town: cleanTown(loc.town), country: countryLabel(loc.country) ?? 'UK', source: 'stall', channel: 'stall', stallName: loc.name ?? null };
    }
  }
  const billing = await billingFromStripe(chargeId);
  const billingTown = cleanTown(billing?.city);
  if (billingTown) return { town: billingTown, country: countryLabel(billing?.country), source: 'billing', channel: 'online', stallName: null };
  const shipTown = cleanTown(order.shipping_city);
  const shipCountry = countryLabel(order.shipping_city ? order.shipping_country : null) ?? countryLabel(billing?.country);
  if (shipTown) return { town: shipTown, country: shipCountry, source: 'shipping', channel: 'online', stallName: null };
  // No usable town: country only (a digital order with no address has no real delivery country)
  const billingCountry = countryLabel(billing?.country);
  const deliveryCountry = order.shipping_city || order.shipping_address_line_1 ? countryLabel(order.shipping_country) : null;
  const country = billingCountry ?? deliveryCountry;
  return { town: null, country, source: billingCountry ? 'billing' : deliveryCountry ? 'shipping' : 'none', channel: 'online', stallName: null };
}

/** Create social items for an order's customised portraits, then check them. Returns how many were added. */
export async function captureSocialItems(
  supabase: any,
  order: { id: string; customer_email?: string | null; pos_location_id?: string | null; shipping_city?: string | null; shipping_country?: string | null; shipping_address_line_1?: string | null; payment_status?: string | null },
  orderItems: { id: string; image_id: string }[],
  opts: { chargeId?: string | null } = {},
): Promise<number> {
  try {
    const ids = Array.from(new Set(orderItems.map(i => i.image_id).filter(Boolean)));
    if (!ids.length) return 0;
    const { data: customs } = await supabase.from('customer_custom_images')
      .select('id, catalog_image_id, pet_name, pet_image_url, pet_cloudinary_id, generated_image_url, generated_cloudinary_id, status, metadata')
      .in('id', ids);
    // Mugs (a 2:1 wrap, not a portrait) aren't featured
    const ready = (customs ?? []).filter((c: any) => c.generated_image_url && c.status !== 'failed' && c.metadata?.product !== 'mug');
    if (!ready.length) return 0;

    const email = order.customer_email?.trim().toLowerCase() || null;
    const { data: optOut } = email
      ? await supabase.from('social_opt_outs').select('email').eq('email', email).maybeSingle()
      : { data: null };
    const location = await resolveLocation(supabase, order, opts.chargeId);

    const rows = ready.map((c: any) => ({
      order_id: order.id,
      order_item_id: orderItems.find(i => i.image_id === c.id)?.id ?? null,
      custom_image_id: c.id,
      catalog_image_id: c.catalog_image_id ?? null,
      customer_email: email,
      pet_name: petNames((c.metadata?.all_pet_names as string[] | undefined) ?? [c.pet_name]),
      before_public_id: usablePublicId(c.pet_cloudinary_id),
      before_url: c.pet_image_url,
      after_public_id: c.generated_cloudinary_id ?? null,
      after_url: c.generated_image_url,
      town: location.town,
      country: location.country,
      location_source: location.source,
      channel: location.channel,
      stall_name: location.stallName,
      opted_out: !!optOut,
    })).filter((r: any) => r.before_url);

    // Already featured as a free preview: it's now a purchase (order, location, time); keeps its check result
    const { data: previews } = await supabase.from('social_items').select('id, custom_image_id')
      .in('custom_image_id', rows.map((r: any) => r.custom_image_id)).eq('source', 'preview');
    for (const pv of previews ?? []) {
      const r = rows.find((x: any) => x.custom_image_id === pv.custom_image_id);
      await supabase.from('social_items').update({
        source: 'purchase', order_id: r.order_id, order_item_id: r.order_item_id, customer_email: r.customer_email ?? undefined,
        town: r.town, country: r.country, location_source: r.location_source, channel: r.channel, stall_name: r.stall_name,
        paid_at: new Date().toISOString(), ...(r.opted_out ? { opted_out: true } : {}),
      }).eq('id', pv.id);
    }

    // One item per portrait: buying the same portrait again doesn't feature it twice
    const { data: inserted, error } = await supabase.from('social_items')
      .upsert(rows, { onConflict: 'custom_image_id', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;

    for (const item of inserted ?? []) await checkSocialItem(supabase, item.id);
    await fillBatches(supabase);
    return inserted?.length ?? 0;
  } catch (err) {
    console.error('social capture failed', err);
    return 0;
  }
}

/** Run (or re-run) the photo check on one item. Opted-out and hidden items aren't checked. */
export async function checkSocialItem(supabase: any, itemId: string): Promise<'approved' | 'rejected' | 'error' | 'skipped'> {
  const { data: item } = await supabase.from('social_items')
    .select('id, before_public_id, before_url, after_public_id, after_url, check_attempts, opted_out, hidden')
    .eq('id', itemId).maybeSingle();
  if (!item || item.opted_out || item.hidden) return 'skipped';

  const enabled = await getSetting('social_photo_check_enabled');
  const result = enabled
    ? await checkPhotos(
        (item.before_public_id && cldUrl(item.before_public_id)) || item.before_url,
        (item.after_public_id && cldUrl(item.after_public_id)) || item.after_url,
      )
    : { status: 'approved' as const, reasons: [] };

  await supabase.from('social_items').update({
    check_status: result.status,
    check_reasons: result.reasons,
    check_attempts: (item.check_attempts ?? 0) + 1,
    checked_at: new Date().toISOString(),
  }).eq('id', item.id);
  return result.status;
}

/** Retry checks that errored (e.g. the AI service was down). Returns how many were retried. */
export async function retryFailedChecks(limit = 20): Promise<number> {
  const supabase = serviceClient();
  const { data } = await supabase.from('social_items').select('id')
    .in('check_status', ['pending', 'error']).lt('check_attempts', MAX_CHECK_ATTEMPTS)
    .eq('opted_out', false).eq('hidden', false)
    .order('paid_at', { ascending: true }).limit(limit);
  for (const row of data ?? []) await checkSocialItem(supabase, row.id);
  if (data?.length) await fillBatches(supabase);
  return data?.length ?? 0;
}

const PREVIEW_COLUMNS = 'id, customer_email, catalog_image_id, pet_name, pet_image_url, pet_cloudinary_id, generated_image_url, generated_cloudinary_id, status, metadata, rating, generated_at, created_at';

function previewRow(c: any, optedOut: boolean) {
  return {
    source: 'preview',
    order_id: null,
    custom_image_id: c.id,
    catalog_image_id: c.catalog_image_id ?? null,
    customer_email: c.customer_email?.trim().toLowerCase() || null,
    pet_name: petNames((c.metadata?.all_pet_names as string[] | undefined) ?? [c.pet_name]),
    before_public_id: usablePublicId(c.pet_cloudinary_id),
    before_url: c.pet_image_url,
    after_public_id: c.generated_cloudinary_id ?? null,
    after_url: c.generated_image_url,
    location_source: 'none',
    channel: 'online',
    opted_out: optedOut,
    paid_at: c.generated_at || c.created_at,
  };
}

/**
 * Free previews as content (only while "Include free previews" is on): completed customisations
 * become 'preview' items and are photo-checked. Customer ratings of 1–2 stars are skipped.
 * ids: specific customisations (called when one finishes); otherwise the latest `days` are imported.
 * Returns how many were added. Never throws.
 */
export async function capturePreviews(opts: { ids?: string[]; days?: number; limit?: number; force?: boolean } = {}): Promise<number> {
  try {
    if (!opts.force && !(await getSetting('social_include_previews'))) return 0;
    const supabase = serviceClient();
    let q = supabase.from('customer_custom_images').select(PREVIEW_COLUMNS)
      .eq('status', 'complete').not('generated_image_url', 'is', null)
      .order('created_at', { ascending: false }).limit(opts.limit ?? 50);
    if (opts.ids?.length) q = q.in('id', opts.ids);
    else q = q.gte('created_at', new Date(Date.now() - (opts.days ?? 30) * 86400_000).toISOString());
    const { data: customs, error } = await q;
    if (error) throw error;

    const candidates = (customs ?? []).filter((c: any) => c.pet_image_url && !(c.rating && c.rating <= 2) && c.metadata?.product !== 'mug');
    if (!candidates.length) return 0;
    const { data: existing } = await supabase.from('social_items').select('custom_image_id').in('custom_image_id', candidates.map((c: any) => c.id));
    const have = new Set((existing ?? []).map((e: any) => e.custom_image_id));
    const fresh = candidates.filter((c: any) => !have.has(c.id));
    if (!fresh.length) return 0;

    const emails = Array.from(new Set(fresh.map((c: any) => c.customer_email?.trim().toLowerCase()).filter(Boolean))) as string[];
    const { data: outs } = emails.length ? await supabase.from('social_opt_outs').select('email').in('email', emails) : { data: [] as any[] };
    const optedOut = new Set((outs ?? []).map((o: any) => o.email));

    const { data: inserted, error: insErr } = await supabase.from('social_items')
      .upsert(fresh.map((c: any) => previewRow(c, optedOut.has(c.customer_email?.trim().toLowerCase()))), { onConflict: 'custom_image_id', ignoreDuplicates: true })
      .select('id');
    if (insErr) throw insErr;
    for (const item of inserted ?? []) await checkSocialItem(supabase, item.id);
    await fillBatches(supabase);
    return inserted?.length ?? 0;
  } catch (err) {
    console.error('social preview capture failed', err);
    return 0;
  }
}
