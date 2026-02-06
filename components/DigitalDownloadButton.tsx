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
      const bundleProduct = products.find((p: any) =>
        p.product_type === 'digital_download' &&
        p.name === 'Digital Download Bundle'
      );

      if (!bundleProduct) {
        throw new Error('Digital download product not configured. Please contact support.');
      }

      // Find pricing for the bundle product
      const bundleProductPricing = pricing.find((p: any) =>
        p.product_id === bundleProduct.id
      );

      if (!bundleProductPricing) {
        // Use default pricing if not found in database
        bundleProductPricing = {
          product_id: bundleProduct.id,
          price: 999,
          sale_price: 999,
          currency_code: 'GBP',
          currency_symbol: '£',
          formatted_price: '£9.99'
        };
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
        description: `${imageTitle} digital download added. Bundle pricing applied at checkout.`,
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
