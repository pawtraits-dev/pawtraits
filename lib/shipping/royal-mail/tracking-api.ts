/**
 * Royal Mail Tracking API v2 client (server only): "Royal Mail Tracking for Server-side App v2"
 * on the Royal Mail Developer Portal (developer.royalmail.net). Subscribe the app there to get a
 * client id and secret: ROYAL_MAIL_TRACKING_CLIENT_ID / ROYAL_MAIL_TRACKING_CLIENT_SECRET.
 *
 *   GET {base}/mailpieces/v2/{trackingNumber}/events
 *   headers X-IBM-Client-Id, X-IBM-Client-Secret, X-Accept-RMG-Terms: yes
 *
 * The response is read defensively (field names from Royal Mail's v2 documentation).
 */
import { stageOfEvent, stageOfSummary, type TrackingEvent, type TrackingStage } from './status';

const BASE = (process.env.ROYAL_MAIL_TRACKING_BASE || 'https://api.royalmail.net').replace(/\/$/, '');

export const trackingConfigured = () => !!(process.env.ROYAL_MAIL_TRACKING_CLIENT_ID && process.env.ROYAL_MAIL_TRACKING_CLIENT_SECRET);

export interface TrackingResult {
  stage: TrackingStage;
  statusText: string | null;
  events: TrackingEvent[];            // newest first
  lastEventAt: string | null;
  deliveredAt: string | null;
  notFoundYet?: boolean;              // Royal Mail doesn't know the barcode yet (not scanned)
}

export async function fetchTracking(trackingNumber: string): Promise<TrackingResult> {
  if (!trackingConfigured()) throw new Error('Royal Mail tracking isn\'t connected: set ROYAL_MAIL_TRACKING_CLIENT_ID and ROYAL_MAIL_TRACKING_CLIENT_SECRET.');
  const res = await fetch(`${BASE}/mailpieces/v2/${encodeURIComponent(trackingNumber)}/events`, {
    headers: {
      'X-IBM-Client-Id': process.env.ROYAL_MAIL_TRACKING_CLIENT_ID!,
      'X-IBM-Client-Secret': process.env.ROYAL_MAIL_TRACKING_CLIENT_SECRET!,
      'X-Accept-RMG-Terms': 'yes',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const text = await res.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) {
    const err = j?.errors?.[0];
    // E1142-style "not recognised": the parcel hasn't been scanned yet
    if (res.status === 404 || /isn.t recognised|not recognised|not found/i.test(err?.errorDescription || err?.errorCause || '')) {
      return { stage: 'label_created', statusText: null, events: [], lastEventAt: null, deliveredAt: null, notFoundYet: true };
    }
    throw new Error(`Royal Mail tracking ${res.status}: ${err?.errorDescription || err?.errorCause || text.slice(0, 200)}`);
  }
  const piece = j?.mailPieces ?? j?.mailPiece ?? j;
  const summary = piece?.summary ?? {};
  const events: TrackingEvent[] = (piece?.events ?? [])
    .map((e: any) => ({ code: e.eventCode ?? null, name: String(e.eventName || e.eventCode || 'Update'), at: e.eventDateTime || e.eventDate || '', location: e.locationName || null }))
    .filter((e: TrackingEvent) => e.at)
    .sort((a: TrackingEvent, b: TrackingEvent) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const latest = events[0];
  const stage = stageOfSummary(summary.statusCategory) ?? (latest ? stageOfEvent(latest.name, latest.code) : 'label_created');
  const delivered = stage === 'delivered' ? events.find(e => stageOfEvent(e.name, e.code) === 'delivered') ?? latest : null;
  return {
    stage,
    statusText: summary.statusDescription || summary.summaryLine || latest?.name || null,
    events,
    lastEventAt: latest?.at || summary.lastEventDateTime || null,
    deliveredAt: delivered?.at ?? null,
  };
}
