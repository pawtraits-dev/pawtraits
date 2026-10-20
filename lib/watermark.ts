/**
 * The watermark on public pictures: small Pawtraits paws repeated across the whole image
 * (rather than one large mark in the middle). Client-safe.
 *
 * Cloudinary layer, sized relative to the picture so every size looks the same:
 *   l_<paw>.png    the brand-purple site paw (#6B46C1), right way up (scripts/upload-watermark-paw.ts uploads it)
 *   c_scale        each paw ~7% of the picture's width (the PNG has a little padding round it)
 *   c_mpad         spacing between paws (20% × 14% of the width). mpad, not pad: pad scales the
 *                  paw up to fill the space, which made the paws ~3× too big
 *   a_-20          a slight tilt
 *   fl_tiled       repeated over the whole picture
 * Tune with CLOUDINARY_WATERMARK_TILE_OPACITY (default 18), _TILE_SIZE (0.07), _TILE_GAP (0.2),
 * and CLOUDINARY_WATERMARK_TILE_ID (default pawtraits_watermark_paw_purple).
 */
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

export function watermarkTiles(): string {
  const id = (process.env.CLOUDINARY_WATERMARK_TILE_ID || 'pawtraits_watermark_paw_purple').replace(/\//g, ':').replace(/\.(png|svg|jpg)$/i, '');
  const opacity = Math.round(num(process.env.CLOUDINARY_WATERMARK_TILE_OPACITY, 18));
  const size = num(process.env.CLOUDINARY_WATERMARK_TILE_SIZE, 0.07);
  const gap = num(process.env.CLOUDINARY_WATERMARK_TILE_GAP, 0.2);
  const h = Math.round(gap * 0.7 * 1000) / 1000;
  return `l_${id}.png/c_scale,w_${size},fl_relative/c_mpad,w_${gap},h_${h},fl_relative/a_-20/o_${opacity}/fl_layer_apply,fl_tiled`;
}
