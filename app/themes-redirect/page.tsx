import { redirect } from 'next/navigation';

// Redirect /themes to /browse?type=themes
export default function ThemesRedirectPage() {
  redirect('/browse?type=themes');
}