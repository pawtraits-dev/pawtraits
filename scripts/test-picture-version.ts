/** Run: npx tsx scripts/test-picture-version.ts — unit tests for lib/picture-version.ts (address version + cache header rule) */
import {
  CACHE_PICTURE_FOREVER, CACHE_PICTURE_PRIVATE, CACHE_PICTURE_SHORT, PICTURE_CACHE_EPOCH,
  cleanPictureVersion, pictureCacheControl, pictureVersion,
} from '../lib/picture-version';

let failed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`}`);
}

const U1 = 'https://res.cloudinary.com/x/image/upload/c_limit,w_800/pawtraits/designs/abc123.jpg';
const U2 = 'https://res.cloudinary.com/x/image/upload/c_limit,w_800/pawtraits/designs/abc124.jpg';

// version hash
const v1 = pictureVersion(U1);
eq('version: deterministic', pictureVersion(U1), v1);
eq('version: 7 URL-safe characters', /^[0-9a-z]{7}$/.test(v1 || ''), true);
eq('version: changes with the URL', pictureVersion(U2) !== v1, true);
eq('version: changes with the epoch', pictureVersion(U1, '2') !== pictureVersion(U1, '1'), true);
eq('version: default epoch is the constant', pictureVersion(U1), pictureVersion(U1, PICTURE_CACHE_EPOCH));
eq('version: surrounding whitespace ignored', pictureVersion(`  ${U1} `), v1);
eq('version: a number works as a source', typeof pictureVersion(42), 'string');
eq('version: undefined gives none', pictureVersion(undefined), undefined);
eq('version: null gives none', pictureVersion(null), undefined);
eq('version: empty gives none', pictureVersion(''), undefined);
eq('version: blank gives none', pictureVersion('   '), undefined);
eq('version: known value (guards against the hash changing by accident)', pictureVersion('a', '1'), '04mv6tv');
eq('version: output passes the route check', cleanPictureVersion(v1), v1);

// route-side check of v
eq('clean: ok value kept', cleanPictureVersion('abc123_-X'), 'abc123_-X');
eq('clean: missing', cleanPictureVersion(null), undefined);
eq('clean: empty', cleanPictureVersion(''), undefined);
eq('clean: junk characters', cleanPictureVersion('a b'), undefined);
eq('clean: too long', cleanPictureVersion('a'.repeat(33)), undefined);

// cache header rule
const c = (isPublicCatalogue: boolean, hasVersion: boolean, isFallback: boolean) => pictureCacheControl({ isPublicCatalogue, hasVersion, isFallback });
eq('cache: public + version + normal = one year immutable', c(true, true, false), CACHE_PICTURE_FOREVER);
eq('cache: one-year header content', CACHE_PICTURE_FOREVER, 'public, max-age=31536000, s-maxage=31536000, immutable');
eq('cache: public without version = an hour (unchanged)', c(true, false, false), CACHE_PICTURE_SHORT);
eq('cache: public + version but fallback = an hour, never a year', c(true, true, true), CACHE_PICTURE_SHORT);
eq('cache: public without version, fallback = an hour', c(true, false, true), CACHE_PICTURE_SHORT);
eq('cache: not public (+ version) = private', c(false, true, false), CACHE_PICTURE_PRIVATE);
eq('cache: not public, no version = private', c(false, false, false), CACHE_PICTURE_PRIVATE);
eq('cache: not public, fallback = private', c(false, true, true), CACHE_PICTURE_PRIVATE);
eq('cache: only one combination gets a year', [true, false].flatMap(a => [true, false].flatMap(b => [true, false].map(d => c(a, b, d)))).filter(h => h === CACHE_PICTURE_FOREVER).length, 1);

console.log(failed ? `\n${failed} FAILED` : '\nAll passed');
process.exit(failed ? 1 : 0);
