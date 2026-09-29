import { redirect } from 'next/navigation';

/**
 * Stall purchases now go through the basket (buy sheet on the customise page → checkout),
 * so several prints can be bought together. Keep this URL working for any old links.
 */
export default async function StallBuyRedirect({ params, searchParams }: {
  params: Promise<{ imageId: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { imageId } = await params;
  const { size } = await searchParams;
  redirect(`/customise/${encodeURIComponent(imageId)}?buy=1${size ? `&size=${encodeURIComponent(size)}` : ''}`);
}
