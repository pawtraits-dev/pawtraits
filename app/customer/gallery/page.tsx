import { redirect } from 'next/navigation';

/**
 * There is one gallery: /gallery ("My Pawtraits"). This older copy counted likes and shares
 * from the browser instead of the account and disagreed with it, so it now forwards there.
 */
export default async function CustomerGalleryRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  const query = params.toString();
  redirect(query ? `/gallery?${query}` : '/gallery');
}
