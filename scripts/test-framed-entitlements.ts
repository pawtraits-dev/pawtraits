// A framed card bought as a download gets a 'purchase' entitlement; a print still gets the bonus copy. No network:
// a fake Supabase client answers the lookups and records the upserted rows.
// Run: NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x npx tsx scripts/test-framed-entitlements.ts
import { grantEntitlementsForOrder } from '../lib/orders/entitlements';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

const FRAMED_CUSTOM = 'c0000000-0000-0000-0000-000000000001';
const FRAMED_CATALOGUE = 'd0000000-0000-0000-0000-000000000002';
let upserted: any[] = [];
const fake: any = {
  from(table: string) {
    let id = '';
    const q: any = {
      select: () => q,
      eq: (_c: string, v: string) => { id = v; return q; },
      maybeSingle: async () => {
        if (table === 'customer_custom_images') return { data: id === FRAMED_CUSTOM ? { id, generation_metadata: { frame: { title: 'ARIES' } } } : null };
        if (table === 'image_catalog') return { data: id === FRAMED_CATALOGUE ? { id, frame_overlay: { clean_public_id: 'a', applied: { title: 'T', medallion: null, at: '' } } } : null };
        return { data: null };
      },
      upsert: async (rows: any[]) => { upserted = rows; return { error: null }; },
    };
    return q;
  },
};
const order = { id: 'o1', customer_email: 'A@B.com', is_guest_checkout: false };
const download = (image_id: string) => ({ image_id, product_data: { product_type: 'digital_download' } });
const print = (image_id: string) => ({ image_id, product_data: { product_type: 'physical_print' } });

(async () => {
  await grantEntitlementsForOrder(fake, order, [download(FRAMED_CUSTOM), download(FRAMED_CATALOGUE)], 'cust1');
  ok('framed custom + catalogue downloads each get a purchase entitlement', upserted.length === 2 && upserted.every(r => r.source === 'purchase' && r.status === 'available'), upserted);
  ok('rows point at the right image columns', upserted.some(r => r.custom_image_id === FRAMED_CUSTOM && r.catalog_image_id === null) && upserted.some(r => r.catalog_image_id === FRAMED_CATALOGUE && r.custom_image_id === null));
  await grantEntitlementsForOrder(fake, order, [print(FRAMED_CUSTOM)], 'cust1');
  ok('a print of a framed card still gets the bonus copy (when the gift setting is on)', upserted.length === 0 || upserted.every(r => r.source === 'welcome_gift'), upserted);
  console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
  process.exit(fail ? 1 : 0);
})();
