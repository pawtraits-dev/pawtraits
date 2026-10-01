/**
 * Shared customised Pawtrait: /share/custom/<share_token>, the link a customer sends with
 * "Look what Pawcasso made of my pet!". Shows the watermarked preview (generated_image_url is
 * always the watermarked version) and invites the visitor to put their own pet in the same design.
 * Each visit adds one to share_count (shown in Admin → Shared images).
 */
import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { Camera } from 'lucide-react';
import { serviceClient } from '@/lib/qr/server';
import { designTitle } from '@/lib/text/plain';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import QuizPromo from '@/components/quiz/QuizPromo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ shareToken: string }> };
const TOKEN_RE = /^[A-Za-z0-9_-]{6,64}$/;
const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };

interface SharedPortrait {
  id: string;
  imageUrl: string;
  petNames: string[];
  shareCount: number;
  breedName: string | null;
  design: { id: string; title: string; themeName: string | null; isPublic: boolean } | null;
}

/** One lookup per request (metadata and page share it) */
const getSharedPortrait = cache(async (shareToken: string): Promise<SharedPortrait | null> => {
  if (!TOKEN_RE.test(shareToken)) return null;
  const { data, error } = await serviceClient()
    .from('customer_custom_images')
    .select(`
      id, generated_image_url, share_count, pet_name, status, metadata,
      breeds:pet_breed_id (name),
      catalog:catalog_image_id (id, description, is_public, themes:theme_id (name))
    `)
    .eq('share_token', shareToken)
    .eq('is_public', true)
    .maybeSingle();
  if (error) console.error('shared portrait lookup failed', error);
  if (!data || !data.generated_image_url || data.status === 'failed') return null;

  const names = ((data.metadata as any)?.all_pet_names as string[] | undefined) ?? [data.pet_name ?? ''];
  const petNames = names.map(n => (n || '').trim()).filter(n => n && n !== 'Uploaded Pet');
  const catalog = data.catalog as any;
  return {
    id: data.id,
    imageUrl: data.generated_image_url,
    petNames,
    shareCount: data.share_count ?? 0,
    breedName: (data.breeds as any)?.name ?? null,
    design: catalog ? {
      id: catalog.id,
      title: designTitle(catalog.description, 'Pawtraits design'),
      themeName: catalog.themes?.name ?? null,
      isPublic: catalog.is_public !== false,
    } : null,
  };
});

/** "Biscuit", "Biscuit and Mochi", "Biscuit, Mochi and Pip" */
const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

function headline(p: SharedPortrait) {
  return p.petNames.length ? `${joinNames(p.petNames)}, painted by Pawcasso` : 'Painted by Pawcasso';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shareToken } = await params;
  const p = await getSharedPortrait(shareToken).catch(() => null);
  if (!p) return { title: 'Pawtrait not found | Pawtraits', robots: { index: false } };
  const title = p.petNames.length ? `${joinNames(p.petNames)}’s Pawtrait` : 'A Pawtrait by Pawcasso';
  const description = 'Pawcasso painted this pet into a masterpiece. Put your own pet in this picture: free preview in about a minute.';
  return {
    title: `${title} | Pawtraits`,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, siteName: 'Pawtraits', locale: 'en_GB', type: 'website', images: [{ url: p.imageUrl, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [p.imageUrl] },
  };
}

export default async function SharedPortraitPage({ params }: Props) {
  const { shareToken } = await params;
  const p = await getSharedPortrait(shareToken).catch(() => null);

  if (!p) {
    return (
      <CountryProvider>
        <div className="min-h-screen bg-white text-gray-900">
          <UserAwareNavigation />
          <main className="mx-auto max-w-md px-5 py-16 text-center">
            <h1 className="text-[2rem] leading-tight" style={lifeSavers}>This Pawtrait has wandered off</h1>
            <p className="mt-3 text-gray-700">The link may be mistyped, or the owner has made it private.</p>
            <Link href="/browse" className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-purple-600 px-6 font-semibold text-white">
              Browse designs
            </Link>
          </main>
        </div>
      </CountryProvider>
    );
  }

  // Each visit counts once (fire and forget)
  serviceClient().from('customer_custom_images')
    .update({ share_count: p.shareCount + 1, last_shared_at: new Date().toISOString() })
    .eq('id', p.id)
    .then(({ error }) => { if (error) console.error('share count update failed', error); });

  const designHref = p.design?.isPublic ? `/customise/${p.design.id}?start=photo&src=share` : '/browse';
  const caption = [p.breedName, p.design?.themeName].filter(Boolean).join(' · ');

  return (
    <CountryProvider>
      <div className="min-h-screen bg-white text-gray-900">
        <UserAwareNavigation />
        <main>
          <section className="bg-[#F6F2FC] px-5 pb-7 pt-5">
            <div className="mx-auto max-w-md">
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={headline(p)} className="block h-auto w-full" />
              </div>
              {caption && <p className="mt-4 text-sm text-gray-600">{caption}</p>}
              <h1 className="mt-1 text-[2rem] leading-[1.1]" style={lifeSavers}>{headline(p)}</h1>
              {p.design && <p className="mt-1 text-gray-700">In &ldquo;{p.design.title}&rdquo;, one of our Pawtrait designs.</p>}
            </div>
          </section>

          <section className="mx-auto max-w-md px-5 py-7">
            <h2 className="text-xl font-bold">Put your pet in this picture</h2>
            <p className="mt-1 text-gray-700">Add a photo and Pawcasso paints your pet in, cat or dog, any breed. Free preview in about a minute, no sign-up.</p>
            <Link href={designHref}
              className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 text-lg font-semibold text-white hover:bg-purple-700">
              <Camera className="h-5 w-5" aria-hidden="true" /> {p.design?.isPublic ? 'Add my pet’s photo' : 'Choose a design'}
            </Link>
            <Link href="/browse" className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border-2 border-purple-200 font-semibold text-purple-800 hover:border-purple-400">
              Browse all designs
            </Link>
            <p className="mt-3 text-center text-sm text-gray-500">Printed on rigid Foamex and sent tracked, or as an instant download.</p>
          </section>

          <QuizPromo source="shared-portrait" />
          <div className="h-10" />
        </main>
      </div>
    </CountryProvider>
  );
}
