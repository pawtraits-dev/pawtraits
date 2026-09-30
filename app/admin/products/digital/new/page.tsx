import { redirect } from 'next/navigation';

// Digital downloads are created with the same form now
export default function NewDigitalProductPage() {
  redirect('/admin/products/new?type=digital_download');
}
