/**
 * /share/referral/<CODE>: where the "Share my link" button in our emails lands. Public and needs no sign-in:
 * the code and the link on it are the same ones the customer gives to friends anyway. Shows the share card
 * (one-tap share, copy link, QR). An unknown code just goes to the home page.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { serviceClient } from '@/lib/qr/server';
import { getReferralDetailsByCode } from '@/lib/referrals/share';
import ShareReferral from '@/components/referrals/ShareReferral';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Share your link | Pawtraits', robots: { index: false, follow: false } };

export default async function ShareReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const details = await getReferralDetailsByCode(serviceClient(), code);
  if (!details) redirect('/');
  return (
    <CountryProvider>
      <div className="min-h-[100dvh] bg-gray-50">
        <UserAwareNavigation />
        <div className="mx-auto max-w-xl px-4 py-8">
          <ShareReferral placement="share_page" details={{ code: details.code, firstName: details.firstName }} hideCreditLink />
        </div>
      </div>
    </CountryProvider>
  );
}
