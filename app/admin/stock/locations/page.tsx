'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MapPin, Pencil, Plus } from 'lucide-react';
import type { StockLocation, StockLocationType } from '@/lib/product-types';
import { AdminSupabaseService } from '@/lib/admin-supabase';

const TYPES: StockLocationType[] = ['stall', 'studio', 'partner', 'other'];

export default function StockLocationsPage() {
  const adminService = new AdminSupabaseService();
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', location_type: 'stall' as StockLocationType, address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; location_type: StockLocationType; address: string; notes: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const result = await adminService.getStockLocations();
    if (result.ok) setLocations(result.data);
    else setError(result.error);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    const result = await adminService.createStockLocation(form);
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setForm({ code: '', name: '', location_type: 'stall', address: '', notes: '' });
    load();
  }

  function startEdit(l: StockLocation) {
    setError(null);
    setEditing({ id: l.id, name: l.name, location_type: l.location_type, address: l.address ?? '', notes: l.notes ?? '' });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) { setError('Name is required'); return; }
    setSavingEdit(true); setError(null);
    const result = await adminService.updateStockLocation({
      id: editing.id,
      name: editing.name.trim(),
      location_type: editing.location_type,
      address: editing.address.trim() || null,
      notes: editing.notes.trim() || null,
    });
    setSavingEdit(false);
    if (!result.ok) { setError(result.error); return; }
    setEditing(null);
    load();
  }

  async function toggleActive(l: StockLocation) {
    const result = await adminService.updateStockLocation({ id: l.id, is_active: !l.is_active });
    if (result.ok) load(); else setError(result.error);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="w-6 h-6" /> Stock Locations</h1>
        <p className="text-gray-600 mt-1">
          Stalls and other places prints are sold. The code is printed into sticker QR codes, so scans and orders are credited to that location.
          Press Edit to change a location’s name, type, address or notes; the new name shows wherever the location appears, including the stall option customers see after a scan.
          Codes can’t be changed once created, because they are printed on stickers. Deactivate instead.
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
                {locations.map(l => editing?.id === l.id ? (
                  <tr key={l.id} className="border-b last:border-0 bg-purple-50/50">
                    <td className="py-2 font-mono font-medium align-top">{l.code}</td>
                    <td className="py-2 pr-2 align-top">
                      <Input aria-label="Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
                      <Input aria-label="Notes" className="mt-2" placeholder="Notes" value={editing.notes} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <select aria-label="Type" className="w-full border rounded h-10 px-2" value={editing.location_type}
                        onChange={e => setEditing({ ...editing, location_type: e.target.value as StockLocationType })}>
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <Input aria-label="Address" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} />
                    </td>
                    <td className="py-2 align-top">{l.is_active ? <span className="text-green-700">Active</span> : <span className="text-gray-400">Inactive</span>}</td>
                    <td className="py-2 text-right align-top whitespace-nowrap">
                      <Button size="sm" onClick={saveEdit} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit}>Cancel</Button>
                    </td>
                  </tr>
                ) : (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-2 font-mono font-medium">{l.code}</td>
                    <td>{l.name}</td>
                    <td className="capitalize">{l.location_type}</td>
                    <td className="text-gray-600">{l.address || '—'}</td>
                    <td>{l.is_active ? <span className="text-green-700">Active</span> : <span className="text-gray-400">Inactive</span>}</td>
                    <td className="text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(l)} disabled={!!editing}><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
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
