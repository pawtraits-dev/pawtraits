// Framed downloads at 4K, and proof that print transformations did not change.
// Run: NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x CLOUDINARY_CLOUD_NAME=x CLOUDINARY_API_KEY=x CLOUDINARY_API_SECRET=x NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=x npx tsx scripts/test-framed-download.ts
import { frameBase, frameCrop, frameLayers, type FrameCard } from '../lib/frames/frame';
import { FRAMED_DOWNLOAD_4K, framedDownloadTransformation, framedPrintTransformation, planFramedDownload } from '../lib/frames/print';
import { MASTER_4K_PX, planPrint, planUpscale, SELF_PRINT_BLEED_MM } from '../lib/print/print-geometry';
import { getCustomerDownloadUrl, type ResolvedOrderImage } from '../lib/orders/order-image';
import { cloudinaryService } from '../lib/cloudinary';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra ?? ''); } };

const card: FrameCard = { title: 'ARIES', tagline: 'First through every door', medallion: { symbol: 'aries' } };
const card2: FrameCard = { title: 'DAISY · THE FOOL', tagline: null, medallion: { numeral: '0' } };

// --- Prints are unchanged: strings pinned from the code before the refactor ---------------------
const PINNED: Record<string, string> = {
  a: "c_crop,x_0,y_139,w_1664,h_2219/c_scale,w_1772,h_2362,q_100/l_pawtraits:frames:celestial-3x4/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply/l_pawtraits:zodiac-symbols:aries/e_colorize:100,co_rgb:D9C48A/c_scale,w_181/fl_layer_apply,g_center,x_-1,y_-983/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_43_letter_spacing_4:ARIES,co_rgb:ECDEAA/c_limit,w_735/fl_layer_apply,g_center,x_6,y_990/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_43_letter_spacing_4:ARIES,co_rgb:1E1708/c_limit,w_735/fl_layer_apply,g_center,x_6,y_988/l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_29:First%20through%20every%20door,co_rgb:ECDEAA/c_limit,w_735/fl_layer_apply,g_center,x_4,y_1026/l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_29:First%20through%20every%20door,co_rgb:1E1708/c_limit,w_735/fl_layer_apply,g_center,x_4,y_1024",
  b: "c_crop,x_0,y_67,w_800,h_1067/c_scale,w_800,h_1067/e_upscale/c_scale,w_1772,h_2362,q_100/l_pawtraits:frames:celestial-3x4/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply/l_pawtraits:zodiac-symbols:aries/e_colorize:100,co_rgb:D9C48A/c_scale,w_181/fl_layer_apply,g_center,x_-1,y_-983/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_43_letter_spacing_4:ARIES,co_rgb:ECDEAA/c_limit,w_735/fl_layer_apply,g_center,x_6,y_990/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_43_letter_spacing_4:ARIES,co_rgb:1E1708/c_limit,w_735/fl_layer_apply,g_center,x_6,y_988/l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_29:First%20through%20every%20door,co_rgb:ECDEAA/c_limit,w_735/fl_layer_apply,g_center,x_4,y_1026/l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_29:First%20through%20every%20door,co_rgb:1E1708/c_limit,w_735/fl_layer_apply,g_center,x_4,y_1024",
  c: "c_crop,x_0,y_267,w_3392,h_4523/c_scale,w_3543,h_4724,q_100/l_pawtraits:frames:celestial-3x4/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_274:0,co_rgb:D9C48A/c_limit,w_374/fl_layer_apply,g_center,x_-1,y_-1972/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_110_letter_spacing_11:DAISY%20%C2%B7%20THE%20FOOL,co_rgb:ECDEAA/c_limit,w_1469/fl_layer_apply,g_center,x_13,y_2012/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_110_letter_spacing_11:DAISY%20%C2%B7%20THE%20FOOL,co_rgb:1E1708/c_limit,w_1469/fl_layer_apply,g_center,x_13,y_2007/c_pad,w_3579,h_4760,b_black",
  d: "c_crop,x_0,y_0,w_1664,h_2496/c_scale,w_2362,h_3543,q_100/l_pawtraits:frames:celestial-2x3/c_scale,w_1.0,h_1.0,fl_relative/fl_layer_apply/l_pawtraits:zodiac-symbols:aries/e_colorize:100,co_rgb:D9C48A/c_scale,w_241/fl_layer_apply,g_center,x_-1,y_-1508/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_57_letter_spacing_6:ARIES,co_rgb:ECDEAA/c_limit,w_980/fl_layer_apply,g_center,x_8,y_1518/l_text:pawtraits:frames:fonts:playfair-display-800.woff2_57_letter_spacing_6:ARIES,co_rgb:1E1708/c_limit,w_980/fl_layer_apply,g_center,x_8,y_1515/l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_38:First%20through%20every%20door,co_rgb:ECDEAA/c_limit,w_980/fl_layer_apply,g_center,x_5,y_1566/l_text:pawtraits:frames:fonts:playfair-display-700-italic.woff2_38:First%20through%20every%20door,co_rgb:1E1708/c_limit,w_980/fl_layer_apply,g_center,x_5,y_1563",
};
const a = planPrint({ width: 1664, height: 2496 }, 15, 20);
const b = planPrint({ width: 800, height: 1200 }, 15, 20);
const c = planPrint({ width: 3392, height: 5056 }, 30, 40);
const cb = planPrint({ width: 3392, height: 5056 }, 30, 40, { bleedMm: SELF_PRINT_BLEED_MM });
ok('print a unchanged', framedPrintTransformation(a, null, card, '3:4') === PINNED.a);
ok('print b (AI upscale) unchanged', framedPrintTransformation(b, planUpscale(b, 25), card, '3:4') === PINNED.b);
ok('print c (bleed) unchanged', framedPrintTransformation(c, null, card2, '3:4', { bleedOutputPx: cb.outputPx }) === PINNED.c);
ok('print d (2:3) unchanged', framedPrintTransformation(planPrint({ width: 1664, height: 2496 }, 20, 30), null, card, '2:3') === PINNED.d);

