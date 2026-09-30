/**
 * Create order_items for a paid order (called from the Stripe webhook).
 *
 * Source of truth is the server-side basket snapshot in pending_checkouts (written when the
 * PaymentIntent is created); Stripe metadata (max 3 items) is only a fallback for intents
 * created before this change. Idempotent: returns existing items if already created.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOrderImage, buildPrintFiles } from './order-image';

export interface CartSnapshotItem {
  productId: string;          // products.id, or "stall_print_S|M|L" for stall take-home
  imageId: string;            // image_catalog.id or customer_custom_images.id
  imageTitle: string;
  quantity: number;
  unitPrice: number;          // pence
  originalPrice?: number;
}

export async function loadCartSnapshot(supabase: SupabaseClient, paymentIntentId: string, metadata: Record<string, string>) {
  const { data } = await supabase
    .from('pending_checkouts')
    .select('cart, fulfillment, guest_session_id, consent, client')
    .eq('payment_intent_id', paymentIntentId)
    .maybeSingle();
  if (data?.cart && Array.isArray(data.cart) && data.cart.length) {
    return { items: data.cart as CartSnapshotItem[], fulfillment: data.fulfillment as string, guestSessionId: data.guest_session_id as string | null, consent: data.consent, client: data.client };
  }
  // Legacy fallback: Stripe metadata (first 3 items only)
  const items: CartSnapshotItem[] = [];
  for (let i = 1; i <= 3; i++) {
    const imageId = metadata[`item${i}_id`];
    if (!imageId) continue;
    items.push({
      productId: metadata[`item${i}_product_id`] || 'unknown',
      imageId,
      imageTitle: metadata[`item${i}_title`] || 'Pawtrait',
      quantity: parseInt(metadata[`item${i}_qty`] || '1', 10),
      unitPrice: parseInt(metadata[`item${i}_unit_price`] || '0', 10),
      originalPrice: metadata[`item${i}_original_price`] ? parseInt(metadata[`item${i}_original_price`], 10) : undefined,
    });
  }
  if (parseInt(metadata.cartItemCount || '0', 10) > items.length) {
    console.error(`⚠️ Order ${paymentIntentId}: basket had ${metadata.cartItemCount} items but only ${items.length} recoverable from metadata`);
  }
  return { items, fulfillment: 'ship', guestSessionId: null, consent: null, client: null };
}

export async function createOrderItems(
  supabase: SupabaseClient,
  order: { id: string; fulfillment_type?: string | null },
  items: CartSnapshotItem[]
): Promise<any[]> {
  const { data: existing } = await supabase.from('order_items').select('*').eq('order_id', order.id);
  if (existing && existing.length) return existing;

  const realProductIds = Array.from(new Set(items.map(i => i.productId).filter(id => /^[0-9a-f-]{36}$/i.test(id))));
  const { data: products } = realProductIds.length
    ? await supabase.from('products').select('*, medium:media(*), format:formats(*)').in('id', realProductIds)
    : { data: [] as any[] };
  const productById = new Map((products ?? []).map((p: any) => [p.id, p]));

  const rows: any[] = [];
  for (const item of items) {
    const stall = /^stall_print_([SML])$/.exec(item.productId);
    const product = productById.get(item.productId) as any;
    const productData = stall
      ? { product_type: 'stall_print', fulfillment_method: 'collected', size_code: stall[1] }
      : product ?? { product_type: 'physical_print', missing_product: item.productId };

    const img = await resolveOrderImage(supabase, item.imageId);
    if (!img) console.error(`❌ Order ${order.id}: image ${item.imageId} not found in catalogue or custom images`);

    const isDigital = productData.product_type === 'digital_download';
    const needsPrintFile = !stall && !isDigital && order.fulfillment_type !== 'collected';
    let printUrl: string | null = null;
    let selfPrintUrl: string | null = null;
    let printMeta: Record<string, any> | null = null;
    if (needsPrintFile && img) {
      try {
        // Cropped to this product's shape at 300 dpi (S/L are 3:4 crops of the 2:3 reference)
        const files = await buildPrintFiles(img, productData, order.id);
        printUrl = files.printUrl;
        selfPrintUrl = files.selfPrintUrl;
        printMeta = files.meta;
      } catch (e) {
        console.error(`❌ Order ${order.id}: could not build print URL for ${item.imageId}`, e);
      }
    }

    rows.push({
      order_id: order.id,
      product_id: item.productId,
      image_id: item.imageId,
      image_ids: null,
      image_title: item.imageTitle?.slice(0, 200) || 'Pawtrait',
      image_url: img?.previewUrl ?? '',
      print_image_url: printUrl,
      self_print_file_url: selfPrintUrl,
      print_file_meta: printMeta,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      original_price: item.originalPrice ?? item.unitPrice,
      total_price: item.unitPrice * item.quantity,
      product_data: productData,
      is_physical: !isDigital,
      is_digital: isDigital,
    });
  }

  let { data: inserted, error } = await supabase.from('order_items').insert(rows).select('*');
  if (error && /self_print_file_url|print_file_meta/.test(error.message || '')) {
    // Print-crop migration not run yet — never lose the order lines over it
    console.error('⚠️ order_items print-file columns missing — run db/migrations/2026-09-30-print-crops.sql');
    ({ data: inserted, error } = await supabase.from('order_items')
      .insert(rows.map(({ self_print_file_url, print_file_meta, ...rest }) => rest)).select('*'));
  }
  if (error) {
    console.error(`❌ Failed to create order items for ${order.id}`, error);
    throw error;
  }
  return inserted ?? [];
}
