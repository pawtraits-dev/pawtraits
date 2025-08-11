import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ServerCartProvider } from '@/lib/server-cart-context';

const inter = Inter({ subsets: ['latin'] });

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
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className={inter.className}>
        <div id="root">
          <ServerCartProvider>
            {children}
          </ServerCartProvider>
        </div>
      </body>
    </html>
  );
}