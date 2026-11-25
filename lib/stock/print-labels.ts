/**
 * Print labels for trade-printed stall stock and customer rear labels (server only): one small frosted
 * label per print, on the CL2163 sheet: A4, 3 across × 7 down, 63.5 × 38.1 mm each, 15.15 mm top margin,
 * 7.75 mm left margin, 2 mm gap between columns, no gap between rows, 1.5 mm corners. Everything is black
 * ink, for legibility. Everything is drawn at least 2.8 mm inside each label.
 *
 *   ┌───────────────────────────────────┐
 *   │ [thumb] PAWTRAITS        ┌──────┐ │   thumbnail and QR share a height (22.5 mm)
 *   │ [     ] Labrador         │  QR  │ │   breed (bold, up to 3 lines)
 *   │ [     ] (M) 20×30 cm     └──────┘ │   size code in an outline, then the dimensions
 *   │ Scan to purchase, or Pawsonalise… │   call to action (stall: one line; rear: up to 2, ref at right)
 *   └───────────────────────────────────┘
 *
 * The QR is the stall sticker link (/S/<ref><size>[/<stall>]): buy this print at the stall price, or
 * put your own pet in it. QR codes are vectors.
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

/** The earlier sheet: A4, 21 labels, 3 across × 7 down, 15 mm strip top and bottom, no gaps: 70 × 38.14 mm each. Not used now. */
export const A4_21: LabelSheetLayout = {
  pageWidthMm: 210, pageHeightMm: 297,
  columns: 3, rows: 7,
  labelWidthMm: 210 / 3, labelHeightMm: (297 - 2 * 15) / 7,
  marginLeftMm: 0, marginTopMm: 15,
  gapXMm: 0, gapYMm: 0,
  cornerRadiusMm: 0,
};

/** CL2163, measured from the supplier template: 63.5 × 38.1 mm, margins 15.15 top / 7.75 left, 2 mm gap across, 1.5 mm corners */
export const CL2163: LabelSheetLayout = {
  pageWidthMm: 210, pageHeightMm: 297,
  columns: 3, rows: 7,
  labelWidthMm: 63.5, labelHeightMm: 38.1,
  marginLeftMm: 7.75, marginTopMm: 15.15,
  gapXMm: 2, gapYMm: 0,
  cornerRadiusMm: 1.5,
};

export interface PrintLabel {
  title: string;           // no longer drawn; shown in the breed slot only when `breed` is empty
  breed?: string | null;   // the breed name, drawn bold under the kicker
  sizeCode: string;        // S / M / L / XL; empty = no outlined box, the size text starts at the column's left
  sizeText: string;        // "20×30 cm"
  qrUrl: string;
  thumbnailKey?: string | null;
  kicker?: string;         // replaces the "PAWTRAITS" brand line (e.g. "MADE FOR BISCUIT")
  ref?: string;            // item reference at the bottom right (e.g. "PW-1234-1")
  cta?: string;            // this label's call to action; overrides the sheet-wide one
  ctaMaxLines?: 1 | 2;     // 1 (default): one line, shrunk to fit, never wrapped; 2: rear labels
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
const BLACK = rgb(0, 0, 0);
const GUIDE = rgb(0.2, 0.65, 0.9);
export const STALL_CTA = 'Scan to purchase, or Pawsonalise with your own pet';

let fontBytes: { bold: Buffer; semi: Buffer } | null = null;
function fonts() {
  const dir = path.join(process.cwd(), 'lib', 'fonts');
  fontBytes ??= {
    bold: readFileSync(path.join(dir, 'LeagueSpartan_700Bold.ttf')),
    semi: readFileSync(path.join(dir, 'LeagueSpartan_600SemiBold.ttf')),
  };
  return fontBytes;
}

export async function generatePrintLabels(labels: PrintLabel[], opts: LabelOptions = {}): Promise<Uint8Array> {
  const layout = opts.layout ?? CL2163;
  const perPage = layout.columns * layout.rows;
  const start = Math.min(Math.max(1, Math.floor(opts.startPosition ?? 1)), perPage) - 1;
  const cta = opts.cta ?? STALL_CTA;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle('Pawtraits print labels');
  pdf.setCreator('Pawtraits admin');
  const f = fonts();
  // No ligatures: pdf-lib + fontkit leave a gap after tt / ff / ll ("Kitt en")
  const noLig = { features: { liga: false, dlig: false, clig: false, calt: false, rlig: false } } as any;
  const bold = await pdf.embedFont(f.bold, { subset: true, ...noLig });
  const semi = await pdf.embedFont(f.semi, { subset: true, ...noLig });

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
      { bold, semi, cta: label.cta ?? cta, guides: !!opts.showGuides, thumb: label.thumbnailKey ? thumbs.get(label.thumbnailKey) ?? null : null });
  });
  if (!labels.length) pdf.addPage([mm(layout.pageWidthMm), mm(layout.pageHeightMm)]);
  return pdf.save();
}

