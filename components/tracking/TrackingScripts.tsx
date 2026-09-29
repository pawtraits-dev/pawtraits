'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { readConsent, ConsentState } from '@/lib/tracking/consent';

const GA_ID = process.env.NEXT_PUBLIC_GA4_ID;               // G-XXXXXXX
const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;       // AW-XXXXXXX (optional)
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/**
 * Google tag (GA4 + Ads) with Consent Mode v2 — loads with everything DENIED and only
 * sets cookies once the visitor opts in. Meta Pixel is not loaded at all until marketing
 * consent is given.
 */
export default function TrackingScripts() {
  useEffect(() => {
    const apply = (c: ConsentState | null) => {
      if (!c) return;
      window.gtag?.('consent', 'update', {
        analytics_storage: c.analytics ? 'granted' : 'denied',
        ad_storage: c.marketing ? 'granted' : 'denied',
        ad_user_data: c.marketing ? 'granted' : 'denied',
        ad_personalization: c.marketing ? 'granted' : 'denied',
      });
      if (c.marketing) loadMetaPixel();
      else window.fbq?.('consent', 'revoke');
    };
    apply(readConsent());
    const onChange = (e: Event) => apply((e as CustomEvent<ConsentState>).detail);
    window.addEventListener('pt:consent', onChange);
    return () => window.removeEventListener('pt:consent', onChange);
  }, []);

  if (!GA_ID && !ADS_ID) return null;
  const primary = GA_ID || ADS_ID;

  return (
    <>
      <Script id="gtag-consent-default" strategy="beforeInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('consent', 'default', {
          ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
          analytics_storage: 'denied', wait_for_update: 500
        });
        gtag('set', 'ads_data_redaction', true);
        gtag('set', 'url_passthrough', true);
        gtag('js', new Date());
        ${GA_ID ? `gtag('config', '${GA_ID}');` : ''}
        ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ''}
      `}</Script>
      <Script id="gtag-lib" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${primary}`} />
    </>
  );
}

let metaLoaded = false;
function loadMetaPixel() {
  if (!META_PIXEL_ID || metaLoaded || typeof window === 'undefined') return;
  metaLoaded = true;
  /* eslint-disable */
  // Standard Meta Pixel bootstrap
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement; t.async = true; t.src = v;
    const s = b.getElementsByTagName(e)[0]; s.parentNode!.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq!('consent', 'grant');
  window.fbq!('init', META_PIXEL_ID);
  window.fbq!('track', 'PageView');
}
