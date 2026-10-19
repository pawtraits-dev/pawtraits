/**
 * The watermark on public pictures: small Pawtraits paws repeated across the whole image
 * (rather than one large mark in the middle). Client-safe.
 *
 * Cloudinary layer, sized relative to the picture so every size looks the same:
 *   l_<logo>.png   the logo, rasterised (it's an SVG: SVG layers ignore resizing unless rasterised)
 *   c_scale        each paw ~7% of the picture's width
 *   c_pad          spacing between paws (20% × 14% of the width)
 *   a_-20          a slight tilt
 *   fl_tiled       repeated over the whole picture
 * Tune with CLOUDINARY_WATERMARK_TILE_OPACITY (default 18), _TILE_SIZE (0.07), _TILE_GAP (0.2).
 */
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

export function watermarkTiles(): string {
  const id = (process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo').replace(/\//g, ':').replace(/\.(png|svg|jpg)$/i, '');
  const opacity = Math.round(num(process.env.CLOUDINARY_WATERMARK_TILE_OPACITY, 18));
  const size = num(process.env.CLOUDINARY_WATERMARK_TILE_SIZE, 0.07);
  const gap = num(process.env.CLOUDINARY_WATERMARK_TILE_GAP, 0.2);
  const h = Math.round(gap * 0.7 * 1000) / 1000;
  return `l_${id}.png/c_scale,w_${size},fl_relative/c_pad,w_${gap},h_${h},fl_relative/a_-20/o_${opacity}/fl_layer_apply,fl_tiled`;
}
