'use client';

/**
 * /admin/orders → Packed → Royal Mail labels. Shows the suggested parcel for each selected order
 * (large letter / small parcel…, weight, Click & Drop service code), lets you change them, then
 * sends the orders to Click & Drop and opens one PDF of labels. Optionally marks them posted
 * (the customer gets the "on its way" email). Royal Mail settings are at the bottom.
 * API: /api/admin/orders/fulfilment/royal-mail (lib/shipping/royal-mail/server.ts).
 */
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Settings2 } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';

type Format = 'largeLetter' | 'smallParcel' | 'mediumParcel';
interface Plan { orderId: string; orderNumber: string; format: Format; grams: number; serviceCode: string; destination: string; prints: number; note: string | null; name: string; postcode: string; country: string; labelled: boolean; trackingNumber: string | null }
interface Settings { service_uk: string; service_europe: string; service_world: string; packaging_grams: number; print_grams_per_100cm2: number; large_letter_max_prints: number }
const FORMAT_LABEL: Record<Format, string> = { largeLetter: 'Large letter', smallParcel: 'Small parcel', mediumParcel: 'Medium parcel' };

export default function RoyalMailLabelsDialog({ open, orderIds, onOpenChange, onDone }: { open: boolean; orderIds: string[]; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [connected, setConnected] = useState<{ clickAndDrop: boolean; tracking: boolean } | null>(null);
  const [markPosted, setMarkPosted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ orderNumber: string; ok: boolean; trackingNumber?: string; error?: string; posted?: boolean }[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPlans(null); setResults(null); setError(null);
    fetch(`/api/admin/orders/fulfilment/royal-mail?ids=${orderIds.join(',')}`, { credentials: 'include' }).then(r => r.json()).then(d => {
      if (d.error) { setError(d.error); return; }
      setPlans(d.plans); setSettings(d.settings); setConnected(d.connected);
    }).catch(() => setError('Could not load the orders'));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- the orders chosen when it opened

  const set = (id: string, patch: Partial<Plan>) => setPlans(ps => ps?.map(p => (p.orderId === id ? { ...p, ...patch } : p)) ?? null);

  const make = async () => {
    if (!plans?.length) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/admin/orders/fulfilment/royal-mail', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markPosted, orders: plans.map(p => ({ orderId: p.orderId, format: p.format, grams: p.grams, serviceCode: p.serviceCode })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Failed (${r.status})`);
      setResults(d.results);
      if (d.pdf) {
        const blob = new Blob([Uint8Array.from(atob(d.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 120_000);
      }
      onDone();
    } catch (e: any) { setError(e.message); }
    setBusy(false);
  };

  const saveSettings = async (next: Settings) => {
    setSettings(next);
    const r = await new AdminSupabaseService().updateAppSetting('royal_mail', next);
    if (!r.ok) setError(r.error);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Royal Mail labels</DialogTitle>
          <DialogDescription>Sends these orders to Click &amp; Drop and opens one PDF of labels to print. Check the parcel size and weight first.</DialogDescription>
        </DialogHeader>
        {connected && !connected.clickAndDrop && <p className="rounded bg-amber-50 p-2 text-sm text-amber-900">Royal Mail isn&apos;t connected yet: add <code>CLICK_AND_DROP_API_KEY</code> to the site&apos;s environment (Click &amp; Drop → Settings → Integrations → API).</p>}
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {!plans && !error && <p className="text-sm text-gray-500"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />Loading…</p>}

        {plans && !results && (
          <>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Order</th><th>Parcel</th><th>Weight (g)</th><th>Service</th></tr></thead>
              <tbody>
                {plans.map(p => (
                  <tr key={p.orderId} className="border-t align-top">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{p.orderNumber}</div>
                      <div className="text-xs text-gray-500">{p.name} · {p.postcode} · {p.country} · {p.prints} print{p.prints === 1 ? '' : 's'}</div>
                      {p.labelled && <div className="text-xs text-purple-700">Already sent: label printed again{p.trackingNumber ? ` (${p.trackingNumber})` : ''}</div>}
                      {p.note && <div className="text-xs text-amber-700">{p.note}</div>}
                    </td>
                    <td className="py-2 pr-2">
                      <select value={p.format} disabled={p.labelled} onChange={e => set(p.orderId, { format: e.target.value as Format })} className="rounded border border-gray-300 px-1 py-1 text-sm">
                        {(Object.keys(FORMAT_LABEL) as Format[]).map(f => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2"><input type="number" min={1} max={30000} value={p.grams} disabled={p.labelled} onChange={e => set(p.orderId, { grams: Number(e.target.value) })} className="w-20 rounded border border-gray-300 px-1 py-1 text-sm" /></td>
                    <td className="py-2"><input value={p.serviceCode} disabled={p.labelled} placeholder="Rules" onChange={e => set(p.orderId, { serviceCode: e.target.value.toUpperCase() })} className="w-20 rounded border border-gray-300 px-1 py-1 font-mono text-sm" title="Click & Drop service code; empty = Click & Drop's shipping rules choose" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!plans.length && <p className="text-sm text-gray-500">None of these orders have prints to post.</p>}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={markPosted} onChange={e => setMarkPosted(e.target.checked)} className="mt-0.5" />
              <span><Mail className="mr-1 inline h-4 w-4 text-purple-600" />Mark them posted and email each customer their tracking number <span className="text-gray-500">(untick if you&apos;re not posting today: they&apos;ll be marked posted automatically at Royal Mail&apos;s first scan)</span></span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => setShowSettings(v => !v)} className="text-xs text-gray-600 underline"><Settings2 className="mr-1 inline h-3 w-3" />Royal Mail settings</button>
              <Button onClick={make} disabled={busy || !plans.length || (connected ? !connected.clickAndDrop : false)} className="bg-purple-600 hover:bg-purple-700">
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Make {plans.length} label{plans.length === 1 ? '' : 's'}
              </Button>
            </div>
          </>
        )}

        {results && (
          <div className="space-y-2 text-sm">
            <ul className="divide-y rounded border">
              {results.map(r => (
                <li key={r.orderNumber} className="flex justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{r.orderNumber}</span>
                  <span className={r.ok && !r.error ? 'text-green-700' : r.ok ? 'text-amber-700' : 'text-red-700'}>
                    {r.ok ? `${r.trackingNumber ?? 'Label made'}${r.posted ? ' · posted, customer emailed' : ''}${r.error ? ` · ${r.error}` : ''}` : r.error}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500">The label PDF opened in a new tab (allow pop-ups if it didn&apos;t). Print at 100% / actual size.</p>
            <div className="flex justify-end"><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></div>
          </div>
        )}

        {showSettings && settings && (
          <div className="space-y-2 rounded-lg border bg-gray-50 p-3 text-xs">
            <p className="text-gray-600">Service codes are Click &amp; Drop&apos;s (see Click &amp; Drop → Settings → Services, or a label you&apos;ve made there). Leave one empty to let your Click &amp; Drop shipping rules choose.</p>
            <div className="grid grid-cols-3 gap-2">
              {(['service_uk', 'service_europe', 'service_world'] as const).map(k => (
                <label key={k}>{k === 'service_uk' ? 'UK' : k === 'service_europe' ? 'Europe' : 'Rest of world'}
                  <input defaultValue={settings[k]} onBlur={e => saveSettings({ ...settings, [k]: e.target.value.trim().toUpperCase() })} className="mt-0.5 block w-full rounded border border-gray-300 px-1 py-1 font-mono" />
                </label>
              ))}
              <label>Packaging (g)<input type="number" defaultValue={settings.packaging_grams} onBlur={e => saveSettings({ ...settings, packaging_grams: Number(e.target.value) || 0 })} className="mt-0.5 block w-full rounded border border-gray-300 px-1 py-1" /></label>
              <label>Print weight (g per 100 cm²)<input type="number" step="0.5" defaultValue={settings.print_grams_per_100cm2} onBlur={e => saveSettings({ ...settings, print_grams_per_100cm2: Number(e.target.value) || 0 })} className="mt-0.5 block w-full rounded border border-gray-300 px-1 py-1" /></label>
              <label>Prints per large letter<input type="number" defaultValue={settings.large_letter_max_prints} onBlur={e => saveSettings({ ...settings, large_letter_max_prints: Number(e.target.value) || 0 })} className="mt-0.5 block w-full rounded border border-gray-300 px-1 py-1" /></label>
            </div>
            <p className="text-gray-500">Weigh a packed 20×30 to set these: packaging + print weight × area. Changes apply next time you open this.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
