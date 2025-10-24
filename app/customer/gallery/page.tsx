'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Share2, ShoppingCart, Download, Star, Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
// Removed AdminSupabaseService - using SupabaseService for customer access
import type { UserProfile } from '@/lib/user-types';
import type { Product, ProductPricing } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import ShareModal from '@/components/share-modal';
import UserInteractionsService from '@/lib/user-interactions';
import { useServerCart } from '@/lib/server-cart-context';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import ImageModal from '@/components/ImageModal';
import { extractDescriptionTitle } from '@/lib/utils';
import StickyFilterHeader from '@/components/StickyFilterHeader';
import { PawSpinner } from '@/components/ui/paw-spinner';

interface GalleryImage {
  id: string;
  filename: string;
  public_url: string;
  prompt_text: string;
  description: string;
  tags: string[];
  breed_id?: string;
  theme_id?: string;
  style_id?: string;
  format_id?: string;
  rating?: number;
  is_featured: boolean;
  created_at: string;
  interaction_types: ('liked' | 'shared' | 'purchased' | 'in_basket')[];
  interaction_dates: { type: 'liked' | 'shared' | 'purchased' | 'in_basket'; date: string }[];
  // Related data
  breed?: {
    id: string;
    name: string;
  };
  theme?: {
    id: string;
    name: string;
  };
  style?: {
    id: string;
    name: string;
  };
}

