// Run: npx tsx scripts/test-zodiac.ts
import { zodiacForBirthday as z, zodiacByKey, ZODIAC_SIGNS } from '../lib/zodiac';
const cases: [string, string | null][] = [
  ['2020-03-21', 'aries'], ['2020-04-19', 'aries'], ['2020-04-20', 'taurus'], ['2020-05-20', 'taurus'], ['2020-05-21', 'gemini'],
  ['2020-06-21', 'cancer'], ['2020-07-22', 'cancer'], ['2020-07-23', 'leo'], ['2020-08-23', 'virgo'], ['2020-09-23', 'libra'],
  ['2020-10-23', 'scorpio'], ['2020-11-21', 'scorpio'], ['2020-11-22', 'sagittarius'], ['2020-12-21', 'sagittarius'],
  ['2020-12-22', 'capricorn'], ['2020-12-31', 'capricorn'], ['2021-01-01', 'capricorn'], ['2021-01-19', 'capricorn'],
  ['2021-01-20', 'aquarius'], ['2021-02-18', 'aquarius'], ['2021-02-19', 'pisces'], ['2021-03-20', 'pisces'],
  ['2024-02-29', 'pisces'], ['2019-08-01T00:00:00+00:00', 'leo'], ['', null], ['not a date', null],
];
let failed = 0;
for (const [d, want] of cases) { const got = z(d)?.key ?? null; if (got !== want) { failed++; console.log('FAIL', d, got, 'expected', want); } }
if (ZODIAC_SIGNS.length !== 12 || zodiacByKey('LEO')?.name !== 'Leo') { failed++; console.log('FAIL sign list'); }
console.log(failed ? `${failed} failed` : `${cases.length + 1} passed`);
process.exit(failed ? 1 : 0);
