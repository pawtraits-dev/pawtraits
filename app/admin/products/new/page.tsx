'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ProductForm from '@/components/admin/products/ProductForm';

export default function NewProductPage() {
  // ?type=digital_download opens the form on "Digital download"
  const [type, setType] = useState<string | null | undefined>(undefined);
  useEffect(() => { setType(new URLSearchParams(window.location.search).get('type')); }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="inline-flex items-center text-sm text-gray-600 hover:text-purple-700"><ArrowLeft className="w-4 h-4 mr-1" />Products</Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Add product</h1>
        <p className="text-gray-600 mt-1">A size and material you print yourself (or a digital download), with its UK price.</p>
      </div>
      {type !== undefined && <ProductForm initialType={type} />}
    </div>
  );
}
