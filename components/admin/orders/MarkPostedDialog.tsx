'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { POSTAGE_SERVICES } from '@/lib/fulfillment/shared';
import type { PostageServiceId } from '@/lib/product-types';

const LAST_SERVICE_KEY = 'pt_admin_last_postage_service';

export interface MarkPostedValues {
  service: PostageServiceId;
  trackingCode?: string;
  trackingUrl?: string;
  carrier?: string;
  notify: boolean;
}

interface Props {
  open: boolean;
  orderNumber: string;
  customerEmail: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: MarkPostedValues) => Promise<string | null>; // returns an error message or null
}

export default function MarkPostedDialog({ open, orderNumber, customerEmail, onOpenChange, onSubmit }: Props) {
  const [service, setService] = useState<PostageServiceId>('rm_tracked_48');
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [carrier, setCarrier] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTrackingCode(''); setTrackingUrl(''); setCarrier(''); setNotify(true); setError(null);
    try {
      const last = localStorage.getItem(LAST_SERVICE_KEY) as PostageServiceId | null;
      if (last && POSTAGE_SERVICES.some(s => s.id === last)) setService(last);
    } catch { /* storage unavailable */ }
  }, [open]);

  const selected = POSTAGE_SERVICES.find(s => s.id === service)!;
  const needsCode = selected.tracked && selected.id !== 'other';

  const submit = async () => {
    if (needsCode && !trackingCode.trim()) { setError(`${selected.label} is tracked — enter the tracking number from the label.`); return; }
    setSaving(true); setError(null);
    try { localStorage.setItem(LAST_SERVICE_KEY, service); } catch { /* ignore */ }
    const err = await onSubmit({ service, trackingCode: trackingCode.trim() || undefined, trackingUrl: trackingUrl.trim() || undefined, carrier: carrier.trim() || undefined, notify });
    setSaving(false);
    if (err) setError(err); else onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark {orderNumber} posted</DialogTitle>
          <DialogDescription>Record how it was sent. The customer gets a “your order is on its way” email.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Postage service</Label>
            <Select value={service} onValueChange={v => setService(v as PostageServiceId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSTAGE_SERVICES.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}{s.tracked ? '' : ' (untracked)'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {service === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="carrier">Courier name</Label>
              <Input id="carrier" value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. DPD" />
            </div>
          )}

          {selected.tracked && (
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking number{needsCode ? '' : ' (optional)'}</Label>
              <Input id="tracking" value={trackingCode} onChange={e => setTrackingCode(e.target.value.toUpperCase())}
                placeholder={selected.carrier === 'Royal Mail' ? 'e.g. AB123456789GB' : ''} autoComplete="off" className="font-mono" />
              {selected.carrier === 'Royal Mail' && <p className="text-xs text-gray-500">The Royal Mail tracking link is added automatically.</p>}
            </div>
          )}

          {service === 'other' && (
            <div className="space-y-2">
              <Label htmlFor="trackingUrl">Tracking link (optional)</Label>
              <Input id="trackingUrl" value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}

          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="mt-0.5 h-4 w-4 accent-purple-600" />
            <span>Email the customer now <span className="text-gray-500">({customerEmail})</span></span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-green-600 hover:bg-green-700">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Mark posted
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
