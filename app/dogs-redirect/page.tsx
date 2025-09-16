import { redirect } from 'next/navigation';

// Redirect /dogs to /browse?type=dogs
export default function DogsRedirectPage() {
  redirect('/browse?type=dogs');
}