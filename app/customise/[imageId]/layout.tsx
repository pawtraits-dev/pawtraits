/**
 * Server layout for the design page: gives each design its own browser-tab title,
 * description and link preview (og/twitter image), so a shared link shows the
 * design rather than the generic Pawtraits card.
 */
import type { Metadata } from 'next';
import { serviceClient } from '@/lib/qr/server';
import { cloudinaryService } from '@/lib/cloudinary';
import { designTitle, snippet } from '@/lib/text/plain';
import { isListed } from '@/lib/catalog/listing';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(
  { params }: { params: Promise<{ imageId: string }> }
): Promise<Metadata> {
  const { imageId } = await params;
  const generic: Metadata = { title: 'Your pet, painted into a masterpiece | Pawtraits' };
  if (!UUID_RE.test(imageId)) return generic;

  try {
    const { data } = await serviceClient()
      .from('image_catalog')
      .select('id, description, marketing_description, marketing_description_approved, cloudinary_public_id, public_url, is_public, is_customer_generated, tags, breeds:breed_id (name), themes:theme_id (name)')
      .eq('id', imageId)
      .maybeSingle();

    // Customers' own images and hidden designs: no preview details, keep out of search
    if (!data || data.is_public === false || data.is_customer_generated) {
      return { ...generic, robots: { index: false, follow: false } };
    }
    // Link-only designs (Pawsonality breed pictures): normal preview, but kept out of search
    const linkOnly = !isListed(data as { tags?: string[] | null });

    const breed = (data.breeds as any)?.name as string | undefined;
    const theme = (data.themes as any)?.name as string | undefined;
    const title = designTitle(data.description, breed ? `${breed} Pawtrait` : 'Pet Pawtrait');
    const blurb = (data.marketing_description_approved && data.marketing_description) || data.description;
    const lead = breed ? `Starring a ${breed}${theme ? ` · ${theme}` : ''}. ` : '';
    const description = snippet(`${lead}Put your own pet in this Pawtrait, or buy it as it is. ${snippet(blurb, 90)}`, 160);

    let image: string | undefined;
    try {
      image = data.cloudinary_public_id ? cloudinaryService.getSharePreviewUrl(data.cloudinary_public_id) : undefined;
    } catch { image = undefined; }

    const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics';
    const url = `${base.replace(/\/$/, '')}/customise/${data.id}`;
    const images = image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined;

    return {
      title: `${title} | Pawtraits`,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, siteName: 'Pawtraits', type: 'website', locale: 'en_GB', images },
      twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
      ...(linkOnly ? { robots: { index: false, follow: true } } : {}),
    };
  } catch (err) {
    console.error('customise metadata failed', err);
    return generic;
  }
}

export default function CustomiseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
