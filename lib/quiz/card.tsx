/**
 * Pawsonality share cards (server only), drawn with next/og:
 *   'story' 1080×1920 (Instagram/WhatsApp status, downloaded or shared as a file)
 *   'og'    1200×630  (link previews: WhatsApp, iMessage, Facebook)
 * Brand purple ground, the result picture (breed version or type design) with the Pawtraits logo
 * and wordmark in its top-right corner, the
 * pet's name and type, and the share quote. Text is added here, never baked into AI images.
 */
import { ImageResponse } from 'next/og';
import type { PublicQuizResult } from './results';
import { withPetName } from './scoring';

const INK = '#2A1A52';
const LILAC = '#D9CDF5';
const SOFT = '#C9B6F2';

export const CARD_SIZES = {
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
} as const;

function pictureUrl(publicId: string | null, w: number, h: number): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!publicId || !cloud) return null;
  // jpg: the card renderer can't read WebP/AVIF
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,g_auto,w_${w},h_${h}/f_jpg,q_80/${publicId}`;
}

/** The Pawtraits paw logo as a small PNG (the stored logo is an SVG; .png rasterises it) */
function logoUrl(size: number): string | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const id = process.env.CLOUDINARY_WATERMARK_PUBLIC_ID || 'pawtraits_watermark_logo';
  return cloud ? `https://res.cloudinary.com/${cloud}/image/upload/c_scale,w_${size * 2}/${id.replace(/\.(png|svg)$/i, '')}.png` : null;
}

/** Logo + "Pawtraits" wordmark, for the top-right corner of the picture */
function CornerBrand({ logo, scale, hf }: { logo: string | null; scale: number; hf: { fontFamily?: string } }) {
  const icon = Math.round(34 * scale);
  return (
    <div style={{
      position: 'absolute', top: Math.round(20 * scale), right: Math.round(20 * scale), display: 'flex', alignItems: 'center',
      gap: Math.round(10 * scale), padding: `${Math.round(8 * scale)}px ${Math.round(18 * scale)}px ${Math.round(8 * scale)}px ${Math.round(10 * scale)}px`,
      background: 'rgba(42,26,82,0.72)', borderRadius: 999, color: '#fff', fontSize: Math.round(30 * scale), ...hf, fontWeight: 800,
    }}>
      {logo ? <img src={logo} width={icon} height={icon} /> : <Paw size={icon} color="#fff" />}
      <span>Pawtraits</span>
    </div>
  );
}

/** Fetch the picture up front so a failed fetch falls back to the paw instead of breaking the card */
async function pictureData(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return null;
    return `data:${res.headers.get('content-type')};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

/** Brand heading font (Life Savers) from Google Fonts; falls back to the default if unreachable */
async function headingFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Life+Savers:wght@800&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(3000) }).then(r => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    return await fetch(url, { signal: AbortSignal.timeout(3000) }).then(r => r.arrayBuffer());
  } catch {
    return null;
  }
}

function Paw({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="5.5" cy="10" r="2.5" /><circle cx="9.5" cy="5.5" r="2.5" /><circle cx="14.5" cy="5.5" r="2.5" /><circle cx="18.5" cy="10" r="2.5" />
      <path d="M12 11c-3.5 0-6 3.2-6 6 0 2 1.6 3 3.2 3 1.3 0 1.8-.6 2.8-.6s1.5.6 2.8.6c1.6 0 3.2-1 3.2-3 0-2.8-2.5-6-6-6z" />
    </svg>
  );
}

export async function renderResultCard(r: PublicQuizResult, format: keyof typeof CARD_SIZES): Promise<ImageResponse> {
  const { width, height } = CARD_SIZES[format];
  const typeName = r.type?.name ?? r.code;
  const headline = `${r.petName} is ${typeName}`;
  const quote = r.type?.shareQuote ? `“${withPetName(r.type.shareQuote, r.petName)}”` : '';
  const font = await headingFont(`${headline}Pawtraits`);
  const fonts = font ? [{ name: 'LifeSavers', data: font, weight: 800 as const, style: 'normal' as const }] : undefined;
  // Only set fontFamily when the brand font loaded (an undefined family breaks the renderer)
  const hf = font ? { fontFamily: 'LifeSavers' } : {};

  if (format === 'og') {
    const [pic, logo] = await Promise.all([pictureData(pictureUrl(r.imagePublicId, 420, 630)), pictureData(logoUrl(26))]);
    return new ImageResponse(
      (
        <div style={{ width, height, display: 'flex', background: INK, color: '#fff' }}>
          {pic
            ? <div style={{ position: 'relative', display: 'flex', width: 420, height: 630 }}>
                <img src={pic} width={420} height={630} style={{ objectFit: 'cover' }} />
                <CornerBrand logo={logo} scale={0.75} hf={hf} />
              </div>
            : <div style={{ width: 420, height: 630, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3B2A6B' }}><Paw size={160} color={SOFT} /></div>}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 56px', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ display: 'flex', background: '#fff', color: INK, fontSize: 28, fontWeight: 800, letterSpacing: 3, padding: '6px 14px', borderRadius: 10 }}>{r.code}</div>
              {r.type?.tagline && <div style={{ fontSize: 28, color: LILAC }}>{r.type.tagline}</div>}
            </div>
            <div style={{ fontSize: headline.length > 30 ? 58 : 68, lineHeight: 1.05, ...hf, fontWeight: 800 }}>{headline}</div>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 28, color: LILAC }}>
              <span>What&apos;s your pet&apos;s Pawsonality?</span>
              <span style={{ color: SOFT }}>pawtraits.pics/quiz</span>
            </div>
          </div>
        </div>
      ),
      { width, height, fonts },
    );
  }

  const [pic, logo] = await Promise.all([pictureData(pictureUrl(r.imagePublicId, 1000, 1050)), pictureData(logoUrl(40))]);
  return new ImageResponse(
    (
      <div style={{ width, height, display: 'flex', flexDirection: 'column', background: INK, color: '#fff', padding: '80px 40px 60px' }}>
        {pic
          ? <div style={{ position: 'relative', display: 'flex', marginTop: 100, width: 1000, height: 1050 }}>
              <img src={pic} width={1000} height={1050} style={{ borderRadius: 36, objectFit: 'cover' }} />
              <CornerBrand logo={logo} scale={1.2} hf={hf} />
            </div>
          : <div style={{ marginTop: 100, width: 1000, height: 1050, borderRadius: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3B2A6B' }}><Paw size={320} color={SOFT} /></div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 44 }}>
          <div style={{ display: 'flex', background: '#fff', color: INK, fontSize: 38, fontWeight: 800, letterSpacing: 4, padding: '8px 18px', borderRadius: 12 }}>{r.code}</div>
          {r.type?.tagline && <div style={{ fontSize: 38, color: LILAC }}>{r.type.tagline}</div>}
        </div>
        <div style={{ marginTop: 18, fontSize: headline.length > 28 ? 84 : 96, lineHeight: 1.04, ...hf, fontWeight: 800 }}>{headline}</div>
        {quote && <div style={{ marginTop: 22, fontSize: 38, lineHeight: 1.35, color: '#E6DDFA' }}>{quote}</div>}
        <div style={{ marginTop: 'auto', paddingTop: 28, borderTop: '2px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'space-between', fontSize: 36 }}>
          <span style={{ fontWeight: 700 }}>What&apos;s your pet&apos;s Pawsonality?</span>
          <span style={{ color: SOFT }}>pawtraits.pics/quiz</span>
        </div>
      </div>
    ),
    { width, height, fonts },
  );
}
