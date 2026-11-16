/**
 * Dates for the operating manual. Everything is a plain 'YYYY-MM-DD' string in Europe/London, and
 * weeks start on Monday. No Date objects leave this file, so there are no time-zone surprises.
 */
export const LONDON = 'Europe/London';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in London, e.g. '2026-11-16'. */
export function londonToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The time of day in London, e.g. '09:14'. */
export function londonTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidYmd(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const m = YMD.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function toDate(ymd: string): Date {
  const m = YMD.exec(ymd)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}
function fromDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(ymd: string, n: number): string {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

/** Monday = 1 ... Sunday = 7. */
export function isoWeekday(ymd: string): number {
  const w = toDate(ymd).getUTCDay();
  return w === 0 ? 7 : w;
}

/** The Monday of the week that contains this date. */
export function weekStart(ymd: string): string {
  return addDays(ymd, 1 - isoWeekday(ymd));
}

/** The 1st of the month that contains this date. */
export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** First Monday-to-Friday day of the month containing this date (bank holidays are not known here). */
export function firstWorkingDay(ymd: string): string {
  let d = monthStart(ymd);
  while (isoWeekday(d) > 5) d = addDays(d, 1);
  return d;
}

export function isWeekday(ymd: string): boolean {
  return isoWeekday(ymd) <= 5;
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** e.g. 'Monday 16 November' */
export function longDate(ymd: string): string {
  const d = toDate(ymd);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${WEEKDAY_NAMES[isoWeekday(ymd) - 1]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

/** The period start that a tick for this period should use, given a day. */
export function periodStartFor(period: 'day' | 'week' | 'month', ymd: string): string {
  return period === 'day' ? ymd : period === 'week' ? weekStart(ymd) : monthStart(ymd);
}
