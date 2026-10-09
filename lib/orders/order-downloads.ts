/**
 * Downloads attached to orders, for the customer's order pages: one per design, from
 * digital_entitlements ('purchase' = bought as a download, 'welcome_gift' = free with a print).
 * The url is the entitlement-checked download (/api/downloads/[id]), which needs the signed-in owner.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface OrderDownload {
  id: string;
  imageId: string | null;
  source: 'purchase' | 'welcome_gift' | string;
  status: 'available' | 'locked' | string;
  url: string;
  downloadCount: number;
}

export async function downloadsForOrders(supabase: SupabaseClient, orderIds: string[]): Promise<Map<string, OrderDownload[]>> {
  const out = new Map<string, OrderDownload[]>();
  if (!orderIds.length) return out;
  const { data, error } = await supabase
    .from('digital_entitlements')
    .select('id, order_id, source, status, custom_image_id, catalog_image_id, download_count')
    .in('order_id', orderIds)
    .neq('status', 'revoked')
    .order('source', { ascending: true }); // 'purchase' before 'welcome_gift'
  if (error) {
    console.error('Order downloads lookup failed', error);
    return out;
  }
  for (const e of data ?? []) {
    const list = out.get(e.order_id) ?? [];
    list.push({
      id: e.id,
      imageId: e.custom_image_id || e.catalog_image_id,
      source: e.source,
      status: e.status,
      url: `/api/downloads/${e.id}`,
      downloadCount: e.download_count ?? 0,
    });
    out.set(e.order_id, list);
  }
  return out;
}

/** Attach `downloads` to each order (and to each item whose design has one) */
export async function withDownloads<T extends { id: string; order_items?: any[] }>(supabase: SupabaseClient, orders: T[]): Promise<(T & { downloads: OrderDownload[] })[]> {
  const map = await downloadsForOrders(supabase, orders.map((o) => o.id));
  return orders.map((o) => {
    const downloads = map.get(o.id) ?? [];
    return {
      ...o,
      downloads,
      order_items: o.order_items?.map((i: any) => ({ ...i, download: downloads.find((d) => d.imageId === i.image_id) ?? null })),
    };
  });
}
