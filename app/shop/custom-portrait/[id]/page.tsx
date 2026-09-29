'use client';

/**
 * Buy a customised portrait (deep link / emails / "My Pawtraits").
 * Uses the same buy sheet as the customise page so options, prices and basket behaviour
 * are identical. Titles never use the catalogue description (it names the original breed).
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import BuyOptionsSheet, { type BuyTarget } from '@/components/customise/BuyOptionsSheet';
import { customPortraitTitle } from '@/lib/cart/items';

export default function CustomPortraitPurchasePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [target, setTarget] = useState<BuyTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scannedSize, setScannedSize] = useState<string | null>(null);

  useEffect(() => {
    try { setScannedSize(sessionStorage.getItem('pt_qr_size')); } catch { /* ignore */ }
    (async () => {
      try {
        const cRes = await fetch(`/api/customers/custom-images/${id}`, { credentials: 'include' });
        if (!cRes.ok) throw new Error('We couldn’t find that portrait on this device. If you made it on another phone, open it there.');
        const c = await cRes.json();
        const catRes = await fetch(`/api/public/catalog-images/${c.catalog_image_id}`);
        const cat = catRes.ok ? await catRes.json() : null;
        setTarget({
          kind: 'custom',
          imageId: c.id,
          catalogImageId: c.catalog_image_id,
          imageUrl: c.generated_image_url,
          title: customPortraitTitle(c.pet_name, cat?.theme?.displayName || cat?.theme?.name),
          formatId: cat?.format?.id,
          themeName: cat?.theme?.name,
        });
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [id]);

  return (
    <CountryProvider>
      <div className="min-h-[100dvh] bg-gray-50">
        <UserAwareNavigation />
        <div className="mx-auto max-w-xl px-4 pt-6">
          {error ? (
            <div className="py-12 text-center">
              <p className="text-gray-800">{error}</p>
              <Link href="/browse" className="mt-6 inline-flex h-12 items-center rounded-xl bg-purple-600 px-6 font-semibold text-white">Browse designs</Link>
            </div>
          ) : target ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={target.imageUrl} alt="Your portrait" className="mx-auto max-h-[50dvh] rounded-2xl shadow-sm" />
          ) : (
            <div className="aspect-square animate-pulse rounded-2xl bg-gray-200" />
          )}
        </div>
        {target && <BuyOptionsSheet open onClose={() => router.back()} target={target} scannedSize={scannedSize} />}
      </div>
    </CountryProvider>
  );
}
