/**
 * Mug mockup URL (client-safe): the customer's wrap on a real mug photo.
 *   pet side  = handle on the right, showing the left half of the wrap
 *   text side = handle on the left, showing the right half
 * The photo's dark handle and inside are recoloured to the mug colour, then that half of the wrap
 * is laid on the mug's face with "multiply" so the photo's shading shows through.
 */
export type MockupSide = 'pet' | 'text';
/** The mug's face in the photo, as fractions of the photo's width / height */
export interface FaceBox { x: number; y: number; w: number; h: number }

const WRAP_W = 2362, WRAP_H = 1134;

// Measured on the first photos uploaded (Oct 2026); adjustable per photo in admin
export const DEFAULT_FACES: Record<MockupSide, FaceBox> = {
  pet: { x: 0.3436, y: 0.275, w: 0.3128, h: 0.546 },
  text: { x: 0.2935, y: 0.2407, w: 0.4287, h: 0.5185 },
};

export interface MockupPhoto { publicId: string; width: number; height: number; url?: string; face?: FaceBox; background?: string }

function cloudBase(photo: MockupPhoto): string {
  if (photo.url?.includes('/image/upload/')) return photo.url.split('/image/upload/')[0] + '/image/upload';
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || ''}/image/upload`;
}

export function mockupUrl(side: MockupSide, photo: MockupPhoto, wrapPublicId: string, colourHex: string, width = 800): string {
  const face = photo.face ?? DEFAULT_FACES[side];
  const x = Math.round(face.x * photo.width), y = Math.round(face.y * photo.height);
  const w = Math.round(face.w * photo.width), h = Math.round(face.h * photo.height);
  const base = photo.publicId.replace(/\//g, ':');
  const wrap = wrapPublicId.replace(/\//g, ':');
  const hex = colourHex.replace('#', '');
  // Background colour of the photo (made transparent along with the white mug, leaving the dark handle/inside)
  const bg = (photo.background || (side === 'pet' ? 'e5e5e5' : 'ffffff')).replace('#', '');
  const steps = [
    // Handle and inside in the mug colour
    `l_${base}/e_make_transparent:35,co_rgb:ffffff/e_make_transparent:12,co_rgb:${bg}/e_colorize:100,co_rgb:${hex}/e_screen,fl_layer_apply`,
    // This side's half of the wrap on the mug's face
    `l_${wrap},c_crop,w_${WRAP_W / 2},h_${WRAP_H},x_${side === 'pet' ? 0 : WRAP_W / 2},y_0/c_scale,w_${w},h_${h}/e_multiply,fl_layer_apply,g_north_west,x_${x},y_${y}`,
    // Square, centred
    `c_fill,ar_1:1,g_center/c_limit,w_${width}/f_auto,q_auto`,
  ];
  return `${cloudBase(photo)}/${steps.join('/')}/${photo.publicId}`;
}

