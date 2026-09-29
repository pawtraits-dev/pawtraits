'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Settings } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { AppSettingsMap } from '@/lib/product-types';


export default function GuestAndStallSettingsPage() {
  const adminService = new AdminSupabaseService();
  const [settings, setSettings] = useState<AppSettingsMap | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const result = await adminService.getAppSettings();
    if (!result.ok) { setMsg({ type: 'err', text: result.error }); return; }
    setSettings(result.data);
    setDraft(Object.fromEntries(Object.entries(result.data).map(([k, v]) => [k, v.value])));
  }
  useEffect(() => { load(); }, []);

  async function save(key: string, value: any) {
    setSaving(key); setMsg(null);
    const result = await adminService.updateAppSetting(key, value);
    setSaving(null);
    if (!result.ok) { setMsg({ type: 'err', text: result.error }); return; }
    setMsg({ type: 'ok', text: 'Saved — takes effect within a minute.' });
    load();
  }

  const pounds = (p: number) => (p / 100).toFixed(2);

  if (!settings) return <div className="p-6">{msg ? <p className="text-red-600">{msg.text}</p> : 'Loading…'}</div>;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" /> Guest & Stall Settings</h1>
        <p className="text-gray-600 mt-1">Controls for customers who haven’t signed up yet, and for “pay on your phone” stall sales.</p>
      </div>
      {msg && <div className={`rounded border px-4 py-2 text-sm ${msg.type === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{msg.text}</div>}

      <Card>
        <CardHeader><CardTitle className="text-lg">Free previews for guests</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className="font-medium">Previews per device per 24 hours</span>
              <p className="text-xs text-gray-500">Each preview is one AI generation (a real cost). Signed-in customers aren’t affected.</p>
              <Input type="number" min={0} value={draft.guest_preview_daily_limit ?? ''} onChange={e => setDraft({ ...draft, guest_preview_daily_limit: parseInt(e.target.value || '0', 10) })} />
            </label>
            <Button disabled={saving === 'guest_preview_daily_limit'} onClick={() => save('guest_preview_daily_limit', draft.guest_preview_daily_limit)}>Save</Button>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className="font-medium">Backstop per IP address per 24 hours</span>
              <p className="text-xs text-gray-500">Keep this high — shoppers at a stall often share the same mobile network address.</p>
              <Input type="number" min={0} value={draft.guest_preview_ip_daily_limit ?? ''} onChange={e => setDraft({ ...draft, guest_preview_ip_daily_limit: parseInt(e.target.value || '0', 10) })} />
            </label>
            <Button disabled={saving === 'guest_preview_ip_daily_limit'} onClick={() => save('guest_preview_ip_daily_limit', draft.guest_preview_ip_daily_limit)}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Stall: pay on your phone</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <span className="font-medium">Ready-made print prices (£)</span>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {(['S', 'M', 'L'] as const).map(s => (
                <label key={s}>
                  <span className="text-xs text-gray-500">{s === 'S' ? 'Small' : s === 'M' ? 'Medium' : 'Large'} ({s})</span>
                  <Input type="number" step="0.01" min={1}
                    value={draft.stall_prices_pence ? pounds(draft.stall_prices_pence[s]) : ''}
                    onChange={e => setDraft({ ...draft, stall_prices_pence: { ...draft.stall_prices_pence, [s]: Math.round(parseFloat(e.target.value || '0') * 100) } })} />
                </label>
              ))}
            </div>
            <Button className="mt-2" disabled={saving === 'stall_prices_pence'} onClick={() => save('stall_prices_pence', draft.stall_prices_pence)}>Save prices</Button>
          </div>
          <div className="flex items-end gap-3">
            <label className="flex-1">
              <span className="font-medium">Discount for paying online at the stall (%)</span>
              <p className="text-xs text-gray-500">Optional nudge away from cash/card reader. 0 = no discount.</p>
              <Input type="number" min={0} max={100} value={draft.stall_online_discount_pct ?? 0} onChange={e => setDraft({ ...draft, stall_online_discount_pct: Number(e.target.value || 0) })} />
            </label>
            <Button disabled={saving === 'stall_online_discount_pct'} onClick={() => save('stall_online_discount_pct', draft.stall_online_discount_pct)}>Save</Button>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!draft.welcome_gift_enabled}
              onChange={e => { setDraft({ ...draft, welcome_gift_enabled: e.target.checked }); save('welcome_gift_enabled', e.target.checked); }} />
            <span>
              <span className="font-medium">Free digital download with every print bought on the website</span> — online and at the stall.
              Account holders get it straight away; guests unlock it from the “account ready” email, which confirms their email address.
              Card-reader and cash sales don’t qualify, which is the nudge to pay on the website.
            </span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
