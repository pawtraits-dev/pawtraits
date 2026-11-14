import type { Metadata, Viewport } from 'next';
import { Inter, Margarine, Life_Savers } from 'next/font/google';
import './globals.css';
import { HybridCartProvider } from '@/lib/hybrid-cart-context';
import EnvironmentIndicator from '@/components/EnvironmentIndicator';
import { Analytics } from '@vercel/analytics/react';
import TrackingScripts from '@/components/tracking/TrackingScripts';
import ConsentBanner from '@/components/tracking/ConsentBanner';
import { Toaster } from '@/components/ui/toaster';
import SiteFooter from '@/components/SiteFooter';

const inter = Inter({ subsets: ['latin'] });
const margarine = Margarine({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-margarine'
});
const lifeSavers = Life_Savers({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-life-savers'
});

export const metadata: Metadata = {
  title: 'Pawtraits - Perfect Pet Portraits',
  description: 'Your pet, painted into a masterpiece. Pick a design, add a photo, and Pawcasso paints your pet in. Prints, mugs and digital downloads.',
  keywords: 'pet portraits, AI art, custom pet art, dog portraits, cat portraits, pet memorial, pet gifts',
  authors: [{ name: 'Pawtraits Team' }],
  openGraph: {
    title: 'Pawtraits',
    description: 'Your pet, painted into a masterpiece. Pick a design, add a photo, and Pawcasso paints your pet in. Prints, mugs and digital downloads.',
    type: 'website',
    locale: 'en_GB',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pawtraits - AI Pet Portraits',
    description: 'Your pet, painted into a masterpiece. Pick a design, add a photo, and Pawcasso paints your pet in. Prints, mugs and digital downloads.',
  },
  robots: 'index, follow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // lets sticky bottom CTAs respect the iPhone home indicator (safe-area insets)
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="icon" href="/assets/logos/paw-svgrepo-200x200-purple.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/assets/logos/paw-svgrepo-200x200-purple.svg" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={`${inter.className} ${margarine.variable} ${lifeSavers.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
        >
          Skip to content
        </a>
        <EnvironmentIndicator />
        <Analytics />
        <TrackingScripts />
        <div id="root">
          <HybridCartProvider>
            <div id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </div>
            <SiteFooter />
          </HybridCartProvider>
        </div>
        <ConsentBanner />
        {/* Toasts were never mounted before, so every toast() call in the app was invisible */}
        <Toaster />
      </body>
    </html>
  );
}