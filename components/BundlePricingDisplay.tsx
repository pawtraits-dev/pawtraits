'use client';

import { useHybridCart } from '@/lib/hybrid-cart-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, TrendingDown, Sparkles } from 'lucide-react';

export function BundlePricingDisplay() {
  const { digitalBundlePricing } = useHybridCart();

  if (!digitalBundlePricing || digitalBundlePricing.quantity === 0) {
    return null;
  }

  const { quantity, total_price, savings, discount_percentage, next_tier } = digitalBundlePricing;

  const formatPrice = (priceInPence: number) => {
    return `£${(priceInPence / 100).toFixed(2)}`;
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-900 flex items-center gap-2 text-lg">
          <Download className="w-5 h-5" />
          Digital Download Bundle
          <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-800">
            {quantity} {quantity === 1 ? 'image' : 'images'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Price breakdown */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-blue-800">Bundle Total:</span>
          <span className="text-lg font-bold text-blue-900">
            {formatPrice(total_price)}
          </span>
        </div>

        {/* Savings badge */}
        {savings > 0 && (
          <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md border border-green-200">
            <TrendingDown className="w-4 h-4 text-green-600" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-green-800">
                You're saving {formatPrice(savings)}
              </div>
              <div className="text-xs text-green-700">
                {discount_percentage.toFixed(0)}% off vs buying individually
              </div>
            </div>
          </div>
        )}

        {/* Next tier upsell */}
        {next_tier && (
          <div className="flex items-start gap-2 p-3 bg-white rounded-md border border-blue-200">
            <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <div className="font-semibold text-blue-900 mb-1">
                Want to save even more?
              </div>
              <div className="text-blue-700">
                Add {next_tier.quantity - quantity} more {next_tier.quantity - quantity === 1 ? 'image' : 'images'} and save an extra {formatPrice(next_tier.additional_savings)}!
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {next_tier.quantity} images = {formatPrice(next_tier.price_per_item * next_tier.quantity)}
              </div>
            </div>
          </div>
        )}

        {/* Bundle details */}
        <div className="pt-2 border-t border-blue-200">
          <div className="text-xs text-blue-700 space-y-1">
            <div className="flex justify-between">
              <span>Price per image:</span>
              <span className="font-medium">{formatPrice(digitalBundlePricing.price_per_item)}</span>
            </div>
            <div className="text-blue-600">
              High-resolution JPG files • Personal license • 7-day download access
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
