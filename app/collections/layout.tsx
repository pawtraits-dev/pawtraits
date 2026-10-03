import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Collections: Christmas, sports teams, Pawsonalities and zodiac | Pawtraits',
  description: 'Pet portraits for every occasion, your team’s colours, your pet’s Pawsonality or star sign. Put your own pet in any design.',
};

export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
