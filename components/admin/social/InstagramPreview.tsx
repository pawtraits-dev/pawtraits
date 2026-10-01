'use client';

/**
 * Admin → Social → Instagram: each carousel shown as it will look on Instagram (phone frame,
 * 10 slides photo → Pawtrait, dots, caption). Edit or reset the caption, take a pet off Instagram,
 * download the slides and copy the caption to post by hand, then mark it posted with its link.
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';

interface Slide { itemId: string; petName: string | null; place: string | null; source: string; kind: 'before' | 'after'; url: string; download: string; postable: boolean }
interface CarouselItem { id: string; petName: string | null; place: string | null; source: string; beforeSlide: string; afterSlide: string; beforeDownload: string; afterDownload: string; postable: boolean }
interface Carousel { id: string; status: 'filling' | 'ready' | 'publishing' | 'posted' | 'failed'; caption: string; captionEdited: boolean; igPermalink: string | null; postedAt: string | null; error: string | null; needsRemoval: boolean; items: CarouselItem[] }
interface Data { batchSize: number; includePreviews: boolean; instagramEnabled: boolean; carousels: Carousel[] }

const STATUS: Record<Carousel['status'], [string, string]> = {
  filling: ['Filling', 'bg-amber-100 text-amber-900'], ready: ['Ready to post', 'bg-green-100 text-green-800'],
  publishing: ['Posting…', 'bg-purple-100 text-purple-800'], posted: ['Posted', 'bg-gray-200 text-gray-800'], failed: ['Posting failed', 'bg-red-100 text-red-800'],
};

function slidesOf(c: Carousel): Slide[] {
  return c.items.flatMap(i => [
    { itemId: i.id, petName: i.petName, place: i.place, source: i.source, kind: 'before' as const, url: i.beforeSlide, download: i.beforeDownload, postable: i.postable },
    { itemId: i.id, petName: i.petName, place: i.place, source: i.source, kind: 'after' as const, url: i.afterSlide, download: i.afterDownload, postable: i.postable },
  ]);
}

function PhonePost({ carousel }: { carousel: Carousel }) {
  const slides = slidesOf(carousel);
  const [n, setN] = useState(0);
  const [more, setMore] = useState(false);
  const cur = slides[Math.min(n, slides.length - 1)];
  const [firstLine, ...rest] = carousel.caption.split('\n');

  return (
    <div className="w-[340px] shrink-0 overflow-hidden rounded-[28px] border-[6px] border-gray-900 bg-white shadow-xl">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-[10px] font-bold text-purple-800">🐾</span>
        </span>
        <span className="text-sm font-semibold text-gray-900">pawtraits</span>
        <span className="ml-auto text-lg leading-none text-gray-700" aria-hidden="true">···</span>
      </div>

      <div className="relative aspect-[4/5] w-full bg-gray-100">
        {cur ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cur.url} alt={`${cur.kind === 'before' ? 'Photo' : 'Pawtrait'} of ${cur.petName ?? 'a pet'}`} className="h-full w-full object-cover" />
        ) : <div className="flex h-full items-center justify-center text-sm text-gray-500">No pets yet</div>}
        {slides.length > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">{n + 1}/{slides.length}</span>
        )}
        {n > 0 && (
          <button type="button" aria-label="Previous slide" onClick={() => setN(n - 1)}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"><ChevronLeft className="h-5 w-5" /></button>
        )}
        {n < slides.length - 1 && (
          <button type="button" aria-label="Next slide" onClick={() => setN(n + 1)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow"><ChevronRight className="h-5 w-5" /></button>
        )}
      </div>

      <div className="flex items-center gap-3.5 px-3 pt-2.5 text-gray-900">
        <Heart className="h-6 w-6" aria-hidden="true" /><MessageCircle className="h-6 w-6" aria-hidden="true" /><Send className="h-6 w-6" aria-hidden="true" />
        <span className="flex flex-1 justify-center gap-1" aria-hidden="true">
          {slides.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === n ? 'bg-blue-500' : 'bg-gray-300'}`} />)}
        </span>
        <Bookmark className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="px-3 pb-4 pt-2 text-[13px] leading-snug text-gray-900">
        <p><span className="font-semibold">pawtraits</span> {firstLine}</p>
        {more ? <p className="mt-1 whitespace-pre-line">{rest.join('\n').trim()}</p>
          : rest.join('').trim() && <button type="button" onClick={() => setMore(true)} className="text-gray-500">… more</button>}
      </div>
    </div>
  );
}

function CarouselCard({ c, batchSize, onChanged, onError }: { c: Carousel; batchSize: number; onChanged: () => void; onError: (e: string) => void }) {
  const [caption, setCaption] = useState(c.caption);
  const [permalink, setPermalink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setCaption(c.caption); }, [c.caption]);
  const editable = c.status === 'filling' || c.status === 'ready' || c.status === 'failed';
  const [label, cls] = STATUS[c.status];
  const unpostable = c.items.filter(i => !i.postable).length;

  async function call(body: Parameters<AdminSupabaseService['updateSocialCarousel']>[1]) {
    setBusy(true);
    const r = await new AdminSupabaseService().updateSocialCarousel(c.id, body);
    setBusy(false);
    if (!r.ok) onError(r.error); else onChanged();
  }
  async function removePet(id: string) {
    setBusy(true);
    const r = await new AdminSupabaseService().updateSocialItem(id, 'ig_exclude');
    setBusy(false);
    if (!r.ok) onError(r.error); else onChanged();
  }

  return (
    <article className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-5 lg:flex-row" aria-label={`Carousel ${label}`}>
      <PhonePost carousel={{ ...c, caption }} />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
          {c.status === 'filling' && <span className="text-sm text-gray-700">{c.items.length} of {batchSize} pets · posts when full</span>}
          {c.status === 'posted' && c.igPermalink && (
            <a href={c.igPermalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-purple-700 underline">View on Instagram <ExternalLink className="h-3.5 w-3.5" /></a>
          )}
          {c.error && <span className="text-sm text-red-700">{c.error}</span>}
        </div>

        {unpostable > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {unpostable === 1 ? 'One pet has' : `${unpostable} pets have`} pictures stored outside Cloudinary, so automatic posting can&rsquo;t use them. Remove {unpostable === 1 ? 'it' : 'them'} or post by hand.
          </p>
        )}

        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {c.items.map((i, n) => (
            <li key={i.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.afterSlide} alt="" className="h-14 w-11 rounded object-cover" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-gray-900">{n + 1}. {i.petName ?? <span className="text-gray-500">No name</span>}
                  {i.source === 'preview' && <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800">Preview</span>}</p>
                <p className="truncate text-gray-600">{i.place ?? 'No location'}</p>
                <p className="flex gap-2 text-xs">
                  <a href={i.beforeDownload} className="inline-flex items-center gap-0.5 text-purple-700 underline"><Download className="h-3 w-3" />Photo</a>
                  <a href={i.afterDownload} className="inline-flex items-center gap-0.5 text-purple-700 underline"><Download className="h-3 w-3" />Pawtrait</a>
                </p>
              </div>
              {editable && (
                <button type="button" disabled={busy} onClick={() => removePet(i.id)} title="Keep this pet off Instagram (stays on the website)"
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold disabled:opacity-50">Remove</button>
              )}
            </li>
          ))}
        </ol>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor={`cap-${c.id}`} className="text-sm font-semibold text-gray-900">Caption {c.captionEdited && <span className="font-normal text-gray-500">(edited)</span>}</label>
            <span className="text-xs text-gray-500">{caption.length} / 2,200</span>
          </div>
          <textarea id={`cap-${c.id}`} value={caption} onChange={e => setCaption(e.target.value)} disabled={!editable} rows={9}
            className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm leading-snug disabled:bg-gray-50" />
          <div className="mt-2 flex flex-wrap gap-2">
            {editable && (
              <button type="button" disabled={busy || caption === c.caption} onClick={() => call({ caption })}
                className="rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Save caption</button>
            )}
            {editable && c.captionEdited && (
              <button type="button" disabled={busy} onClick={() => call({ action: 'reset_caption' })} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold">Use automatic caption</button>
            )}
            <button type="button" onClick={() => { navigator.clipboard.writeText(caption).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold">
              {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy caption</>}
            </button>
          </div>
          {c.status === 'filling' && !c.captionEdited && <p className="mt-1 text-xs text-gray-500">The caption updates as pets join. Editing it stops that.</p>}
        </div>

        {c.status === 'ready' && (
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-sm font-semibold text-gray-900">Posted it yourself?</p>
            <p className="text-xs text-gray-600">Download the 10 slides in order, post them as one carousel with the caption, then paste the post link.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={permalink} onChange={e => setPermalink(e.target.value)} placeholder="https://www.instagram.com/p/…" aria-label="Instagram post link"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
              <button type="button" disabled={busy || !permalink.trim()} onClick={() => call({ action: 'mark_posted', permalink })}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">Mark as posted</button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default function InstagramPreview({ onError }: { onError: (e: string) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(async () => {
    const r = await new AdminSupabaseService().getSocialCarousels();
    if (r.ok) setData(r.data); else onError(r.error);
  }, [onError]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="p-4 text-sm text-gray-600">Loading carousels…</p>;
  const unposted = data.carousels.filter(c => c.status !== 'posted');
  const posted = data.carousels.filter(c => c.status === 'posted');

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-700">
        Every {data.batchSize} featured pets make a 10-slide carousel (photo → Pawtrait for each, in order).
        {data.instagramEnabled ? ' Full carousels post automatically.' : ' Instagram posting is off: full carousels wait here, ready to download and post by hand.'}
        {!data.includePreviews && ' Only purchases are included (switch on "Include free previews" to use previews too).'}
      </p>
      {unposted.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">No featured pets waiting yet. Carousels appear here as orders{data.includePreviews ? ' and previews' : ''} pass the photo check.</p>}
      {unposted.map(c => <CarouselCard key={c.id} c={c} batchSize={data.batchSize} onChanged={load} onError={onError} />)}
      {posted.length > 0 && (
        <details className="rounded-xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">Posted ({posted.length})</summary>
          <div className="mt-4 space-y-4">{posted.map(c => <CarouselCard key={c.id} c={c} batchSize={data.batchSize} onChanged={load} onError={onError} />)}</div>
        </details>
      )}
    </div>
  );
}
