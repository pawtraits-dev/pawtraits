import { redirect } from 'next/navigation';

// Redirect /cats to /browse?type=cats
export default function CatsRedirectPage() {
  redirect('/browse?type=cats');
}