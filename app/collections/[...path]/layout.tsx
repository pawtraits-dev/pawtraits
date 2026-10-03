/**
 * Server layout for a collection page: its own title, description and share preview
 * (picture = the collection's best design). Unknown or empty collections are kept out of search.
 */
import type { Metadata } from 'next';
import { serviceClient } from '@/lib/qr/server';
import { cloudinaryService } from '@/lib/cloudinary';
import { cleanPath, loadPublicTree } from '@/lib/collections/public';

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path: parts } = await params;
  const path = cleanPath((parts ?? []).join('/'));
  const generic: Metadata = { title: 'Collections | Pawtraits', robots: { index: false, follow: true } };
  if (!path) return generic;
  try {
    const supabase = serviceClient();
    const tree = await loadPublicTree(supabase);
    const c = tree.find(x => x.path === path);
    if (!c || c.designs === 0) return generic;
    const parent = c.parentPath ? tree.find(x => x.path === c.parentPath) : null;
    const title = c.kind === 'sport' && c.depth === 2 ? `${c.name} pet portraits${parent ? ` (${parent.name})` : ''}`
      : c.kind === 'zodiac' && c.depth === 1 ? `${c.name} pet portraits`
      : c.kind === 'pawsonality' && c.depth === 1 ? `${c.name}: Pawsonality pet portraits`
      : `${c.name} pet portraits`;
    const description = (c.description ? `${c.description} ` : '') + `${c.designs} design${c.designs === 1 ? '' : 's'}. Put your own pet in any of them: free preview in about a minute.`;
    let image: string | undefined;
    if (c.heroImageId) {
      const { data } = await supabase.from('image_catalog').select('cloudinary_public_id').eq('id', c.heroImageId).maybeSingle();
      try { image = data?.cloudinary_public_id ? cloudinaryService.getSharePreviewUrl(data.cloudinary_public_id) : undefined; } catch { image = undefined; }
    }
    const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://pawtraits.pics').replace(/\/$/, '');
    const url = `${base}/collections/${c.path}`;
    const images = image ? [{ url: image, width: 1200, height: 630, alt: c.name }] : undefined;
    return {
      title: `${title} | Pawtraits`, description, alternates: { canonical: url },
      openGraph: { title, description, url, type: 'website', images },
      twitter: { card: images ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
    };
  } catch {
    return generic;
  }
}

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
