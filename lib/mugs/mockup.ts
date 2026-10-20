/** Server: both mockups for a wrap using the photos from Admin → Mugs → Mockup photos */
import { getSetting } from '@/lib/app-settings';
import { mockupUrl, wrapMockupUrl, type MockupPhoto, type MockupSide } from '@/lib/mugs/mockup-url';

export { mockupUrl, wrapMockupUrl, DEFAULT_FACES, type MockupSide, type FaceBox } from '@/lib/mugs/mockup-url';

/** Both mockups for a wrap, or {} when the photos haven't been uploaded */
export async function mugMockups(wrapPublicId: string | null | undefined, colourHex: string): Promise<Partial<Record<MockupSide, string>>> {
  if (!wrapPublicId) return {};
  const photos = await getSetting('mug_mockup_photos');
  const out: Partial<Record<MockupSide, string>> = {};
  for (const side of ['pet', 'text'] as MockupSide[]) {
    const p = photos?.[side] as MockupPhoto | undefined;
    if (p?.publicId && p.width && p.height) out[side] = mockupUrl(side, p, wrapPublicId, colourHex);
  }
  return out;
}

/** Both sides of a wraparound catalogue design / customer painting on the mug photos, or {} */
export async function wrapMockups(wrapPublicId: string | null | undefined, opts: { overlay?: string; extra?: string; width?: number } = {}): Promise<Partial<Record<MockupSide, string>>> {
  if (!wrapPublicId) return {};
  const photos = await getSetting('mug_mockup_photos');
  const out: Partial<Record<MockupSide, string>> = {};
  for (const side of ['pet', 'text'] as MockupSide[]) {
    const p = photos?.[side] as MockupPhoto | undefined;
    if (p?.publicId && p.width && p.height) out[side] = wrapMockupUrl(side, p, wrapPublicId, opts);
  }
  return out;
}
