/**
 * Offers: the date rules for the birthday and zodiac campaigns (pure; no database, no clock: `now` is passed in).
 * All maths is on UTC calendar days, so there are no time-of-day or time-zone surprises.
 *
 * Birthday: due from (next birthday - daysBefore) up to 5 days before the birthday. A birthday learned later than that is skipped for
 *   this year (there is no time to paint, approve and send). Round key `birthday:<year of that birthday>`. 29 Feb is 28 Feb in a year without one.
 * Zodiac: due from (the start of the pet's sign - daysBefore) until the day the sign starts. Round key `zodiac:<sign>:<year the sign starts>`.
 *   Capricorn starts on 22 Dec, so in January the next start is this coming December.
 * Both on the same week: the birthday wins and the zodiac waits (pickAutomatic).
 */
import { ZODIAC_SIGNS, zodiacByKey, zodiacForMonthDay, type ZodiacKey } from '@/lib/zodiac';

export const DAY = 24 * 60 * 60 * 1000;
/** A birthday offer is not started with fewer than this many days to go */
export const MIN_BIRTHDAY_LEAD_DAYS = 5;
/** One offer email a week to one address, of any kind (same number as lib/offers/settings MIN_GAP_DAYS; kept here so this file stays pure) */
const WEEK_DAYS = 7;

export interface Birthday { month: number; day: number; year?: number | null }

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (y: number, m: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
/** UTC midnight of the calendar day containing `ms` */
export const utcDay = (ms: number) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * A birthday from anything (numbers or numeric strings): month 1-12, a day that exists in that month (29 Feb is allowed), and an optional
 * year (1980 to 2100; with a year the day must exist in THAT year). Anything impossible (30 Feb, month 13) is null: quietly ignored.
 * A year that is out of range is dropped and the day and month kept.
 */
export function cleanBirthday(raw: { month?: unknown; day?: unknown; year?: unknown } | null | undefined): Birthday | null {
  if (!raw) return null;
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? NaN : Number(v));
  const month = num(raw.month), day = num(raw.day), y = num(raw.year);
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > daysIn(2024, month)) return null;   // 2024: a leap year, so 29 Feb counts
  const year = Number.isInteger(y) && y >= 1980 && y <= 2100 ? y : null;
  if (year !== null && day > daysIn(year, month)) return null;
  return { month, day, year };
}

/** "YYYY-MM-DD" (pets.birthday) as a birthday; null for anything else */
export function birthdayFromDate(value: unknown): Birthday | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return m ? cleanBirthday({ month: Number(m[2]), day: Number(m[3]), year: Number(m[1]) }) : null;
}

/** The sign for a birthday (day and month are enough) */
export function signOfBirthday(b: Birthday | null | undefined): ZodiacKey | null {
  return b ? zodiacForMonthDay(b.month, b.day)?.key ?? null : null;
}

/** The day this birthday falls on in `year` (UTC ms): 29 Feb is 28 Feb in a year without one */
export function birthdayIn(b: Birthday, year: number): number {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return Date.UTC(year, b.month - 1, day);
}

/** The next time this birthday falls, today included */
export function nextBirthday(b: Birthday, now: number): { at: number; year: number } {
  const today = utcDay(now), y = new Date(today).getUTCFullYear();
  const thisYear = birthdayIn(b, y);
  return thisYear >= today ? { at: thisYear, year: y } : { at: birthdayIn(b, y + 1), year: y + 1 };
}

export interface Due { round: string; eventAt: number; eventDate: string; daysUntil: number; opensInDays: number }

/**
 * The birthday window: `opensInDays` is 0 or less once the offer is due (daysBefore days to go), `daysUntil` the days left to the birthday.
 * `due` is true inside the window and with at least MIN_BIRTHDAY_LEAD_DAYS to go.
 */
export function birthdayWindow(b: Birthday, now: number, daysBefore: number): Due & { due: boolean } {
  const { at, year } = nextBirthday(b, now);
  const daysUntil = Math.round((at - utcDay(now)) / DAY);
  const opensInDays = daysUntil - daysBefore;
  return { round: `birthday:${year}`, eventAt: at, eventDate: dayOf(at), daysUntil, opensInDays, due: opensInDays <= 0 && daysUntil >= MIN_BIRTHDAY_LEAD_DAYS };
}
export function birthdayDue(b: Birthday | null | undefined, now: number, daysBefore: number): (Due & { due: true }) | null {
  if (!b) return null;
  const w = birthdayWindow(b, now, daysBefore);
  return w.due ? (w as Due & { due: true }) : null;
}

/** The next time this sign starts, today included (UTC ms, and the year it starts in) */
export function nextSignStart(sign: ZodiacKey, now: number): { at: number; year: number } | null {
  const z = zodiacByKey(sign);
  if (!z) return null;
  const today = utcDay(now), y = new Date(today).getUTCFullYear();
  const thisYear = Date.UTC(y, z.from[0] - 1, z.from[1]);
  return thisYear >= today ? { at: thisYear, year: y } : { at: Date.UTC(y + 1, z.from[0] - 1, z.from[1]), year: y + 1 };
}

