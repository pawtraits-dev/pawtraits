'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Check } from 'lucide-react';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import { useToast } from '@/components/ui/use-toast';

interface DigitalDownloadButtonProps {
  imageId: string;
  imageUrl: string;
  imageTitle: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export function DigitalDownloadButton({
  imageId,
  imageUrl,
  imageTitle,
  className,
  variant = 'outline'
}: DigitalDownloadButtonProps) {
  const { addToCart, getMasterBundleProductId, items } = useHybridCart();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  // Check if this image is already in cart as digital download
  const isInCart = items.some(item => {
    const productData = item.product as any;
    return item.imageId === imageId && productData?.product_type === 'digital_download';
  });

  async function handleAddDigitalDownload() {
    setLoading(true);
    try {
      // Fetch products and pricing from public API (same as physical products)
      const [productsResponse, pricingResponse] = await Promise.all([
        fetch('/api/public/products'),
        fetch('/api/public/pricing')
      ]);

      if (!productsResponse.ok || !pricingResponse.ok) {
        throw new Error('Failed to load product information');
      }

      const [products, pricing] = await Promise.all([
        productsResponse.json(),
        pricingResponse.json()
      ]);

      // Find the master bundle product
      const list = Array.isArray(products) ? products : (products?.products ?? []);
      const digital = list.filter((p: any) => p.product_type === 'digital_download' && p.is_active !== false);
      const priced = new Set((Array.isArray(pricing) ? pricing : []).filter((r: any) => r.country_code === 'GB' && r.sale_price > 0).map((r: any) => r.product_id));
      const withPrice = digital.filter((p: any) => priced.has(p.id));
      const bundleProduct = withPrice.find((p: any) => p.sku === 'DIGITAL') || withPrice[0] || digital[0];

      if (!bundleProduct) {
        throw new Error('Digital download product not configured. Please contact support.');
      }

      // Current UK price for the download (never a made-up default)
      const rows = (Array.isArray(pricing) ? pricing : []).filter((p: any) => p.product_id === bundleProduct.id && p.country_code === 'GB');
      rows.sort((x: any, y: any) => Number(y.is_current === true) - Number(x.is_current === true));
      const bundleProductPricing = rows[0];
      if (!bundleProductPricing?.sale_price) {
        throw new Error('The digital download has no UK price yet. Please try again later.');
      }

      // Add to cart using same pattern as physical products
      await addToCart({
        productId: bundleProduct.id,
        imageId,
        imageUrl,
        imageTitle,
        product: bundleProduct,
        pricing: bundleProductPricing,
        quantity: 1
      });

      setAdded(true);
      setTimeout(() => setAdded(false), 2000);

      toast({
        title: 'Added to cart',
        description: `${imageTitle} digital download added to your basket.`,
      });

      console.log('✅ [Digital Download] Added to cart:', imageTitle);
    } catch (error) {
      console.error('❌ [Digital Download] Failed to add to cart:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add to cart',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  if (isInCart) {
    return (
      <Button
        variant="outline"
        className={className}
        disabled
      >
        <Check className="w-4 h-4 mr-2 text-green-600" />
        In Cart
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      onClick={handleAddDigitalDownload}
      disabled={loading || added}
      className={className}
    >
      {added ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Added!
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          {loading ? 'Adding...' : 'Digital Download - £9.99'}
        </>
      )}
    </Button>
  );
}
