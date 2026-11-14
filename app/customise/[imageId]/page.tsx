/**
 * Design page (server). Loads the design before the page is sent, so the first HTML already holds
 * the design's picture (eager, high priority), its breed and title, in the same box the client
 * page uses, instead of a grey skeleton that waits for JavaScript and a second request.
 * Everything interactive is the client component (CustomiseClient.tsx).
 *
 * Caching: the page reads searchParams, so it is rendered per request (dynamic); nothing here
 * reads cookies or the signed-in user. Saved pets, basket, stall offer and referral state still
 * load on the client, as before.
 */
import CustomiseClient from './CustomiseClient';
import { loadDesignPageData } from '@/lib/catalog/design-page-data';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

export default async function CustomisePage({
  params,
  searchParams,
}: {
  params: Promise<{ imageId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { imageId } = await params;
  const sp = await searchParams;

  let initialData = null;
  let missing = false;
  if (UUID_RE.test(imageId)) {
    try {
      const result = await loadDesignPageData(imageId);
      if (result.status === 'ok') initialData = result.data;
      else missing = true;
    } catch (err) {
      // The page still works: the client fetches the design itself
      console.error('customise page load failed', err);
    }
  }

  return (
    <CustomiseClient
      initialData={initialData}
      missing={missing}
      initialQuery={{ src: first(sp.src), size: first(sp.size), from: first(sp.from) }}
    />
  );
}
