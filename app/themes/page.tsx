/**
 * Old theme links (/themes, /themes?theme=<id>, and /browse?type=themes which comes here).
 * Themes are behind the scenes now: send people to the theme's collection, else all collections.
 */
import { redirect } from 'next/navigation';
import { serviceClient } from '@/lib/qr/server';

export const dynamic = 'force-dynamic';
const UUID = /^[0-9a-f-]{36}$/i;

export default async function ThemesRedirect({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  let target = '/collections';
  if (theme) {
    try {
      const q = serviceClient().from('themes').select('collections:default_collection_id (path, is_active)');
      const { data } = await (UUID.test(theme) ? q.eq('id', theme) : q.eq('slug', theme.slice(0, 80))).maybeSingle();
      const c = (data as any)?.collections;
      if (c?.path && c.is_active) target = `/collections/${c.path}`;
    } catch { /* fall back to all collections */ }
  }
  redirect(target);
}