export function zodiacWindow(sign: ZodiacKey, now: number, daysBefore: number): (Due & { sign: ZodiacKey; due: boolean }) | null {
  const next = nextSignStart(sign, now);
  if (!next) return null;
  const daysUntil = Math.round((next.at - utcDay(now)) / DAY);
  const opensInDays = daysUntil - daysBefore;
  return { round: `zodiac:${sign}:${next.year}`, eventAt: next.at, eventDate: dayOf(next.at), daysUntil, opensInDays, sign, due: opensInDays <= 0 && daysUntil >= 0 };
}
export function zodiacDue(sign: ZodiacKey | null | undefined, now: number, daysBefore: number): (Due & { sign: ZodiacKey }) | null {
  if (!sign) return null;
  const w = zodiacWindow(sign, now, daysBefore);
  return w && w.due ? w : null;
}

export const isAutomaticRound = (round: string) => round.startsWith('birthday:') || round.startsWith('zodiac:');
export const roundKind = (round: string): 'round1' | 'round2' | 'campaign' | 'birthday' | 'zodiac' | 'other' =>
  round === '1' ? 'round1' : round === '2' ? 'round2' : round.startsWith('campaign:') ? 'campaign' : round.startsWith('birthday:') ? 'birthday' : round.startsWith('zodiac:') ? 'zodiac' : 'other';
/** The sign inside a zodiac round key ("zodiac:leo:2027" is "leo") */
export const signOfRound = (round: string): ZodiacKey | null => (round.startsWith('zodiac:') ? zodiacByKey(round.split(':')[1])?.key ?? null : null);

export interface AutomaticSettings { birthdayOn: boolean; zodiacOn: boolean; birthdayDays: number; zodiacDays: number }
export type Automatic = ({ kind: 'birthday' } & Due) | ({ kind: 'zodiac'; sign: ZodiacKey } & Due);

/**
 * Which automatic offer, if any, to start for this person now. `has(round)` says whether they already have a row for that round.
 * The birthday wins: while a birthday offer is due, or its window opens within a week, the zodiac waits (it may then miss its window).
 */
export function pickAutomatic(person: { birthday: Birthday | null; sign: ZodiacKey | null }, now: number, s: AutomaticSettings, has: (round: string) => boolean): Automatic | null {
  let birthdayBlocksZodiac = false;
  if (s.birthdayOn && person.birthday) {
    const w = birthdayWindow(person.birthday, now, s.birthdayDays);
    if (!has(w.round)) {
      if (w.due) return { kind: 'birthday', round: w.round, eventAt: w.eventAt, eventDate: w.eventDate, daysUntil: w.daysUntil, opensInDays: w.opensInDays };
      if (w.opensInDays > 0 && w.opensInDays <= WEEK_DAYS && w.daysUntil - w.opensInDays >= 0 && s.birthdayDays >= MIN_BIRTHDAY_LEAD_DAYS) birthdayBlocksZodiac = true;
    }
  }
  if (s.zodiacOn && person.sign && !birthdayBlocksZodiac) {
    const z = zodiacDue(person.sign, now, s.zodiacDays);
    if (z && !has(z.round)) return { kind: 'zodiac', sign: z.sign, round: z.round, eventAt: z.eventAt, eventDate: z.eventDate, daysUntil: z.daysUntil, opensInDays: z.opensInDays };
  }
  return null;
}

/** An automatic offer is not sent after the day it was for (birthday, or the start of the sign) */
export const eventPassed = (eventDate: string | null | undefined, now: number) => !!eventDate && Date.parse(`${eventDate}T00:00:00Z`) < utcDay(now);

/** How many of these people are due in the next `horizonDays` (for the admin page): a birthday or sign window that opens within that time, or is open now */
export function dueWithin(person: { birthday: Birthday | null; sign: ZodiacKey | null }, now: number, s: { birthdayDays: number; zodiacDays: number }, horizonDays: number): { birthday: boolean; zodiac: boolean } {
  let birthday = false, zodiac = false;
  if (person.birthday) { const w = birthdayWindow(person.birthday, now, s.birthdayDays); birthday = w.opensInDays <= horizonDays && w.daysUntil >= MIN_BIRTHDAY_LEAD_DAYS; }
  if (person.sign) { const w = zodiacWindow(person.sign, now, s.zodiacDays); zodiac = !!w && w.opensInDays <= horizonDays; }
  return { birthday, zodiac };
}

export { ZODIAC_SIGNS };

/** What an offer is called on the page: Round 1, Round 2, Birthday, Zodiac: Leo, or the campaign's name */
export function offerLabel(round: string, campaignName: string | null): string {
  const kind = roundKind(round);
  if (kind === 'round1') return 'Round 1';
  if (kind === 'round2') return 'Round 2';
  if (kind === 'birthday') return 'Birthday';
  if (kind === 'zodiac') return `Zodiac: ${zodiacByKey(signOfRound(round))?.name ?? 'sign'}`;
  return campaignName ?? 'Campaign';
}
