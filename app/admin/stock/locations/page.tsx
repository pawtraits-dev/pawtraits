'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MapPin, Plus } from 'lucide-react';
import type { StockLocation, StockLocationType } from '@/lib/product-types';

const TYPES: StockLocationType[] = ['stall', 'studio', 'partner', 'other'];

export default function StockLocationsPage() {
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', location_type: 'stall' as StockLocationType, address: '', notes: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/stock/locations');
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Failed to load locations');
    else setLocations(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/stock/locations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    setForm({ code: '', name: '', location_type: 'stall', address: '', notes: '' });
    load();
  }

  async function toggleActive(l: StockLocation) {
    const res = await fetch('/api/admin/stock/locations', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: l.id, is_active: !l.is_active }),
    });
    if (res.ok) load(); else setError((await res.json()).error);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="w-6 h-6" /> Stock Locations</h1>
        <p className="text-gray-600 mt-1">
          Stalls and other places prints are sold. The code is printed into sticker QR codes, so scans and orders are credited to that location.
          Codes can’t be changed once created — deactivate instead.
        </p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader><CardTitle className="text-lg">Add location</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="md:col-span-1 text-sm">
              <span className="text-xs text-gray-500">Code (2–8, A–Z 0–9)</span>
              <Input value={form.code} maxLength={8} placeholder="CAMDEN"
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} required />
            </label>
            <label className="md:col-span-2 text-sm">
              <span className="text-xs text-gray-500">Name</span>
              <Input value={form.name} placeholder="Camden Market stall" onChange={e => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="md:col-span-1 text-sm">
              <span className="text-xs text-gray-500">Type</span>
              <select className="w-full border rounded h-10 px-2" value={form.location_type}
                onChange={e => setForm({ ...form, location_type: e.target.value as StockLocationType })}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="md:col-span-1 text-sm">
              <span className="text-xs text-gray-500">Address / notes</span>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </label>
            <Button type="submit" disabled={saving || form.code.length < 2}><Plus className="w-4 h-4 mr-1" />{saving ? 'Saving…' : 'Add'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-gray-500">Loading…</p> : locations.length === 0 ? (
            <p className="text-gray-500">No locations yet — run the qr-stickers migration if STUDIO is missing.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="py-2">Code</th><th>Name</th><th>Type</th><th>Address</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {locations.map(l => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 font-mono font-medium">{l.code}</td>
                    <td>{l.name}</td>
                    <td className="capitalize">{l.location_type}</td>
                    <td className="text-gray-600">{l.address || '—'}</td>
                    <td>{l.is_active ? <span className="text-green-700">Active</span> : <span className="text-gray-400">Inactive</span>}</td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(l)}>{l.is_active ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
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
