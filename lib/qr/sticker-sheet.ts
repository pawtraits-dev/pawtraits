import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import { qrMatrix } from './render';

/**
 * A4 sticker sheet generator for the removable rear stickers.
 * Default layout: 8 per sheet, 99.1 × 67.7 mm (Avery L7165-compatible).
 * QR codes are drawn as vectors, so they stay sharp at any print resolution.
 */

export interface StickerSheetLayout {
  pageWidthMm: number;
  pageHeightMm: number;
  columns: number;
  rows: number;
  labelWidthMm: number;
  labelHeightMm: number;
  marginLeftMm: number;
  marginTopMm: number;
  gapXMm: number;
  gapYMm: number;
}

export const DEFAULT_STICKER_LAYOUT: StickerSheetLayout = {
  pageWidthMm: 210, pageHeightMm: 297,
  columns: 2, rows: 4,
  labelWidthMm: 99.1, labelHeightMm: 67.7,
  marginLeftMm: 4.65, marginTopMm: 13.1,
  gapXMm: 2.5, gapYMm: 0,
};

export interface StickerLabel {
  url: string;              // encoded in the QR (upper-case short link)
  displayUrl: string;       // human-readable version printed under the ref
  refText: string;          // e.g. "Ref 1123-M"
  locationCode?: string | null;
  sequence?: string | null; // e.g. "3/16" — matches label to print when applying
  thumbnailKey?: string | null; // key into StickerSheetOptions.thumbnails (usually the image id)
}

export interface StickerSheetOptions {
  layout?: StickerSheetLayout;
  startPosition?: number;   // 1-based position on the first sheet (to finish a part-used sheet)
  cta?: string;             // call to action
  subCta?: string;
  showGuides?: boolean;     // outline each label (for test prints on plain paper)
  /** JPEG/PNG bytes per thumbnailKey. Each image is embedded once and reused on every label. */
  thumbnails?: Map<string, Uint8Array>;
}

const MM = 72 / 25.4; // points per mm
const mm = (v: number) => v * MM;

export async function generateStickerSheet(labels: StickerLabel[], opts: StickerSheetOptions = {}): Promise<Uint8Array> {
  const layout = opts.layout ?? DEFAULT_STICKER_LAYOUT;
  const perPage = layout.columns * layout.rows;
  const start = Math.min(Math.max(1, Math.floor(opts.startPosition ?? 1)), perPage) - 1;
  const cta = opts.cta ?? 'Scan to put YOUR pet in this picture';
  const subCta = opts.subCta ?? 'Buy it on your phone and get a free digital copy';

  const pdf = await PDFDocument.create();
  pdf.setTitle('Pawtraits sticker sheet');
  pdf.setCreator('Pawtraits admin');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Embed each thumbnail once (keeps the PDF small when many labels share an image)
  const embedded = new Map<string, PDFImage>();
  for (const [key, bytes] of Array.from(opts.thumbnails?.entries() ?? [])) {
    try {
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      embedded.set(key, isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes));
    } catch (e) {
      console.warn(`Sticker sheet: could not embed thumbnail ${key}`, e);
    }
  }

  let page: PDFPage | null = null;
  labels.forEach((label, i) => {
    const slot = start + i;
    const posOnPage = slot % perPage;
    if (!page || posOnPage === 0) page = pdf.addPage([mm(layout.pageWidthMm), mm(layout.pageHeightMm)]);

    const col = posOnPage % layout.columns;
    const row = Math.floor(posOnPage / layout.columns);
    const x = layout.marginLeftMm + col * (layout.labelWidthMm + layout.gapXMm);
    const yTop = layout.marginTopMm + row * (layout.labelHeightMm + layout.gapYMm);
    drawLabel(page, label, { x, yTop, w: layout.labelWidthMm, h: layout.labelHeightMm, pageH: layout.pageHeightMm },
      { regular, bold, cta, subCta, guides: !!opts.showGuides,
        thumb: label.thumbnailKey ? embedded.get(label.thumbnailKey) ?? null : null });
  });

  if (!labels.length) pdf.addPage([mm(layout.pageWidthMm), mm(layout.pageHeightMm)]);
  return pdf.save();
}

