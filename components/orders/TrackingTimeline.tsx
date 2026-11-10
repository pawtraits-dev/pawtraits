'use client';

/**
 * Customer order page: where the parcel is. Four-step progress (packed → with Royal Mail → out for
 * delivery → delivered) and Royal Mail's own updates, newest first. Data: orders.tracking_*
 * (lib/shipping/royal-mail/), checked every few hours.
 */
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { PROGRESS, STAGE_TEXT, progressIndex, type TrackingEvent, type TrackingStage } from '@/lib/shipping/royal-mail/status';

const STEP_LABEL: Record<(typeof PROGRESS)[number], string> = { label_created: 'Packed', in_transit: 'With Royal Mail', out_for_delivery: 'Out for delivery', delivered: 'Delivered' };
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function TrackingTimeline({ stage, statusText, events, trackingNumber, trackingUrl, checkedAt, posted }: {
  stage: TrackingStage | null; statusText?: string | null; events?: TrackingEvent[] | null;
  trackingNumber?: string | null; trackingUrl?: string | null; checkedAt?: string | null; posted: boolean;
}) {
  const s: TrackingStage = stage ?? (posted ? 'in_transit' : 'label_created');
  const at = progressIndex(s);
  const problem = ['attempted', 'awaiting_collection', 'returned', 'exception'].includes(s);
  const list = (events ?? []).slice(0, 12);
  return (
    <section aria-label="Delivery tracking" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`text-lg font-semibold ${s === 'delivered' ? 'text-green-700' : problem ? 'text-amber-700' : 'text-purple-700'}`}>{STAGE_TEXT[s].customer}</p>
        {trackingNumber && (
          <p className="text-sm text-gray-600">Royal Mail <span className="font-mono">{trackingNumber}</span>
            {trackingUrl && <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center text-purple-700 underline">Royal Mail page<ExternalLink className="ml-0.5 h-3 w-3" /></a>}
          </p>
        )}
      </div>
      <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
        {PROGRESS.map((p, i) => (
          <li key={p} className="text-center">
            <div className={`mx-auto mb-1 h-1.5 rounded-full ${i <= at ? (problem && i === at ? 'bg-amber-500' : 'bg-purple-600') : 'bg-gray-200'}`} />
            <span className={`text-[11px] sm:text-xs ${i <= at ? 'font-semibold text-gray-900' : 'text-gray-500'}`} aria-current={i === at ? 'step' : undefined}>
              {i === at && problem ? STAGE_TEXT[s].label : STEP_LABEL[p]}
            </span>
          </li>
        ))}
      </ol>
      {statusText && <p className="text-sm text-gray-700">{statusText}</p>}
      {list.length > 0 && (
        <ul className="space-y-2 border-l-2 border-purple-100 pl-4">
          {list.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative text-sm">
              <span className="absolute -left-[23px] top-0.5 bg-white">{i === 0 ? <CheckCircle2 className="h-4 w-4 text-purple-600" /> : <Circle className="h-4 w-4 text-gray-300" />}</span>
              <p className={i === 0 ? 'font-medium text-gray-900' : 'text-gray-700'}>{e.name}</p>
              <p className="text-xs text-gray-500">{when(e.at)}{e.location ? ` · ${e.location}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
      {checkedAt && <p className="text-xs text-gray-400">Last checked with Royal Mail {when(checkedAt)}</p>}
    </section>
  );
}