// --- Plans ----------------------------------------------------------------------------------------
ok('4K target is the largest exact 2:3 inside 3392 x 5056', FRAMED_DOWNLOAD_4K.width === 3370 && FRAMED_DOWNLOAD_4K.height === 5055 && FRAMED_DOWNLOAD_4K.width * 3 === FRAMED_DOWNLOAD_4K.height * 2 && MASTER_4K_PX.height === 5056);
const master = planFramedDownload({ width: 3392, height: 5056 }, true);
ok('master: its own 2:3 size, no upscale', master.upscale === null && master.output.width === 3370 && master.output.height === 5055, master);
const odd = planFramedDownload({ width: 3000, height: 4800 }, true);
ok('a master is never upscaled, whatever its size', odd.upscale === null && odd.output.width === odd.crop.width, odd);
const k2 = planFramedDownload({ width: 1700, height: 2550 }, false);
ok('2K clean source: AI upscale to the 4K size', !!k2.upscale && k2.output.height === 5055 && k2.crop.width === 1700 && k2.crop.height === 2550, k2);
ok('upscale input within the AI limit, never above the crop', !!k2.upscale && k2.upscale.pre.width * k2.upscale.pre.height <= 4.1e6 && k2.upscale.pre.width <= k2.crop.width);
const k1 = planFramedDownload({ width: 850, height: 1275 }, false);
ok('1K clean source: upscaled to 4K', !!k1.upscale && k1.output.height === 5055 && k1.upscale.pre.width === 850, k1);
const big = planFramedDownload({ width: 4000, height: 6000 }, false);
ok('bigger than 4K: own size, no upscale', big.upscale === null && big.output.height === 6000 && big.output.width === 4000, big);
const unknown = planFramedDownload(null, false);
ok('size unknown: plain scale to 4K, no AI upscale', unknown.upscale === null && unknown.output.height === 5055 && unknown.crop.height === 5055);
ok('same helper as prints: plan crop uses frameBase', JSON.stringify(k2.crop) === JSON.stringify(frameBase('2:3', { width: 1700, height: 2550 })));

// --- Transformation ---------------------------------------------------------------------------------
const parts = framedDownloadTransformation(master, card).split('/');
ok('download: crop, scale to output, then the frame', parts[0] === frameCrop(master.crop) && parts[1] === 'c_scale,w_3370,h_5055,q_100' && parts[2].startsWith('l_pawtraits:frames:celestial-2x3'), parts.slice(0, 3));
ok('download: frame layers are exactly frameLayers at the output base', framedDownloadTransformation(master, card) === [frameCrop(master.crop), 'c_scale,w_3370,h_5055,q_100', frameLayers(card, '2:3', { width: 3370, height: 5055 })].join('/'));
ok('download: no AI upscale when not needed', !framedDownloadTransformation(master, card).includes('e_upscale'));
const upParts = framedDownloadTransformation(k2, card).split('/');
ok('download: AI upscale comes before the frame', upParts.indexOf('e_upscale') > 0 && upParts.indexOf('e_upscale') < upParts.findIndex(p => p.startsWith('l_pawtraits:frames')));
// Every size and offset in the layers is a whole number of pixels (no decimals except the base-relative frame scale 1.0)
const layersOnly = frameLayers(card, '2:3', { width: 3370, height: 5055 });
const nums = Array.from(layersOnly.matchAll(/\b[whxy]_(-?[\d.]+)/g)).map(m => m[1]).filter(v => v !== '1.0');
ok('layer sizes and offsets are whole pixels', nums.length > 10 && nums.every(v => /^-?\d+$/.test(v)), nums.filter(v => !/^-?\d+$/.test(v)));
const fontSizes = Array.from(layersOnly.matchAll(/playfair[^_]*_(\d+)(_letter_spacing_(\d+))?:/g));
ok('font sizes whole', fontSizes.length >= 2);

