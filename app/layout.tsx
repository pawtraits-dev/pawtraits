import type { Metadata, Viewport } from 'next';
import { Inter, Margarine, Life_Savers } from 'next/font/google';
import './globals.css';
import { ServerCartProvider } from '@/lib/server-cart-context';

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
  title: 'Pawpraits - Perfect Pet Portraits',
  description: 'Fantastic Fun Picture of your Furry Friends.',
  keywords: 'pet portraits, AI art, custom pet art, dog portraits, cat portraits, pet memorial, pet gifts',
  authors: [{ name: 'Pawtraits Team' }],
  openGraph: {
    title: 'Pawtraits',
    description: 'Fantastic Fun Picture of your Furry Friends',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PawTraits - AI Pet Portraits',
    description: 'Fantastic Fun Picture of your Furry Friends ',
  },
  robots: 'index, follow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/assets/logos/paw-svgrepo-200x200-purple.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/assets/logos/paw-svgrepo-200x200-purple.svg" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={`${inter.className} ${margarine.variable} ${lifeSavers.variable}`}>
        <div id="root">
          <ServerCartProvider>
            {children}
          </ServerCartProvider>
        </div>
      </body>
    </html>
  );
}