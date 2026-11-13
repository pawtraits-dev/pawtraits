'use client';

/**
 * Admin → Catalogue → a design → Framed card: for designs in a Zodiac sign or tarot card, draw the
 * ornate frame (medallion, title, tagline) on the picture or take it off, on the design and
 * optionally its breed versions. Previews show both print shapes. Wording: Admin → Collections →
 * Captions. Data: /api/admin/catalog/[id]/frame (lib/frames/).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Frame } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { FrameCard } from '@/lib/frames/frame';

interface Info {
  kind: 'zodiac' | 'tarot'; card: FrameCard | null; dog: FrameCard | null; cat: FrameCard | null;
  applied: (FrameCard & { at: string }) | null; plateOn: boolean;
  previews: Record<'2:3' | '3:4', string> | null;
  versions: { total: number; framed: number };
}

export default function FramePanel({ imageId, onChanged }: { imageId: string; onChanged?: () => void }) {
  const svc = () => new AdminSupabaseService();
  const [info, setInfo] = useState<Info | null>(null);
  const [versions, setVersions] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await svc().getDesignFrame(imageId);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setInfo(r.data?.card ? r.data : null);
  }, [imageId]);
  useEffect(() => { setInfo(null); setMsg(null); load(); }, [load]);

  if (!info?.card) return msg && !msg.ok ? <p className="text-xs text-red-700">{msg.text}</p> : null;
  const c = info.card;
  const stale = !!info.applied && (info.applied.title !== c.title || (info.applied.tagline || null) !== (c.tagline || null));
  const withVersions = versions && info.versions.total > 0;

  const act = async (on: boolean) => {
    setBusy(on ? 'Drawing the frame… (a few seconds a picture)' : 'Taking the frame off…'); setMsg(null);
    const r = on ? await svc().applyDesignFrame(imageId, withVersions) : await svc().removeDesignFrame(imageId, withVersions);
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    const d = r.data;
    setMsg({ ok: !d.failed, text: `${on ? 'Frame on' : 'Frame off'}: ${d.done} picture${d.done === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed (${d.errors.join('; ')})` : ''}${d.skipped ? `, ${d.skipped} left: press again to carry on` : ''}.` });
    await load();
    onChanged?.();
  };

  return (
    <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 text-sm" aria-label="Framed card">
      <div className="flex items-center gap-2 font-semibold text-gray-900"><Frame className="h-4 w-4 text-indigo-600" /> Framed card</div>
      {info.previews && (
        <div className="mt-2 flex gap-3">
          {(['2:3', '3:4'] as const).map(s => (
            <figure key={s} className="w-28">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.previews![s]} alt={`How the frame looks at ${s}`} className="w-full rounded border border-indigo-200" />
              <figcaption className="mt-0.5 text-center text-[11px] text-gray-600">{s}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1">
        <p className="text-gray-800">
          {'medallion' in c && c.medallion ? ('numeral' in c.medallion ? `Numeral ${c.medallion.numeral}` : `Symbol: ${c.medallion.symbol}`) : null} · “{c.title.toUpperCase()}”{c.tagline ? <> · <em>{c.tagline}</em></> : null}
        </p>
        {info.cat && info.dog && (info.cat.title !== info.dog.title || info.cat.tagline !== info.dog.tagline) && (
          <p className="text-xs text-gray-500">Cat versions: “{info.cat.title.toUpperCase()}”{info.cat.tagline ? ` · ${info.cat.tagline}` : ''}</p>
        )}
        <p className="text-xs text-gray-600">
          {info.applied ? (stale ? 'On the picture, with older wording.' : 'On the picture now.') : 'Not on the picture.'}
          {info.plateOn && ' Adding the frame takes the caption plate off.'}
          {info.versions.total > 0 && ` Versions: ${info.versions.framed} of ${info.versions.total} have it.`}
          {' '}<Link href="/admin/collections/captions" className="text-purple-700 underline">Change the wording</Link>
        </p>
        {info.versions.total > 0 && (
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={versions} onChange={e => setVersions(e.target.checked)} /> Its {info.versions.total} breed version{info.versions.total === 1 ? '' : 's'} too</label>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button disabled={!!busy} onClick={() => act(true)} className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-40">
            {info.applied ? (stale ? 'Redraw with the new wording' : 'Redraw') : 'Add the frame'}
          </button>
          {(info.applied || info.versions.framed > 0) && <button disabled={!!busy} onClick={() => act(false)} className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-40">Remove the frame</button>}
        </div>
        {busy && <p role="status" className="text-xs text-gray-700">{busy}</p>}
        {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
