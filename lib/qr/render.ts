import QRCode from 'qrcode';

/**
 * Print-safe QR rendering for stickers. Deliberately separate from lib/qr-code.ts,
 * which imports `canvas` and defaults to purple-on-transparent (not print-safe).
 */
export const STICKER_QR_OPTIONS = {
  errorCorrectionLevel: 'Q' as const,
  margin: 4, // quiet zone in modules (QR spec minimum)
  color: { dark: '#000000', light: '#FFFFFF' },
};

export async function renderQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { ...STICKER_QR_OPTIONS, type: 'svg' });
}

export async function renderQrPng(text: string, widthPx = 1024): Promise<Buffer> {
  return QRCode.toBuffer(text, { ...STICKER_QR_OPTIONS, type: 'png', width: widthPx });
}

/** Module matrix (no quiet zone) for drawing directly into PDFs as vectors. */
export function qrMatrix(text: string): { size: number; isDark: (x: number, y: number) => boolean } {
  const qr = QRCode.create(text, { errorCorrectionLevel: STICKER_QR_OPTIONS.errorCorrectionLevel });
  const size = qr.modules.size;
  const data = qr.modules.data;
  return { size, isDark: (x, y) => !!data[y * size + x] };
}
