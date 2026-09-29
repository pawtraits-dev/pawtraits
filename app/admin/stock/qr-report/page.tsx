'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart3 } from 'lucide-react';

interface LocationRow { location_code: string; scans: number; unique_visitors: number; orders: number; revenue_pence: number }
interface ImageRow { stock_ref: number; image_id: string | null; scans: number; orders: number }

const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');

export default function QrReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<{ locations: LocationRow[]; topImages: ImageRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    const res = await fetch(`/api/admin/stock/qr-report?from=${from}&to=${to}`);
    const d = await res.json();
    setLoading(false);
    if (!res.ok) { setError(d.error); return; }
    setData(d);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const totals = (data?.locations ?? []).reduce(
    (t, r) => ({ scans: t.scans + r.scans, orders: t.orders + r.orders, revenue: t.revenue + r.revenue_pence }),
    { scans: 0, orders: 0, revenue: 0 }
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6" /> Sticker QR Report</h1>
        <p className="text-gray-600 mt-1">Scans of print stickers and the orders they led to (last scan within 30 days wins). Bot/link-preview hits are excluded.</p>
      </div>

      <div className="flex items-end gap-3">
        <label className="text-sm"><span className="text-xs text-gray-500">From</span><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="text-sm"><span className="text-xs text-gray-500">To</span><Input type="date" value={to} max={today} onChange={e => setTo(e.target.value)} /></label>
        <Button onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Update'}</Button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[['Scans', totals.scans.toString()], ['Orders', totals.orders.toString()], ['Revenue', gbp(totals.revenue)]].map(([k, v]) => (
          <Card key={k}><CardContent className="pt-6"><p className="text-xs text-gray-500">{k}</p><p className="text-2xl font-semibold">{v}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">By location</CardTitle></CardHeader>
        <CardContent>
          {!data?.locations.length ? <p className="text-gray-500 text-sm">No scans in this period.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="py-2">Location</th><th className="text-right">Scans</th><th className="text-right">Visitors (daily)</th>
                <th className="text-right">Orders</th><th className="text-right">Conversion</th><th className="text-right">Revenue</th>
              </tr></thead>
              <tbody>
                {data.locations.map(r => (
                  <tr key={r.location_code} className="border-b last:border-0">
                    <td className="py-2 font-mono">{r.location_code}</td>
                    <td className="text-right">{r.scans}</td>
                    <td className="text-right">{r.unique_visitors}</td>
                    <td className="text-right">{r.orders}</td>
                    <td className="text-right">{pct(r.orders, r.unique_visitors)}</td>
                    <td className="text-right">{gbp(r.revenue_pence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Most scanned images</CardTitle></CardHeader>
        <CardContent>
          {!data?.topImages.length ? <p className="text-gray-500 text-sm">No scans in this period.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Ref</th><th className="text-right">Scans</th><th className="text-right">Orders</th></tr></thead>
              <tbody>
                {data.topImages.map(r => (
                  <tr key={r.stock_ref} className="border-b last:border-0">
                    <td className="py-2 font-mono">{r.stock_ref}{!r.image_id && <span className="ml-2 text-xs text-red-600">(image missing)</span>}</td>
                    <td className="text-right">{r.scans}</td>
                    <td className="text-right">{r.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
