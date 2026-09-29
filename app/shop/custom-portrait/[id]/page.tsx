'use client';

/**
 * Buy a customised portrait — mobile-first. Works for guests. Digital download and prints
 * all go in the same basket and the same checkout.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Truck } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import StickyActionBar from '@/components/customise/StickyActionBar';
import { track } from '@/lib/tracking/events';

interface CustomImage { id: string; catalog_image_id: string; generated_image_url: string | null; status: string }
interface CatalogImage { id: string; description: string; format?: { id: string; name: string; aspectRatio: string }; theme?: { name: string } }
interface ProductRow {
  id: string; name: string; product_type: string; size_code?: string; size_name?: string; width_cm?: number; height_cm?: number;
  media_name?: string; media_description?: string; gelato_sku?: string;
  pricing: { id: string; sale_price: number; discount_price?: number | null; is_on_sale?: boolean; currency_code: string; currency_symbol: string; product_id: string; country_code: string };
}

const money = (p: ProductRow['pricing']) => {
  const v = p.is_on_sale && p.discount_price ? p.discount_price : p.sale_price;
  return `${p.currency_symbol || '£'}${(v / 100).toFixed(v % 100 === 0 ? 0 : 2)}`;
};

export default function CustomPortraitPurchasePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { toast } = useToast();
  const { addToCart } = useHybridCart();

  const [customImage, setCustomImage] = useState<CustomImage | null>(null);
  const [catalogImage, setCatalogImage] = useState<CatalogImage | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [scannedSize, setScannedSize] = useState<string | null>(null);

  useEffect(() => {
    try { setScannedSize(sessionStorage.getItem('pt_qr_size')); } catch { /* ignore */ }
    (async () => {
      try {
        const cRes = await fetch(`/api/customers/custom-images/${id}`, { credentials: 'include' });
        if (!cRes.ok) throw new Error('We couldn’t find that portrait on this device. If you made it on another phone, open it there.');
        const c: CustomImage = await cRes.json();
        setCustomImage(c);
        const catRes = await fetch(`/api/public/catalog-images/${c.catalog_image_id}`);
        const cat: CatalogImage = await catRes.json();
        setCatalogImage(cat);
        if (cat.format?.id) {
          const pRes = await fetch(`/api/public/format-products?formatId=${cat.format.id}&country=GB`);
          const pData = await pRes.json();
          setProducts(pData.products || []);
          const digital = (pData.products || []).find((p: ProductRow) => p.product_type === 'digital_download');
          if (digital) setSelected(new Set([digital.id])); // sensible default: the download
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const digital = products.filter(p => p.product_type === 'digital_download');
  const prints = products.filter(p => p.product_type !== 'digital_download');
  const printsByMedia = useMemo(() => prints.reduce<Record<string, ProductRow[]>>((acc, p) => {
    (acc[p.media_name || 'Prints'] ||= []).push(p); return acc;
  }, {}), [prints]);

  const selectedProducts = products.filter(p => selected.has(p.id));
  const total = selectedProducts.reduce((t, p) => t + (p.pricing.is_on_sale && p.pricing.discount_price ? p.pricing.discount_price : p.pricing.sale_price), 0);

  const toggle = (pid: string) => setSelected(prev => {
    const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n;
  });

  async function addSelected() {
    if (!customImage || !catalogImage || !selectedProducts.length) return;
    setAdding(true);
    try {
      for (const p of selectedProducts) {
        await addToCart({
          productId: p.id,
          imageId: customImage.id,
          imageUrl: customImage.generated_image_url || '',
          imageTitle: `${catalogImage.description || 'Pawtrait'} (Custom Portrait)`,
          product: p as any,
          pricing: p.pricing as any,
          quantity: 1,
          gelatoProductUid: p.gelato_sku,
          printSpecs: p.width_cm ? { width_cm: p.width_cm, height_cm: p.height_cm || p.width_cm, medium: p.media_name || '', format: catalogImage.format?.name || '' } : undefined,
        } as any);
      }
      track.addToCart(selectedProducts.map(p => ({
        id: catalogImage.id, name: catalogImage.description, category: catalogImage.theme?.name,
        variant: p.product_type === 'digital_download' ? 'custom_digital' : `custom_${p.size_code || p.name}`,
        price: (p.pricing.is_on_sale && p.pricing.discount_price ? p.pricing.discount_price : p.pricing.sale_price) / 100,
      })));
      router.push('/shop/cart');
    } catch (e: any) {
      toast({ title: 'Couldn’t add to basket', description: e.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  return (
    <CountryProvider>
      <div className="min-h-[100dvh] bg-gray-50">
        <UserAwareNavigation />
        <div className="mx-auto max-w-xl px-4 pt-3 md:pt-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-1 py-2 text-sm text-gray-600"><ArrowLeft className="h-4 w-4" /> Back</button>

          {loading && <div className="animate-pulse"><div className="aspect-square rounded-2xl bg-gray-200" /><div className="mt-4 h-20 rounded-2xl bg-gray-200" /></div>}
          {error && (
            <div className="py-12 text-center">
              <p className="text-gray-800">{error}</p>
              <Link href="/browse" className="mt-6 inline-flex h-12 items-center rounded-xl bg-purple-600 px-6 font-semibold text-white">Browse designs</Link>
            </div>
          )}

          {!loading && customImage && (
            <>
              <div className="flex gap-4 rounded-2xl bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {customImage.generated_image_url && <img src={customImage.generated_image_url} alt="Your portrait" className="h-28 w-24 rounded-xl object-cover" />}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-purple-700">Your custom portrait</p>
                  <p className="font-semibold text-gray-900 line-clamp-2">{catalogImage?.description}</p>
                  <p className="mt-1 text-xs text-gray-500">Final files have no watermark.</p>
                </div>
              </div>

              <h1 className="mt-6 text-xl font-bold text-gray-900">How would you like it?</h1>
              <p className="text-sm text-gray-600">Pick as many as you like.</p>

              {digital.length > 0 && (
                <div className="mt-4 space-y-2">
                  {digital.map(p => (
                    <OptionRow key={p.id} checked={selected.has(p.id)} onClick={() => toggle(p.id)}
                      icon={<Download className="h-5 w-5" />} title="Digital download"
                      subtitle="High-resolution file · instant · perfect for phones and socials" price={money(p.pricing)} />
                  ))}
                </div>
              )}

              {Object.entries(printsByMedia).map(([media, rows]) => (
                <div key={media} className="mt-5">
                  <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-800"><Truck className="h-4 w-4" /> {media} · delivered</p>
                  <div className="space-y-2">
                    {rows.map(p => (
                      <OptionRow key={p.id} checked={selected.has(p.id)} onClick={() => toggle(p.id)}
                        title={`${p.size_name || ''} ${p.width_cm ? `${p.width_cm}×${p.height_cm} cm` : p.name}`.trim()}
                        subtitle={scannedSize && p.size_code === scannedSize ? 'Same size as the print you scanned' : p.media_description}
                        highlight={!!scannedSize && p.size_code === scannedSize}
                        price={money(p.pricing)} />
                    ))}
                  </div>
                </div>
              ))}

              {!products.length && <p className="mt-6 text-sm text-gray-600">No products are set up for this format yet.</p>}

              <StickyActionBar>
                <button onClick={addSelected} disabled={!selectedProducts.length || adding}
                  className="flex h-14 w-full items-center justify-between rounded-2xl bg-purple-600 px-5 text-lg font-semibold text-white shadow-lg disabled:bg-purple-300">
                  <span>{adding ? 'Adding…' : selectedProducts.length ? `Add ${selectedProducts.length} to basket` : 'Choose an option'}</span>
                  {selectedProducts.length > 0 && <span>£{(total / 100).toFixed(2)}</span>}
                </button>
                <p className="text-center text-xs text-gray-500">No account needed — checkout as a guest.</p>
              </StickyActionBar>
            </>
          )}
        </div>
      </div>
    </CountryProvider>
  );
}

function OptionRow({ checked, onClick, icon, title, subtitle, price, highlight }: {
  checked: boolean; onClick: () => void; icon?: React.ReactNode; title: string; subtitle?: string | null; price: string; highlight?: boolean;
}) {
  return (
    <button onClick={onClick} aria-pressed={checked}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-white p-4 text-left transition ${checked ? 'border-purple-600 ring-2 ring-purple-100' : highlight ? 'border-purple-300' : 'border-gray-200'}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300'}`}>
        {checked && <Check className="h-4 w-4" />}
      </span>
      {icon && <span className="text-purple-700">{icon}</span>}
      <span className="flex-1">
        <span className="block font-semibold text-gray-900">{title}</span>
        {subtitle && <span className={`block text-xs ${highlight ? 'text-purple-700 font-medium' : 'text-gray-500'}`}>{subtitle}</span>}
      </span>
      <span className="font-bold text-gray-900">{price}</span>
    </button>
  );
}
