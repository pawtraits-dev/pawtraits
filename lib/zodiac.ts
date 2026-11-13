/**
 * Star signs for pets. This is the one place the signs and their date ranges live: My pets, the
 * zodiac quiz, recommendations and the zodiac collection (lib/collections/definitions.ts) all read
 * it. A pet's sign comes from its birthday; with no birthday, from the zodiac quiz (pets.zodiac_sign).
 */
export type ZodiacKey =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export interface ZodiacSign {
  key: ZodiacKey;
  name: string;
  symbol: string;
  /** First day of the sign, as [month, day] (month 1–12) */
  from: [number, number];
  /** Last day of the sign, as [month, day] */
  to: [number, number];
  /** "21 Mar – 19 Apr" */
  dates: string;
  element: 'fire' | 'earth' | 'air' | 'water';
}

export const ZODIAC_SIGNS: ZodiacSign[] = [
  { key: 'aries', name: 'Aries', symbol: '♈', from: [3, 21], to: [4, 19], dates: '21 Mar – 19 Apr', element: 'fire' },
  { key: 'taurus', name: 'Taurus', symbol: '♉', from: [4, 20], to: [5, 20], dates: '20 Apr – 20 May', element: 'earth' },
  { key: 'gemini', name: 'Gemini', symbol: '♊', from: [5, 21], to: [6, 20], dates: '21 May – 20 Jun', element: 'air' },
  { key: 'cancer', name: 'Cancer', symbol: '♋', from: [6, 21], to: [7, 22], dates: '21 Jun – 22 Jul', element: 'water' },
  { key: 'leo', name: 'Leo', symbol: '♌', from: [7, 23], to: [8, 22], dates: '23 Jul – 22 Aug', element: 'fire' },
  { key: 'virgo', name: 'Virgo', symbol: '♍', from: [8, 23], to: [9, 22], dates: '23 Aug – 22 Sep', element: 'earth' },
  { key: 'libra', name: 'Libra', symbol: '♎', from: [9, 23], to: [10, 22], dates: '23 Sep – 22 Oct', element: 'air' },
  { key: 'scorpio', name: 'Scorpio', symbol: '♏', from: [10, 23], to: [11, 21], dates: '23 Oct – 21 Nov', element: 'water' },
  { key: 'sagittarius', name: 'Sagittarius', symbol: '♐', from: [11, 22], to: [12, 21], dates: '22 Nov – 21 Dec', element: 'fire' },
  { key: 'capricorn', name: 'Capricorn', symbol: '♑', from: [12, 22], to: [1, 19], dates: '22 Dec – 19 Jan', element: 'earth' },
  { key: 'aquarius', name: 'Aquarius', symbol: '♒', from: [1, 20], to: [2, 18], dates: '20 Jan – 18 Feb', element: 'air' },
  { key: 'pisces', name: 'Pisces', symbol: '♓', from: [2, 19], to: [3, 20], dates: '19 Feb – 20 Mar', element: 'water' },
];

export function zodiacByKey(key: string | null | undefined): ZodiacSign | null {
  return ZODIAC_SIGNS.find(s => s.key === String(key || '').toLowerCase()) ?? null;
}

/** Sign for a month (1–12) and day */
export function zodiacForMonthDay(month: number, day: number): ZodiacSign | null {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // The sign that started most recently on or before this date; before 20 Jan it is still Capricorn
  const starts = [...ZODIAC_SIGNS].sort((a, b) => a.from[0] - b.from[0] || a.from[1] - b.from[1]);
  let current = starts[starts.length - 1]; // Capricorn (22 Dec) wraps over the new year
  for (const s of starts) {
    if (month > s.from[0] || (month === s.from[0] && day >= s.from[1])) current = s;
  }
  return current;
}

/**
 * Sign for a birthday. Accepts "YYYY-MM-DD" (as stored on pets.birthday) or a Date. The date string
 * is read as written, never through a time zone, so 20 January is always 20 January.
 */
export function zodiacForBirthday(birthday: string | Date | null | undefined): ZodiacSign | null {
  if (!birthday) return null;
  if (birthday instanceof Date) {
    return Number.isNaN(birthday.getTime()) ? null : zodiacForMonthDay(birthday.getMonth() + 1, birthday.getDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday);
  return m ? zodiacForMonthDay(Number(m[2]), Number(m[3])) : null;
}

/**
 * A pet's sign and where it came from. The birthday always wins; the sign saved by the zodiac quiz
 * (pets.zodiac_sign) is used only when there is no birthday.
 */
export function petZodiac(pet: { birthday?: string | Date | null; zodiac_sign?: string | null }): { sign: ZodiacSign; source: 'birthday' | 'quiz' } | null {
  const fromBirthday = zodiacForBirthday(pet.birthday);
  if (fromBirthday) return { sign: fromBirthday, source: 'birthday' };
  const stored = zodiacByKey(pet.zodiac_sign);
  return stored ? { sign: stored, source: 'quiz' } : null;
}

/** Path of a sign's collection, e.g. "zodiac/leo" */
export const zodiacCollectionPath = (key: ZodiacKey) => `zodiac/${key}`;
