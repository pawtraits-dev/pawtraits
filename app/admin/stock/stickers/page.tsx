'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Printer, Plus, Trash2, FileDown } from 'lucide-react';
import type { StockLocation } from '@/lib/product-types';

interface Row { imageId: string; stockRef: number; description: string | null; thumb: string | null; size: string; quantity: number }

export default function StickerSheetPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [locationCode, setLocationCode] = useState('');
  const [refInput, setRefInput] = useState('');
  const [startPosition, setStartPosition] = useState(1);
  const [showGuides, setShowGuides] = useState(false);
  const [includeThumbnails, setIncludeThumbnails] = useState(true);
  const [cta, setCta] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stock/locations?activeOnly=true').then(r => (r.ok ? r.json() : [])).then(setLocations).catch(() => {});
    // Arrived from the catalogue QR panel: ?add=<imageId>&size=M&loc=CAMDEN
    const qs = new URLSearchParams(window.location.search);
    const add = qs.get('add');
    if (qs.get('loc')) setLocationCode(qs.get('loc')!.toUpperCase());
    if (add) addImages(`ids=${encodeURIComponent(add)}`, qs.get('size')?.toUpperCase() || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addImages(query: string, size = '') {
    setError(null);
    const res = await fetch(`/api/admin/stock/stickers?${query}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    if (!data.length) { setError('No matching images found'); return; }
    setRows(prev => {
      const next = [...prev];
      for (const img of data) {
        next.push({ imageId: img.id, stockRef: img.stock_ref, description: img.description, thumb: img.public_url, size, quantity: 1 });
      }
      return next;
    });
  }

  function addByRef(e: React.FormEvent) {
    e.preventDefault();
    const refs = refInput.split(/[\s,]+/).map(s => s.replace(/[^0-9]/g, '')).filter(Boolean);
    if (!refs.length) return;
    addImages(`refs=${refs.join(',')}`);
    setRefInput('');
  }

  const update = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const totalLabels = rows.reduce((n, r) => n + (r.quantity || 0), 0);
  const sheets = Math.ceil((totalLabels + startPosition - 1) / 8);

  async function generate() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/admin/stock/stickers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map(r => ({ imageId: r.imageId, size: r.size || undefined, quantity: r.quantity })),
          locationCode: locationCode || undefined, startPosition, showGuides, includeThumbnails, cta: cta || undefined,
        }),
      });
      if (!res.ok) { setError((await res.json()).error || 'Failed to generate'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'stickers.pdf';
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Printer className="w-6 h-6" /> Sticker Sheets</h1>
        <p className="text-gray-600 mt-1">
          Build an A4 sheet of rear stickers (8 per sheet, 99.1 × 67.7 mm). Each QR takes the customer straight to that image’s customise page,
          and — if you pick a location — credits scans and orders to that stall.
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader><CardTitle className="text-lg">Settings</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <label>
            <span className="text-xs text-gray-500">Location (printed into every QR)</span>
            <select className="w-full border rounded h-10 px-2" value={locationCode} onChange={e => setLocationCode(e.target.value)}>
              <option value="">No location</option>
              {locations.map(l => <option key={l.id} value={l.code}>{l.code} — {l.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs text-gray-500">Start at label position (1–8)</span>
            <Input type="number" min={1} max={8} value={startPosition}
              onChange={e => setStartPosition(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs text-gray-500">Call to action (optional)</span>
            <Input value={cta} placeholder="Scan to put YOUR pet in this picture" maxLength={60} onChange={e => setCta(e.target.value)} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={includeThumbnails} onChange={e => setIncludeThumbnails(e.target.checked)} />
            Show image thumbnail on each sticker
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} />
            Show label outlines (for a plain-paper test print)
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Images</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addByRef} className="flex gap-2">
            <Input value={refInput} placeholder="Add by ref, e.g. 1123, 1124 1130" onChange={e => setRefInput(e.target.value)} />
            <Button type="submit" variant="outline"><Plus className="w-4 h-4 mr-1" />Add</Button>
          </form>
          <p className="text-xs text-gray-500">Tip: open any image in Admin → Catalogue and use “Sticker sheet” in its QR panel.</p>

          {rows.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="py-2 w-14"></th><th>Ref</th><th>Description</th><th className="w-28">Size</th><th className="w-24">Qty</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.imageId}-${i}`} className="border-b last:border-0">
                    <td className="py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.thumb && <img src={r.thumb} alt="" className="w-10 h-10 object-cover rounded" />}
                    </td>
                    <td className="font-mono">{r.stockRef}</td>
                    <td className="text-gray-600 truncate max-w-xs">{r.description || '—'}</td>
                    <td>
                      <select className="border rounded px-2 py-1" value={r.size} onChange={e => update(i, { size: e.target.value })}>
                        <option value="">Any</option><option value="S">S</option><option value="M">M</option><option value="L">L</option>
                      </select>
                    </td>
                    <td><Input type="number" min={1} max={100} value={r.quantity} onChange={e => update(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{totalLabels} label{totalLabels === 1 ? '' : 's'} · {sheets || 0} sheet{sheets === 1 ? '' : 's'}</p>
        <Button onClick={generate} disabled={busy || !rows.length}>
          <FileDown className="w-4 h-4 mr-1" /> {busy ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>
      <p className="text-xs text-gray-500">Print at 100% / “Actual size” — not “Fit to page” — or the stickers won’t line up.</p>
    </div>
  );
}