// --- getCustomerDownloadUrl (no network: dependencies are replaced) ------------------------------------
(async () => {
  const frame = { card, style: 'celestial' as const, sourceId: 'pawtraits/clean/design' };
  const base: ResolvedOrderImage = { kind: 'custom', id: 'c1', cloudinaryPublicId: 'pawtraits/baked/design', originalUrl: null, previewUrl: null, filename: 'f', catalogImageId: null, frame };
  let assets = 0, warmed: string[] = [], asked: string[] = [];
  const deps = (size: { width: number; height: number } | null) => ({
    ensureFrameAssets: async () => { assets++; },
    dimensions: async (id: string) => { asked.push(id); return size; },
    warm: async (u: string) => { warmed.push(u); },
  });
  // With master
  let url = await getCustomerDownloadUrl({ ...base, printMasterPublicId: 'pawtraits/print-masters/master-1' }, 'cust', 'order12345', deps({ width: 3392, height: 5056 }));
  ok('master used as the source', asked[0] === 'pawtraits/print-masters/master-1' && url.includes('pawtraits/print-masters/master-1') && !url.includes('pawtraits/clean/design') && !url.includes('baked'), url);
  ok('master: 3370 x 5055, frame at that size, no upscale, no warm-up', url.includes('c_scale,w_3370,h_5055,q_100') && !url.includes('e_upscale') && warmed.length === 0);
  ok('assets ensured before the URL', assets === 1);
  ok('signed, expiring, attachment, png, quality 100', /\/s--[\w-]+--\//.test(url) && /fl_attachment:pawtrait-order123/.test(url) && url.includes('q_100') && /\.png$/.test(url.split('?')[0]), url);
  ok('frame layers present in the URL', url.includes('l_pawtraits:frames:celestial-2x3') && url.includes('l_pawtraits:zodiac-symbols:aries'));
  // Without master: clean source, upscaled
  asked = []; warmed = [];
  url = await getCustomerDownloadUrl(base, 'cust', 'order12345', deps({ width: 1700, height: 2550 }));
  ok('no master: the clean source (not the baked copy)', asked[0] === 'pawtraits/clean/design' && url.includes('pawtraits/clean/design') && !url.includes('pawtraits/baked'), url);
  ok('no master: AI upscale then 3370 x 5055, warmed once', url.includes('e_upscale') && url.includes('c_scale,w_3370,h_5055,q_100') && warmed.length === 1 && warmed[0] === url);
  // Catalogue design: no master ever; clean source
  asked = [];
  url = await getCustomerDownloadUrl({ ...base, kind: 'catalog', id: 'k1' }, 'cust', 'order12345', deps({ width: 3000, height: 4500 }));
  ok('catalogue: clean source, upscaled to 4K', asked[0] === 'pawtraits/clean/design' && url.includes('e_upscale') && url.includes('w_3370,h_5055'), url);
  // Size unreadable: still a URL, no AI upscale
  warmed = [];
  url = await getCustomerDownloadUrl(base, 'cust', 'order12345', { ...deps(null), dimensions: async () => { throw new Error('boom'); } });
  ok('dimensions unreadable: falls back to a plain scale, never an error', url.includes('w_3370,h_5055') && !url.includes('e_upscale') && warmed.length === 0);

  // Unframed: identical to before (the same call getDownloadUrl made)
  const realNow = Date.now; Date.now = () => 1_800_000_000_000;
  try {
    const plain: ResolvedOrderImage = { ...base, frame: null };
    const before = await cloudinaryService.getDownloadUrl('pawtraits/baked/design', 'cust', 'order12345');
    ok('unframed, no master: same URL as before', await getCustomerDownloadUrl(plain, 'cust', 'order12345') === before);
    const beforeM = await cloudinaryService.getDownloadUrl('pawtraits/print-masters/master-1', 'cust', 'order12345');
    ok('unframed, master: same URL as before', await getCustomerDownloadUrl({ ...plain, printMasterPublicId: 'pawtraits/print-masters/master-1' }, 'cust', 'order12345') === beforeM);
    ok('unframed URL has no frame or upscale', !before.includes('frames') && !before.includes('e_upscale'));
  } finally { Date.now = realNow; }

  if (process.env.SHOW) console.log(await getCustomerDownloadUrl({ ...base, printMasterPublicId: 'pawtraits/print-masters/master-1' }, 'cust', 'order12345', deps({ width: 3392, height: 5056 })));
  console.log(fail ? `${fail} failed, ${pass} passed` : `${pass} passed`);
  process.exit(fail ? 1 : 0);
})();
