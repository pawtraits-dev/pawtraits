'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Printer, Download, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { shippingSummary } from '@/lib/shipping/rates';
import { SHAPE_FAMILIES, type ShapeFamily } from '@/lib/products/shape-family';
import { cropNote } from '@/lib/print/print-geometry';
import type { CatalogueProduct, CatalogueProductInput } from '@/lib/product-types';

const adminService = new AdminSupabaseService();

const toPounds = (pence?: number | null) => (pence === null || pence === undefined ? '' : (pence / 100).toFixed(2));
function toPence(value: string): number | null {
  const v = value.replace(/[£,\s]/g, '');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
const gbp = (pence: number) => `${pence < 0 ? '−' : ''}£${(Math.abs(pence) / 100).toFixed(2)}`;

interface FormState {
  product_type: 'physical_print' | 'digital_download';
  medium_id: string;
  shape_family: ShapeFamily;
  size_name: string;
  size_code: string;
  width_cm: string;
  height_cm: string;
  description: string;
  price: string;
  unit_cost: string;
  postage_cost: string;
  gelato_sku: string;
  gelato_sku_landscape: string;
  is_active: boolean;
  is_featured: boolean;
  display_order: string;
}

function initialState(product?: CatalogueProduct | null, type?: string | null): FormState {
  const digital = product ? product.product_type === 'digital_download' : type === 'digital_download';
  return {
    product_type: digital ? 'digital_download' : 'physical_print',
    medium_id: product?.medium_id || '',
    shape_family: (product?.shape_family as ShapeFamily) || (digital ? 'any' : 'rect_2x3'),
    size_name: product?.size_name || (digital ? 'Digital' : ''),
    size_code: product?.size_code || (digital ? 'D' : ''),
    width_cm: product?.width_cm ? String(product.width_cm) : '',
    height_cm: product?.height_cm ? String(product.height_cm) : '',
    description: product?.description || '',
    price: toPounds(product?.price_pence),
    unit_cost: toPounds(product?.unit_cost_pence ?? 0),
    postage_cost: toPounds(product?.postage_cost_pence ?? 0),
    gelato_sku: product?.gelato_sku || '',
    gelato_sku_landscape: product?.gelato_sku_landscape || '',
    is_active: product?.is_active ?? true,
    is_featured: product?.is_featured ?? false,
    display_order: String(product?.display_order ?? 0),
  };
}

/** Create / edit a product: what it is, which designs it's offered on, its UK price and costs. */
export default function ProductForm({ product, initialType }: { product?: CatalogueProduct | null; initialType?: string | null }) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(product, initialType));
  const [media, setMedia] = useState<Array<{ id: string; name: string; slug: string; is_active?: boolean }>>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGelato, setShowGelato] = useState(!!(product?.gelato_sku || product?.gelato_sku_landscape));

  useEffect(() => {
    adminService.getMedia(false).then(list => setMedia((list || []) as any));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));
  const isPrint = form.product_type === 'physical_print';

  const setType = (type: FormState['product_type']) => setForm(f => ({
    ...f,
    product_type: type,
    shape_family: type === 'digital_download' ? 'any' : f.shape_family === 'any' ? 'rect_2x3' : f.shape_family,
    size_name: type === 'digital_download' && !f.size_name ? 'Digital' : f.size_name,
    size_code: type === 'digital_download' && !f.size_code ? 'D' : f.size_code,
  }));

  // Money + margin preview
  const price = toPence(form.price);
  const unitCost = toPence(form.unit_cost) ?? 0;
  const postage = toPence(form.postage_cost) ?? 0;
  const fees = price && price > 0 ? Math.round(price * 0.015 + 20) : 0;
  const margin = price && price > 0 && !Number.isNaN(unitCost) && !Number.isNaN(postage) ? price - unitCost - postage - fees : null;

  // Size preview
  const w = Number(form.width_cm), h = Number(form.height_cm);
  const short = Math.min(w, h), long = Math.max(w, h);
  const sizeOk = w > 0 && h > 0;
  const sizePreview = useMemo(() => {
    if (!isPrint || !sizeOk) return null;
    if (form.shape_family === 'rect_2x3') {
      const note = cropNote('portrait', short, long);
      return { lines: [`Portrait designs print ${short}×${long} cm`, `Landscape designs print ${long}×${short} cm`], note: note ? `Not 2:3, so designs are ${note.toLowerCase().replace(' to fit', '')} to fit.` : 'Exactly 2:3 — designs print edge to edge.' };
    }
    if (form.shape_family === 'square') return { lines: [`Square designs print ${short}×${short} cm`], note: w !== h ? 'Width and height must be equal.' : null };
    if (form.shape_family === 'wide') return { lines: [`Wide designs print ${long}×${short} cm`], note: null };
    return null;
  }, [isPrint, sizeOk, form.shape_family, short, long, w, h]);

  const submit = async () => {
    setError(null);
    if (price === null || Number.isNaN(price)) { setError('Enter a price.'); return; }
    if (Number.isNaN(unitCost) || Number.isNaN(postage)) { setError('Costs must be amounts in pounds, e.g. 1.20'); return; }
    const input: CatalogueProductInput = {
      product_type: form.product_type,
      medium_id: form.medium_id,
      shape_family: form.shape_family,
      size_name: form.size_name,
      size_code: form.size_code.toUpperCase(),
      width_cm: isPrint ? w : null,
      height_cm: isPrint ? h : null,
      description: form.description,
      price_pence: price,
      unit_cost_pence: unitCost,
      postage_cost_pence: isPrint ? postage : 0,
      gelato_sku: isPrint ? form.gelato_sku : null,
      gelato_sku_landscape: isPrint ? form.gelato_sku_landscape : null,
      is_active: form.is_active,
      is_featured: form.is_featured,
      display_order: Number.parseInt(form.display_order, 10) || 0,
    };
    setSaving(true);
    const result = await adminService.saveCatalogueProduct(input, product?.id);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    toast({ title: product ? `${result.data.name} saved` : `${result.data.name} added` });
    router.push('/admin/products');
  };

  const remove = async () => {
    if (!product || !window.confirm(`Delete ${product.name}? If it has been ordered it will be deactivated instead.`)) return;
    setDeleting(true);
    const result = await adminService.deleteCatalogueProduct(product.id);
    setDeleting(false);
    if (!result.ok) { setError(result.error); return; }
    toast({ title: result.data.deleted ? `${product.name} deleted` : `${product.name} has orders, so it was deactivated instead` });
    router.push('/admin/products');
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* What it is */}
      <Card>
        <CardHeader><CardTitle>Product</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {([['physical_print', 'Print', Printer, 'Printed and posted (self-print by default)'], ['digital_download', 'Digital download', Download, 'High-res file, delivered by email']] as const).map(([value, label, Icon, hint]) => (
              <button key={value} type="button" onClick={() => setType(value)}
                className={`rounded-lg border-2 p-3 text-left ${form.product_type === value ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                <div className="flex items-center gap-2 font-medium text-gray-900"><Icon className="w-4 h-4" />{label}</div>
                <p className="mt-1 text-xs text-gray-600">{hint}</p>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="medium">Material</Label>
            <select id="medium" value={form.medium_id} onChange={e => set('medium_id', e.target.value)}
              className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm">
              <option value="" disabled>Choose…</option>
              {media.map(m => <option key={m.id} value={m.id}>{m.name}{m.is_active === false ? ' (inactive)' : ''}</option>)}
            </select>
            <p className="text-xs text-gray-500">Add or edit materials in <Link href="/admin/media" className="text-purple-700 underline">Media</Link>.</p>
          </div>

          {isPrint && (
            <div className="space-y-2">
              <Label>Offered on</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {SHAPE_FAMILIES.filter(f => f.id !== 'any').map(f => (
                  <button key={f.id} type="button" onClick={() => set('shape_family', f.id)}
                    className={`rounded-lg border-2 p-3 text-left ${form.shape_family === f.id ? 'border-purple-600 bg-purple-50' : 'border-gray-200 hover:border-purple-300'}`}>
                    <div className="font-medium text-gray-900 text-sm">{f.label}</div>
                    <div className="text-xs text-gray-500">{f.ratios.join(' · ')}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{SHAPE_FAMILIES.find(f => f.id === form.shape_family)?.hint}</p>
            </div>
          )}
          {!isPrint && <p className="text-sm text-gray-600">Offered on every design, and included free with any print bought on the website.</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="size_name">Size name</Label>
              <Input id="size_name" value={form.size_name} onChange={e => set('size_name', e.target.value)} placeholder={isPrint ? 'e.g. Medium' : 'Digital'} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="size_code">Size code</Label>
              <Input id="size_code" value={form.size_code} onChange={e => set('size_code', e.target.value.toUpperCase())} placeholder="e.g. M" maxLength={4} />
              <p className="text-xs text-gray-500">Used on stickers and stock refs (S, M, L…).</p>
            </div>
          </div>

          {isPrint && (
            <div className="space-y-2">
              <Label>Print size (cm)</Label>
              <div className="flex items-center gap-2">
                <Input aria-label="Width" inputMode="decimal" value={form.width_cm} onChange={e => set('width_cm', e.target.value)} placeholder="20" className="w-24" />
                <span className="text-gray-500">×</span>
                <Input aria-label="Height" inputMode="decimal" value={form.height_cm} onChange={e => set('height_cm', e.target.value)} placeholder="30" className="w-24" />
                <span className="text-sm text-gray-500">cm</span>
              </div>
              {sizePreview && (
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                  {sizePreview.lines.map(l => <div key={l}>{l}</div>)}
                  {sizePreview.note && <div className="mt-1 text-gray-500">{sizePreview.note}</div>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Shown under the size in the buy panel" />
          </div>
        </CardContent>
      </Card>

      {/* Price and margin */}
      <Card>
        <CardHeader><CardTitle>Price (UK)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input id="price" inputMode="decimal" value={form.price} onChange={e => set('price', e.target.value)} placeholder="35.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_cost">Unit cost</Label>
              <Input id="unit_cost" inputMode="decimal" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)} placeholder="0.00" />
              <p className="text-xs text-gray-500">{isPrint ? 'Blank, ink, packaging' : 'e.g. upscaling'}</p>
            </div>
            {isPrint && (
              <div className="space-y-2">
                <Label htmlFor="postage_cost">Postage cost</Label>
                <Input id="postage_cost" inputMode="decimal" value={form.postage_cost} onChange={e => set('postage_cost', e.target.value)} placeholder="0.00" />
                <p className="text-xs text-gray-500">Only postage the delivery charge doesn’t cover — usually 0</p>
              </div>
            )}
          </div>
          {margin !== null && (
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
              <span className={margin < 0 ? 'text-red-700 font-semibold' : 'text-gray-900 font-semibold'}>Margin {gbp(margin)}{price ? ` (${Math.round((margin / price) * 100)}%)` : ''}</span>
              <span className="text-gray-500"> after costs and card fees (~{gbp(fees)})</span>
            </div>
          )}
          <p className="text-xs text-gray-500">Past orders keep the price they were sold at. Delivery is charged per order on top ({shippingSummary()}).</p>
        </CardContent>
      </Card>

      {/* Gelato (optional) */}
      {isPrint && (
        <Card>
          <CardHeader className="pb-3">
            <button type="button" onClick={() => setShowGelato(s => !s)} className="flex w-full items-center justify-between text-left">
              <CardTitle className="text-base">Gelato equivalent (optional)</CardTitle>
              {showGelato ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </CardHeader>
          {showGelato && (
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">Only needed if you want to be able to send orders for this product to Gelato instead of printing them yourself. Paste the Gelato product UID.</p>
              <div className="space-y-2">
                <Label htmlFor="gelato_sku">{form.shape_family === 'rect_2x3' ? 'Gelato SKU (portrait)' : 'Gelato SKU'}</Label>
                <Input id="gelato_sku" value={form.gelato_sku} onChange={e => set('gelato_sku', e.target.value.trim())} className="font-mono text-xs" />
              </div>
              {form.shape_family === 'rect_2x3' && (
                <div className="space-y-2">
                  <Label htmlFor="gelato_sku_landscape">Gelato SKU (landscape, if different)</Label>
                  <Input id="gelato_sku_landscape" value={form.gelato_sku_landscape} onChange={e => set('gelato_sku_landscape', e.target.value.trim())} className="font-mono text-xs" />
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Visibility */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />On sale</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_featured} onCheckedChange={v => set('is_featured', v)} />Featured</label>
          <label className="flex items-center gap-2 text-sm">Sort order
            <Input value={form.display_order} onChange={e => set('display_order', e.target.value)} inputMode="numeric" className="w-20 h-8" />
          </label>
        </CardContent>
      </Card>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <Button onClick={submit} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{product ? 'Save changes' : 'Add product'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/products')} disabled={saving}>Cancel</Button>
        </div>
        {product && (
          <Button variant="ghost" onClick={remove} disabled={deleting} className="text-red-600 hover:text-red-700">
            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}Delete
          </Button>
        )}
      </div>
    </div>
  );
}
