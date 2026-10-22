/**
 * Print labels for trade-printed stall stock (server only): one small frosted label per print,
 * used on the front corner or the back, A4 sheets of 21 (63.5 × 38.1 mm, 3 × 7, template CL2163).
 *
 *   ┌───────────────────────────────────┐
 *   │ [thumb] PAWTRAITS        ┌──────┐ │   thumbnail, brand, size tag
 *   │ [     ] (M) 20×30 cm    │  QR  │ │
 *   │ Game Day Glory           │      │ │   title (Life Savers, up to 2 lines)
 *   │ Scan to buy or add your pet └──┘ │   call to action
 *   └───────────────────────────────────┘
 *
 * Light purple for the accents, deep brand purple for the QR code and the title so the code
 * scans on a see-through label. The QR is the stall sticker link (/S/<ref><size>[/<stall>]):
 * buy this print at the stall price, or put your own pet in it. QR codes are vectors.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { qrMatrix } from '@/lib/qr/render';

export interface LabelSheetLayout {
  pageWidthMm: number; pageHeightMm: number;
  columns: number; rows: number;
  labelWidthMm: number; labelHeightMm: number;
  marginLeftMm: number; marginTopMm: number;
  gapXMm: number; gapYMm: number;
  cornerRadiusMm: number;
}

/** CL2163: A4, 21 labels 63.5 × 38.1 mm, 3 across × 7 down, margins 15.15 top / 7.75 left, 2 mm gap across */
export const CL2163: LabelSheetLayout = {
  pageWidthMm: 210, pageHeightMm: 297,
  columns: 3, rows: 7,
  labelWidthMm: 63.5, labelHeightMm: 38.1,
  marginLeftMm: 7.75, marginTopMm: 15.15,
  gapXMm: 2, gapYMm: 0,
  cornerRadiusMm: 1.5,
};

export interface PrintLabel {
  title: string;
  sizeCode: string;        // S / M / L / XL
  sizeText: string;        // "20×30 cm"
  qrUrl: string;
  thumbnailKey?: string | null;
}

export interface LabelOptions {
  layout?: LabelSheetLayout;
  startPosition?: number;  // 1-based, to finish a part-used sheet
  showGuides?: boolean;    // label outlines, for a test print on plain paper
  cta?: string;
  thumbnails?: Map<string, Uint8Array>;
}

const MM = 72 / 25.4;
const mm = (v: number) => v * MM;
const DEEP = rgb(0x3d / 255, 0x23 / 255, 0x73 / 255);     // #3D2373 brand deep purple
const MID = rgb(0x6e / 255, 0x54 / 255, 0xb5 / 255);      // #6E54B5
const LIGHT = rgb(0xb9 / 255, 0xa3 / 255, 0xe8 / 255);    // #B9A3E8 light purple

let fontBytes: { title: Buffer; bold: Buffer; semi: Buffer } | null = null;
function fonts() {
  const dir = path.join(process.cwd(), 'lib', 'fonts');
  fontBytes ??= {
    title: readFileSync(path.join(dir, 'LifeSavers_700Bold.ttf')),
    bold: readFileSync(path.join(dir, 'LeagueSpartan_700Bold.ttf')),
    semi: readFileSync(path.join(dir, 'LeagueSpartan_600SemiBold.ttf')),
  };
  return fontBytes;
}

export async function generatePrintLabels(labels: PrintLabel[], opts: LabelOptions = {}): Promise<Uint8Array> {
  const layout = opts.layout ?? CL2163;
  const perPage = layout.columns * layout.rows;
  const start = Math.min(Math.max(1, Math.floor(opts.startPosition ?? 1)), perPage) - 1;
  const cta = opts.cta ?? 'Scan to buy, or put your pet in it';

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('Pawtraits print labels');
  pdf.setCreator('Pawtraits admin');
  const f = fonts();
  const titleFont = await pdf.embedFont(f.title);   // not subset: subsetting garbles Life Savers' glyphs
  const bold = await pdf.embedFont(f.bold, { subset: true });
  const semi = await pdf.embedFont(f.semi, { subset: true });

  const thumbs = new Map<string, PDFImage>();
  for (const [key, bytes] of Array.from(opts.thumbnails?.entries() ?? [])) {
    try { thumbs.set(key, bytes[0] === 0x89 ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)); } catch { /* label without thumbnail */ }
  }

  let page: PDFPage | null = null;
  labels.forEach((label, i) => {
    const slot = start + i;
    const pos = slot % perPage;
    if (!page || pos === 0) page = pdf.addPage([mm(layout.pageWidthMm), mm(layout.pageHeightMm)]);
    const col = pos % layout.columns, row = Math.floor(pos / layout.columns);
    const x = layout.marginLeftMm + col * (layout.labelWidthMm + layout.gapXMm);
    const yTop = layout.marginTopMm + row * (layout.labelHeightMm + layout.gapYMm);
    drawLabel(page, label, { x, yTop, w: layout.labelWidthMm, h: layout.labelHeightMm, pageH: layout.pageHeightMm, r: layout.cornerRadiusMm },
      { titleFont, bold, semi, cta, guides: !!opts.showGuides, thumb: label.thumbnailKey ? thumbs.get(label.thumbnailKey) ?? null : null });
  });
  if (!labels.length) pdf.addPage([mm(layout.pageWidthMm), mm(layout.pageHeightMm)]);
  return pdf.save();
}

