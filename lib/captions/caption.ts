/**
 * Captions (client-safe): a translucent gold name plate across the bottom of a Pawsonality or
 * Zodiac picture with the type or sign and its tagline, e.g.
 *   ESFB · The Party Animal / The Social Anarchist        (Pawsonalities, dog and cat wording)
 *   ♌  Leo / Born to be adored  ♌                          (Zodiac, symbol at both ends)
 *
 * Drawn by Cloudinary as layers over the picture (never painted by AI, so it's always crisp and
 * spelled right), and baked into a stored copy so downloads and print files carry it. The clean
 * picture is kept (image_catalog.caption_overlay) so AI variations never copy the plate.
 * Wording: Admin → Collections → Captions (collections.metadata.caption); server code is in
 * lib/captions/server.ts.
 */
import { escapeWords } from '@/lib/picture-words';

export type CaptionAnimal = 'dog' | 'cat';
export interface Caption { title: string; tagline: string | null; symbol: string | null }   // symbol: zodiac slug

/** Admin wording for one type or sign (collections.metadata.caption); missing keys use the defaults */
export interface CaptionWording { title_dog?: string; title_cat?: string; tagline_dog?: string; tagline_cat?: string }

/** image_catalog.caption_overlay */
export interface CaptionOverlay {
  clean_public_id: string;                                   // the picture without the plate
  applied: (Caption & { at: string }) | null;                // what's drawn on now (null = none)
}

export const CAPTION_MAX = { title: 48, tagline: 60 };
export const CAPTION_STYLE = { plate: 'E2BD5A', alpha: 'B3', title: '2A1608', tagline: '4A2C10', titleFont: 'Life Savers', taglineFont: 'Montserrat' };
export const symbolPublicId = (slug: string) => `pawtraits/zodiac-symbols/${slug}`;

/** Default zodiac taglines (Admin → Collections → Captions changes them) */
export const ZODIAC_TAGLINES: Record<string, { dog: string; cat: string }> = {
  aries: { dog: 'First through every door', cat: 'Born to lead, refuses to follow' },
  taurus: { dog: 'Will not be rushed. Will be fed.', cat: 'Comfort is non-negotiable' },
  gemini: { dog: 'Two moods, both ready for walkies', cat: 'Two minds, zero apologies' },
  cancer: { dog: 'Home is wherever you are', cat: 'Soft heart, sharp claws' },
  leo: { dog: 'Born to be adored', cat: 'Born to rule the sofa' },
  virgo: { dog: 'Inspects every sniff twice', cat: 'Notices everything, approves of little' },
  libra: { dog: 'Shares the sofa (mostly)', cat: 'Graceful from whisker to tail' },
  scorpio: { dog: 'Loyal to the very last biscuit', cat: 'Mysterious by design' },
  sagittarius: { dog: 'Every walk is an adventure', cat: 'Curious beyond all reason' },
  capricorn: { dog: 'Serious about snack time', cat: 'Always climbs to the top' },
  aquarius: { dog: 'One of a kind, and knows it', cat: 'Marches to their own purr' },
  pisces: { dog: 'Dreamy eyes, gentle soul', cat: 'Lost in daydreams and sunbeams' },
};

/** Tidy admin wording: trimmed, one line, length-capped; empty stays empty (= no tagline) */
export function cleanCaptionText(v: unknown, max: number): string {
  return String(v ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** image_catalog.caption_overlay → value, or null */
export function readCaptionOverlay(v: any): CaptionOverlay | null {
  if (!v || typeof v !== 'object' || typeof v.clean_public_id !== 'string' || !v.clean_public_id) return null;
  const a = v.applied;
  return {
    clean_public_id: v.clean_public_id,
    applied: a && typeof a.title === 'string' ? { title: a.title, tagline: typeof a.tagline === 'string' && a.tagline ? a.tagline : null, symbol: typeof a.symbol === 'string' ? a.symbol : null, at: String(a.at || '') } : null,
  };
}

/** "ESFB · The Party Animal — The Social Anarchist" (for labels and checkboxes) */
export const captionLabel = (c: Caption) => (c.tagline ? `${c.title} — ${c.tagline}` : c.title);

const r4 = (v: number) => (v === 0 ? '0' : String(Math.round(v * 10000) / 10000));

/**
 * Raw Cloudinary transformation drawing the plate. Every size is a share of the picture's width
 * (W); vertical offsets are converted with the picture's shape (aspect = width ÷ height), so the
 * plate looks the same on a 2:3 design, a 3:4 print crop or a 4K print master.
 *
 * Plate: 86% of W wide, centred, 3.5% of W above the bottom edge, 17% of W tall (12% without a
 * tagline), rounded, gold at 70% opacity. Title in Life Savers, tagline in Montserrat bold italic;
 * each is set in a fixed box (shrunk if too long, padded if short) so the letter size is the same
 * whatever the words. Zodiac signs get their symbol at both ends of the plate (title narrower).
 */
export function captionLayer(c: Caption, aspect: number): string {
  const a = aspect > 0 ? aspect : 2 / 3;
  const S = CAPTION_STYLE;
  const m = 0.035, plateW = 0.86, plateH = c.tagline ? 0.17 : 0.12;
  const px = 0.76 / 900;                                    // picture-width units per box pixel
  const textW = c.symbol ? 0.56 : 0.76;
  const boxW = Math.round(textW / px);
  const y = (v: number) => r4(v * a);                       // W units → share of the height
  const font = (f: string) => f.replace(/\s+/g, '%20');
  const layers = [
    // the plate: a stretched, invisible full stop with a translucent gold background
    `l_text:Arial_100:.,co_rgb:${S.plate}00,b_rgb:${S.plate}${S.alpha}/c_scale,w_860,h_${Math.round(plateH * 1000)}/r_36/c_scale,w_${r4(plateW)},fl_relative/fl_layer_apply,g_south,y_${y(m)},fl_relative`,
    `l_text:${font(S.titleFont)}_84_bold:${escapeWords(c.title)},co_rgb:${S.title}/c_limit,w_${boxW},h_110/c_mpad,w_${boxW},h_110/c_scale,w_${r4(textW)},fl_relative/fl_layer_apply,g_south,y_${y(c.tagline ? m + 0.075 : m + 0.0135)},fl_relative`,
  ];
  if (c.tagline) {
    layers.push(`l_text:${font(S.taglineFont)}_44_bold_italic:${escapeWords(c.tagline)},co_rgb:${S.tagline}/c_limit,w_${boxW},h_60/c_mpad,w_${boxW},h_60/c_scale,w_${r4(textW)},fl_relative/fl_layer_apply,g_south,y_${y(m + 0.025)},fl_relative`);
  }
  if (c.symbol) {
    const size = c.tagline ? 0.085 : 0.07;
    const sy = y(m + (plateH - size) / 2);
    const id = symbolPublicId(c.symbol).replace(/\//g, ':');
    for (const g of ['south_west', 'south_east']) {
      layers.push(`l_${id}/e_colorize:100,co_rgb:${S.title}/c_scale,w_${r4(size)},fl_relative/fl_layer_apply,g_${g},x_${r4(0.07 + 0.035)},y_${sy},fl_relative`);
    }
  }
  return layers.join('/');
}
