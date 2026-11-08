'use client';

/**
 * Admin → Catalogue → a design → Caption plate: for designs in a Pawsonality type or Zodiac sign,
 * put the translucent gold plate (type/sign + tagline) on the picture or take it off, on the design
 * and optionally its breed versions. Wording: Admin → Collections → Captions. Data:
 * /api/admin/catalog/[id]/caption (lib/captions/).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Award } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { captionLayer, type Caption } from '@/lib/captions/caption';

interface Info {
  caption: Caption | null; dog: Caption | null; cat: Caption | null; designAnimal: 'dog' | 'cat';
  applied: (Caption & { at: string }) | null; clean: string | null; aspect: number; cloudName: string;
  versions: { total: number; captioned: number };
}

export default function CaptionPanel({ imageId, onChanged }: { imageId: string; onChanged?: () => void }) {
  const svc = () => new AdminSupabaseService();
  const [info, setInfo] = useState<Info | null>(null);
  const [versions, setVersions] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await svc().getDesignCaption(imageId);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setInfo(r.data?.caption ? r.data : null);
  }, [imageId]);
  useEffect(() => { setInfo(null); setMsg(null); load(); }, [load]);

  if (!info?.caption) return msg && !msg.ok ? <p className="text-xs text-red-700">{msg.text}</p> : null;
  const c = info.caption;
  const stale = !!info.applied && (info.applied.title !== c.title || info.applied.tagline !== c.tagline);
  const preview = info.clean && info.cloudName
    ? `https://res.cloudinary.com/${info.cloudName}/image/upload/c_limit,w_400/${captionLayer(c, info.aspect)}/f_jpg,q_80/${info.clean}`
    : null;

  const act = async (action: 'apply' | 'remove') => {
    setBusy(action === 'apply' ? 'Drawing the plate… (a few seconds a picture)' : 'Taking the plate off…'); setMsg(null);
    const r = await svc().designCaptionAction(imageId, { action, versions: versions && info.versions.total > 0 });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    const d = r.data;
    setMsg({ ok: !d.failed, text: `${action === 'apply' ? 'Plate on' : 'Plate off'}: ${d.done} picture${d.done === 1 ? '' : 's'}${d.failed ? `, ${d.failed} failed (${d.errors.join('; ')})` : ''}${d.skipped ? `, ${d.skipped} left: press again to carry on` : ''}.` });
    await load();
    onChanged?.();
  };

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 text-sm" aria-label="Caption plate">
      <div className="flex items-center gap-2 font-semibold text-gray-900"><Award className="h-4 w-4 text-amber-600" /> Caption plate</div>
      <div className="mt-2 flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="How the plate looks" className="w-28 rounded border border-amber-200" />}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-gray-800">“{c.title}”{c.tagline ? <> · <em>{c.tagline}</em></> : null}</p>
          {info.cat && info.dog && info.cat.title !== info.dog.title && <p className="text-xs text-gray-500">Cat versions: “{info.cat.title}”{info.cat.tagline ? ` · ${info.cat.tagline}` : ''}</p>}
          <p className="text-xs text-gray-600">
            {info.applied ? (stale ? 'On the picture, with older wording.' : 'On the picture now.') : 'Not on the picture.'}
            {info.versions.total > 0 && ` Versions: ${info.versions.captioned} of ${info.versions.total} have it.`}
            {' '}<Link href="/admin/collections/captions" className="text-purple-700 underline">Change the wording</Link>
          </p>
          {info.versions.total > 0 && (
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={versions} onChange={e => setVersions(e.target.checked)} /> Its {info.versions.total} breed version{info.versions.total === 1 ? '' : 's'} too</label>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={!!busy} onClick={() => act('apply')} className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40">
              {info.applied ? (stale ? 'Redraw with the new wording' : 'Redraw') : 'Add the plate'}
            </button>
            {(info.applied || info.versions.captioned > 0) && <button disabled={!!busy} onClick={() => act('remove')} className="rounded border border-gray-300 px-3 py-1 text-xs disabled:opacity-40">Take it off</button>}
          </div>
          {busy && <p role="status" className="text-xs text-gray-700">{busy}</p>}
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
        </div>
      </div>
    </section>
  );
}
