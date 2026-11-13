// Run: npx tsx scripts/test-coat-match.ts
import { closestCoat, colourDistance } from '../lib/catalog/coat-match';
const coats = [
  { id: 'black', hex_color: '#1A1A1A' }, { id: 'white', hex_color: '#FFFFFF' }, { id: 'golden', hex_color: '#DAA520' },
  { id: 'brown', hex_color: '#5C4033' }, { id: 'cream', hex_color: '#FFFDD0' }, { id: 'red', hex_color: '#A52A2A' }, { id: 'none', hex_color: null },
];
const t = (name: string, got: unknown, want: unknown) => { const ok = got === want; console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${got}`); if (!ok) process.exitCode = 1; };
const live = [
  { id: 'Black', hex_color: '#2C2C2C' }, { id: 'Brown', hex_color: '#8B4513' }, { id: 'Cream', hex_color: '#F5F5DC' }, { id: 'Fawn', hex_color: '#D2B48C' },
  { id: 'Golden', hex_color: '#D4A574' }, { id: 'Red', hex_color: '#CD853F' }, { id: 'Silver', hex_color: '#C0C0C0' }, { id: 'White', hex_color: '#F8F8F8' },
];
t('apricot (live values) -> Golden', closestCoat({ id: 'a', hex_color: '#E3A869' }, live)?.id, 'Golden');
t('chocolate -> brown', closestCoat({ id: 'a', hex_color: '#4E342E' }, coats)?.id, 'brown');
t('grey-black -> black', closestCoat({ id: 'a', hex_color: '#2B2B2B' }, coats)?.id, 'black');
t('ivory -> cream', closestCoat({ id: 'a', hex_color: '#FFFFF0' }, coats.filter(c => c.id !== 'white'))?.id, 'cream');
t('no target colour', closestCoat({ id: 'a', hex_color: null }, coats), null);
t('no candidates', closestCoat({ id: 'a', hex_color: '#000000' }, []), null);
t('candidates without colour', closestCoat({ id: 'a', hex_color: '#000000' }, [{ id: 'x' }]), null);
t('hex without hash', colourDistance('000000', '#000000'), 0);
t('bad hex', colourDistance('#zzz', '#000000'), null);
