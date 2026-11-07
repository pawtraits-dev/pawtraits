/**
 * Divider cards for the stall's flip-through bins (server only): one card per breed, as wide as
 * the prints it divides and 2 cm taller, so the top 2 cm shows above the prints.
 *
 *   ┌──────────────────────────────┐
 *   │ Cockerpoo               [QR] │  2 cm purple tab: breed name, QR to the breed's designs
 *   ├──────────────────────────────┤
 *   │ ┌──────────┐ Tagline…        │
 *   │ │  hero    │ Description…    │  square hero photo at half width, words beside it
 *   │ │ (square) │ …               │  (a long description carries on full width below)
 *   │ └──────────┘                 │
 *   │ Some of our Cockerpoo designs│
 *   │ [design] [design] [design]   │  three designs (chosen in admin, else the newest)
 *   │ Scan the code at the top…    │
 *   │                pawtraits.pics│
 *   └──────────────────────────────┘
 * Designed at 15 cm wide and scaled to the size; the tab is always 2 cm. One card per page at its
 * exact finished size, no bleed or crop marks (like the print files).
 */
import { readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { qrMatrix } from '@/lib/qr/render';

export type DividerSize = 'S' | 'M' | 'L' | 'XL';
/** Print width × height (cm, portrait); the card is the same width and 2 cm taller */
export const DIVIDER_SIZES: Record<DividerSize, { w: number; h: number; label: string }> = {
  S: { w: 15, h: 20, label: 'Small prints (15 × 20 cm) → cards 15 × 22 cm' },
  M: { w: 20, h: 30, label: 'Medium prints (20 × 30 cm) → cards 20 × 32 cm' },
  L: { w: 30, h: 40, label: 'Large prints (30 × 40 cm) → cards 30 × 42 cm' },
  XL: { w: 40, h: 60, label: 'Extra large prints (40 × 60 cm) → cards 40 × 62 cm' },
};
export const TAB_CM = 2;
export const DESIGNS_PER_CARD = 3;

export interface DividerBreed {
  id: string; name: string; animal: 'dog' | 'cat'; description: string | null; heroUrl: string | null;
  designs: { id: string; imageUrl: string }[];   // up to three, in order
}

const MM = 72 / 25.4;
const mm = (v: number) => v * MM;
const DEEP = rgb(0x3d / 255, 0x23 / 255, 0x73 / 255);
const PURPLE = rgb(0x6b / 255, 0x46 / 255, 0xc1 / 255);
const INK = rgb(0.16, 0.14, 0.2);
const SOFT = rgb(0.45, 0.42, 0.5);
const EMPTY = rgb(0.95, 0.93, 0.99);

export function breedUrl(b: Pick<DividerBreed, 'id' | 'animal'>): string {
  return `https://www.pawtraits.pics/browse?type=${b.animal === 'cat' ? 'cats' : 'dogs'}&breed=${b.id}&src=divider`;
}

/** "**Tagline**\n\nBody" → tagline and plain body text */
export function splitDescription(md: string | null): { tagline: string | null; body: string } {
  const text = (md || '').replace(/\r/g, '').trim();
  const m = /^\*\*([\s\S]+?)\*\*\s*/.exec(text);
  const tagline = m ? m[1].trim() : null;
  const rest = (m ? text.slice(m[0].length) : text)
    .replace(/\[(.+?)\]\(.+?\)/g, '$1').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
  return { tagline, body: rest };
}

/** Where things go (mm from the top-left) */
function geometry(size: DividerSize) {
  const s = DIVIDER_SIZES[size];
  const W = s.w * 10, H = (s.h + TAB_CM) * 10, tab = TAB_CM * 10;
  const k = W / 150;                                   // designed at 15 cm wide
  const m = 6 * k, gap = 6 * k;
  const col = (W - 2 * m - gap) / 2;                   // half width: the photo's side
  const thumbGap = 4 * k, thumbW = (W - 2 * m - 2 * thumbGap) / 3, thumbH = thumbW * 1.5;
  return { W, H, tab, k, m, gap, col, thumbGap, thumbW, thumbH, qr: 17, top: tab + 6 * k };
}

/** A picture as JPEG cropped to w × h px (sharp handles PNG / WebP / anything) */
async function fetchJpeg(url: string, w: number, h: number): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf).rotate().resize(w, h, { fit: 'cover', position: 'attention' }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
  } catch { return null; }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const c = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(c, size) <= maxWidth) line = c; else { if (line) out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}

let fontBytes: { title: Buffer; semi: Buffer } | null = null;
function fonts() {
  const dir = path.join(process.cwd(), 'lib', 'fonts');
  fontBytes ??= { title: readFileSync(path.join(dir, 'LifeSavers_700Bold.ttf')), semi: readFileSync(path.join(dir, 'LeagueSpartan_600SemiBold.ttf')) };
  return fontBytes;
}

const px = (mmv: number) => Math.min(2400, Math.round((mmv / 25.4) * 300));   // 300 dpi

export async function generateDividerCards(breeds: DividerBreed[], size: DividerSize): Promise<{ pdf: Uint8Array; missingHero: string[] }> {
  const g = geometry(size);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`Pawtraits divider cards (${size})`);
  pdf.setCreator('Pawtraits admin');
  const f = {
    title: await pdf.embedFont(fonts().title),                 // not subset (subsetting garbles Life Savers)
    semi: await pdf.embedFont(fonts().semi, { subset: true }),
    body: await pdf.embedFont(StandardFonts.Helvetica),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };

  const missingHero: string[] = [];
  for (const b of breeds) {
    // This breed's pictures: the hero (square) and its designs (2:3), fetched together
    const [hero, ...designs] = await Promise.all([
      b.heroUrl ? fetchJpeg(b.heroUrl, px(g.col), px(g.col)) : Promise.resolve(null),
      ...b.designs.slice(0, DESIGNS_PER_CARD).map(d => fetchJpeg(d.imageUrl, px(g.thumbW), px(g.thumbH))),
    ]);
    if (!hero) missingHero.push(b.name);
    const heroImg = hero ? await pdf.embedJpg(hero) : null;
    const designImgs: (PDFImage | null)[] = [];
    for (const d of designs) designImgs.push(d ? await pdf.embedJpg(d) : null);
    drawCard(pdf.addPage([mm(g.W), mm(g.H)]), b, heroImg, designImgs, g, f);
  }
  return { pdf: await pdf.save(), missingHero };
}

