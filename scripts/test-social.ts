/**
 * Social loop privacy and photo-check parsing tests: npm run test:social
 */
import { cleanTown, countryLabel, petFirstName, petNames, placeLabel } from '../lib/social/privacy';
import { parseCheckReply } from '../lib/social/photo-check';
import { buildCaption } from '../lib/social/carousel';

let failed = 0, passed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) passed++;
  else { failed++; console.error(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); }
};

// Pet names: first name only, placeholders dropped
eq('first name', petFirstName('biscuit the brave'), 'Biscuit');
eq('uppercase', petFirstName('MAX'), 'Max');
eq('accents', petFirstName('zoë'), 'Zoë');
eq('apostrophe', petFirstName("o'malley"), "O'malley");
eq('placeholder', petFirstName('Uploaded Pet'), null);
eq('digits', petFirstName('R2D2'), null);
eq('email-like', petFirstName('sam@example.com'), null);
eq('empty', petFirstName('  '), null);
eq('two pets', petNames(['Biscuit', 'mochi']), 'Biscuit & Mochi');
eq('dedupe', petNames(['Biscuit', 'biscuit']), 'Biscuit');
eq('max length', petNames(['Bartholomew', 'Wellington', 'Montgomery']), 'Bartholomew & Wellington');
eq('none usable', petNames(['Uploaded Pet', null]), null);

// Towns: no digits, postcodes or streets
eq('town case', cleanTown('  derby '), 'Derby');
eq('umlaut', cleanTown('köln'), 'Köln');
eq('hyphen', cleanTown('stoke-on-trent'), 'Stoke-on-Trent');
eq('two words', cleanTown('NEW YORK'), 'New York');
eq('postcode rejected', cleanTown('SW1A 1AA'), null);
eq('house number rejected', cleanTown('12 High Street'), null);
eq('too long', cleanTown('x'.repeat(41)), null);
eq('empty town', cleanTown(''), null);

// Countries
eq('GB', countryLabel('GB'), 'UK');
eq('United Kingdom', countryLabel('United Kingdom'), 'UK');
eq('DE', countryLabel('de'), 'Germany');
eq('US', countryLabel('US'), 'USA');
eq('UK code', countryLabel('UK'), 'UK');
eq('FR', countryLabel('FR'), 'France');
eq('name kept', countryLabel('Ireland'), 'Ireland');
eq('junk', countryLabel('12345'), null);
eq('place', placeLabel('Derby', 'UK'), 'Derby, UK');
eq('country only', placeLabel(null, 'Germany'), 'Germany');
eq('nothing', placeLabel(null, null), null);

// Photo check replies
eq('ok', parseCheckReply('{"ok": true, "reasons": [], "note": "fine"}'), { status: 'approved', reasons: [] });
eq('rejected', parseCheckReply('Here: {"ok": false, "reasons": ["person"], "note": "man holding dog"}').status, 'rejected');
eq('reasons kept', parseCheckReply('{"ok": false, "reasons": ["child", "bogus"], "note": ""}').reasons, ['child']);
eq('ok with reasons fails safe', parseCheckReply('{"ok": true, "reasons": ["personal_details"]}').status, 'rejected');
eq('not ok without reason fails safe', parseCheckReply('{"ok": false, "reasons": []}').reasons, ['unreadable']);
eq('garbage', parseCheckReply('I cannot help with that').status, 'error');
eq('bad json', parseCheckReply('{"ok": tru}').status, 'error');
eq('missing ok', parseCheckReply('{"reasons": []}').status, 'error');

// Captions
const it = (petName: string | null, channel: 'online' | 'stall' = 'online', town: string | null = null, stallName: string | null = null) => ({ petName, channel, town, stallName });
const cap = buildCaption([it('Biscuit', 'stall', 'London', 'Old Spitalfields Market'), it('Mochi', 'online', 'Derby'), it('Lotte', 'online', null), it('Max', 'online', 'Köln'), it(null)]);
eq('caption headline', cap.split('\n')[0], 'Five pets, five masterpieces 🎨🐾');
eq('caption names', cap.includes('Swipe to watch Biscuit, Mochi, Lotte, Max and one shy friend go from phone photo to Pawtrait'), true);
eq('caption places', cap.includes('📍 Old Spitalfields Market · London · Derby · Köln'), true);
eq('caption hashtags ≤ 30', (cap.match(/#/g) || []).length <= 30, true);
eq('caption no emails', /@/.test(cap), false);
const cap2 = buildCaption([it('Pip'), it(null), it(null)]);
eq('caption three, two unnamed', cap2.includes('Three pets, three masterpieces') && cap2.includes('Pip and two shy friends'), true);
eq('no places line', cap2.includes('📍'), false);
eq('one pet', buildCaption([it('Rex')]).split('\n')[0], 'One pet, one masterpiece 🎨🐾');

console.log(failed ? `${failed} failed, ${passed} passed` : `${passed} tests passed`);
process.exit(failed ? 1 : 0);
