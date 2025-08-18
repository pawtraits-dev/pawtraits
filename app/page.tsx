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
import { useServerCart } from '@/lib/server-cart-context';
import { CountryProvider, useCountryPricing } from '@/lib/country-context';
import ClickableMetadataTags from '@/components/clickable-metadata-tags';
import ImageModal from '@/components/ImageModal';
import { extractDescriptionTitle } from '@/lib/utils';
import PublicNavigation from '@/components/PublicNavigation';


interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  date: string;
  pet_name?: string;
  image_url?: string;
}

function HomePageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
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
  const [reviews] = useState<Review[]>([
    {
      id: '1',
      customer_name: 'Sarah M.',
      rating: 5,
      comment: 'Absolutely stunning! The AI captured my golden retriever Max perfectly. The quality is incredible and it now hangs proudly in our living room.',
      date: '2024-03-15',
      pet_name: 'Max',
      image_url: '/api/placeholder/200/200'
    },
    {
      id: '2', 
      customer_name: 'James L.',
      rating: 5,
      comment: 'I was skeptical about AI art, but this exceeded all expectations. My cat Luna looks majestic in the Renaissance style portrait!',
      date: '2024-03-10',
      pet_name: 'Luna',
      image_url: '/api/placeholder/200/200'
    },
    {
      id: '3',
      customer_name: 'Maria G.',
      rating: 5,
      comment: 'Perfect memorial piece for our beloved rescue dog Charlie. The team was incredibly thoughtful and the result brought tears to our eyes.',
      date: '2024-03-08',
      pet_name: 'Charlie',
      image_url: '/api/placeholder/200/200'
    },
    {
      id: '4',
      customer_name: 'David R.',
      rating: 5,
      comment: 'Amazing quality and fast delivery! My German Shepherd looks like royalty in the portrait. Highly recommend!',
      date: '2024-03-05',
      pet_name: 'Rex',
      image_url: '/api/placeholder/200/200'
    }
  ]);
  const [currentReview, setCurrentReview] = useState(0);
  
  const supabase = getSupabaseClient();
  const supabaseService = new SupabaseService();
  const { addToCart } = useServerCart();
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
      const productsData = await supabaseService.getProducts() || [];
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadPricing = async () => {
    try {
      const pricingData = await supabaseService.getProductPricing() || [];
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
              router.push('/partners/shop');
              return;
            case 'customer':
              router.push('/customer/shop');
              return;
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
      const response = await fetch('/api/gallery/images');
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

  const nextReview = () => {
    setCurrentReview((prev) => (prev + 1) % reviews.length);
  };

  const prevReview = () => {
    setCurrentReview((prev) => (prev - 1 + reviews.length) % reviews.length);
  };


  // Filter images by category
  const popularImages = images.filter(img => img.rating && img.rating >= 4.5).slice(0, 6);
  const newImages = images.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6);
  const featuredImages = images.filter(img => img.is_featured).slice(0, 6);

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
      <PublicNavigation />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              AI-Generated Pet Portraits
              <span className="block text-purple-600 font-[family-name:var(--font-margarine)]">Made with Love</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transform your beloved pets into stunning, personalized artworks using cutting-edge AI technology. 
              Perfect for gifts, memorials, or just celebrating your furry family members.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                size="lg"
                onClick={() => router.push('/customer/shop')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Heart className="w-5 h-5 mr-2" />
                Start Creating
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => scrollToSection('gallery')}
              >
                View Gallery
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-margarine)]">
              Discover Amazing Pet Portraits
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse our collection of AI-generated pet portraits in various styles and themes
            </p>
          </div>

          <Tabs defaultValue="popular" className="space-y-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
              <TabsTrigger value="popular" className="font-[family-name:var(--font-margarine)]">
                Popular ({popularImages.length})
              </TabsTrigger>
              <TabsTrigger value="new" className="font-[family-name:var(--font-margarine)]">
                New ({newImages.length})
              </TabsTrigger>
              <TabsTrigger value="featured" className="font-[family-name:var(--font-margarine)]">
                Featured ({featuredImages.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="popular" className="space-y-6">
              {popularImages.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Popular images coming soon...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {popularImages.map((image) => renderImageCard(image, 'popular'))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-6">
              {newImages.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">New images coming soon...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {newImages.map((image) => renderImageCard(image, 'new'))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="featured" className="space-y-6">
              {featuredImages.length === 0 ? (
                <div className="text-center py-12">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">Featured images coming soon...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredImages.map((image) => renderImageCard(image, 'featured'))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="text-center mt-12">
            <Button 
              size="lg"
              onClick={() => router.push('/customer/gallery')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              View Full Gallery
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-margarine)]">
              What Our Customers Say
            </h2>
            <p className="text-xl text-gray-600">
              Real reviews from pet parents who love their AI portraits
            </p>
          </div>

          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="flex items-center justify-center mb-6">
                <Quote className="w-12 h-12 text-purple-600" />
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-4">
                  {[...Array(reviews[currentReview].rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <p className="text-lg text-gray-700 mb-6 italic">
                  "{reviews[currentReview].comment}"
                </p>
                
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <p className="font-semibold text-gray-900">{reviews[currentReview].customer_name}</p>
                    <p className="text-sm text-gray-600">
                      Pet parent to {reviews[currentReview].pet_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(reviews[currentReview].date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel Controls */}
            <button
              onClick={prevReview}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
            <button
              onClick={nextReview}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <ChevronRight className="w-6 h-6 text-gray-600" />
            </button>

            {/* Dots Indicator */}
            <div className="flex items-center justify-center space-x-2 mt-6">
              {reviews.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentReview(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentReview ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sign Up Section */}
      <section id="signup" className="py-20 bg-gradient-to-br from-purple-600 to-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-white">
            <h2 className="text-4xl font-bold mb-6 font-[family-name:var(--font-margarine)]">
              Ready to Create Your Pet's Portrait?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Join thousands of happy pet parents who have transformed their beloved companions into beautiful artwork
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

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-6 font-[family-name:var(--font-margarine)]">
              About PawTraits
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're passionate about celebrating the special bond between pets and their families through beautiful, AI-generated artwork
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">AI-Powered Technology</h3>
              <p className="text-gray-600">
                Our advanced AI technology creates unique, personalized portraits that capture your pet's personality and charm
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Made with Love</h3>
              <p className="text-gray-600">
                Every portrait is crafted with care and attention to detail, ensuring your pet's unique characteristics shine through
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Premium Quality</h3>
              <p className="text-gray-600">
                High-resolution artwork suitable for printing on canvas, paper, or digital sharing across all platforms
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Multiple Options</h3>
              <p className="text-gray-600">
                Choose from various styles, themes, and formats to create the perfect portrait for your space and budget
              </p>
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
                <Sparkles className="w-6 h-6 text-purple-400" />
                <span className="text-xl font-bold font-[family-name:var(--font-margarine)]">PawTraits</span>
              </div>
              <p className="text-gray-400">
                Creating beautiful memories of your beloved pets through AI-powered artwork.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Browse</h3>
              <div className="space-y-2">
                <Link href="/dogs" className="block text-gray-400 hover:text-white transition-colors">Dogs</Link>
                <Link href="/cats" className="block text-gray-400 hover:text-white transition-colors">Cats</Link>
                <Link href="/themes" className="block text-gray-400 hover:text-white transition-colors">Themes</Link>
                <Link href="/customer/gallery" className="block text-gray-400 hover:text-white transition-colors">Gallery</Link>
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
              © 2024 PawTraits. All rights reserved.
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