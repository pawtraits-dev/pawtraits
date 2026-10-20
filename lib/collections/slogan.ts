/**
 * Team motto / customer slogan on personalised-kit designs (client-safe): big stacked block
 * capitals on the right of the picture ("TO WOOF IS TO DO"), drawn by Cloudinary as a text layer
 * (never painted by AI, so it's always crisp and spelled right).
 *
 * Font: the Google Font "Bowlby One SC" (Cloudinary loads Google Fonts by name, nothing to upload).
 * Change it with NEXT_PUBLIC_CLOUDINARY_SLOGAN_FONT (any Google Font name, or a custom font
 * uploaded to Cloudinary as "<name>.ttf").
 */

/** Words and characters allowed on the picture */
const RUDE = ['FUCK', 'SHIT', 'CUNT', 'TWAT', 'WANK', 'NAZI', 'SLUT', 'WHORE', 'BITCH', 'NIGG', 'FAGG', 'PAEDO', 'PEDO', 'BOLLOCK', 'BELLEND', 'HITLER'];
export const SLOGAN_MAX = 32;

/** Upper-case, tidy and check a motto or slogan. Line breaks are kept (they force a new line). */
export function cleanSlogan(raw: unknown): string | null {
  const s = String(raw ?? '').toUpperCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  if (!s || s.replace(/\n/g, ' ').length > SLOGAN_MAX) return null;
  if (!/^[A-Z0-9 '"!?&.,\-\n]+$/.test(s)) return null;
  const letters = s.replace(/[^A-Z]/g, '');
  return RUDE.some(w => letters.includes(w)) ? null : s;
}

/** Cloudinary text needs commas and slashes double-escaped */
const escapeText = (t: string) => encodeURIComponent(t).replace(/%2C/g, '%252C').replace(/%2F/g, '%252F').replace(/'/g, '%27');

function fontName(): string {
  return (process.env.NEXT_PUBLIC_CLOUDINARY_SLOGAN_FONT || process.env.CLOUDINARY_SLOGAN_FONT || 'Bowlby One SC').replace(/\s+/g, '%20');
}

/**
 * Raw Cloudinary transformation adding the slogan on the right of the picture.
 * The text is set at 100 px in a 760 px column (Bowlby is wide: room for "BISCUITS" on one line;
 * longer text wraps, line breaks force new lines), then the whole block is scaled to 30% of the
 * picture's width and placed 4% in from the right edge, centred vertically.
 */
export function sloganLayer(text: string, opts: { colour?: string; width?: number; inset?: number } = {}): string {
  const colour = (opts.colour || 'ffffff').replace('#', '');
  const width = opts.width ?? 0.3;
  const inset = opts.inset ?? 0.04;
  return [
    `l_text:${fontName()}_100_center_line_spacing_-10:${escapeText(text)},co_rgb:${colour},c_fit,w_760`,
    `e_shadow:35,x_5,y_5,co_rgb:000000`,
    `c_scale,w_${width},fl_relative`,
    `fl_layer_apply,g_east,x_${inset}`,
  ].join('/');
}
