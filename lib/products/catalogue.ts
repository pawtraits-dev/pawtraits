/**
 * Server helpers for the product catalogue.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatIdsForProduct } from './shape-family';

/** Adds `format_ids` (the formats each product is offered on) so clients can match designs by shape family. */
export async function withFormatIds<T extends { format_id?: string | null; shape_family?: string | null }>(supabase: SupabaseClient, products: T[]): Promise<Array<T & { format_ids: string[] }>> {
  if (!products?.length) return [];
  const { data: formats } = await supabase.from('formats').select('id, aspect_ratio, is_active');
  return products.map(p => ({ ...p, format_ids: formatIdsForProduct(p, formats || []) }));
}