interface Box { x: number; yTop: number; w: number; h: number; pageH: number; r: number }

function drawLabel(page: PDFPage, label: PrintLabel, b: Box, f: { titleFont: PDFFont; bold: PDFFont; semi: PDFFont; cta: string; guides: boolean; thumb: PDFImage | null }) {
  const Y = (topMm: number) => mm(b.pageH - topMm);   // pdf-lib origin is bottom-left
  const inset = 2.5;                                     // safe area: allows ~1 mm of printer drift

  if (f.guides) {
    page.drawRectangle({ x: mm(b.x), y: Y(b.yTop + b.h), width: mm(b.w), height: mm(b.h), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.4 });
  }

  // QR, right-hand side, vertically centred, deep purple modules (no white box: the frosted
  // label is the light background; quiet zone of 2 modules kept clear)
  const qrSide = 24;
  const qrX = b.x + b.w - inset - qrSide;
  const qrTop = b.yTop + (b.h - qrSide) / 2;
  const { size, isDark } = qrMatrix(label.qrUrl);
  const quiet = 2;
  const mod = qrSide / (size + 2 * quiet);
  page.drawRectangle({ x: mm(qrX), y: Y(qrTop + qrSide), width: mm(qrSide), height: mm(qrSide), borderColor: LIGHT, borderWidth: 0.9 });
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!isDark(c, r)) continue;
    page.drawRectangle({ x: mm(qrX + (c + quiet) * mod), y: Y(qrTop + (r + quiet + 1) * mod), width: mm(mod) + 0.05, height: mm(mod) + 0.05, color: DEEP });
  }

  // Left column
  const lx = b.x + inset;
  const lw = qrX - 2.5 - lx;
  let textX = lx;
  let top = b.yTop + inset;

  if (f.thumb) {
    const maxW = 11, maxH = 14.5;
    const s = Math.min(maxW / f.thumb.width, maxH / f.thumb.height);
    const w = f.thumb.width * s, h = f.thumb.height * s;
    page.drawImage(f.thumb, { x: mm(lx), y: Y(top + h), width: mm(w), height: mm(h) });
    page.drawRectangle({ x: mm(lx), y: Y(top + h), width: mm(w), height: mm(h), borderColor: LIGHT, borderWidth: 0.5 });
    textX = lx + w + 2;
  }
  const tw = lx + lw - textX;

  // Brand line
  page.drawText('PAWTRAITS', { x: mm(textX), y: Y(top + 2.4), size: 6, font: f.bold, color: LIGHT });

  // Size tag: light purple pill with the size code, then the dimensions
  const tagTop = top + 4.6;
  const code = label.sizeCode;
  const codeSize = 8.5;
  const codeW = f.bold.widthOfTextAtSize(code, codeSize) / MM + 2.4;
  page.drawRectangle({ x: mm(textX), y: Y(tagTop + 4.4), width: mm(codeW), height: mm(4.4), color: LIGHT });
  page.drawText(code, { x: mm(textX + 1.2), y: Y(tagTop + 3.35), size: codeSize, font: f.bold, color: DEEP });
  const dimW = Math.max(4, tw - codeW - 1.2);
  const dimSize = f.bold.widthOfTextAtSize(label.sizeText, 8.5) <= mm(dimW) ? 8.5 : 7.3;   // 40×60 cm next to XL
  page.drawText(fit(label.sizeText, f.bold, dimSize, mm(dimW)), { x: mm(textX + codeW + 1.2), y: Y(tagTop + 3.35), size: dimSize, font: f.bold, color: DEEP });

  // Title under the thumbnail row, full column width, up to 2 lines (smaller if it's long)
  top = b.yTop + inset + (f.thumb ? 16.3 : 10.5);
  let titleSize = 12;
  let lines = wrap(label.title, f.titleFont, titleSize, mm(lw));
  if (lines.length > 2) { titleSize = 10; lines = wrap(label.title, f.titleFont, titleSize, mm(lw)); }
  lines = lines.slice(0, 2);
  if (wrap(label.title, f.titleFont, titleSize, mm(lw)).length > 2) lines[1] = fit(`${lines[1]}…`, f.titleFont, titleSize, mm(lw));
  const lead = titleSize * 0.42;
  lines.forEach((line, i) => page.drawText(line, { x: mm(lx), y: Y(top + lead * (i + 1) - 0.6), size: titleSize, font: f.titleFont, color: DEEP }));

  // Call to action at the bottom of the column
  const ctaLines = wrap(f.cta, f.semi, 6.3, mm(lw)).slice(0, 2);
  ctaLines.reverse().forEach((line, i) => page.drawText(line, { x: mm(lx), y: Y(b.yTop + b.h - inset - 0.4 - i * 2.7), size: 6.3, font: f.semi, color: MID }));
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const c = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(c, size) <= maxWidth) line = c;
    else { if (line) out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text.replace(/…$/, '');
  while (t.length > 2 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}
