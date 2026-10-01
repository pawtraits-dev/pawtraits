'use client';

/**
 * Home page (spec: docs/specs/customer-ux-round-1.md).
 *
 *   hero: the proposition + "Make my pet's Pawtrait"
 *   how it works (3 steps)
 *   find your breed (only breeds that have designs)
 *   designs: 2-column grid, New / Popular / Staff picks
 *   "every design can be your pet" band
 *
 * Data: /api/images (public catalogue), /api/public/products + /api/public/pricing (prices),
 * /api/public/breeds-with-designs. Admins and partners are sent to their own areas.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Paintbrush, ArrowRight } from 'lucide-react';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { productMatchesFormat } from '@/lib/products/shape-family';
import { designTitle } from '@/lib/text/plain';

interface HomeImage {
  id: string;
  description?: string;
  image_url?: string;
  public_url?: string;
  format_id?: string | null;
  breed_name?: string;
  theme_name?: string;
  is_featured?: boolean;
  like_count?: number;
  view_count?: number;
  created_at: string;
}
interface BreedChip { id: string; name: string; animalType: 'dog' | 'cat'; count: number; imageId: string }
type Tab = 'new' | 'popular' | 'picks';

const lifeSavers = { fontFamily: 'var(--font-life-savers), cursive' };
const gbp = (p: number) => `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`;

export default function HomePage() {
  return (
    <CountryProvider>
      <HomePageContent />
    </CountryProvider>
  );
}

function HomePageContent() {
  const router = useRouter();
  const [images, setImages] = useState<HomeImage[] | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [breeds, setBreeds] = useState<BreedChip[]>([]);
  const [tab, setTab] = useState<Tab>('new');

  useEffect(() => {
    // Admins and partners have their own home
    fetch('/api/auth/check', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const type = d?.isAuthenticated ? d?.user?.user_type : null;
        if (type === 'admin') router.replace('/admin');
        else if (type === 'partner') router.replace('/browse');
      })
      .catch(() => {});

    fetch('/api/images?public=true&limit=60')
      .then(r => (r.ok ? r.json() : { images: [] }))
      .then(d => setImages((d.images || []).filter((i: any) => !i.is_customer_generated)))
      .catch(() => setImages([]));
    fetch('/api/public/products').then(r => (r.ok ? r.json() : [])).then(setProducts).catch(() => {});
    fetch('/api/public/pricing')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        // Current UK price per product
        const m = new Map<string, number>();
        for (const row of rows || []) {
          if (row.country_code !== 'GB' || row.is_current === false) continue;
          const v = row.is_on_sale && row.discount_price ? row.discount_price : row.sale_price;
          if (v > 0 && (!m.has(row.product_id) || v < m.get(row.product_id)!)) m.set(row.product_id, v);
        }
        setPrices(m);
      })
      .catch(() => {});
    fetch('/api/public/breeds-with-designs').then(r => (r.ok ? r.json() : { breeds: [] })).then(d => setBreeds(d.breeds || [])).catch(() => {});
  }, [router]);

  /** "Prints from £25" or, for a design with no print sizes, "Digital download £9.99" */
  const priceLine = (img: HomeImage): { label: string; digitalOnly: boolean } | null => {
    const matching = products.filter(p => p.is_active !== false && productMatchesFormat(p, img.format_id));
    const print = matching.filter(p => p.product_type !== 'digital_download').map(p => prices.get(p.id)).filter((v): v is number => !!v);
    if (print.length) return { label: `Prints from ${gbp(Math.min(...print))}`, digitalOnly: false };
    const digital = matching.filter(p => p.product_type === 'digital_download').map(p => prices.get(p.id)).filter((v): v is number => !!v);
    if (digital.length) return { label: `Digital download ${gbp(Math.min(...digital))}`, digitalOnly: true };
    return null;
  };

  const lowestPrint = useMemo(() => {
    const v = products.filter(p => p.is_active !== false && p.product_type !== 'digital_download').map(p => prices.get(p.id)).filter((x): x is number => !!x);
    return v.length ? Math.min(...v) : null;
  }, [products, prices]);

  const shown = useMemo(() => {
    const list = [...(images || [])];
    if (tab === 'new') list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (tab === 'popular') list.sort((a, b) => (b.like_count || 0) * 3 + (b.view_count || 0) - ((a.like_count || 0) * 3 + (a.view_count || 0)));
    return (tab === 'picks' ? list.filter(i => i.is_featured) : list).slice(0, 8);
  }, [images, tab]);

  const heroImage = useMemo(() => (images || []).find(i => i.is_featured) || (images || [])[0], [images]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <UserAwareNavigation />

      {/* HERO */}
      <section className="bg-purple-50/70">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-8 md:grid-cols-2 md:py-16">
          <div>
            <span className="inline-flex items-center rounded-full border border-purple-200 bg-white px-3 py-1 text-xs font-semibold text-purple-800">
              Free preview · no sign-up
            </span>
            <h1 className="mt-3 text-[2.25rem] leading-[1.08] text-gray-900 md:text-5xl" style={lifeSavers}>
              Your pet, painted into a masterpiece
            </h1>
            <p className="mt-3 max-w-md text-base text-gray-600 md:text-lg">
              Pick a Pawtrait you love, add a photo of your pet, and Pawcasso paints them in. See it in about a minute.
            </p>

            {/* Before → after, on phones shown here; on desktop the picture sits in the right column */}
            <HeroPicture image={heroImage} className="mt-6 md:hidden" />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/browse" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 text-lg font-semibold text-white hover:bg-purple-700">
                <Paintbrush className="h-5 w-5" /> Make my pet&apos;s Pawtrait
              </Link>
              <Link href="/browse" className="flex h-12 items-center justify-center rounded-xl border-2 border-purple-200 bg-white px-6 font-semibold text-purple-800 hover:border-purple-400 sm:h-14">
                Browse {images && images.length >= 10 ? `${images.length}+ ` : ''}designs
              </Link>
            </div>
            <p className="mt-3 text-center text-sm text-gray-500 sm:text-left">
              {lowestPrint ? `Prints from ${gbp(lowestPrint)} · ` : ''}Tracked UK delivery £5 · Instant downloads
            </p>
          </div>
          <HeroPicture image={heroImage} className="hidden md:block" />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-5 pt-10">
        <h2 className="text-xl font-bold">How it works</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ['Pick a design', 'Royal Pawtraits, black-tie evenings, birthday chaos and more.'],
            ['Add a photo of your pet', 'Face on, good light. Your free preview is ready in about a minute.'],
            ['We print and post it', 'Printed on rigid Foamex and sent tracked, with a bonus digital copy.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-800">{i + 1}</span>
              <span><span className="block font-semibold">{t}</span><span className="block text-sm text-gray-600">{d}</span></span>
            </li>
          ))}
        </ol>
      </section>

      {/* FIND YOUR BREED */}
      {breeds.length > 0 && (
        <section className="mx-auto max-w-6xl pt-10">
          <div className="flex items-baseline justify-between px-5">
            <h2 className="text-xl font-bold">Find your breed</h2>
            <Link href="/browse" className="text-sm font-semibold text-purple-700">All breeds</Link>
          </div>
          <div className="mt-3 flex gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {breeds.slice(0, 16).map(b => (
              <Link key={b.id} href={`/browse?type=${b.animalType === 'cat' ? 'cats' : 'dogs'}&breed=${b.id}`}
                className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center text-xs font-medium text-gray-800">
                <span className="block h-[68px] w-[68px] overflow-hidden rounded-full border-2 border-purple-100 bg-gray-100 [&>div]:h-full">
                  <CatalogImage imageId={b.imageId} alt="" sizes="68px" className="h-full w-full object-cover object-top" />
                </span>
                <span className="line-clamp-2 leading-tight">{b.name}</span>
              </Link>
            ))}
          </div>
          <p className="mt-1 px-5 text-sm text-gray-500">Don&apos;t see yours? Any design can be painted with your pet, cat or dog.</p>
        </section>
      )}

      {/* DESIGNS */}
      <section id="gallery" className="mx-auto max-w-6xl px-5 pt-10">
        <h2 className="text-xl font-bold">Designs</h2>
        <div className="mt-3 flex gap-2" role="tablist" aria-label="Sort designs">
          {([['new', 'New'], ['popular', 'Popular'], ['picks', 'Staff picks']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`h-9 rounded-full px-4 text-sm font-semibold transition ${tab === key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-800 hover:border-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>

        {!images ? (
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-gray-100" />)}
          </div>
        ) : shown.length === 0 ? (
          <p className="mt-6 text-gray-600">Fresh Pawtraits are on the easel. Check back soon!</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-4">
            {shown.map(img => {
              const price = priceLine(img);
              const title = designTitle(img.description);
              return (
                <Link key={img.id} href={`/customise/${img.id}`} className="group block">
                  <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-gray-100 [&>div]:h-full">
                    <CatalogImage imageId={img.id} alt={title} fallbackUrl={img.image_url || img.public_url}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    {price?.digitalOnly && (
                      <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-gray-900">Digital only</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug line-clamp-2">{title}</p>
                  {(img.breed_name || img.theme_name) && (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{[img.breed_name, img.theme_name].filter(Boolean).join(' · ')}</p>
                  )}
                  {price && <p className="mt-0.5 text-sm font-semibold">{price.label}</p>}
                </Link>
              );
            })}
          </div>
        )}
        <Link href="/browse" className="mt-6 flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-purple-200 font-semibold text-purple-800 hover:border-purple-400">
          See all designs <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* EVERY DESIGN CAN BE YOUR PET */}
      <section className="mt-12 bg-gray-950 text-white">
        <div className="mx-auto max-w-6xl px-5 py-10">
          <h2 className="text-[1.7rem] leading-tight" style={lifeSavers}>Every design can be your pet</h2>
          <p className="mt-2 max-w-xl text-gray-300">
            The pet in the picture is just a stand-in. Cat or dog, any breed: Pawcasso paints your pet into any Pawtrait.
          </p>
          <div className="mt-5 flex gap-3 overflow-hidden">
            {(images || []).slice(0, 3).map(img => (
              <div key={img.id} className="aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl bg-gray-800 md:w-36 [&>div]:h-full">
                <CatalogImage imageId={img.id} alt="" fallbackUrl={img.image_url || img.public_url} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <Link href="/browse" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-white px-6 font-semibold text-gray-950 sm:w-auto">
            Make my pet&apos;s Pawtrait
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-3 px-5 py-8 text-sm md:grid-cols-6">
          <Link href="/browse" className="text-gray-800 hover:text-purple-700">Browse designs</Link>
          <Link href="/auth/login" className="text-gray-800 hover:text-purple-700">Sign in</Link>
          <Link href="/orders" className="text-gray-800 hover:text-purple-700">My orders</Link>
          <Link href="/help" className="text-gray-800 hover:text-purple-700">Help &amp; delivery</Link>
          <Link href="/signup/partner" className="text-gray-800 hover:text-purple-700">Partner with us</Link>
          <Link href="/privacy" className="text-gray-800 hover:text-purple-700">Privacy &amp; terms</Link>
          <p className="col-span-2 mt-2 text-gray-500 md:col-span-6">© {new Date().getFullYear()} Pawtraits</p>
        </div>
      </footer>
    </div>
  );
}

/** A featured design with a "your pet's photo" polaroid in front: the before → after idea at a glance */
function HeroPicture({ image, className = '' }: { image?: HomeImage; className?: string }) {
  return (
    <div className={`relative mx-auto h-[330px] w-full max-w-[360px] md:h-[440px] md:max-w-[440px] ${className}`}>
      <div className="absolute right-0 top-0 aspect-[4/5] h-[310px] overflow-hidden rounded-2xl bg-gray-200 shadow-xl md:h-[420px] [&>div]:h-full">
        {image && <CatalogImage imageId={image.id} alt={designTitle(image.description)} fallbackUrl={image.image_url || image.public_url} sizes="(min-width: 768px) 340px, 250px" priority className="h-full w-full object-cover" />}
      </div>
      <div className="absolute bottom-0 left-0 h-40 w-32 -rotate-[4deg] rounded-xl border-[6px] border-white bg-white shadow-lg md:h-48 md:w-40">
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-md bg-purple-50 p-2 text-center text-xs font-medium text-purple-900">
          <Camera className="h-6 w-6" />
          Your pet&apos;s photo
        </div>
      </div>
      <svg width="56" height="40" viewBox="0 0 56 40" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="absolute left-24 top-24 md:left-32 md:top-32" aria-hidden>
        <path d="M4 34C14 10 30 6 48 10" /><path d="M41 4l7 6-8 5" />
      </svg>
    </div>
  );
}
