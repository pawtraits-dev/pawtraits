'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Heart, 
  Share2, 
  ShoppingCart, 
  Star, 
  Sparkles, 
  ArrowRight,
  Quote,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { getSupabaseClient } from '@/lib/supabase-client';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import type { ImageCatalogWithDetails } from '@/lib/types';
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import ShareModal from '@/components/share-modal';
import UserInteractionsService from '@/lib/user-interactions';
import { useHybridCart } from '@/lib/hybrid-cart-context';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import ClickableMetadataTags from '@/components/clickable-metadata-tags';
import ImageModal from '@/components/ImageModal';
import { extractDescriptionTitle } from '@/lib/utils';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import ContentBasedCarousel from '@/components/ContentBasedCarousel';
import ReviewsCarousel from '@/components/reviews/ReviewsCarousel';

function HomePageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState('new');
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageCatalogWithDetails | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [imageToShare, setImageToShare] = useState<ImageCatalogWithDetails | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<ImageCatalogWithDetails | null>(null);
  const [likedImages, setLikedImages] = useState<Set<string>>(new Set());
  const [sharedImages, setSharedImages] = useState<Set<string>>(new Set());
  const [purchasedImages, setPurchasedImages] = useState<Set<string>>(new Set());
  
  const supabase = getSupabaseClient();
  const supabaseService = new SupabaseService();
  const { addToCart } = useHybridCart();
  const { selectedCountry, selectedCountryData, getCountryPricing, getLowestPrice } = useCountryPricing();

  useEffect(() => {
    checkUser();
    loadData();
    loadUserInteractions();
  }, []);

  const loadData = async () => {
    await Promise.all([
      loadGalleryImages(),
      loadProducts(),
      loadPricing()
    ]);
  };

  const loadProducts = async () => {
    try {
      const productsData = await supabaseService.getPublicProducts() || [];  // Use public method to bypass RLS
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadPricing = async () => {
    try {
      const pricingData = await supabaseService.getPublicProductPricing() || [];  // Use public method to bypass RLS
      setPricing(pricingData);
    } catch (error) {
      console.error('Error loading pricing:', error);
    }
  };

  const loadUserInteractions = () => {
    const liked = UserInteractionsService.getLikedImageIds();
    const shared = UserInteractionsService.getSharedImageIds();
    const purchased = UserInteractionsService.getPurchasedImageIds();
    
    setLikedImages(new Set(liked));
    setSharedImages(new Set(shared));
    setPurchasedImages(new Set(purchased));
  };

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const profile = await supabaseService.getCurrentUserProfile();
        
        if (profile) {
          switch (profile.user_type) {
            case 'admin':
              router.push('/admin');
              return;
            case 'partner':
              router.push('/browse');
              return;
            case 'customer':
              // Let customers browse the home page instead of redirecting
              // They can navigate to /browse or /shop via the UI
              break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGalleryImages = async () => {
    try {
      const response = await fetch('/api/images?public=true');
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
      }
    } catch (error) {
      console.error('Error loading gallery images:', error);
    }
  };

  const getImageProductInfo = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    
    if (!image || !image.format_id) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    const availableProducts = (products || []).filter(p => 
      p.is_active && p.format_id === image.format_id
    );
    
    if (availableProducts.length === 0) {
      return { productCount: 0, lowestPrice: null, currency: null };
    }

    const countryPricing = getCountryPricing(pricing || []).filter(p => 
      availableProducts.some(product => product.id === p.product_id)
    );

    if (countryPricing.length === 0) {
      return { productCount: availableProducts.length, lowestPrice: null, currency: null };
    }

    const lowestPricing = countryPricing.reduce((lowest, current) => 
      current.sale_price < lowest.sale_price ? current : lowest
    );

    return {
      productCount: availableProducts.length,
      lowestPrice: lowestPricing.sale_price,
      currency: lowestPricing.currency_code,
      currencySymbol: lowestPricing.currency_symbol
    };
  };

  const handleBuyClick = (image: ImageCatalogWithDetails) => {
    setSelectedImage(image);
    setShowProductModal(true);
  };

  const handleAddToCart = (productId: string, quantity: number) => {
    if (!selectedImage) return;

    const product = products.find(p => p.id === productId);
    const productPricing = pricing.find(p => p.product_id === productId && p.country_code === selectedCountry);
    
    if (!product || !productPricing) {
      alert('Product information not found');
      return;
    }

    addToCart({
      imageId: selectedImage.id,
      productId: productId,
      imageUrl: selectedImage.image_variants?.thumbnail?.url || selectedImage.image_variants?.mid_size?.url || selectedImage.public_url,
      imageTitle: selectedImage.description || 'Pet Portrait',
      product: product,
      pricing: productPricing,
      quantity: quantity
    });

    setShowProductModal(false);
    setSelectedImage(null);
  };

  const handleLike = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    const isNowLiked = UserInteractionsService.toggleLikeSync(imageId, image);
    
    setLikedImages(prev => {
      const newLiked = new Set(prev);
      if (isNowLiked) {
        newLiked.add(imageId);
      } else {
        newLiked.delete(imageId);
      }
      return newLiked;
    });
  };

  const handleShare = (image: ImageCatalogWithDetails) => {
    setImageToShare(image);
    setShowShareModal(true);
  };

  const handleImageClick = (image: ImageCatalogWithDetails) => {
    setModalImage(image);
    setShowImageModal(true);
  };

  const handleShareComplete = (platform: string) => {
    if (imageToShare) {
      UserInteractionsService.recordShare(imageToShare.id, platform, imageToShare);
      setSharedImages(prev => new Set(prev).add(imageToShare.id));
    }
    setShowShareModal(false);
    setImageToShare(null);
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={i} className="w-3 h-3 fill-current" />);
    }
    
    if (hasHalfStar) {
      stars.push(<Star key="half" className="w-3 h-3 fill-current opacity-50" />);
    }
    
    return <div className="flex items-center space-x-0.5">{stars}</div>;
  };


  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };


  // Filter images by category
  const popularImages = images
    .filter(img => img.rating && img.rating > 0)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 5);
  const newImages = images.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const featuredImages = images.filter(img => img.is_featured).slice(0, 5);

  const renderImageCard = (image: ImageCatalogWithDetails, badgeType: 'popular' | 'new' | 'featured') => {
    const isLiked = likedImages.has(image.id);
    const isShared = sharedImages.has(image.id);
    const isPurchased = purchasedImages.has(image.id);
    const productInfo = getImageProductInfo(image.id);

    const badgeConfig = {
      popular: { text: 'Popular', icon: Star, class: 'bg-yellow-100 text-yellow-800' },
      new: { text: 'New', icon: Sparkles, class: 'bg-green-100 text-green-800' },
      featured: { text: 'Featured', icon: Star, class: 'bg-purple-100 text-purple-800' }
    };

    const badge = badgeConfig[badgeType];

    return (
      <Card key={image.id} className="group hover:shadow-lg transition-shadow overflow-hidden">
        <div 
          className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer"
          onClick={() => handleImageClick(image)}
        >
          <CatalogImage
            imageId={image.id}
            alt={image.description || 'Generated image'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            fallbackUrl={image.image_url || image.public_url}
          />
          {image.rating && image.rating > 0 && (
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              {renderStars(image.rating)}
            </div>
          )}
          
          <div className="absolute top-2 right-2 flex space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLike(image.id);
              }}
              className={`p-2 rounded-full transition-all ${
                isLiked 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white bg-opacity-80 text-gray-700 hover:bg-red-500 hover:text-white'
              }`}
              title={isLiked ? 'Unlike' : 'Like'}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleShare(image);
              }}
              className={`p-2 rounded-full transition-all ${
                isShared 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-white bg-opacity-80 text-gray-700 hover:bg-blue-500 hover:text-white'
              }`}
              title={isShared ? 'Shared' : 'Share'}
            >
              <Share2 className="w-4 h-4" />
            </button>
            
            {isPurchased && (
              <div className="bg-green-500 text-white p-2 rounded-full" title="Purchased">
                <ShoppingCart className="w-4 h-4 fill-current" />
              </div>
            )}
          </div>

          <div className="absolute bottom-2 left-2">
            <Badge className={badge.class}>
              <badge.icon className="w-3 h-3 mr-1" />
              {badge.text}
            </Badge>
          </div>
        </div>
        
        <CardContent className="p-4 space-y-3">
          <ClickableMetadataTags
            breed_id={image.breed_id}
            breed_name={image.breed_name}
            breed_animal_type={image.breed_animal_type}
            theme_id={image.theme_id}
            theme_name={image.theme_name}
            style_id={image.style_id}
            style_name={image.style_name}
            coat_id={image.coat_id}
            coat_name={image.coat_name}
            coat_hex_color={image.coat_hex_color}
            coat_animal_type={image.coat_animal_type}
          />
          
          {image.description && (
            <p className="text-sm text-gray-900 font-medium line-clamp-2">
              {extractDescriptionTitle(image.description)}
            </p>
          )}
          
          <div className="pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-gray-600">
                {productInfo.productCount > 0 ? (
                  <>
                    {productInfo.productCount} product{productInfo.productCount > 1 ? 's' : ''} from{' '}
                    {productInfo.lowestPrice && productInfo.currencySymbol ? 
                      formatPrice(productInfo.lowestPrice, productInfo.currency || 'GBP', productInfo.currencySymbol) : 
                      'Price TBC'
                    }
                  </>
                ) : (
                  'Price TBC'
                )}
              </div>
            </div>
            <Button 
              size="sm"
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={productInfo.productCount === 0}
              onClick={(e) => {
                e.stopPropagation();
                handleBuyClick(image);
              }}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {productInfo.productCount === 0 ? 'Coming Soon' : 'Add to Cart'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header */}
      <UserAwareNavigation />

      {/* Hero Carousel Section */}
      <section className="relative">
        <ContentBasedCarousel
          pageType="home"
          className="h-96 lg:h-[500px]"
        />
      </section>

      {/* Filter Bar Section */}
      <section className="py-6 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <div className="flex space-x-4">
              <button 
                onClick={() => setActiveFilter('new')}
                className={`px-6 py-2 rounded-full border transition-all ${
                  activeFilter === 'new' 
                    ? 'border-primary bg-primary text-primary-foreground' 
                    : 'border-gray-300 text-gray-700 hover:border-primary hover:text-primary'
                }`}
              >
                new
              </button>
              <button 
                onClick={() => setActiveFilter('featured')}
                className={`px-6 py-2 rounded-full border transition-all ${
                  activeFilter === 'featured' 
                    ? 'border-primary bg-primary text-primary-foreground' 
                    : 'border-gray-300 text-gray-700 hover:border-primary hover:text-primary'
                }`}
              >
                featured
              </button>
              <button 
                onClick={() => setActiveFilter('popular')}
                className={`px-6 py-2 rounded-full border transition-all ${
                  activeFilter === 'popular' 
                    ? 'border-primary bg-primary text-primary-foreground' 
                    : 'border-gray-300 text-gray-700 hover:border-primary hover:text-primary'
                }`}
              >
                popular
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {(() => {
            const currentImages = activeFilter === 'popular' ? popularImages : 
                                 activeFilter === 'new' ? newImages : featuredImages;
            const badgeType = activeFilter as 'popular' | 'new' | 'featured';

            return currentImages.length === 0 ? (
              <div className="text-center py-12">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">{activeFilter} images coming soon...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {currentImages.map((image) => renderImageCard(image, badgeType))}
              </div>
            );
          })()}

          <div className="text-center mt-8">
            <Button
              size="default"
              variant="outline"
              onClick={() => router.push('/browse')}
              className="rounded-full px-8"
            >
              see all
            </Button>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-20 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-life-savers)]">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of happy pet parents
            </p>
          </div>

          <ReviewsCarousel />
        </div>
      </section>

      {/* Sign Up Section */}
      <section id="signup" className="py-20 bg-gradient-to-br from-purple-600 to-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-6 font-[family-name:var(--font-life-savers)]">
              Ready to Create Your Pet's Portrait?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Join thousands of happy pet parents
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                size="lg"
                variant="secondary"
                onClick={() => router.push('/signup/user')}
                className="bg-white text-purple-600 hover:bg-gray-100"
              >
                Sign Up as Pet Owner
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/signup/partner')}
                className="border-white text-white hover:bg-white hover:text-purple-600"
              >
                Join as Partner
              </Button>
            </div>
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Image
                  src="/assets/logos/paw-svgrepo-200x200-purple.svg"
                  alt="Pawtraits Logo"
                  width={24}
                  height={24}
                  className="w-6 h-6"
                />
                <span className="text-xl font-bold font-[family-name:var(--font-life-savers)]">Pawtraits</span>
              </div>
              <p className="text-gray-400">
                Perfect Pet Pawtrits
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Browse</h3>
              <div className="space-y-2">
                <Link href="/dogs" className="block text-gray-400 hover:text-white transition-colors">Dogs</Link>
                <Link href="/cats" className="block text-gray-400 hover:text-white transition-colors">Cats</Link>
                <Link href="/themes" className="block text-gray-400 hover:text-white transition-colors">Themes</Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Account</h3>
              <div className="space-y-2">
                <Link href="/signup/user" className="block text-gray-400 hover:text-white transition-colors">Sign Up</Link>
                <Link href="/auth/login" className="block text-gray-400 hover:text-white transition-colors">Sign In</Link>
                <Link href="/signup/partner" className="block text-gray-400 hover:text-white transition-colors">Partner Program</Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <div className="space-y-2">
                <a href="mailto:support@pawtraits.com" className="block text-gray-400 hover:text-white transition-colors">Contact Us</a>
                <Link href="/help" className="block text-gray-400 hover:text-white transition-colors">Help Center</Link>
                <Link href="/privacy" className="block text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="block text-gray-400 hover:text-white transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-gray-400">
              © 2024 Pawtraits. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {selectedImage && (
        <ProductSelectionModal
          image={selectedImage}
          products={products}
          pricing={pricing}
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setSelectedImage(null);
          }}
          onAddToBasket={handleAddToCart}
        />
      )}

      {imageToShare && (
        <ShareModal
          image={imageToShare}
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setImageToShare(null);
          }}
          onShare={handleShareComplete}
        />
      )}

      {modalImage && (
        <ImageModal
          imageId={modalImage.id}
          imageData={{
            id: modalImage.id,
            description: modalImage.description,
            prompt_text: modalImage.prompt_text,
            breed_name: modalImage.breed_name,
            theme_name: modalImage.theme_name,
            style_name: modalImage.style_name
          }}
          isOpen={showImageModal}
          onClose={() => {
            setShowImageModal(false);
            setModalImage(null);
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <CountryProvider>
      <HomePageContent />
    </CountryProvider>
  );
}