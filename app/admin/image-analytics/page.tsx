'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, Heart, Share2, ShoppingCart, Search, ArrowUpDown, Edit3, Check, X, ShoppingBag } from 'lucide-react';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import { PawSpinner } from '@/components/ui/paw-spinner';

interface ImageAnalytics {
  id: string;
  public_url: string;
  prompt_text: string;
  breed_name?: string;
  theme_name?: string;
  style_name?: string;
  created_at: string;
  views: number;
  likes: number;
  shares: number;
  purchases: number;
  revenue: number;
  cart_count: number;
  popularity_score: number;
  description?: string;
  tags: string[];
  is_featured: boolean;
}

type SortField = 'created_at' | 'views' | 'likes' | 'shares' | 'purchases' | 'revenue' | 'cart_count' | 'popularity_score';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'individual' | 'by_breed' | 'by_theme' | 'by_product';

interface GroupedAnalytics {
  name: string;
  totalImages: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalPurchases: number;
  totalRevenue: number;
  totalCartCount: number;
  averagePopularity: number;
  topImage?: ImageAnalytics;
}

export default function ImageAnalyticsPage() {
  const [images, setImages] = useState<ImageAnalytics[]>([]);
  const [filteredImages, setFilteredImages] = useState<ImageAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('popularity_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [breedFilter, setBreedFilter] = useState<string>('all');
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [featuredFilter, setFeaturedFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('individual');
  
  const [breeds, setBreeds] = useState<{id: string, name: string}[]>([]);
  const [themes, setThemes] = useState<{id: string, name: string}[]>([]);
  const [allThemes, setAllThemes] = useState<{id: string, name: string}[]>([]);
  const [breedAnalytics, setBreedAnalytics] = useState<GroupedAnalytics[]>([]);
  const [themeAnalytics, setThemeAnalytics] = useState<GroupedAnalytics[]>([]);
  
  // Bulk editing state
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [bulkThemeId, setBulkThemeId] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterAndSortImages();
  }, [images, searchTerm, sortField, sortDirection, breedFilter, themeFilter, featuredFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading image analytics data...');
      
      // Use the dedicated API endpoint following established patterns
      const response = await fetch('/api/admin/image-analytics');
      if (!response.ok) {
        throw new Error('Failed to load image analytics');
      }
      
      const processedImages = await response.json();
      console.log(`Loaded ${processedImages.length} images with analytics`);
      
      setImages(processedImages);

      // Load filter options
      const uniqueBreeds = Array.from(new Set(processedImages.map((img: any) => img.breed_name).filter(Boolean))) as string[];
      const uniqueThemes = Array.from(new Set(processedImages.map((img: any) => img.theme_name).filter(Boolean))) as string[];
      
      setBreeds(uniqueBreeds.map(name => ({ id: name, name })));
      setThemes(uniqueThemes.map(name => ({ id: name, name })));
      setAllThemes(uniqueThemes.map(name => ({ id: name, name })));
      
      // Calculate grouped analytics
      calculateGroupedAnalytics(processedImages);

    } catch (error) {
      console.error('Error loading image analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortImages = () => {
    let filtered = [...images];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(image => 
        image.prompt_text?.toLowerCase().includes(term) ||
        image.breed_name?.toLowerCase().includes(term) ||
        image.theme_name?.toLowerCase().includes(term) ||
        image.style_name?.toLowerCase().includes(term)
      );
    }

    // Breed filter
    if (breedFilter !== 'all') {
      filtered = filtered.filter(image => image.breed_name === breedFilter);
    }

    // Theme filter
    if (themeFilter !== 'all') {
      filtered = filtered.filter(image => image.theme_name === themeFilter);
    }

    // Featured filter
    if (featuredFilter !== 'all') {
      const showFeatured = featuredFilter === 'featured';
      filtered = filtered.filter(image => image.is_featured === showFeatured);
    }

    // Sort images
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle string sorting for dates and names
      if (sortField === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredImages(filtered);
  };

  const calculateGroupedAnalytics = (imageData: ImageAnalytics[]) => {
    // Calculate breed analytics
    const breedGroups = imageData.reduce((acc, image) => {
      const breedName = image.breed_name || 'Unknown';
      if (!acc[breedName]) {
        acc[breedName] = [];
      }
      acc[breedName].push(image);
      return acc;
    }, {} as Record<string, ImageAnalytics[]>);

    const breedStats = Object.entries(breedGroups).map(([name, images]) => ({
      name,
      totalImages: images.length,
      totalViews: images.reduce((sum, img) => sum + img.views, 0),
      totalLikes: images.reduce((sum, img) => sum + img.likes, 0),
      totalShares: images.reduce((sum, img) => sum + img.shares, 0),
      totalPurchases: images.reduce((sum, img) => sum + img.purchases, 0),
      totalRevenue: images.reduce((sum, img) => sum + img.revenue, 0),
      totalCartCount: images.reduce((sum, img) => sum + img.cart_count, 0),
      averagePopularity: images.reduce((sum, img) => sum + img.popularity_score, 0) / images.length,
      topImage: images.sort((a, b) => b.popularity_score - a.popularity_score)[0]
    })).sort((a, b) => b.averagePopularity - a.averagePopularity);

    // Calculate theme analytics
    const themeGroups = imageData.reduce((acc, image) => {
      const themeName = image.theme_name || 'Unknown';
      if (!acc[themeName]) {
        acc[themeName] = [];
      }
      acc[themeName].push(image);
      return acc;
    }, {} as Record<string, ImageAnalytics[]>);

    const themeStats = Object.entries(themeGroups).map(([name, images]) => ({
      name,
      totalImages: images.length,
      totalViews: images.reduce((sum, img) => sum + img.views, 0),
      totalLikes: images.reduce((sum, img) => sum + img.likes, 0),
      totalShares: images.reduce((sum, img) => sum + img.shares, 0),
      totalPurchases: images.reduce((sum, img) => sum + img.purchases, 0),
      totalRevenue: images.reduce((sum, img) => sum + img.revenue, 0),
      totalCartCount: images.reduce((sum, img) => sum + img.cart_count, 0),
      averagePopularity: images.reduce((sum, img) => sum + img.popularity_score, 0) / images.length,
      topImage: images.sort((a, b) => b.popularity_score - a.popularity_score)[0]
    })).sort((a, b) => b.averagePopularity - a.averagePopularity);

    setBreedAnalytics(breedStats);
    setThemeAnalytics(themeStats);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <div className="text-center">
          <PawSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading image analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Image Analytics</h1>
          <p className="text-gray-600 mt-2">
            Track performance metrics for AI-generated images
          </p>
        </div>
        
        <Select value={viewMode} onValueChange={(value: ViewMode) => setViewMode(value)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Individual Images</SelectItem>
            <SelectItem value="by_breed">Group by Breed</SelectItem>
            <SelectItem value="by_theme">Group by Theme</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filters and Search */}
      {viewMode === 'individual' && (
        <Card>
          <CardHeader>
            <CardTitle>Filters & Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search images..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Breed</label>
                <Select value={breedFilter} onValueChange={setBreedFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Breeds</SelectItem>
                    {breeds.map(breed => (
                      <SelectItem key={breed.id} value={breed.name}>{breed.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Theme</label>
                <Select value={themeFilter} onValueChange={setThemeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Themes</SelectItem>
                    {themes.map(theme => (
                      <SelectItem key={theme.id} value={theme.name}>{theme.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Featured</label>
                <Select value={featuredFilter} onValueChange={setFeaturedFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Images</SelectItem>
                    <SelectItem value="featured">Featured Only</SelectItem>
                    <SelectItem value="not-featured">Not Featured</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortField} onValueChange={(value: SortField) => setSortField(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popularity_score">Popularity Score</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="purchases">Purchases</SelectItem>
                    <SelectItem value="cart_count">Added to Cart</SelectItem>
                    <SelectItem value="likes">Likes</SelectItem>
                    <SelectItem value="shares">Shares</SelectItem>
                    <SelectItem value="views">Views</SelectItem>
                    <SelectItem value="created_at">Date Created</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {viewMode === 'individual' && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{filteredImages.length}</div>
              <div className="text-sm text-gray-600">Total Images</div>
            </CardContent>
          </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {filteredImages.reduce((sum, img) => sum + img.views, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Views</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {filteredImages.reduce((sum, img) => sum + img.likes, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Likes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {filteredImages.reduce((sum, img) => sum + img.shares, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Shares</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {filteredImages.reduce((sum, img) => sum + img.purchases, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Purchases</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <ShoppingBag className="w-5 h-5 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">
                {filteredImages.reduce((sum, img) => sum + img.cart_count, 0).toLocaleString()}
              </div>
            </div>
            <div className="text-sm text-gray-600">Added to Cart</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">
              £{filteredImages.reduce((sum, img) => sum + img.revenue, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-600">Total Revenue</div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Breed Analytics */}
      {viewMode === 'by_breed' && (
        <Card>
          <CardHeader>
            <CardTitle>Breed Performance Analytics</CardTitle>
            <CardDescription>Performance metrics grouped by dog breed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {breedAnalytics.map((breed, index) => (
                <div key={breed.name} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    {/* Top Image Thumbnail */}
                    {breed.topImage && (
                      <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={breed.topImage.public_url}
                          alt={breed.topImage.prompt_text || 'Image'}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          #{index + 1} {breed.name}
                        </h3>
                        <Badge variant="outline">
                          {breed.totalImages} image{breed.totalImages !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">{breed.totalViews.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">Views</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 col-span-1 md:col-span-4">
                          <div className="flex items-center space-x-1 text-blue-600">
                            <Eye className="w-4 h-4" />
                            <span>{breed.totalViews.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-red-600">
                            <Heart className="w-4 h-4" />
                            <span>{breed.totalLikes.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-green-600">
                            <Share2 className="w-4 h-4" />
                            <span>{breed.totalShares.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-orange-600">
                            <ShoppingCart className="w-4 h-4" />
                            <span>{breed.totalPurchases.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-yellow-600">
                            <ShoppingBag className="w-4 h-4" />
                            <span>{breed.totalCartCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-emerald-600">
                            <span className="font-medium">£{breed.totalRevenue.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Analytics */}
      {viewMode === 'by_theme' && (
        <Card>
          <CardHeader>
            <CardTitle>Theme Performance Analytics</CardTitle>
            <CardDescription>Performance metrics grouped by artistic theme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {themeAnalytics.map((theme, index) => (
                <div key={theme.name} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    {/* Top Image Thumbnail */}
                    {theme.topImage && (
                      <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={theme.topImage.public_url}
                          alt={theme.topImage.prompt_text || 'Image'}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          #{index + 1} {theme.name}
                        </h3>
                        <Badge variant="outline">
                          {theme.totalImages} image{theme.totalImages !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">{theme.totalViews.toLocaleString()}</div>
                          <div className="text-sm text-gray-500">Views</div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 col-span-1 md:col-span-4">
                          <div className="flex items-center space-x-1 text-blue-600">
                            <Eye className="w-4 h-4" />
                            <span>{theme.totalViews.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-red-600">
                            <Heart className="w-4 h-4" />
                            <span>{theme.totalLikes.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-green-600">
                            <Share2 className="w-4 h-4" />
                            <span>{theme.totalShares.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-orange-600">
                            <ShoppingCart className="w-4 h-4" />
                            <span>{theme.totalPurchases.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-yellow-600">
                            <ShoppingBag className="w-4 h-4" />
                            <span>{theme.totalCartCount.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-1 text-emerald-600">
                            <span className="font-medium">£{theme.totalRevenue.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Images Grid */}
      {viewMode === 'individual' && (
        <Card>
          <CardHeader>
            <CardTitle>Image Performance</CardTitle>
            <CardDescription>Individual image analytics and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredImages.map((image, index) => (
                <div key={image.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative">
                    <Image
                      src={image.public_url}
                      alt={image.prompt_text || 'AI Generated Image'}
                      width={300}
                      height={300}
                      className="w-full h-48 object-cover"
                    />
                    {image.is_featured && (
                      <Badge className="absolute top-2 right-2 bg-yellow-500 text-yellow-900">
                        Featured
                      </Badge>
                    )}
                  </div>
                  
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 line-clamp-2">{image.prompt_text}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">{image.breed_name}</Badge>
                        <Badge variant="outline" className="text-xs">{image.theme_name}</Badge>
                        {image.is_featured && (
                          <Badge className="text-xs bg-yellow-100 text-yellow-800">
                            Featured
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Metrics */}
                    <div className="flex items-center space-x-6 text-sm">
                      <div className="flex items-center space-x-1 text-blue-600">
                        <Eye className="w-4 h-4" />
                        <span>{image.views}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-red-600">
                        <Heart className="w-4 h-4" />
                        <span>{image.likes}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-green-600">
                        <Share2 className="w-4 h-4" />
                        <span>{image.shares}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-orange-600">
                        <ShoppingCart className="w-4 h-4" />
                        <span>{image.purchases}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-yellow-600">
                        <ShoppingBag className="w-4 h-4" />
                        <span>{image.cart_count}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-emerald-600">
                        <span className="font-medium">£{image.revenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredImages.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No images match your current filters</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}