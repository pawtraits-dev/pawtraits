'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Download, ShoppingCart, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CustomImage {
  id: string;
  generated_image_url: string;
  share_token: string;
  status: string;
  catalog_image_id: string;
  pet_id: string | null;
}

export default function CustomPortraitPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const customImageId = params.id as string;

  const [customImage, setCustomImage] = useState<CustomImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    loadCustomImage();
  }, [customImageId]);

  async function loadCustomImage() {
    try {
      setLoading(true);

      const response = await fetch(`/api/customers/custom-images/${customImageId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Custom portrait not found');
      }

      const data = await response.json();
      setCustomImage(data);
    } catch (err) {
      console.error('Error loading custom portrait:', err);
      setError(err instanceof Error ? err.message : 'Failed to load custom portrait');
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase() {
    if (!customImage) return;

    setPurchasing(true);

    try {
      // Create a checkout session for the custom portrait
      const response = await fetch('/api/shop/custom-portrait/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customImageId: customImage.id,
          catalogImageId: customImage.catalog_image_id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();

      // Navigate to checkout
      router.push(checkoutUrl);
    } catch (err) {
      console.error('Purchase error:', err);
      toast({
        title: 'Purchase failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error || !customImage) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Custom portrait not found'}</AlertDescription>
        </Alert>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchase Your Custom Portrait</h1>
          <p className="text-gray-600 mt-1">
            Get the full high-resolution version without watermark
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Portrait Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Your Custom Portrait</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="relative w-full rounded-lg overflow-hidden bg-gray-100"
              style={{ aspectRatio: '1 / 1' }}
            >
              <Image
                src={customImage.generated_image_url}
                alt="Custom portrait"
                fill
                className="object-cover"
              />
              {/* Watermark indicator */}
              <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-xs">
                Preview • Watermarked
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Purchase Options */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Digital Download</CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                High-resolution image without watermark
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-semibold text-gray-900">Custom Portrait</span>
                  <span className="text-2xl font-bold text-blue-600">£9.99</span>
                </div>
                <p className="text-sm text-gray-600">
                  One-time purchase • Instant download
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900">What's included:</h4>
                <ul className="space-y-2">
                  {[
                    'High-resolution image (4K quality)',
                    'No watermark',
                    'Instant download after purchase',
                    'Perfect for printing or sharing',
                    'Lifetime access to your download'
                  ].map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {purchasing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Purchase Now - £9.99
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                Secure checkout powered by Stripe
              </p>
            </CardContent>
          </Card>

          <Alert className="border-green-200 bg-green-50">
            <Download className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>Instant Access:</strong> Download your high-resolution portrait immediately after purchase
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
