import type { Metadata, Viewport } from 'next';
import { Inter, Margarine } from 'next/font/google';
import './globals.css';
import { ServerCartProvider } from '@/lib/server-cart-context';

const inter = Inter({ subsets: ['latin'] });
const margarine = Margarine({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-margarine'
});

export const metadata: Metadata = {
  title: 'PawTraits - AI Pet Portraits',
  description: 'Transform your beloved pets into stunning, personalized artworks using cutting-edge AI technology.',
  keywords: 'pet portraits, AI art, custom pet art, dog portraits, cat portraits, pet memorial, pet gifts',
  authors: [{ name: 'PawTraits Team' }],
  openGraph: {
    title: 'PawTraits - AI Pet Portraits',
    description: 'Transform your beloved pets into stunning, personalized artworks using cutting-edge AI technology.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PawTraits - AI Pet Portraits',
    description: 'Transform your beloved pets into stunning, personalized artworks using cutting-edge AI technology.',
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
      <body className={`${inter.className} ${margarine.variable}`}>
        <div id="root">
          <ServerCartProvider>
            {children}
          </ServerCartProvider>
        </div>
      </body>
    </html>
  );
}