function drawCard(page: PDFPage, b: DividerBreed, hero: PDFImage | null, designs: (PDFImage | null)[], g: ReturnType<typeof geometry>,
  f: { title: PDFFont; semi: PDFFont; body: PDFFont; italic: PDFFont }) {
  const { W, H, tab, k, m, gap, col } = g;
  const Y = (top: number) => mm(H - top);              // pdf-lib's origin is bottom-left
  const kt = k;                                        // text grows with the card

  // ---- Tab (shows above the prints): name left, QR right on a white square
  page.drawRectangle({ x: 0, y: Y(tab), width: mm(W), height: mm(tab), color: DEEP });
  const q = g.qr, qx = W - m - q + 2 * k, qy = (tab - q) / 2;
  page.drawRectangle({ x: mm(qx), y: Y(qy + q), width: mm(q), height: mm(q), color: rgb(1, 1, 1) });
  const { size: n, isDark } = qrMatrix(breedUrl(b));
  const quiet = 1.2, mod = q / (n + 2 * quiet);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (isDark(c, r)) page.drawRectangle({ x: mm(qx + (c + quiet) * mod), y: Y(qy + (r + quiet + 1) * mod), width: mm(mod) + 0.05, height: mm(mod) + 0.05, color: DEEP });
  }
  let ns = Math.min(34 * kt, mm(tab) * 0.6);
  while (ns > 10 && f.title.widthOfTextAtSize(b.name, ns) > mm(qx - 4 * k - m)) ns -= 0.5;
  page.drawText(b.name, { x: mm(m), y: Y(tab / 2) - ns * 0.3, size: ns, font: f.title, color: rgb(1, 1, 1) });

  // ---- Square hero photo at half width
  const top = g.top;
  if (hero) page.drawImage(hero, { x: mm(m), y: Y(top + col), width: mm(col), height: mm(col) });
  else page.drawRectangle({ x: mm(m), y: Y(top + col), width: mm(col), height: mm(col), color: EMPTY });

  // ---- Tagline and description beside it, carrying on full width below the photo
  const { tagline, body } = splitDescription(b.description);
  const tx = m + col + gap;
  const s = 8.6 * kt, lead = (s * 1.32) / MM;
  let y = top + 2 * k;
  if (tagline) for (const l of wrap(tagline, f.italic, s * 1.15, mm(col))) {
    y += lead * 1.05; page.drawText(l, { x: mm(tx), y: Y(y), size: s * 1.15, font: f.italic, color: PURPLE });
  }
  if (tagline) y += lead * 0.45;
  const beside = (yy: number) => yy + lead <= top + col;
  // the words stop where the designs need their room
  const designsH = 3 * k + 9 * k + g.thumbH + 7 * k + 2 * lead + 6 * k;
  const textEnd = H - m - designsH;
  let line = '', truncated = false;
  const flush = (text: string) => {
    const side = beside(y);
    if (!side && y < top + col) y = top + col + lead * 0.2;   // first full-width line starts clear of the photo
    y += lead;
    page.drawText(text, { x: mm(side ? tx : m), y: Y(y), size: s, font: f.body, color: INK });
  };
  for (const w of body.split(/\s+/).filter(Boolean)) {
    if (y + 2 * lead > Math.max(textEnd, top + col)) { truncated = true; break; }
    const c = line ? `${line} ${w}` : w;
    if (f.body.widthOfTextAtSize(c, s) <= mm(beside(y) ? col : W - 2 * m)) { line = c; continue; }
    flush(line); line = w;
  }
  if (line) flush(truncated ? `${line.replace(/[\s,;:.]+$/, '')}…` : line);

  // ---- One row of designs
  let by = Math.max(top + col, y) + 9 * k;
  page.drawText(`Some of our ${b.name} designs`, { x: mm(m), y: Y(by), size: 9 * kt, font: f.semi, color: DEEP });
  by += 3 * k;
  for (let i = 0; i < DESIGNS_PER_CARD; i++) {
    const x = m + i * (g.thumbW + g.thumbGap);
    const img = designs[i];
    if (img) page.drawImage(img, { x: mm(x), y: Y(by + g.thumbH), width: mm(g.thumbW), height: mm(g.thumbH) });
    else page.drawRectangle({ x: mm(x), y: Y(by + g.thumbH), width: mm(g.thumbW), height: mm(g.thumbH), color: EMPTY });
  }
  by += g.thumbH + 7 * k;
  const how = 'Scan the code at the top, add a photo of your pet, and Pawcasso paints them into any picture. Free preview in about a minute.';
  for (const l of wrap(how, f.body, 8 * kt, mm(W - 2 * m))) { page.drawText(l, { x: mm(m), y: Y(by), size: 8 * kt, font: f.body, color: SOFT }); by += (8 * kt * 1.3) / MM; }
  const site = 'pawtraits.pics';
  page.drawText(site, { x: mm(W - m) - f.semi.widthOfTextAtSize(site, 8 * kt), y: Y(H - m), size: 8 * kt, font: f.semi, color: PURPLE });
}
