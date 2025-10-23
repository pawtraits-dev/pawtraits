'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Wand2,
  Sparkles,
  ShoppingCart,
  Check,
  Star,
  Image as ImageIcon,
  CreditCard,
  Zap,
  Heart,
  AlertCircle,
  Gift
} from 'lucide-react';
import { useUserRouting } from '@/hooks/use-user-routing';
import type { ImageCatalogWithDetails } from '@/lib/types';
import CustomerImageCustomizationModal from '@/components/CustomerImageCustomizationModal';

interface CreditBalance {
  remaining: number;
  purchased: number;
  used: number;
}

interface CreditPack {
  id: string;
  credits: number;
  price: number;
  priceFormatted: string;
  orderCredit?: number;
  orderCreditFormatted?: string;
  discount?: number;
  recommended?: boolean;
  bestValue?: boolean;
}

interface GeneratedImage {
  id: string;
  cloudinary_public_id: string;
  public_url: string;
  prompt_text: string;
  is_purchased: boolean;
  created_at: string;
  original_image_id: string;
}

function CustomerCustomizePageContent() {
  const { userProfile } = useUserRouting();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [catalogImages, setCatalogImages] = useState<ImageCatalogWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [imageToCustomize, setImageToCustomize] = useState<ImageCatalogWithDetails | null>(null);

  // Check for success/cancelled purchase URL parameters
  const creditsPurchased = searchParams.get('credits_purchased') === 'true';
  const purchaseCancelled = searchParams.get('credits_purchase_cancelled') === 'true';

  useEffect(() => {
    if (userProfile) {
      loadData();
    }
  }, [userProfile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCreditBalance(),
        loadGeneratedImages(),
        loadFeaturedCatalogImages()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCreditBalance = async () => {
    try {
      const response = await fetch('/api/customers/credits');
      if (response.ok) {
        const data = await response.json();
        console.log('Credit balance API response:', data);
        setCreditBalance(data.credits);
        // Ensure creditPacks is always an array
        const packs = Array.isArray(data.creditPacks) ? data.creditPacks : [];
        console.log('Setting credit packs:', packs);
        setCreditPacks(packs);
      }
    } catch (error) {
      console.error('Error loading credit balance:', error);
    }
  };

  const loadGeneratedImages = async () => {
    try {
      const response = await fetch('/api/customers/generated-images?limit=12');
      if (response.ok) {
        const data = await response.json();
        console.log('Generated images API response:', data);
        // Ensure images is always an array
        const images = Array.isArray(data.images) ? data.images : [];
        console.log('Setting generated images:', images);
        setGeneratedImages(images);
      }
    } catch (error) {
      console.error('Error loading generated images:', error);
    }
  };

  const loadFeaturedCatalogImages = async () => {
    try {
      const response = await fetch('/api/images?is_featured=true&limit=6');
      if (response.ok) {
        const data = await response.json();
        console.log('Catalog images API response:', data);
        // Ensure data is always an array
        const images = Array.isArray(data) ? data : [];
        console.log('Setting catalog images:', images);
        setCatalogImages(images);
      }
    } catch (error) {
      console.error('Error loading catalog images:', error);
    }
  };

  const handlePurchaseCredits = async (packId: string) => {
    try {
      setPurchasingPack(packId);

      const response = await fetch('/api/customers/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();
      console.log('Checkout response:', data);
      const checkoutUrl = data.checkoutUrl || data.sessionUrl;
      if (!checkoutUrl) {
        throw new Error('No checkout URL received');
      }
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error purchasing credits:', error);
      alert('Failed to initiate purchase. Please try again.');
      setPurchasingPack(null);
    }
  };

  const handleCustomizeImage = (image: ImageCatalogWithDetails) => {
    setImageToCustomize(image);
    setShowCustomizeModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your customization dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <div className="container mx-auto px-4 py-8">

        {/* Success/Cancelled Messages */}
        {creditsPurchased && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-3">
                <Check className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Credits purchased successfully!</p>
                  <p className="text-sm text-green-600">Your credits have been added to your account.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {purchaseCancelled && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <div>
                  <p className="font-semibold text-yellow-800">Purchase cancelled</p>
                  <p className="text-sm text-yellow-600">You can purchase credits anytime below.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-4 bg-purple-600 rounded-full">
              <Wand2 className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI Pet Portrait Customization
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Transform any portrait into your perfect pet image. Change breeds, add outfits, create multi-pet portraits, and more!
          </p>
        </div>

        {/* Credit Balance Card */}
        <Card className="mb-8 border-2 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Sparkles className="w-8 h-8 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Your Credit Balance</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {creditBalance?.remaining || 0} Credits
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {creditBalance?.used || 0} used · {creditBalance?.purchased || 0} purchased
                  </p>
                </div>
              </div>
              <Button
                onClick={() => router.push('/browse')}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Start Customizing
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* How It Works Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2 text-purple-600" />
              How AI Customization Works
            </CardTitle>
            <CardDescription>
              Create unique, personalized pet portraits in 4 easy steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ImageIcon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">1. Choose Image</h3>
                <p className="text-sm text-gray-600">
                  Browse our catalog and select any portrait to customize
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Wand2 className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">2. Customize</h3>
                <p className="text-sm text-gray-600">
                  Change breed, coat color, outfit, or add a second pet
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">3. Generate</h3>
                <p className="text-sm text-gray-600">
                  AI creates your unique portrait in seconds (1 credit)
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">4. Purchase</h3>
                <p className="text-sm text-gray-600">
                  Love it? Order prints on canvas, paper, acrylic & more
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Packs Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-purple-600" />
              Purchase Credits
            </CardTitle>
            <CardDescription>
              Choose a credit pack to start creating custom portraits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Array.isArray(creditPacks) && creditPacks.map((pack) => (
                <Card
                  key={pack.id}
                  className={`relative ${
                    pack.recommended ? 'border-2 border-purple-500 shadow-lg' : ''
                  } ${pack.bestValue ? 'border-2 border-green-500 shadow-lg' : ''}`}
                >
                  {pack.recommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-purple-600">Most Popular</Badge>
                    </div>
                  )}
                  {pack.bestValue && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-green-600">Best Value</Badge>
                    </div>
                  )}
                  <CardContent className="pt-6 text-center">
                    <div className="mb-4">
                      <p className="text-4xl font-bold text-gray-900">
                        {pack.credits}
                      </p>
                      <p className="text-sm text-gray-600">Customization Credits</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-3xl font-bold text-purple-600">
                        {pack.priceFormatted}
                      </p>
                      <p className="text-sm text-gray-500">
                        £{(pack.price / pack.credits / 100).toFixed(2)} per credit
                      </p>
                      {pack.discount && pack.discount > 0 && (
                        <Badge variant="secondary" className="mt-1">
                          {pack.discount}% Off
                        </Badge>
                      )}
                    </div>
                    {pack.orderCredit && pack.orderCredit > 0 && (
                      <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center justify-center gap-2 text-green-700">
                          <Gift className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            Bonus: {pack.orderCreditFormatted} order credit
                          </span>
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          Use towards your print orders!
                        </p>
                      </div>
                    )}
                    <Button
                      onClick={() => handlePurchaseCredits(pack.id)}
                      disabled={purchasingPack === pack.id}
                      className={`w-full ${
                        pack.recommended || pack.bestValue
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : ''
                      }`}
                      size="lg"
                    >
                      {purchasingPack === pack.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Purchase
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 text-center text-sm text-gray-600">
              <p className="flex items-center justify-center">
                <Check className="w-4 h-4 mr-1 text-green-600" />
                New customers get 2 free trial credits
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Your Generated Images */}
        {generatedImages.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Heart className="w-5 h-5 mr-2 text-purple-600" />
                    Your Generated Portraits
                  </CardTitle>
                  <CardDescription>
                    {generatedImages.length} custom portrait{generatedImages.length !== 1 ? 's' : ''} created
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => router.push('/customer/gallery')}
                >
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {generatedImages.slice(0, 6).map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={image.public_url}
                        alt="Generated portrait"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {image.is_purchased && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-600">
                          <Check className="w-3 h-3 mr-1" />
                          Purchased
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Featured Catalog Images - Call to Action */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Star className="w-5 h-5 mr-2 text-purple-600" />
                  Featured Portraits to Customize
                </CardTitle>
                <CardDescription>
                  Click any image to start customizing
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push('/browse')}
              >
                Browse All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {catalogImages.map((image) => (
                <div
                  key={image.id}
                  className="relative group cursor-pointer"
                  onClick={() => handleCustomizeImage(image)}
                >
                  <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={image.image_variants?.catalog_watermarked?.url || image.public_url}
                      alt={image.description || 'Pet portrait'}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 rounded-lg flex items-center justify-center">
                    <Button
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-purple-600 hover:bg-purple-700"
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Customize
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Customization Modal */}
      {imageToCustomize && (
        <CustomerImageCustomizationModal
          image={imageToCustomize}
          isOpen={showCustomizeModal}
          onClose={() => {
            setShowCustomizeModal(false);
            setImageToCustomize(null);
          }}
          onGenerationComplete={(variations) => {
            console.log('Generated variations:', variations);
            setShowCustomizeModal(false);
            setImageToCustomize(null);
            // Reload generated images to show new creations
            loadGeneratedImages();
            loadCreditBalance();
          }}
        />
      )}
    </div>
  );
}

export default function CustomerCustomizePage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <CustomerCustomizePageContent />
    </Suspense>
  );
}
