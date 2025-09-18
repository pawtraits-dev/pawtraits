// Force dynamic rendering using Next.js 15 server component approach
import { headers } from 'next/headers';
import PetsClient from './PetsClient';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PetsPage() {
  // Access headers to ensure this is dynamic
  const headersList = await headers();
  const userAgent = headersList.get('user-agent');

  console.log('🔧 Server component rendering, user agent:', userAgent?.substring(0, 50));

  return <PetsClient />;
}