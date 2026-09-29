'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Copy, Download, QrCode, Printer, ExternalLink } from 'lucide-react';
import type { StockLocation } from '@/lib/product-types';
import { AdminSupabaseService } from '@/lib/admin-supabase';

/** Sticker QR for one catalogue image — shown in the admin catalogue image modal. */
export default function ImageQrPanel({ imageId }: { imageId: string }) {
  const adminService = useMemo(() => new AdminSupabaseService(), []);
  const [size, setSize] = useState('');
  const [loc, setLoc] = useState('');
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [info, setInfo] = useState<{ stockRef: number; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    adminService.getStockLocations(true).then(r => setLocations(r.ok ? r.data : []));
  }, [adminService]);

  const qrOpts = { size: size || undefined, locationCode: loc || undefined };
  const qrUrl = (format: 'svg' | 'png', download = false) => adminService.getImageQrUrl(imageId, { format, download, ...qrOpts });

  useEffect(() => {
    setError(null);
    adminService.getImageQrInfo(imageId, { size: size || undefined, locationCode: loc || undefined }).then(r => {
      if (r.ok) setInfo({ stockRef: r.data.stockRef, url: r.data.url });
      else { setInfo(null); setError(r.error); }
    });
  }, [adminService, imageId, size, loc]);

  const copy = async () => {
    if (!info) return;
    await navigator.clipboard.writeText(info.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <QrCode className="w-4 h-4" /> Sticker QR
        </h4>
        {info && <span className="text-sm font-mono bg-gray-100 rounded px-2 py-0.5">Ref {info.stockRef}</span>}
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="flex gap-4 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl('svg')}
            alt="Sticker QR code"
            className="w-40 h-40 border rounded bg-white shrink-0"
          />
          <div className="flex-1 space-y-2 text-sm">
            <label className="block">
              <span className="text-xs text-gray-500">Print size</span>
              <select className="mt-1 w-full border rounded px-2 py-1" value={size} onChange={e => setSize(e.target.value)}>
                <option value="">Any size</option>
                <option value="S">Small (S)</option>
                <option value="M">Medium (M)</option>
                <option value="L">Large (L)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Location</span>
              <select className="mt-1 w-full border rounded px-2 py-1" value={loc} onChange={e => setLoc(e.target.value)}>
                <option value="">No location</option>
                {locations.map(l => <option key={l.id} value={l.code}>{l.code} — {l.name}</option>)}
              </select>
            </label>
            {info && <p className="font-mono text-xs break-all text-gray-600">{info.url}</p>}
            <p className="text-xs text-gray-500">Scan with your phone to test the full customer journey.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={copy} disabled={!info}>
          <Copy className="w-3 h-3 mr-1" /> {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button size="sm" variant="outline" asChild disabled={!info}>
          {/* Same path the QR encodes, on this site — records a scan (tagged with your admin browser) and follows the redirect */}
          <a href={info ? new URL(info.url.toLowerCase()).pathname : '#'} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3 h-3 mr-1" /> Test link
          </a>
        </Button>
        <Button size="sm" variant="outline" asChild disabled={!info}>
          <a href={qrUrl('svg', true)}><Download className="w-3 h-3 mr-1" /> SVG</a>
        </Button>
        <Button size="sm" variant="outline" asChild disabled={!info}>
          <a href={qrUrl('png', true)}><Download className="w-3 h-3 mr-1" /> PNG</a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/admin/stock/stickers?add=${imageId}${size ? `&size=${size}` : ''}${loc ? `&loc=${loc}` : ''}`}>
            <Printer className="w-3 h-3 mr-1" /> Sticker sheet
          </Link>
        </Button>
      </div>
    </div>
  );
}