interface Box { x: number; yTop: number; w: number; h: number; pageH: number; r: number }

const cap = (f: PDFFont, s: number) => (f.heightAtSize(s, { descender: false }) / MM) * 0.82;

function roundRect(page: PDFPage, x: number, yTop: number, w: number, h: number, r: number, pageH: number) {
  if (r <= 0) {
    page.drawRectangle({ x: mm(x), y: mm(pageH - yTop - h), width: mm(w), height: mm(h), borderColor: GUIDE, borderWidth: 0.35 });
    return;
  }
  const k = 0.5523 * r;
  const p = `M ${x + r} 0 L ${x + w - r} 0 C ${x + w - r + k} 0 ${x + w} ${r - k} ${x + w} ${r} L ${x + w} ${h - r} C ${x + w} ${h - r + k} ${x + w - r + k} ${h} ${x + w - r} ${h} L ${x + r} ${h} C ${x + r - k} ${h} ${x} ${h - r + k} ${x} ${h - r} L ${x} ${r} C ${x} ${r - k} ${x + r - k} 0 ${x + r} 0 Z`;
  page.drawSvgPath(p, { x: 0, y: mm(pageH - yTop), scale: MM, borderColor: GUIDE, borderWidth: 0.35 / MM });
}

function drawLabel(page: PDFPage, label: PrintLabel, b: Box, f: { bold: PDFFont; semi: PDFFont; cta: string; guides: boolean; thumb: PDFImage | null }) {
  const Y = (topMm: number) => mm(b.pageH - topMm);   // pdf-lib origin is bottom-left
  const inset = 2.8, side = 22.5;                       // thumbnail and QR share this height
  const top = b.yTop + inset;

  if (f.guides) roundRect(page, b.x, b.yTop, b.w, b.h, b.r, b.pageH);

  // QR, black, right
  const qx = b.x + b.w - inset - side;
  const { size, isDark } = qrMatrix(label.qrUrl);
  const quiet = 1.5, mod = side / (size + 2 * quiet);
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (!isDark(c, r)) continue;
    page.drawRectangle({ x: mm(qx + (c + quiet) * mod), y: Y(top + (r + quiet + 1) * mod), width: mm(mod) + 0.05, height: mm(mod) + 0.05, color: BLACK });
  }

  // Thumbnail, left, same height as the QR, aspect kept, no border (width capped so the text column keeps room)
  let tw = 0;
  if (f.thumb) {
    tw = Math.min(side * f.thumb.width / f.thumb.height, 20);
    const th = tw * f.thumb.height / f.thumb.width;
    page.drawImage(f.thumb, { x: mm(b.x + inset), y: Y(top + th), width: mm(tw), height: mm(th) });
  }

  // Middle column
  const mx = b.x + inset + (f.thumb ? tw + 2 : 0), mw = qx - 2 - mx;
  let y = top;

  // Kicker: up to 2 lines, 6 pt down to 5
  let ks = 6, kl = wrap((label.kicker ?? 'PAWTRAITS').toUpperCase(), f.bold, ks, mm(mw));
  while (kl.length > 2 && ks > 5) { ks -= 0.25; kl = wrap((label.kicker ?? 'PAWTRAITS').toUpperCase(), f.bold, ks, mm(mw)); }
  kl = limitLines(kl, 2, f.bold, ks, mm(mw));
  kl.forEach((l, i) => page.drawText(l, { x: mm(mx), y: Y(y + cap(f.bold, ks) + i * ks * 0.4), size: ks, font: f.bold, color: BLACK }));
  y += cap(f.bold, ks) + (kl.length - 1) * ks * 0.4 + 1.8;

  // Breed (the title when there is none): as big as fits on up to 3 lines, 10 pt down to 6.5
  const breed = (label.breed ?? '').trim() || label.title;
  let bs = 10, bl = wrap(breed, f.bold, bs, mm(mw));
  while ((bl.length > 3 || bl.some(l => f.bold.widthOfTextAtSize(l, bs) > mm(mw))) && bs > 6.5) { bs -= 0.25; bl = wrap(breed, f.bold, bs, mm(mw)); }
  bl = limitLines(bl, 3, f.bold, bs, mm(mw));
  bl.forEach((l, i) => page.drawText(fit(l, f.bold, bs, mm(mw)), { x: mm(mx), y: Y(y + cap(f.bold, bs) + i * bs * 0.4), size: bs, font: f.bold, color: BLACK }));

  // Size row, bottom-aligned with the QR: outlined size code, then the dimensions
  const rowBase = top + side - 0.4;
  const code = label.sizeCode;
  const hasCode = code.length > 0;
  const codeSize = 8;
  const codeW = hasCode ? f.bold.widthOfTextAtSize(code, codeSize) / MM + 2.2 : 0;
  if (hasCode) {
    page.drawRectangle({ x: mm(mx), y: Y(rowBase + 0.6), width: mm(codeW), height: mm(4.2), borderColor: BLACK, borderWidth: 0.7 });
    page.drawText(code, { x: mm(mx + 1.1), y: Y(rowBase - 0.6), size: codeSize, font: f.bold, color: BLACK });
  }
  const dimOff = hasCode ? codeW + 1.2 : 0;
  // as in the approved mock, an XL "40×60 cm" at the 5.5 pt floor may use 1.5 mm of the 2 mm gap before the QR
  const dimRoom = mm(Math.max(4, mw - dimOff + 1.5));
  let ds = 7.5; while (ds > 5.5 && f.semi.widthOfTextAtSize(label.sizeText, ds) > mm(Math.max(4, mw - dimOff))) ds -= 0.25;
  page.drawText(fit(label.sizeText, f.semi, ds, dimRoom), { x: mm(mx + dimOff), y: Y(rowBase - 0.6), size: ds, font: f.semi, color: BLACK });

  // Bottom band: call to action, centred vertically in the band; the item ref at the bottom right when set
  const bandTop = top + side + 0.8, bandBottom = b.yTop + b.h - inset;
  const refW = label.ref ? f.semi.widthOfTextAtSize(label.ref, 5.5) / MM + 1.5 : 0;
  const cw = b.w - 2 * inset - refW;
  const maxLines = label.ctaMaxLines === 2 ? 2 : 1;
  let cs = 7.6, cl = wrap(f.cta, f.semi, cs, mm(cw));
  if (maxLines === 1) {
    // One line, never wrapped: shrink until it fits the full width (truncated only below 4 pt)
    cl = [f.cta.replace(/\s+/g, ' ').trim()];
    while (cs > 4 && f.semi.widthOfTextAtSize(cl[0], cs) > mm(cw)) cs -= 0.1;
    cl = [fit(cl[0], f.semi, cs, mm(cw))];
  } else {
    while (cl.length > 2 && cs > 6) { cs -= 0.2; cl = wrap(f.cta, f.semi, cs, mm(cw)); }
    cl = limitLines(cl, 2, f.semi, cs, mm(cw));
  }
  const lead = cs * 0.42;
  const blockH = cap(f.semi, cs) + (cl.length - 1) * lead;
  const last = (bandTop + bandBottom) / 2 + blockH / 2 - 0.2;
  cl.forEach((l, i) => page.drawText(l, { x: mm(b.x + inset), y: Y(last - (cl.length - 1 - i) * lead), size: cs, font: f.semi, color: BLACK }));
  if (label.ref) page.drawText(label.ref, { x: mm(b.x + b.w - inset - refW + 1.5), y: Y(last), size: 5.5, font: f.semi, color: BLACK });
}

/** Keep at most n lines; the last kept line is cut with an ellipsis if lines were dropped */
function limitLines(lines: string[], n: number, font: PDFFont, size: number, maxWidth: number): string[] {
  if (lines.length <= n) return lines;
  const out = lines.slice(0, n);
  out[n - 1] = fit(`${out[n - 1]}…`, font, size, maxWidth);
  return out;
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
