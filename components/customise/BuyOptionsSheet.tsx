'use client';

/**
 * Bottom sheet listing every way to buy a design, with prices.
 *
 *  - From a stall sticker: the print in the customer's hand is highlighted as
 *    "Take it home now" (stall price). Other sizes are made to order and delivered.
 *  - Custom portraits: digital download + all print options for the format.
 *  - "Checkout now" or "Add to basket & keep shopping" (multiple purchases).
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Download, Truck, ShoppingBag, X, Hand, Gift } from 'lucide-react';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import { useToast } from '@/components/ui/use-toast';
import { buildStallCartProduct, SIZE_NAMES, isStallProductId } from '@/lib/cart/items';
import { track } from '@/lib/tracking/events';

export interface BuyTarget {
  kind: 'catalog' | 'custom';
  imageId: string;          // id stored on the basket line (catalogue image or custom image)
  catalogImageId: string;   // for analytics audiences
  imageUrl: string;
  title: string;            // basket/order title (never the breed description for custom portraits)
  formatId?: string | null;
  themeName?: string | null;
}

export interface StallOfferView {
  available: boolean;
  locationName?: string;
  size?: 'S' | 'M' | 'L';
  pricePence?: number;
  listPricePence?: number;
  discountPct?: number;
}

interface ProductRow {
  id: string; name: string; product_type: string; size_code?: string; size_name?: string;
  width_cm?: number; height_cm?: number; media_name?: string; media_description?: string; gelato_sku?: string;
  medium?: any; format?: any;
  pricing: { id: string; sale_price: number; discount_price?: number | null; is_on_sale?: boolean; currency_code: string; currency_symbol: string; product_id: string; country_code: string };
}

const STALL_OPTION = '__stall__';
const pence = (p: ProductRow['pricing']) => (p.is_on_sale && p.discount_price ? p.discount_price : p.sale_price);
const gbp = (v?: number) => (v === undefined ? '' : `£${(v / 100).toFixed(v % 100 === 0 ? 0 : 2)}`);

export default function BuyOptionsSheet({ open, onClose, target, stallOffer, scannedSize }: {
  open: boolean;
  onClose: () => void;
  target: BuyTarget;
  stallOffer?: StallOfferView | null;
  scannedSize?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { items, addToCart } = useHybridCart();
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'checkout' | 'basket' | null>(null);

  const stallAvailable = target.kind === 'catalog' && !!stallOffer?.available && !!stallOffer.size && !!stallOffer.pricePence;

  useEffect(() => {
    if (!open || products || !target.formatId) return;
    fetch(`/api/public/format-products?formatId=${target.formatId}&country=GB`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Could not load prices'); return d.products as ProductRow[]; })
      .then(rows => {
        setProducts(rows);
        // sensible default: the print in their hand, else the download for a custom portrait
        const digital = rows.find(p => p.product_type === 'digital_download');
        if (stallAvailable) setSelected(new Set([STALL_OPTION]));
        else if (target.kind === 'custom' && digital) setSelected(new Set([digital.id]));
      })
      .catch(e => setLoadError(e.message));
  }, [open, products, target.formatId, target.kind, stallAvailable]);

  const digital = (products ?? []).filter(p => p.product_type === 'digital_download');
  const printsByMedium = useMemo(() => (products ?? [])
    .filter(p => p.product_type !== 'digital_download')
    .reduce<Record<string, ProductRow[]>>((acc, p) => { (acc[p.media_name || p.medium?.name || 'Prints'] ||= []).push(p); return acc; }, {}), [products]);

  const alreadyHasStallLine = items.some(i => isStallProductId(i.productId) && i.imageId === target.imageId);

  const total = (() => {
    let t = 0;
    if (selected.has(STALL_OPTION) && stallAvailable) t += stallOffer!.pricePence!;
    for (const p of products ?? []) if (selected.has(p.id)) t += pence(p.pricing);
    return t;
  })();

  // Every print bought on the website includes a free digital download of the design,
  // so never charge for the download alongside a print of the same design.
  const digitalIds = new Set(digital.map(p => p.id));
  const anyPrintSelected = Array.from(selected).some(id => id === STALL_OPTION || (!digitalIds.has(id) && (products ?? []).some(p => p.id === id)));
  useEffect(() => {
    if (!anyPrintSelected) return;
    setSelected(prev => {
      if (!Array.from(prev).some(id => digitalIds.has(id))) return prev;
      return new Set(Array.from(prev).filter(id => !digitalIds.has(id)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyPrintSelected]);

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function add(then: 'checkout' | 'basket') {
    if (!selected.size) return;
    setBusy(then);
    try {
      const tracked: any[] = [];
      if (selected.has(STALL_OPTION) && stallAvailable && !alreadyHasStallLine) {
        const { product, pricing } = buildStallCartProduct(stallOffer!.size!, stallOffer!.pricePence!);
        await addToCart({ productId: product.id, imageId: target.imageId, imageUrl: target.imageUrl, imageTitle: target.title, product: product as any, pricing: pricing as any, quantity: 1 } as any);
        tracked.push({ id: target.catalogImageId, name: target.title, variant: `stall_${stallOffer!.size}`, price: stallOffer!.pricePence! / 100 });
      }
      for (const p of products ?? []) {
        if (!selected.has(p.id)) continue;
        await addToCart({
          productId: p.id, imageId: target.imageId, imageUrl: target.imageUrl, imageTitle: target.title,
          product: p as any, pricing: p.pricing as any, quantity: 1,
          gelatoProductUid: p.gelato_sku,
          printSpecs: p.width_cm ? { width_cm: p.width_cm, height_cm: p.height_cm || p.width_cm, medium: p.media_name || p.medium?.name || '', format: p.format?.name || '' } : undefined,
        } as any);
        tracked.push({ id: target.catalogImageId, name: target.title, variant: p.product_type === 'digital_download' ? 'digital' : p.size_code || p.name, price: pence(p.pricing) / 100 });
      }
      if (tracked.length) track.addToCart(tracked);

      if (then === 'checkout') {
        router.push('/shop/checkout');
      } else {
        onClose();
        setSelected(new Set());
        toast({
          title: 'Added to your basket 🛍️',
          description: stallAvailable ? 'Scan another print or keep browsing — check out whenever you’re ready.' : 'Keep browsing — your basket is in the top bar.',
        });
      }
    } catch (e: any) {
      toast({ title: 'Couldn’t add to basket', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Buy options">
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] max-w-xl flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={target.imageUrl} alt="" className="h-12 w-10 rounded-lg object-cover" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-purple-700">{target.kind === 'custom' ? 'Your portrait' : 'This print'}</p>
            <p className="truncate font-semibold text-gray-900">{target.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <p className="flex items-start gap-2 rounded-2xl bg-green-50 px-3 py-2.5 text-sm text-green-900">
            <Gift className="mt-0.5 h-4 w-4 shrink-0" />
            <span><strong>Free digital copy with every print</strong> bought here — a high-res file for your phone, emailed with your receipt.</span>
          </p>
          {stallAvailable && (
            <section>
              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-800"><Hand className="h-4 w-4" /> Take it home now{stallOffer!.locationName ? ` · ${stallOffer!.locationName}` : ''}</p>
              <Option
                checked={selected.has(STALL_OPTION)} onClick={() => toggle(STALL_OPTION)} highlight
                disabled={alreadyHasStallLine}
                badge="The print in your hand"
                title={`${SIZE_NAMES[stallOffer!.size!]} print — ready now`}
                subtitle={alreadyHasStallLine ? 'Already in your basket' : 'Pay on your phone and take it with you'}
                perk={alreadyHasStallLine ? undefined : 'Free digital copy included'}
                price={gbp(stallOffer!.pricePence)}
                wasPrice={stallOffer!.discountPct ? gbp(stallOffer!.listPricePence) : undefined}
              />
            </section>
          )}

          {!products && !loadError && <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />)}</div>}
          {loadError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}

          {digital.length > 0 && (
            <section>
              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-800"><Download className="h-4 w-4" /> Digital</p>
              <div className="space-y-2">
                {digital.map(p => (
                  <Option key={p.id} checked={!anyPrintSelected && selected.has(p.id)} onClick={() => !anyPrintSelected && toggle(p.id)}
                    disabled={anyPrintSelected}
                    title={anyPrintSelected ? 'Digital download — included free' : 'Digital download only'}
                    subtitle={anyPrintSelected ? 'Comes free with the print you’ve chosen 🎁' : 'High-resolution file · instant · perfect for phones and socials'}
                    price={anyPrintSelected ? 'Free' : gbp(pence(p.pricing))}
                    wasPrice={anyPrintSelected ? gbp(pence(p.pricing)) : undefined} />
                ))}
              </div>
            </section>
          )}

          {Object.entries(printsByMedium).map(([medium, rows]) => (
            <section key={medium}>
              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-gray-800">
                <Truck className="h-4 w-4" /> {medium} · {stallAvailable ? 'made to order, delivered' : 'delivered'}
              </p>
              <div className="space-y-2">
                {rows.map(p => {
                  const sameSize = !!scannedSize && p.size_code === scannedSize;
                  return (
                    <Option key={p.id} checked={selected.has(p.id)} onClick={() => toggle(p.id)}
                      highlight={sameSize && !stallAvailable}
                      title={`${p.size_name || ''} ${p.width_cm ? `${p.width_cm}×${p.height_cm} cm` : p.name}`.trim()}
                      subtitle={sameSize ? (stallAvailable ? 'Same size as the one in your hand, made fresh and delivered' : 'Same size as the print you scanned') : p.media_description}
                      perk="Free digital copy included"
                      price={gbp(pence(p.pricing))} />
                  );
                })}
              </div>
            </section>
          ))}

          {products && products.length === 0 && !stallAvailable && (
            <p className="text-sm text-gray-600">No products are set up for this design’s format yet.</p>
          )}
        </div>

        <div className="border-t bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2">
          <button onClick={() => add('checkout')} disabled={!selected.size || !!busy}
            className="flex h-14 w-full items-center justify-between rounded-2xl bg-purple-600 px-5 text-lg font-semibold text-white shadow-lg disabled:bg-purple-300">
            <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" />{busy === 'checkout' ? 'One moment…' : 'Checkout now'}</span>
            {total > 0 && <span>{gbp(total)}</span>}
          </button>
          <button onClick={() => add('basket')} disabled={!selected.size || !!busy}
            className="h-12 w-full rounded-2xl border-2 border-purple-600 font-semibold text-purple-800 disabled:border-purple-200 disabled:text-purple-300">
            {busy === 'basket' ? 'Adding…' : 'Add to basket & keep shopping'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Option({ checked, onClick, title, subtitle, price, wasPrice, highlight, badge, disabled, perk }: {
  checked: boolean; onClick: () => void; title: string; subtitle?: string | null; price: string;
  wasPrice?: string; highlight?: boolean; badge?: string; disabled?: boolean; perk?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} aria-pressed={checked}
      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left transition disabled:opacity-60 ${
        checked ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-100' : highlight ? 'border-purple-300 bg-white' : 'border-gray-200 bg-white'}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'border-purple-600 bg-purple-600 text-white' : 'border-gray-300'}`}>
        {checked && <Check className="h-4 w-4" />}
      </span>
      <span className="flex-1 min-w-0">
        {badge && <span className="mb-1 inline-block rounded-full bg-purple-600 px-2 py-0.5 text-[11px] font-semibold text-white">{badge}</span>}
        <span className="block font-semibold text-gray-900">{title}</span>
        {subtitle && <span className="block text-xs text-gray-500">{subtitle}</span>}
        {perk && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-700"><Gift className="h-3 w-3" />{perk}</span>}
      </span>
      <span className="text-right">
        <span className="block font-bold text-gray-900">{price}</span>
        {wasPrice && <span className="block text-xs text-gray-400 line-through">{wasPrice}</span>}
      </span>
    </button>
  );
}