export default function MyPawtraitsGallery() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<GalleryImage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [imageToShare, setImageToShare] = useState<GalleryImage | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [pricing, setPricing] = useState<ProductPricing[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImage, setModalImage] = useState<GalleryImage | null>(null);

  const supabaseService = new SupabaseService();
  // Using SupabaseService for customer access
  const { cart } = useServerCart();

  useEffect(() => {
    loadUserData();
    loadProductData();
  }, []);

  useEffect(() => {
    if (userProfile) {
      loadGalleryImages();
    }
  }, [userProfile]);

  useEffect(() => {
    filterImages();
  }, [images, searchQuery]);

  const loadUserData = async () => {
    try {
      const profile = await supabaseService.getCurrentUserProfile();
      setUserProfile(profile);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductData = async () => {
    try {
      const [productsData, pricingData] = await Promise.all([
        supabaseService.getProducts(),
        supabaseService.getAllProductPricing()
      ]);
      
      setProducts(productsData?.filter((p: any) => p.is_active) || []);
      setPricing(pricingData || []);
    } catch (error) {
      console.error('Error loading product data:', error);
    }
  };

  const loadGalleryImages = async () => {
    try {
      // Load user interactions from localStorage (liked and shared images)
      const localInteractions = UserInteractionsService.getGalleryImages();
      
      // Convert interactions to a temporary format for processing
      interface TempGalleryImage {
        id: string;
        filename: string;
        public_url: string;
        prompt_text: string;
        description: string;
        tags: string[];
        breed_id?: string;
        theme_id?: string;
        style_id?: string;
        format_id?: string;
        rating?: number;
        is_featured: boolean;
        created_at: string;
        interaction_type: 'liked' | 'shared' | 'purchased' | 'in_basket';
        interaction_date: string;
        breed?: { id: string; name: string };
        theme?: { id: string; name: string };
        style?: { id: string; name: string };
      }

      // Map localStorage interactions to temporary format
      const localTempImages: TempGalleryImage[] = localInteractions.map(item => ({
        id: (item as any).id || (item as any).imageId,
        filename: (item as any).filename || 'unknown.jpg',
        public_url: (item as any).public_url || '',
        prompt_text: (item as any).prompt_text || 'Untitled Portrait',
        description: (item as any).description || '',
        tags: (item as any).tags || [],
        breed_id: (item as any).breed_id,
        theme_id: (item as any).theme_id,
        style_id: (item as any).style_id,
        format_id: (item as any).format_id,
        rating: (item as any).rating,
        is_featured: (item as any).is_featured || false,
        created_at: (item as any).created_at || (item as any).timestamp,
        interaction_type: item.interaction_type,
        interaction_date: item.interaction_date,
        breed: (item as any).breed,
        theme: (item as any).theme,
        style: (item as any).style
      }));

      // Load purchased images from orders API if user profile is available
      let purchasedTempImages: TempGalleryImage[] = [];
      if (userProfile?.email) {
        try {
          const ordersResponse = await fetch(`/api/shop/orders?email=${encodeURIComponent(userProfile.email)}`);

          if (ordersResponse.ok) {
            const orders = await ordersResponse.json();

            // Convert order items to temporary gallery images
            if (Array.isArray(orders) && orders.length > 0) {
              purchasedTempImages = orders.flatMap((order: any) => {
                if (!order.order_items || !Array.isArray(order.order_items)) {
                  return [];
                }

                return order.order_items.map((item: any) => ({
                  id: item.image_id,
                  filename: item.image_title?.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg' || 'purchase.jpg',
                  public_url: item.image_url,
                  prompt_text: item.image_title || 'Purchased Portrait',
                  description: `Purchased on ${new Date(order.created_at).toLocaleDateString()}`,
                  tags: ['purchased'],
                  breed_id: undefined,
                  theme_id: undefined,
                  style_id: undefined,
                  format_id: undefined,
                  rating: undefined,
                  is_featured: false,
                  created_at: order.created_at,
                  interaction_type: 'purchased' as const,
                  interaction_date: order.created_at,
                  breed: undefined,
                  theme: undefined,
                  style: undefined
                }));
              }).filter(Boolean); // Remove any null/undefined items
            }
          }
        } catch (error) {
          console.error('Error loading purchased images from orders:', error);
        }
      }

      // Load basket items from cart
      const basketTempImages: TempGalleryImage[] = cart.items.map(cartItem => ({
        id: cartItem.imageId,
        filename: cartItem.imageTitle?.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg' || 'basket.jpg',
        public_url: cartItem.imageUrl,
        prompt_text: cartItem.imageTitle || 'In Basket',
        description: `Added to basket on ${new Date(cartItem.addedAt).toLocaleDateString()}`,
        tags: ['in_basket', cartItem.product.name],
        breed_id: undefined,
        theme_id: undefined,
        style_id: undefined,
        format_id: undefined,
        rating: undefined,
        is_featured: false,
        created_at: cartItem.addedAt,
        interaction_type: 'in_basket' as const,
        interaction_date: cartItem.addedAt,
        breed: undefined,
        theme: undefined,
        style: undefined
      }));

      // Combine all temporary images
      const allTempImages = [...localTempImages, ...purchasedTempImages, ...basketTempImages];
      
      // Group by image ID and combine interaction types
      const imageMap = new Map<string, GalleryImage>();
      
      allTempImages.forEach(tempImage => {
        const existing = imageMap.get(tempImage.id);
        
        if (existing) {
          // Add this interaction type if not already present
          if (!existing.interaction_types.includes(tempImage.interaction_type)) {
            existing.interaction_types.push(tempImage.interaction_type);
            existing.interaction_dates.push({
              type: tempImage.interaction_type,
              date: tempImage.interaction_date
            });
          }
          
          // Update other fields with purchased data if this is a purchase (take precedence)
          if (tempImage.interaction_type === 'purchased') {
            existing.prompt_text = tempImage.prompt_text;
            existing.description = tempImage.description;
            existing.public_url = tempImage.public_url;
            existing.filename = tempImage.filename;
          }
        } else {
          // Create new gallery image
          imageMap.set(tempImage.id, {
            id: tempImage.id,
            filename: tempImage.filename,
            public_url: tempImage.public_url,
            prompt_text: tempImage.prompt_text,
            description: tempImage.description,
            tags: tempImage.tags,
            breed_id: tempImage.breed_id,
            theme_id: tempImage.theme_id,
            style_id: tempImage.style_id,
            format_id: tempImage.format_id,
            rating: tempImage.rating,
            is_featured: tempImage.is_featured,
            created_at: tempImage.created_at,
            interaction_types: [tempImage.interaction_type],
            interaction_dates: [{
              type: tempImage.interaction_type,
              date: tempImage.interaction_date
            }],
            breed: tempImage.breed,
            theme: tempImage.theme,
            style: tempImage.style
          });
        }
      });

      // Convert map to array and sort by most recent interaction
      const deduplicatedImages = Array.from(imageMap.values());
      deduplicatedImages.sort((a, b) => {
        const aMostRecent = Math.max(...a.interaction_dates.map(d => new Date(d.date).getTime()));
        const bMostRecent = Math.max(...b.interaction_dates.map(d => new Date(d.date).getTime()));
        return bMostRecent - aMostRecent;
      });

      setImages(deduplicatedImages);
    } catch (error) {
      console.error('Error loading gallery images:', error);
      setImages([]);
    }
  };

  const filterImages = () => {
    let filtered = [...images];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(image =>
        image.prompt_text.toLowerCase().includes(query) ||
        image.description.toLowerCase().includes(query) ||
        image.tags.some(tag => tag.toLowerCase().includes(query)) ||
        (image.breed?.name && image.breed.name.toLowerCase().includes(query)) ||
        (image.theme?.name && image.theme.name.toLowerCase().includes(query)) ||
        (image.style?.name && image.style.name.toLowerCase().includes(query))
      );
    }

    setFilteredImages(filtered);
  };

  const getImagesByType = (type: 'liked' | 'shared' | 'purchased' | 'in_basket') => {
    return filteredImages.filter(image => image.interaction_types.includes(type));
  };

  const handleBuyClick = (image: GalleryImage) => {
    setSelectedImage(image);
    setShowProductModal(true);
  };

  const handleShare = (image: GalleryImage) => {
    setImageToShare(image);
    setShowShareModal(true);
  };

  const handleImageClick = (image: GalleryImage) => {
    setModalImage(image);
    setShowImageModal(true);
  };

  const handleShareComplete = (platform: string) => {
    if (imageToShare) {
      console.log(`Image shared on ${platform}:`, imageToShare.id);
    }
  };

  const handleCheckoutClick = () => {
    // Navigate to checkout page
    window.location.href = '/shop/checkout';
  };

  const handleDownload = async (image: GalleryImage) => {
    try {
      console.log(`🔄 Starting download for image ${image.id}`);
      
      // Get the purchased variant download URL from our API
      const downloadResponse = await fetch(`/api/images/${image.id}/download`);
      
      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        console.error('Download API error:', errorData);
        alert(errorData.error || 'Failed to generate download link');
        return;
      }
      
      const { download_url, filename, variant } = await downloadResponse.json();
      console.log(`📥 Got download URL (${variant}): ${download_url}`);
      
      // Download the image
      const imageResponse = await fetch(download_url);
      const blob = await imageResponse.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `pawtraits-${filename}`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`✅ Download completed for ${filename}`);
    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Failed to download image. Please try again.');
    }
  };

  const ImageCard = ({ image }: { image: GalleryImage }) => (
    <Card className="group hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-0">
        <div 
          className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg relative overflow-hidden cursor-pointer"
          onClick={() => handleImageClick(image)}
        >
          <CatalogImage
            imageId={image.id}
            alt={image.description || image.prompt_text}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallbackUrl={image.public_url}
          />
          
          {/* Interaction type badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {image.interaction_types.includes('purchased') && (
              <Badge className="bg-green-100 text-green-800 text-xs">
                💳 Purchased
              </Badge>
            )}
            {image.interaction_types.includes('liked') && (
              <Badge className="bg-red-100 text-red-800 text-xs">
                ❤️ Liked
              </Badge>
            )}
            {image.interaction_types.includes('shared') && (
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                📤 Shared
              </Badge>
            )}
            {image.interaction_types.includes('in_basket') && (
              <Badge className="bg-orange-100 text-orange-800 text-xs">
                🛒 In Basket
              </Badge>
            )}
          </div>
          
          {/* Featured badge */}
          {image.is_featured && (
            <Badge className="absolute top-2 right-2 bg-yellow-500 text-white">
              Featured
            </Badge>
          )}

          {/* Action buttons */}
          <div className="absolute bottom-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-8 p-0 bg-white/90 hover:bg-white"
              onClick={() => handleShare(image)}
            >
              <Share2 className="w-4 h-4 text-gray-600" />
            </Button>
            {image.interaction_types.includes('purchased') && (
              <Button
                variant="ghost"
                size="sm"
                className="w-8 h-8 p-0 bg-white/90 hover:bg-white"
                onClick={() => handleDownload(image)}
              >
                <Download className="w-4 h-4 text-gray-600" />
              </Button>
            )}
          </div>
          
          {/* Breed badge */}
          {image.breed && (
            <Badge className="absolute bottom-2 left-2 bg-purple-100 text-purple-800">
              {image.breed.name}
            </Badge>
          )}
        </div>
        
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">
            {extractDescriptionTitle(image.description) || image.prompt_text}
          </h3>
          
          {/* Interaction dates */}
          <div className="text-xs text-gray-500 mb-3">
            {image.interaction_dates
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((interaction, index) => (
                <p key={interaction.type}>
                  {interaction.type === 'purchased' ? 'Purchased' :
                   interaction.type === 'liked' ? 'Liked' :
                   'Shared'} on {new Date(interaction.date).toLocaleDateString()}
                </p>
              ))
            }
          </div>
          
          {/* Tags */}
          {image.tags && image.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {image.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {image.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{image.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
          
          {/* Theme and Style info */}
          <div className="text-sm text-gray-500 mb-3">
            {image.theme && (
              <span className="mr-2">Theme: {image.theme.name}</span>
            )}
            {image.style && (
              <span>Style: {image.style.name}</span>
            )}
          </div>

          {/* Action buttons */}
          {image.interaction_types.includes('in_basket') && !image.interaction_types.includes('purchased') && (
            <div className="pt-3 border-t">
              <Button 
                size="sm"
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                onClick={handleCheckoutClick}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Checkout Now
              </Button>
            </div>
          )}
          {!image.interaction_types.includes('purchased') && !image.interaction_types.includes('in_basket') && (
            <div className="pt-3 border-t">
              <Button 
                size="sm"
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={() => handleBuyClick(image)}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Buy Now
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const EmptyState = ({ type }: { type: string }) => (
    <Card className="p-8 text-center">
      <CardContent>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          {type === 'liked' && <Heart className="w-8 h-8 text-gray-400" />}
          {type === 'shared' && <Share2 className="w-8 h-8 text-gray-400" />}
          {type === 'purchased' && <ShoppingCart className="w-8 h-8 text-gray-400" />}
          {type === 'in_basket' && <ShoppingCart className="w-8 h-8 text-gray-400" />}
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No {type === 'in_basket' ? 'basket' : type} Pawtraits yet
        </h3>
        <p className="text-gray-600 mb-4">
          {type === 'liked' && "Like Pawtraits you love to see them here"}
          {type === 'shared' && "Share Pawtraits with friends to build your collection"}
          {type === 'purchased' && "Purchase Pawtraits to access them anytime"}
          {type === 'in_basket' && "Add Pawtraits to your basket to see them here"}
        </p>
        <Button variant="outline" onClick={() => window.location.href = '/browse'}>
          Browse Pawtraits
        </Button>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center py-12 mb-8">
            <PawSpinner size="lg" />
            <p className="mt-4 text-gray-600">Loading your pawtraits gallery...</p>
          </div>

          {/* Skeleton Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-0">
                  <div className="aspect-square bg-gray-200 rounded-t-lg" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-gray-200 rounded w-16" />
                      <div className="h-6 bg-gray-200 rounded w-16" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const likedImages = getImagesByType('liked');
  const sharedImages = getImagesByType('shared');
  const purchasedImages = getImagesByType('purchased');
  const basketImages = getImagesByType('in_basket');

  // Configure sticky header filters - simpler for gallery
  const stickyHeaderFilters: any[] = []; // No filters needed for gallery, just search

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      {/* Sticky Filter Header */}
      <StickyFilterHeader
        searchTerm={searchQuery}
        onSearchTermChange={setSearchQuery}
        onSearchSubmit={() => {}} // Simple search, no URL updates needed
        searchPlaceholder="Search your gallery..."
        filters={stickyHeaderFilters}
        onClearFilters={() => {
          setSearchQuery('');
        }}
      />
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Pawtraits Gallery</h1>
          <p className="text-gray-600">
            Your personal collection of loved, shared, and purchased Pawtraits
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">
              All ({filteredImages.length})
            </TabsTrigger>
            <TabsTrigger value="liked">
              Liked ({likedImages.length})
            </TabsTrigger>
            <TabsTrigger value="shared">
              Shared ({sharedImages.length})
            </TabsTrigger>
            <TabsTrigger value="in_basket">
              In Basket ({basketImages.length})
            </TabsTrigger>
            <TabsTrigger value="purchased">
              Purchased ({purchasedImages.length})
            </TabsTrigger>
          </TabsList>

            <TabsContent value="all" className="space-y-6">
            {filteredImages.length === 0 ? (
              <EmptyState type="all" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredImages.map((image) => (
                  <ImageCard key={image.id} image={image} />
                ))}
              </div>
            )}
            </TabsContent>

          <TabsContent value="in_basket" className="space-y-6">
          {basketImages.length === 0 ? (
            <EmptyState type="in_basket" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {basketImages.map((image) => (
                <ImageCard key={image.id} image={image} />
              ))}
            </div>
          )}
          </TabsContent>

          <TabsContent value="purchased" className="space-y-6">
          {purchasedImages.length === 0 ? (
            <EmptyState type="purchased" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {purchasedImages.map((image) => (
                <ImageCard key={image.id} image={image} />
              ))}
            </div>
          )}
          </TabsContent>

          <TabsContent value="liked" className="space-y-6">
          {likedImages.length === 0 ? (
            <EmptyState type="liked" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {likedImages.map((image) => (
                <ImageCard key={image.id} image={image} />
              ))}
            </div>
          )}
          </TabsContent>

          <TabsContent value="shared" className="space-y-6">
          {sharedImages.length === 0 ? (
            <EmptyState type="shared" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sharedImages.map((image) => (
                <ImageCard key={image.id} image={image} />
              ))}
            </div>
          )}
          </TabsContent>
        </Tabs>

      </div>

      {/* Product Selection Modal */}
      {selectedImage && (
        <ProductSelectionModal
          isOpen={showProductModal}
          onClose={() => {
            setShowProductModal(false);
            setSelectedImage(null);
          }}
          image={selectedImage}
          products={products}
          pricing={pricing}
          onAddToBasket={() => {}} // TODO: Implement
        />
      )}

      {/* Share Modal */}
      {imageToShare && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setImageToShare(null);
          }}
          image={imageToShare}
          onShare={handleShareComplete}
        />
      )}

      {/* Image Modal */}
      {modalImage && (
        <ImageModal
          isOpen={showImageModal}
          onClose={() => {
            setShowImageModal(false);
            setModalImage(null);
          }}
          imageId={modalImage.id}
          imageData={{
            id: modalImage.id,
            description: modalImage.description,
            prompt_text: modalImage.prompt_text,
            breed_name: modalImage.breed?.name,
            theme_name: modalImage.theme?.name,
            style_name: modalImage.style?.name,
            is_featured: modalImage.is_featured,
            rating: modalImage.rating,
            tags: modalImage.tags,
            public_url: modalImage.public_url
          }}
          onBuyClick={() => handleBuyClick(modalImage)}
          onShareClick={() => handleShare(modalImage)}
          onDownloadClick={modalImage.interaction_types.includes('purchased') ? () => handleDownload(modalImage) : undefined}
          isShared={modalImage.interaction_types.includes('shared')}
          isPurchased={modalImage.interaction_types.includes('purchased')}
          showActions={true}
          products={products}
          pricing={pricing}
        />
      )}
    </div>
  );
}