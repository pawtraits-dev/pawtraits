'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Heart, Share2, ShoppingCart, Download, Star, Filter, Search, Wand2, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
// Removed AdminSupabaseService - using SupabaseService for customer access
import type { UserProfile } from '@/lib/user-types';
import type { Product, ProductPricing } from '@/lib/product-types';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import ShareModal from '@/components/share-modal';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import ImageModal from '@/components/ImageModal';
import { extractDescriptionTitle } from '@/lib/utils';
import StickyFilterHeader from '@/components/StickyFilterHeader';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';
import { useHybridCart } from '@/lib/hybrid-cart-context';

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
  // Order information for purchased items
  order_type?: string;
  order_id?: string;
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

  // New state for custom and recommended images
  const [customImages, setCustomImages] = useState<GalleryImage[]>([]);
  const [recommendedImages, setRecommendedImages] = useState<GalleryImage[]>([]);
  const [userPets, setUserPets] = useState<any[]>([]);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [loadingCustomImages, setLoadingCustomImages] = useState(false);

  const supabaseService = new SupabaseService();
  const { totalItems, items: cartItems } = useHybridCart();

  useEffect(() => {
    loadUserData();
    loadProductData();
  }, []);

  useEffect(() => {
    if (userProfile) {
      // Load all data in parallel for better performance
      Promise.all([
        loadUserPets(),
        loadCustomImages(),
        loadGalleryImages()
      ]);
    }
  }, [userProfile, cartItems]);

  useEffect(() => {
    if (userPets.length > 0) {
      loadRecommendedImages();
    }
  }, [userPets]);

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

  const loadUserPets = async () => {
    if (!userProfile) return;

    try {
      const { data: { session } } = await supabaseService.getClient().auth.getSession();
      if (!session) return;

      const response = await fetch('/api/customers/pets', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        const pets = await response.json();
        setUserPets(pets || []);
        console.log('🐾 Loaded', pets?.length || 0, 'user pets');
      }
    } catch (error) {
      console.error('Error loading user pets:', error);
      setUserPets([]);
    }
  };

  const loadCustomImages = async () => {
    if (!userProfile) return;

    try {
      setLoadingCustomImages(true);
      const response = await fetch('/api/customers/generated-images');

      if (response.ok) {
        const { images } = await response.json();

        // Transform to GalleryImage format
        const customGalleryImages: GalleryImage[] = (images || []).map((img: any) => ({
          id: img.id,
          filename: img.cloudinary_public_id || `custom-${img.id}.jpg`,
          public_url: img.public_url,
          prompt_text: img.prompt_text,
          description: img.prompt_text,
          tags: ['custom', 'generated'],
          breed_id: img.breed_id,
          theme_id: img.theme_id,
          style_id: img.style_id,
          format_id: img.format_id,
          rating: undefined,
          is_featured: false,
          created_at: img.created_at,
          interaction_types: [],
          interaction_dates: [],
          breed: img.breed_id ? { id: img.breed_id, name: '' } : undefined,
          theme: img.theme_id ? { id: img.theme_id, name: '' } : undefined,
          style: img.style_id ? { id: img.style_id, name: '' } : undefined,
        }));

        setCustomImages(customGalleryImages);
      }
    } catch (error) {
      console.error('Error loading custom images:', error);
      setCustomImages([]);
    } finally {
      setLoadingCustomImages(false);
    }
  };

  const loadRecommendedImages = async () => {
    if (!userProfile || userPets.length === 0) {
      setRecommendedImages([]);
      return;
    }

    try {
      setLoadingRecommended(true);

      // Build pet combinations (breed_id + coat_id)
      const petCombinations = userPets
        .filter(pet => pet.breed_id && pet.coat_id)
        .map(pet => ({
          breed_id: pet.breed_id,
          coat_id: pet.coat_id
        }));

      if (petCombinations.length === 0) {
        setRecommendedImages([]);
        return;
      }

      const response = await fetch('/api/images/recommended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ petCombinations })
      });

      if (response.ok) {
        const { images } = await response.json();

        // Transform to GalleryImage format
        const recommendedGalleryImages: GalleryImage[] = (images || []).map((img: any) => ({
          id: img.id,
          filename: img.filename,
          public_url: img.public_url,
          prompt_text: img.prompt_text,
          description: img.description,
          tags: img.tags || [],
          breed_id: img.breed_id,
          theme_id: img.theme_id,
          style_id: img.style_id,
          format_id: img.format_id,
          rating: img.rating,
          is_featured: img.is_featured,
          created_at: img.created_at,
          interaction_types: [],
          interaction_dates: [],
          breed: img.breeds ? { id: img.breeds.id, name: img.breeds.name } : undefined,
          theme: img.themes ? { id: img.themes.id, name: img.themes.name } : undefined,
          style: img.styles ? { id: img.styles.id, name: img.styles.name } : undefined,
        }));

        setRecommendedImages(recommendedGalleryImages);
      }
    } catch (error) {
      console.error('Error loading recommended images:', error);
      setRecommendedImages([]);
    } finally {
      setLoadingRecommended(false);
    }
  };

  const loadGalleryImages = async () => {
    try {
      // Load user interactions from database (liked and shared images)
      let databaseInteractions: any[] = [];

      // Follow customer API pattern - use email-based authentication
      if (userProfile?.email) {
        console.log('🎨 GALLERY: Loading interactions from database for user:', userProfile.email, 'type:', userProfile.user_type);
        const response = await fetch(`/api/user-interactions?email=${encodeURIComponent(userProfile.email)}`);

        console.log('🎨 GALLERY: User-interactions API response status:', response.status);

        if (response.ok) {
          databaseInteractions = await response.json();
          console.log('🎨 GALLERY: Loaded', databaseInteractions.length, 'interactions from database');

          // Log details of interactions for debugging
          databaseInteractions.forEach((interaction, index) => {
            console.log(`🎨 GALLERY: Interaction ${index + 1}:`, {
              type: interaction.type,
              imageId: interaction.imageId,
              timestamp: interaction.timestamp,
              hasImageData: !!interaction.imageData
            });
          });
        } else {
          const errorText = await response.text();
          console.error('❌ GALLERY: Failed to load database interactions:', response.status, response.statusText, errorText);
        }
      } else {
        console.error('❌ GALLERY: No user email available for database interactions');
      }
      
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
        order_type?: string;
        order_id?: string;
      }

      // Process database interactions (only source for logged-in users)
      console.log('🎨 GALLERY: Processing', databaseInteractions.length, 'database interactions');

      const databaseTempImages: TempGalleryImage[] = databaseInteractions.map(item => ({
        id: item.imageData.id,
        filename: item.imageData.filename,
        public_url: item.imageData.public_url,
        prompt_text: item.imageData.prompt_text,
        description: item.imageData.description,
        tags: item.imageData.tags || [],
        breed_id: item.imageData.breed_id,
        theme_id: item.imageData.theme_id,
        style_id: item.imageData.style_id,
        format_id: item.imageData.format_id,
        rating: item.imageData.rating,
        is_featured: item.imageData.is_featured,
        created_at: item.imageData.created_at,
        interaction_type: item.type, // API returns 'type' not 'interaction_type'
        interaction_date: item.timestamp, // API returns 'timestamp' not 'interaction_date'
        breed: item.imageData.breed,
        theme: item.imageData.theme,
        style: item.imageData.style
      }));

      console.log('🎨 GALLERY: Converted to', databaseTempImages.length, 'temp images with types:',
        databaseTempImages.map(img => img.interaction_type));

      // Load purchased images from orders API if user profile is available
      let purchasedTempImages: TempGalleryImage[] = [];
      if (userProfile?.email) {
        try {
          console.log('Gallery: Loading purchased images for user type:', userProfile.user_type, 'email:', userProfile.email);

          // Use different API endpoints based on user type
          let ordersResponse;
          if (userProfile.user_type === 'partner') {
            console.log('Gallery: Using partner orders API for partner user');
            ordersResponse = await fetch(`/api/partners/orders`);
          } else {
            console.log('Gallery: Using shop orders API for customer user');
            ordersResponse = await fetch(`/api/shop/orders?email=${encodeURIComponent(userProfile.email)}`);
          }

          console.log('Gallery: Orders API response status:', ordersResponse.status);

          if (ordersResponse.ok) {
            const orders = await ordersResponse.json();
            console.log('Gallery: Found orders:', orders?.length || 0);
            
            // Convert order items to temporary gallery images
            if (Array.isArray(orders) && orders.length > 0) {
              console.log('Gallery: Processing orders:', orders.map(o => ({
                id: o.id,
                order_number: o.order_number,
                order_type: o.order_type || 'customer',
                items_count: o.order_items?.length || 0
              })));

              // Get all unique image IDs from orders to fetch catalog data
              const orderImageIds = [...new Set(orders.flatMap((order: any) =>
                order.order_items?.map((item: any) => item.image_id) || []
              ))];

              console.log('Gallery: Fetching catalog data for', orderImageIds.length, 'purchased images');

              // Fetch image catalog data for purchased images via API
              let catalogImageMap = new Map();
              if (orderImageIds.length > 0) {
                try {
                  const response = await fetch('/api/images/catalog', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageIds: orderImageIds })
                  });

                  if (response.ok) {
                    const catalogImages = await response.json();
                    console.log('Gallery: Got catalog data for', catalogImages?.length || 0, 'images');
                    catalogImageMap = new Map(catalogImages?.map((img: any) => [img.id, img]) || []);
                  }
                } catch (error) {
                  console.error('Gallery: Failed to fetch catalog data for purchased images:', error);
                }
              }

              purchasedTempImages = orders.flatMap((order: any) => {
                if (!order.order_items || !Array.isArray(order.order_items)) {
                  console.log('Gallery: Order missing items:', order.id);
                  return [];
                }

                console.log('Gallery: Processing order items:', order.order_items.map((item: any) => ({
                  image_id: item.image_id,
                  image_title: item.image_title,
                  image_url: item.image_url
                })));

                return order.order_items.map((item: any) => {
                  // Get catalog data for this image if available
                  const catalogData = catalogImageMap.get(item.image_id);

                  return {
                    id: item.image_id,
                    filename: item.image_title?.replace(/[^a-zA-Z0-9]/g, '_') + '.jpg' || 'purchase.jpg',
                    public_url: item.image_url,
                    prompt_text: item.image_title || 'Purchased Portrait',
                    description: catalogData?.description || item.image_title || 'Purchased Portrait',
                    tags: ['purchased', order.order_type || 'customer'],
                    breed_id: catalogData?.breed_id,
                    theme_id: catalogData?.theme_id,
                    style_id: catalogData?.style_id,
                    format_id: catalogData?.format_id,
                    rating: catalogData?.rating,
                    is_featured: catalogData?.is_featured || false,
                    created_at: order.created_at,
                    interaction_type: 'purchased' as const,
                    interaction_date: order.created_at,
                    breed: catalogData?.breeds ? {
                      id: catalogData.breeds.id,
                      name: catalogData.breeds.name
                    } : undefined,
                    theme: catalogData?.themes ? {
                      id: catalogData.themes.id,
                      name: catalogData.themes.name
                    } : undefined,
                    style: catalogData?.styles ? {
                      id: catalogData.styles.id,
                      name: catalogData.styles.name
                    } : undefined,
                    // Add order type for display differentiation
                    order_type: order.order_type || 'customer',
                    order_id: order.id
                  };
                });
              }).filter(Boolean); // Remove any null/undefined items

              console.log('Gallery: Created purchased temp images:', purchasedTempImages.length);
            }
          } else {
            console.error('Gallery: Orders API failed:', ordersResponse.status, ordersResponse.statusText);
          }
        } catch (error) {
          console.error('Error loading purchased images from orders:', error);
        }
      } else {
        console.log('Gallery: No user profile email available');
      }

      // Load basket items from cart
      const basketTempImages: TempGalleryImage[] = cartItems.map(cartItem => ({
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

      // Combine all temporary images (database interactions, purchased, and basket)
      const allTempImages = [...databaseTempImages, ...purchasedTempImages, ...basketTempImages];
      
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
            existing.order_type = tempImage.order_type;
            existing.order_id = tempImage.order_id;
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
            style: tempImage.style,
            order_type: tempImage.order_type,
            order_id: tempImage.order_id
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

  // Helper function to extract text between asterisks from description
  const extractDescriptionHighlight = (description: string): string => {
    const match = description.match(/\*\*(.*?)\*\*/);
    return match ? match[1] : description;
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
              <Badge className={`text-xs ${
                image.order_type === 'partner_for_client'
                  ? 'bg-purple-100 text-purple-800'
                  : image.order_type === 'partner'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                💳 {image.order_type === 'partner_for_client'
                  ? 'Partner for Client'
                  : image.order_type === 'partner'
                  ? 'Partner Purchase'
                  : 'Customer Purchase'}
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
            {extractDescriptionHighlight(image.description) || image.prompt_text}
          </h3>


          {/* Interaction dates - only show most recent, avoid duplicate purchase dates */}
          <div className="text-xs text-gray-500 mb-3">
            {image.interaction_dates
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 1) // Only show most recent interaction
              .map((interaction) => (
                <p key={interaction.type}>
                  {interaction.type === 'purchased' && image.order_id ? (
                    <a
                      href={userProfile?.user_type === 'partner'
                        ? `/partners/orders/${image.order_id}`
                        : `/orders/${image.order_id}`}
                      className="text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      Purchased on {new Date(interaction.date).toLocaleDateString()}
                    </a>
                  ) : (
                    <>
                      {interaction.type === 'purchased' ? 'Purchased' :
                       interaction.type === 'liked' ? 'Liked' :
                       interaction.type === 'shared' ? 'Shared' :
                       'Added'} on {new Date(interaction.date).toLocaleDateString()}
                    </>
                  )}
                </p>
              ))
            }
          </div>

          {/* Theme badge as hyperlink */}
          {image.theme && (
            <div className="flex flex-wrap gap-1 mb-3">
              <a
                href={`/browse?theme=${image.theme.id}`}
                className="inline-block"
              >
                <Badge variant="secondary" className="text-xs hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer">
                  🎨 {image.theme.name}
                </Badge>
              </a>
            </div>
          )}

          {/* Additional tags (only relevant descriptive tags) */}
          {image.tags && image.tags.filter(tag => {
            // Exclude technical/system tags and keep only relevant descriptive tags
            const excludedTags = [
              'purchased', 'customer', 'partner', 'partner_for_client',
              'ai-generated', 'generated', 'artificial', 'digital',
              'portrait', 'pet', 'animal', 'image', 'photo', 'picture'
            ];
            return !excludedTags.some(excluded => tag.toLowerCase().includes(excluded.toLowerCase()));
          }).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {image.tags
                .filter(tag => {
                  const excludedTags = [
                    'purchased', 'customer', 'partner', 'partner_for_client',
                    'ai-generated', 'generated', 'artificial', 'digital',
                    'portrait', 'pet', 'animal', 'image', 'photo', 'picture'
                  ];
                  return !excludedTags.some(excluded => tag.toLowerCase().includes(excluded.toLowerCase()));
                })
                .slice(0, 2)
                .map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))
              }
            </div>
          )}

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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
    <CountryProvider>
      <UserAwareNavigation />
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
        <Tabs defaultValue="recommended" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="recommended" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Recommended ({recommendedImages.length})
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Custom ({customImages.length})
            </TabsTrigger>
            <TabsTrigger value="liked" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Liked ({likedImages.length})
            </TabsTrigger>
            <TabsTrigger value="shared" className="flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Shared ({sharedImages.length})
            </TabsTrigger>
            <TabsTrigger value="in_basket" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              In Basket ({basketImages.length})
            </TabsTrigger>
            <TabsTrigger value="purchased" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Purchased ({purchasedImages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recommended" className="space-y-6">
            {userPets.length === 0 ? (
              <Card className="p-8 text-center">
                <CardContent>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Add Your Pets for Personalized Recommendations
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Tell us about your pets to see Pawtraits that match their breed and coat
                  </p>
                  <Button onClick={() => window.location.href = '/customer/pets/add'}>
                    Add Your First Pet
                  </Button>
                </CardContent>
              </Card>
            ) : loadingRecommended ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : recommendedImages.length === 0 ? (
              <Card className="p-8 text-center">
                <CardContent>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Star className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Matching Recommendations Yet
                  </h3>
                  <p className="text-gray-600 mb-4">
                    We're working on creating more Pawtraits for your pets' breeds and coats
                  </p>
                  <Button variant="outline" onClick={() => window.location.href = '/browse'}>
                    Browse All Pawtraits
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {recommendedImages.map((image) => (
                  <ImageCard key={image.id} image={image} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-6">
            {customImages.length === 0 ? (
              <Card className="p-8 text-center">
                <CardContent>
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wand2 className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Custom Pawtraits Yet
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Create custom variations of any Pawtrait from the Browse page
                  </p>
                  <Button variant="outline" onClick={() => window.location.href = '/browse'}>
                    Browse & Customize
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {customImages.map((image) => (
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
    </CountryProvider>
  );
}