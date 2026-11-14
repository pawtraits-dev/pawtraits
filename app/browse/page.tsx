/**
 * Browse page (server). Loads the first page of designs before the page is sent, so the first HTML
 * already holds the picture cards (real <img> elements, titles) and the heading, instead of a grey
 * skeleton that waits for JavaScript and five requests. Everything interactive is the client
 * component (BrowseClient.tsx).
 *
 * What is loaded here is the same for every visitor: the designs for the URL's filters, the tab counts
 * and (for a breed / theme view) that one breed or theme for the heading. Nothing reads cookies or
 * the signed-in user. Prices (country-specific), the breed / theme lists and facets, likes, basket and
 * the signed-in state still load on the client, as before.
 *
 * Caching: the page reads searchParams, so it is rendered per request (dynamic); no cache layer here.
 */
import BrowseClient from './BrowseClient';
import { serviceClient } from '@/lib/qr/server';
import { listingCounts, loadBrowseHeading, loadBrowsePage } from '@/lib/catalog/browse-server';
import {
  BROWSE_PAGE_SIZE,
  browseApiParamsFromKey,
  browseGridKey,
  browseGridVisible,
  browseStateFromRecord,
} from '@/lib/catalog/browse-params';

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const state = browseStateFromRecord(sp);
  const gridKey = browseGridKey(state);

  let initialData = null;
  try {
    const db = serviceClient();
    const [page, heading] = await Promise.all([
      browseGridVisible(state)
        ? loadBrowsePage(db, browseApiParamsFromKey(gridKey, 1, BROWSE_PAGE_SIZE), true)
        : listingCounts(db).then(counts => ({ images: [], total: 0, hasMore: false, counts })),
      loadBrowseHeading(db, { breed: state.breed, theme: state.theme }),
    ]);
    initialData = {
      images: page.images,
      total: page.total,
      hasMore: page.hasMore,
      counts: page.counts ?? null,
      breed: heading.breed,
      theme: heading.theme,
    };
  } catch (err) {
    // The page still works: the client fetches everything itself, as it always did
    console.error('browse page load failed', err);
  }

  return <BrowseClient initialData={initialData} initialQuery={{ ...state, gridKey }} />;
}
