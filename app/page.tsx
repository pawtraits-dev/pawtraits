/**
 * Home page (server). Picks the hero picture before the page is sent — the latest real customer
 * photo and its Pawtrait from the social feed — so it shows straight away instead of a
 * placeholder. Everything else is the client page in components/home/HomePage.tsx.
 */
import HomePage from '@/components/home/HomePage';
import { getFeed, type FeedItem } from '@/lib/social/feed';

export const revalidate = 120;

export default async function Home() {
  let hero: FeedItem | null = null;
  try {
    [hero = null] = await getFeed(1);
  } catch (err) {
    console.error('home hero failed', err);
  }
  return <HomePage hero={hero} />;
}
