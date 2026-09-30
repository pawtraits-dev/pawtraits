/**
 * Self-print paperwork (server only):
 *  - Packing slips (A4, one per order) with a cut-out address label and a pick list
 *  - A pick-list summary page first when several orders are printed together
 *  - Royal Mail Click & Drop import CSV
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib';
import { postedItems, describeOrderItem, itemTitle, itemRef } from './shared';

export { describeOrderItem, itemTitle, itemRef };

const MM = 72 / 25.4;
const mm = (v: number) => v * MM;
const A4 = { w: mm(210), h: mm(297) };
const PURPLE = rgb(0.576, 0.2, 0.918);
const GREY = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(0.85, 0.86, 0.88);
const BLACK = rgb(0.07, 0.09, 0.15);

/** Small JPEG for the slip, via Cloudinary when possible. */
function thumbUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/res\.cloudinary\.com\/.+\/upload\//.test(url)) {
    return url.replace('/upload/', '/upload/w_300,h_300,c_limit,f_jpg,q_75/');
  }
  return url;
}

async function fetchImage(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!/jpe?g|png/.test(ct)) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function addressLines(order: any): string[] {
  const name = `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim();
  const line1 = order.shipping_address_line_1 || order.shipping_address || '';
  const lines = [
    name,
    order.client_name && order.order_type === 'partner_for_client' ? `c/o ${order.client_name}` : '',
    line1,
    order.shipping_address_line_2 || '',
    order.shipping_city || '',
    (order.shipping_postcode || '').toUpperCase(),
    countryName(order.shipping_country),
  ];
  return lines.filter(l => l && l.trim());
}

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom', US: 'United States', CA: 'Canada', AU: 'Australia', DE: 'Germany', FR: 'France',
  ES: 'Spain', IT: 'Italy', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland', AT: 'Austria',
  DK: 'Denmark', SE: 'Sweden', NO: 'Norway', IE: 'Ireland',
};
export function countryName(c: string | null | undefined): string {
  if (!c) return '';
  return COUNTRY_NAMES[c.toUpperCase()] || c;
}
export function countryCode(c: string | null | undefined): string {
  if (!c) return 'GB';
  if (c.length === 2) return c.toUpperCase();
  const hit = Object.entries(COUNTRY_NAMES).find(([, n]) => n.toLowerCase() === c.toLowerCase());
  return hit ? hit[0] : c;
}

/** Latin-1 safe text for the standard PDF fonts. */
function safe(text: string): string {
  return String(text ?? '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/×/g, 'x').replace(/…/g, '...')
    .replace(/[^\x20-\x7E -ÿ]/g, '');
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxWidth) t = t.slice(0, -1);
  return t + '...';
}

function drawDashedRect(page: PDFPage, x: number, y: number, w: number, h: number) {
  const opts = { color: GREY, thickness: 0.8, dashArray: [4, 3] };
  page.drawLine({ start: { x, y }, end: { x: x + w, y }, ...opts });
  page.drawLine({ start: { x, y: y + h }, end: { x: x + w, y: y + h }, ...opts });
  page.drawLine({ start: { x, y }, end: { x, y: y + h }, ...opts });
  page.drawLine({ start: { x: x + w, y }, end: { x: x + w, y: y + h }, ...opts });
}

function checkbox(page: PDFPage, x: number, y: number, size = mm(4)) {
  page.drawRectangle({ x, y, width: size, height: size, borderColor: BLACK, borderWidth: 0.8 });
}

export interface PackingSlipOptions {
  /** Shown under the address label, e.g. "Return to: Pawtraits, …" */
  returnAddress?: string | null;
}

export async function generatePackingSlips(orders: any[], opts: PackingSlipOptions = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(orders.length === 1 ? `Packing slip ${orders[0].order_number}` : `Packing slips (${orders.length} orders)`);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Thumbnails (one fetch per distinct image)
  const images = new Map<string, PDFImage | null>();
  const urls = new Set<string>();
  for (const o of orders) for (const i of postedItems(o)) { const u = thumbUrl(i.image_url); if (u) urls.add(u); }
  await Promise.all(Array.from(urls).map(async u => {
    const bytes = await fetchImage(u);
    if (!bytes) return images.set(u, null);
    try {
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      images.set(u, isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes));
    } catch { images.set(u, null); }
  }));

  if (orders.length > 1) drawPickSummary(pdf, orders, regular, bold);
  for (const order of orders) drawSlip(pdf, order, regular, bold, images, opts);
  return pdf.save();
}

function drawPickSummary(pdf: PDFDocument, orders: any[], regular: PDFFont, bold: PDFFont) {
  const page = pdf.addPage([A4.w, A4.h]);
  const left = mm(15);
  let y = A4.h - mm(20);
  page.drawText('Print run - pick list', { x: left, y, size: 20, font: bold, color: BLACK });
  y -= mm(7);
  page.drawText(safe(`${orders.length} orders - printed ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`), { x: left, y, size: 10, font: regular, color: GREY });
  y -= mm(12);

  // Blanks needed by product
  const byProduct = new Map<string, number>();
  for (const o of orders) for (const i of postedItems(o)) {
    const key = describeOrderItem(i);
    byProduct.set(key, (byProduct.get(key) || 0) + (i.quantity || 1));
  }
  page.drawText('Blanks to pull', { x: left, y, size: 12, font: bold, color: PURPLE });
  y -= mm(7);
  for (const [product, qty] of Array.from(byProduct.entries()).sort()) {
    page.drawText(`${qty} x`, { x: left, y, size: 11, font: bold, color: BLACK });
    page.drawText(fit(regular, product, 11, mm(150)), { x: left + mm(14), y, size: 11, font: regular, color: BLACK });
    y -= mm(6);
  }
  y -= mm(6);

  page.drawText('Prints', { x: left, y, size: 12, font: bold, color: PURPLE });
  y -= mm(7);
  const cols = [left, left + mm(8), left + mm(40), left + mm(110), left + mm(165)];
  page.drawText('Ref', { x: cols[1], y, size: 8, font: bold, color: GREY });
  page.drawText('Design', { x: cols[2], y, size: 8, font: bold, color: GREY });
  page.drawText('Product', { x: cols[3], y, size: 8, font: bold, color: GREY });
  page.drawText('Qty', { x: cols[4], y, size: 8, font: bold, color: GREY });
  y -= mm(5);
  for (const o of orders) {
    postedItems(o).forEach((item, idx) => {
      if (y < mm(20)) return; // one page summary; the per-order slips have everything
      checkbox(page, cols[0], y - 1, mm(3.5));
      page.drawText(safe(itemRef(o, idx)), { x: cols[1], y, size: 9, font: bold, color: BLACK });
      page.drawText(fit(regular, itemTitle(item), 9, mm(66)), { x: cols[2], y, size: 9, font: regular, color: BLACK });
      page.drawText(fit(regular, describeOrderItem(item), 9, mm(52)), { x: cols[3], y, size: 9, font: regular, color: BLACK });
      page.drawText(String(item.quantity || 1), { x: cols[4], y, size: 9, font: bold, color: BLACK });
      y -= mm(6);
    });
  }
}

function drawSlip(pdf: PDFDocument, order: any, regular: PDFFont, bold: PDFFont, images: Map<string, PDFImage | null>, opts: PackingSlipOptions) {
  const page = pdf.addPage([A4.w, A4.h]);
  const left = mm(15);
  const right = A4.w - mm(15);

  // --- Address label (top right, cut along the dashes) -----------------------
  const labelW = mm(99), labelH = mm(62);
  const labelX = right - labelW, labelY = A4.h - mm(12) - labelH;
  drawDashedRect(page, labelX, labelY, labelW, labelH);
  page.drawText('POSTAL ADDRESS', { x: labelX + mm(5), y: labelY + labelH - mm(7), size: 7, font: bold, color: GREY });
  let ly = labelY + labelH - mm(14);
  const lines = addressLines(order);
  lines.forEach((line, i) => {
    const isPostcode = i === lines.length - 2 && /\d/.test(line);
    const size = isPostcode ? 14 : 12;
    page.drawText(fit(isPostcode || i === 0 ? bold : regular, line, size, labelW - mm(10)), {
      x: labelX + mm(5), y: ly, size, font: isPostcode || i === 0 ? bold : regular, color: BLACK,
    });
    ly -= mm(isPostcode ? 6.5 : 5.6);
  });
  if (opts.returnAddress) {
    page.drawText(fit(regular, `If undelivered return to: ${opts.returnAddress}`, 6.5, labelW - mm(10)), {
      x: labelX + mm(5), y: labelY + mm(3.5), size: 6.5, font: regular, color: GREY,
    });
  }

  // --- Header (top left) ------------------------------------------------------
  let y = A4.h - mm(22);
  page.drawText('Pawtraits', { x: left, y, size: 22, font: bold, color: PURPLE });
  y -= mm(8);
  page.drawText('Packing slip', { x: left, y, size: 12, font: regular, color: GREY });
  y -= mm(12);
  page.drawText(safe(`Order ${order.order_number}`), { x: left, y, size: 14, font: bold, color: BLACK });
  y -= mm(6);
  page.drawText(safe(new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })), { x: left, y, size: 10, font: regular, color: GREY });
  y -= mm(5);
  const shipping = order.metadata?.shippingMethodName || order.metadata?.shipping_method_name;
  if (shipping) {
    page.drawText(fit(regular, `Delivery paid: ${shipping}`, 10, labelX - left - mm(5)), { x: left, y, size: 10, font: regular, color: GREY });
    y -= mm(5);
  }
  if (order.fulfillment_notes) {
    page.drawText(fit(bold, `Note: ${order.fulfillment_notes}`, 10, labelX - left - mm(5)), { x: left, y, size: 10, font: bold, color: rgb(0.7, 0.1, 0.1) });
  }

  // --- Items -------------------------------------------------------------------
  y = labelY - mm(14);
  page.drawText('In this parcel', { x: left, y, size: 12, font: bold, color: BLACK });
  y -= mm(4);
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, color: LIGHT, thickness: 1 });
  y -= mm(4);

  const rowH = mm(34);
  const items = postedItems(order);
  items.forEach((item, idx) => {
    if (y - rowH < mm(40)) return; // keep space for the footer; very large orders continue on the pick list
    const top = y;
    const img = images.get(thumbUrl(item.image_url) || '');
    const box = mm(28);
    if (img) {
      const scale = Math.min(box / img.width, box / img.height);
      const w = img.width * scale, h = img.height * scale;
      page.drawImage(img, { x: left + (box - w) / 2, y: top - box + (box - h) / 2, width: w, height: h });
    } else {
      page.drawRectangle({ x: left, y: top - box, width: box, height: box, color: rgb(0.95, 0.95, 0.97) });
    }
    const tx = left + box + mm(6);
    const tw = right - tx - mm(30);
    page.drawText(fit(bold, itemTitle(item), 12, tw), { x: tx, y: top - mm(5), size: 12, font: bold, color: BLACK });
    page.drawText(fit(regular, describeOrderItem(item), 10, tw), { x: tx, y: top - mm(11), size: 10, font: regular, color: BLACK });
    page.drawText(safe(`Ref ${itemRef(order, idx)}`), { x: tx, y: top - mm(17), size: 9, font: regular, color: GREY });
    const meta = item.print_file_meta;
    if (!item.print_image_url) {
      page.drawText('No print file - check the order in admin', { x: tx, y: top - mm(23), size: 9, font: bold, color: rgb(0.8, 0.1, 0.1) });
    } else if (meta?.quality === 'low') {
      page.drawText(safe(`Low resolution (${meta.effective_dpi} dpi) - check before printing`), { x: tx, y: top - mm(23), size: 9, font: bold, color: rgb(0.8, 0.1, 0.1) });
    } else if (meta?.print_mm) {
      page.drawText(safe(`Print ${meta.print_mm[0]} x ${meta.print_mm[1]} mm${meta.crop && meta.crop.trims !== 'none' ? ' (3:4 crop)' : ''}`), { x: tx, y: top - mm(23), size: 8, font: regular, color: GREY });
    }
    // Qty + packer checks
    page.drawText(`x ${item.quantity || 1}`, { x: right - mm(26), y: top - mm(6), size: 16, font: bold, color: BLACK });
    checkbox(page, right - mm(26), top - mm(15));
    page.drawText('Printed', { x: right - mm(20.5), y: top - mm(14.2), size: 8, font: regular, color: GREY });
    checkbox(page, right - mm(26), top - mm(22));
    page.drawText('Packed', { x: right - mm(20.5), y: top - mm(21.2), size: 8, font: regular, color: GREY });
    y -= rowH;
    page.drawLine({ start: { x: left, y: y + mm(3) }, end: { x: right, y: y + mm(3) }, color: LIGHT, thickness: 0.5 });
  });
  if (items.length && y - rowH < mm(40) && items.length > 1) {
    const shown = Math.floor((labelY - mm(26) - mm(40)) / rowH);
    if (shown < items.length) {
      page.drawText(safe(`+ ${items.length - shown} more item(s) - see the order in admin`), { x: left, y: y - mm(2), size: 10, font: bold, color: rgb(0.8, 0.1, 0.1) });
    }
  }

  // --- Footer message for the customer -----------------------------------------
  const fy = mm(30);
  page.drawLine({ start: { x: left, y: fy + mm(10) }, end: { x: right, y: fy + mm(10) }, color: LIGHT, thickness: 1 });
  page.drawText('Thank you for your order!', { x: left, y: fy + mm(3), size: 13, font: bold, color: PURPLE });
  page.drawText('Printed and packed by hand in London. Your free digital copy is waiting in your Pawtraits account.', { x: left, y: fy - mm(3), size: 9, font: regular, color: BLACK });
  page.drawText('Questions? support@pawtraits.pics  -  Share your pet\'s portrait and tag us!', { x: left, y: fy - mm(8), size: 9, font: regular, color: GREY });
}

// ----------------------------------------------------------------------------------
// Royal Mail Click & Drop import CSV
// Map the columns once in Click & Drop (Settings → Import → create a mapping) and save it.
// ----------------------------------------------------------------------------------

const CSV_HEADERS = [
  'Order reference', 'Order date', 'Full name', 'Company name',
  'Address line 1', 'Address line 2', 'Address line 3', 'Town', 'County', 'Postcode', 'Country code',
  'Email', 'Phone', 'Package contents', 'Item count', 'Order value (GBP)', 'Delivery paid (GBP)', 'Delivery service paid',
];

function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  // Guard against spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function clickAndDropCsv(orders: any[]): string {
  const rows = orders.map(order => {
    const items = postedItems(order);
    const contents = items.map(i => `${i.quantity || 1} x ${describeOrderItem(i)} print`).join('; ');
    const itemCount = items.reduce((n, i) => n + (i.quantity || 1), 0);
    return [
      order.order_number,
      new Date(order.created_at).toISOString().slice(0, 10),
      `${order.shipping_first_name || ''} ${order.shipping_last_name || ''}`.trim(),
      order.order_type === 'partner_for_client' ? (order.client_name || '') : '',
      order.shipping_address_line_1 || order.shipping_address || '',
      order.shipping_address_line_2 || '',
      '',
      order.shipping_city || '',
      '',
      (order.shipping_postcode || '').toUpperCase(),
      countryCode(order.shipping_country),
      order.customer_email || '',
      order.metadata?.customerPhone || '',
      contents,
      itemCount,
      ((order.total_amount || 0) / 100).toFixed(2),
      ((order.shipping_amount || 0) / 100).toFixed(2),
      order.metadata?.shippingMethodName || '',
    ].map(csvCell).join(',');
  });
  return '﻿' + [CSV_HEADERS.join(','), ...rows].join('\r\n') + '\r\n';
}
