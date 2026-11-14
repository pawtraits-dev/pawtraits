'use client';

/**
 * "Give 10%, get 10%": one compact card that makes sharing a customer's referral link one tap.
 * Uses the customer's EXISTING referral code and the /c/<CODE> link the referrals page has always shared.
 *
 *  - Share with a friend: the phone's share sheet (Web Share API) with the text, the link and, when the
 *    device allows it, the customer's Pawtrait picture as a file. Pass only the watermarked public picture.
 *  - Without Web Share: a WhatsApp link, Copy link, and the QR code to show in person.
 *  - Copy link is always there (secondary). See my credit goes to /referrals.
 * Shows nothing when the visitor has no referral code (not signed in as a customer, partner, etc.).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Copy, Check, QrCode } from 'lucide-react';
import { track } from '@/lib/tracking/events';
import { REFERRAL_COPY, buildShareUrl, shareText, whatsappUrl, sharePetName } from '@/lib/referrals/text';

export type SharePlacement = 'referrals' | 'order_confirmation' | 'order_detail' | 'custom_portrait' | 'share_page';

interface Props {
  placement: SharePlacement;
  /** Pet's name for the share text; letters only, otherwise "my pet" wording is used */
  petName?: string | null;
  /** Design to open for the friend (catalogue design id), optional */
  designId?: string | null;
  /** The customer's own Pawtrait, WATERMARKED public https URL only. Shared as a file where the device allows */
  imageUrl?: string | null;
  /** Fetch the details for the buyer of this order (guests on the confirmation page) instead of the signed-in customer */
  orderId?: string | null;
  /** Already known (server-rendered page): skips the lookup */
  details?: { code: string; firstName?: string | null } | null;
  /** Hide the "See my credit" link (on the referrals page itself) */
  hideCreditLink?: boolean;
  className?: string;
}

export default function ShareReferral({ placement, petName, designId, imageUrl, orderId, details: given, hideCreditLink, className }: Props) {
  const [code, setCode] = useState<string | null>(given?.code ?? null);
  const [origin, setOrigin] = useState('');
  const [canNativeShare, setCanNativeShare] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const fileRef = useRef<File | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (given?.code) { setCode(given.code); return; }
    let cancelled = false;
    fetch(`/api/referrals/mine${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ''}`, { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.details?.code) setCode(d.details.code); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [given?.code, orderId]);

  // Get the picture ready before the tap: the share sheet must open straight from the tap
  useEffect(() => {
    fileRef.current = null;
    if (!imageUrl || !/^https:\/\//.test(imageUrl) || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(imageUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) return;
        const file = new File([blob], `pawtrait.${blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: blob.type });
        if (!cancelled && navigator.canShare({ files: [file] })) fileRef.current = file;
      } catch { /* no picture: the text and link still share */ }
    })();
    return () => { cancelled = true; };
  }, [imageUrl]);

  if (!code || !origin) return null;

  const url = buildShareUrl(origin, code, designId);
  const pet = sharePetName(petName);

  const record = (method: 'native' | 'whatsapp' | 'copy' | 'qr') => {
    try {
      fetch('/api/referrals/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ referral_code: code, action: 'share', platform: `${placement}:${method}` }),
      }).catch(() => {});
    } catch { /* tracking never blocks sharing */ }
    track.referralShare(method, placement);
  };

  const shareNow = async () => {
    try {
      const file = fileRef.current;
      await navigator.share({ text: shareText(pet), url, ...(file ? { files: [file] } : {}) });
      record('native');
    } catch { /* closed the share sheet */ }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      record('copy');
    } catch { /* clipboard blocked */ }
  };

  const qrVisible = showQr || canNativeShare === false;

  return (
    <section aria-label={REFERRAL_COPY.heading} className={`rounded-2xl border border-purple-100 bg-purple-50 p-4 ${className ?? ''}`}>
      <h2 className="text-lg font-bold text-gray-900">{REFERRAL_COPY.heading}</h2>
      <p className="mt-1 text-sm text-gray-700">{REFERRAL_COPY.line}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canNativeShare ? (
          <button type="button" onClick={shareNow}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white">
            <Share2 className="h-4 w-4" /> {REFERRAL_COPY.shareButton}
          </button>
        ) : (
          <a href={whatsappUrl(url, pet)} target="_blank" rel="noopener noreferrer" onClick={() => record('whatsapp')}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white">
            <Share2 className="h-4 w-4" /> {REFERRAL_COPY.whatsapp}
          </a>
        )}
        <button type="button" onClick={copy} aria-live="polite"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-purple-300 bg-white px-4 text-sm font-medium text-purple-800">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? REFERRAL_COPY.copiedButton : REFERRAL_COPY.copyButton}
        </button>
        {canNativeShare && (
          <button type="button" onClick={() => { setShowQr(v => !v); if (!showQr) record('qr'); }} aria-expanded={showQr}
            className="inline-flex h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-purple-800 underline">
            <QrCode className="h-4 w-4" /> {showQr ? 'Hide QR code' : 'Show QR code'}
          </button>
        )}
      </div>

      {qrVisible && (
        <div className="mt-3 flex items-center gap-3">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <QRCodeSVG value={url} size={132} level="Q" includeMargin fgColor="#000000" bgColor="#FFFFFF" />
          </div>
          <div className="text-sm text-gray-700">
            <p>{REFERRAL_COPY.qrCaption}</p>
            <p className="mt-1 font-mono text-base font-bold tracking-wider text-gray-900">{code}</p>
          </div>
        </div>
      )}

      {!hideCreditLink && (
        <p className="mt-3 text-sm"><Link href="/referrals" className="font-medium text-purple-700 underline">{REFERRAL_COPY.creditLink}</Link></p>
      )}
    </section>
  );
}
