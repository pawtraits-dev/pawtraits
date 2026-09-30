'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Download, Pencil, Loader2, AlertTriangle, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { SHAPE_FAMILIES, familyLabel, orientedSize } from '@/lib/products/shape-family';
import type { CatalogueProduct } from '@/lib/product-types';

const adminService = new AdminSupabaseService();
const gbp = (pence: number | null | undefined) => (pence === null || pence === undefined ? '—' : `${pence < 0 ? '−' : ''}£${(Math.abs(pence) / 100).toFixed(2)}`);

const GROUPS: Array<{ id: string; label: string; hint: string }> = [
  ...SHAPE_FAMILIES.map(f => ({ id: f.id, label: f.label, hint: f.hint })),
  { id: 'legacy', label: 'Single format (legacy)', hint: 'Older products tied to one format. Recreate them above, then delete these.' },
];

export default function AdminProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<CatalogueProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await adminService.getCatalogueProducts();
    if (result.ok) { setProducts(result.data); setError(null); } else setError(result.error);
  }, []);
  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const out: Record<string, CatalogueProduct[]> = {};
    for (const p of products || []) (out[p.shape_family || 'legacy'] ||= []).push(p);
    return out;
  }, [products]);

  const toggle = async (p: CatalogueProduct) => {
    setBusy(p.id);
    const result = await adminService.setCatalogueProductActive(p.id, !p.is_active);
    setBusy(null);
    if (!result.ok) { toast({ title: 'Couldn’t update', description: result.error, variant: 'destructive' }); return; }
    setProducts(list => (list || []).map(x => (x.id === p.id ? result.data : x)));
    toast({ title: `${p.name} ${result.data.is_active ? 'on sale' : 'hidden from the shop'}` });
  };

  const missingPrice = (products || []).filter(p => p.is_active && !p.price_pence).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">What customers can buy, and the UK price. Products are self-printed; a Gelato SKU is optional.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/products/new?type=digital_download"><Button variant="outline"><Download className="w-4 h-4 mr-2" />Digital download</Button></Link>
          <Link href="/admin/products/new"><Button className="bg-purple-600 hover:bg-purple-700"><Plus className="w-4 h-4 mr-2" />Add product</Button></Link>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {missingPrice > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4" />{missingPrice} product{missingPrice === 1 ? ' is' : 's are'} on sale without a UK price — customers won’t see {missingPrice === 1 ? 'it' : 'them'}.
        </p>
      )}

      {!products && !error && <div className="py-10 text-gray-500 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Loading…</div>}

      {products && products.length === 0 && (
        <Card><CardContent className="py-10 text-center text-gray-600">
          No products yet. Run <code className="text-xs">db/migrations/2026-09-30-product-catalogue.sql</code> to add the starter range (Foamex S/M/L and a digital download), or add one yourself.
        </CardContent></Card>
      )}

      {GROUPS.filter(g => grouped[g.id]?.length).map(group => (
        <Card key={group.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{group.label}</CardTitle>
            <p className="text-sm text-gray-500">{group.hint}</p>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-6 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                    <th className="px-3 py-2 font-medium text-right">Price</th>
                    <th className="px-3 py-2 font-medium text-right">Costs</th>
                    <th className="px-3 py-2 font-medium text-right">Margin</th>
                    <th className="px-3 py-2 font-medium">Gelato</th>
                    <th className="px-3 py-2 font-medium">On sale</th>
                    <th className="px-6 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {grouped[group.id].map(p => (
                    <tr key={p.id} className={`border-b last:border-0 ${p.is_active ? '' : 'text-gray-400'}`}>
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">{p.name}{p.is_featured && <Badge className="ml-2 bg-purple-100 text-purple-800">Featured</Badge>}</div>
                        <div className="text-xs text-gray-500 font-mono">{p.sku}{p.shape_family ? '' : ` · ${familyLabel(p.shape_family)}`}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {p.product_type === 'digital_download' ? 'Digital file' : (
                          <>
                            {p.size_name} <span className="text-gray-500">{orientedSize(p, 'portrait')}</span>
                            {p.shape_family === 'rect_2x3' && <div className="text-xs text-gray-500">landscape {orientedSize(p, 'landscape')}</div>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">{p.price_pence ? gbp(p.price_pence) : <span className="text-red-600">No price</span>}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{gbp(p.unit_cost_pence + p.postage_cost_pence)}</td>
                      <td className={`px-3 py-3 text-right ${p.margin_pence !== null && p.margin_pence < 0 ? 'text-red-600' : ''}`}>
                        {gbp(p.margin_pence)}{p.margin_percent !== null && <span className="text-xs text-gray-500"> {p.margin_percent}%</span>}
                      </td>
                      <td className="px-3 py-3">{p.gelato_sku ? <Check className="w-4 h-4 text-green-600" aria-label="Has Gelato SKU" /> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-3">
                        <Switch checked={p.is_active} disabled={busy === p.id} onCheckedChange={() => toggle(p)} aria-label={`${p.name} on sale`} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link href={`/admin/products/${p.id}/edit`} className="inline-flex items-center text-purple-700 hover:underline"><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-gray-500">
        Margin = price − unit cost − postage − card fees (estimated at 1.5% + 20p). Take-home prices at the stall are set in <Link href="/admin/settings/guest-and-stall" className="underline">Guest &amp; Stall Settings</Link>.
      </p>
    </div>
  );
}
