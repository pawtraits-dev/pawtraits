'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import ProductForm from '@/components/admin/products/ProductForm';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { CatalogueProduct } from '@/lib/product-types';

const adminService = new AdminSupabaseService();

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<CatalogueProduct | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    adminService.getCatalogueProduct(id).then(r => (r.ok ? setProduct(r.data) : setError(r.error)));
  }, [id]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/products" className="inline-flex items-center text-sm text-gray-600 hover:text-purple-700"><ArrowLeft className="w-4 h-4 mr-1" />Products</Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{product ? product.name : 'Edit product'}</h1>
        {product && <p className="text-gray-500 mt-1 font-mono text-sm">{product.sku}</p>}
      </div>
      {error ? <p className="text-red-700">{error}</p>
        : product ? <ProductForm product={product} />
        : <div className="py-10 text-gray-500 flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" />Loading…</div>}
    </div>
  );
}