interface Box { x: number; yTop: number; w: number; h: number; pageH: number }

function drawLabel(
  page: PDFPage, label: StickerLabel, box: Box,
  f: { regular: PDFFont; bold: PDFFont; cta: string; subCta: string; guides: boolean; thumb: PDFImage | null }
) {
  // pdf-lib's origin is bottom-left; convert from top-left mm
  const toY = (topMm: number) => mm(box.pageH - topMm);
  const black = rgb(0, 0, 0);
  const grey = rgb(0.35, 0.35, 0.35);
  const purple = rgb(0.576, 0.2, 0.918); // #9333ea

  if (f.guides) {
    page.drawRectangle({
      x: mm(box.x), y: toY(box.yTop + box.h), width: mm(box.w), height: mm(box.h),
      borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5,
    });
  }

  // QR on the left: square, vertically centred, with a 4-module quiet zone included
  const pad = 4;
  // Smaller QR when a thumbnail shares the label (still ~32 mm of code — scans easily)
  const qrSideMm = Math.min(box.h - 2 * pad, f.thumb ? 40 : 46);
  const qrX = box.x + pad;
  const qrTop = box.yTop + (box.h - qrSideMm) / 2;
  const { size, isDark } = qrMatrix(label.url);
  const quiet = 4;
  const moduleMm = qrSideMm / (size + 2 * quiet);
  page.drawRectangle({ x: mm(qrX), y: toY(qrTop + qrSideMm), width: mm(qrSideMm), height: mm(qrSideMm), color: rgb(1, 1, 1) });
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isDark(c, r)) continue;
      page.drawRectangle({
        x: mm(qrX + (c + quiet) * moduleMm),
        y: toY(qrTop + (r + quiet + 1) * moduleMm),
        width: mm(moduleMm) + 0.05, // hairline overlap avoids white seams
        height: mm(moduleMm) + 0.05,
        color: black,
      });
    }
  }

  // Text on the right
  const tx = qrX + qrSideMm + 3;
  const tw = box.x + box.w - pad - tx;
  let cursor = box.yTop + pad;

  if (f.thumb) {
    // Thumbnail of the design, top of the text column, aspect ratio preserved
    const maxW = tw, maxH = 27;
    const scale = Math.min(maxW / f.thumb.width, maxH / f.thumb.height);
    const w = f.thumb.width * scale, h = f.thumb.height * scale;
    page.drawImage(f.thumb, { x: mm(tx), y: toY(cursor + h), width: mm(w), height: mm(h) });
    page.drawRectangle({ x: mm(tx), y: toY(cursor + h), width: mm(w), height: mm(h), borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.4 });
    cursor += h + 4.2;
    for (const line of wrap(f.cta, f.bold, 9.5, mm(tw)).slice(0, 2)) {
      page.drawText(line, { x: mm(tx), y: toY(cursor), size: 9.5, font: f.bold, color: purple });
      cursor += 4;
    }
  } else {
    cursor += 5;
    for (const line of wrap(f.cta, f.bold, 12, mm(tw))) {
      page.drawText(line, { x: mm(tx), y: toY(cursor), size: 12, font: f.bold, color: purple });
      cursor += 5.2;
    }
    cursor += 1.5;
    for (const line of wrap(f.subCta, f.regular, 8.5, mm(tw))) {
      page.drawText(line, { x: mm(tx), y: toY(cursor), size: 8.5, font: f.regular, color: grey });
      cursor += 3.8;
    }
  }

  // Footer block anchored to the bottom
  let footer = box.yTop + box.h - pad - 1;
  if (label.sequence || label.locationCode) {
    const meta = [label.locationCode, label.sequence].filter(Boolean).join('  ·  ');
    page.drawText(meta, { x: mm(tx), y: toY(footer), size: 6.5, font: f.regular, color: grey });
    footer -= 3.6;
  }
  page.drawText(fit(label.displayUrl, f.regular, 7.5, mm(tw)), { x: mm(tx), y: toY(footer), size: 7.5, font: f.regular, color: grey });
  footer -= 4.6;
  page.drawText(label.refText, { x: mm(tx), y: toY(footer), size: 11, font: f.bold, color: black });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else { if (line) lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 4 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}
