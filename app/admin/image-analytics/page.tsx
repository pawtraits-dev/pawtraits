'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Eye, Heart, Share2, ShoppingCart, Search, ArrowUpDown } from 'lucide-react';
import Image from 'next/image';
import { SupabaseService } from '@/lib/supabase';
import { PawSpinner } from '@/components/ui/paw-spinner';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import type { ImageCatalogWithDetails } from '@/lib/types';

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
  popularity_score: number;
  description?: string;
  tags: string[];
  is_featured: boolean;
}

type SortField = 'created_at' | 'views' | 'likes' | 'shares' | 'purchases' | 'popularity_score';
type SortDirection = 'asc' | 'desc';

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
  
  const [breeds, setBreeds] = useState<{id: string, name: string}[]>([]);
  const [themes, setThemes] = useState<{id: string, name: string}[]>([]);

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
      
      // Load image data with relationships using the service method
      console.log('Loading image data...');
      const imageData = await supabaseService.getImages({
        limit: 1000,
        publicOnly: false // Admin can see all images
      }) as ImageCatalogWithDetails[];
      
      console.log(`Loaded ${imageData.length} images from database`);

      // Load user interactions data (handle policy issues gracefully)
      let interactionsData: any[] = [];
      try {
        const { data, error } = await supabaseService.supabase
          .from('user_interactions')
          .select('image_id, interaction_type, COUNT(*)')
          .group(['image_id', 'interaction_type']);

        if (error) {
          console.warn('Interactions error (using fallback):', error.message);
          // Fall back to using the built-in counters from image_catalog
          interactionsData = [];
        } else {
          interactionsData = data || [];
        }
      } catch (err) {
        console.warn('Interactions query failed, using image_catalog counters');
        interactionsData = [];
      }

      // Load order items for purchase data (if table exists)
      let purchaseData: any[] = [];
      try {
        const { data, error } = await supabaseService.supabase
          .from('order_items')
          .select('image_id, COUNT(*)')
          .group(['image_id']);
        
        if (!error) purchaseData = data || [];
      } catch (err) {
        console.warn('Order items table not accessible:', err);
      }

      // Process and combine data
      const processedImages = imageData.map((image: any) => {
        // Use built-in counters from image_catalog if interactions query failed
        let views, likes, shares;
        
        if (interactionsData.length > 0) {
          const interactions = interactionsData.filter((a: any) => a.image_id === image.id) || [];
          views = interactions.find((a: any) => a.interaction_type === 'view')?.count || 0;
          likes = interactions.find((a: any) => a.interaction_type === 'like')?.count || 0;
          shares = interactions.find((a: any) => a.interaction_type === 'share')?.count || 0;
        } else {
          // Fall back to built-in counters
          views = image.view_count || 0;
          likes = image.like_count || 0;
          shares = image.share_count || 0;
        }
        
        const purchases = purchaseData?.find((p: any) => p.image_id === image.id);
        const purchaseCount = purchases?.count || 0;
        
        // Calculate popularity score: (likes × 3) + (shares × 5) + (views × 1) + (purchases × 10)
        const popularityScore = (likes * 3) + (shares * 5) + (views * 1) + (purchaseCount * 10);

        return {
          id: image.id,
          public_url: image.public_url,
          prompt_text: image.prompt_text,
          breed_name: image.breed_name || 'Unknown',
          theme_name: image.theme_name || 'Unknown', 
          style_name: image.style_name || 'Unknown',
          created_at: image.created_at,
          description: image.description,
          tags: image.tags,
          is_featured: image.is_featured,
          views,
          likes,
          shares,
          purchases: purchaseCount,
          popularity_score: popularityScore
        };
      });

      console.log(`Processed ${processedImages.length} images for display`);
      if (processedImages.length > 0) {
        console.log('Sample processed image:', {
          breed_name: processedImages[0].breed_name,
          theme_name: processedImages[0].theme_name,
          views: processedImages[0].views,
          likes: processedImages[0].likes
        });
      }
      
      setImages(processedImages);

      // Load filter options
      const uniqueBreeds = Array.from(new Set(processedImages.map((img: any) => img.breed_name).filter(Boolean))) as string[];
      const uniqueThemes = Array.from(new Set(processedImages.map((img: any) => img.theme_name).filter(Boolean))) as string[];
      
      console.log(`Found ${uniqueBreeds.length} unique breeds:`, uniqueBreeds.slice(0, 5));
      console.log(`Found ${uniqueThemes.length} unique themes:`, uniqueThemes.slice(0, 5));
      
      setBreeds(uniqueBreeds.sort().map((name: string) => ({ id: name, name })));
      setThemes(uniqueThemes.sort().map((name: string) => ({ id: name, name })));

    } catch (error) {
      console.error('Error loading image analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortImages = () => {
    let filtered = [...images];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(image => 
        image.prompt_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        image.breed_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        image.theme_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        image.style_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply breed filter
    if (breedFilter !== 'all') {
      filtered = filtered.filter(image => image.breed_name === breedFilter);
    }

    // Apply theme filter
    if (themeFilter !== 'all') {
      filtered = filtered.filter(image => image.theme_name === themeFilter);
    }

    // Apply featured filter
    if (featuredFilter !== 'all') {
      filtered = filtered.filter(image => 
        featuredFilter === 'featured' ? image.is_featured : 
        featuredFilter === 'not-featured' ? !image.is_featured : true
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredImages(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    return <ArrowUpDown className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <PawSpinner size="xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Image Analytics</h1>
        <p className="text-gray-600 mt-2">
          Analyze performance metrics for generated images
        </p>
      </div>

      {/* Filters and Search */}
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
                  placeholder="Search prompts, breeds, themes..."
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
                    <SelectItem key={breed.id} value={breed.name}>
                      {breed.name}
                    </SelectItem>
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
                    <SelectItem key={theme.id} value={theme.name}>
                      {theme.name}
                    </SelectItem>
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
                  <SelectItem value="purchases">Purchases</SelectItem>
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

      {/* Results Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
      </div>

      {/* Images Table */}
      <Card>
        <CardHeader>
          <CardTitle>Image Performance</CardTitle>
          <CardDescription>
            Images sorted by {sortField.replace('_', ' ')} ({sortDirection === 'desc' ? 'highest first' : 'lowest first'})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredImages.map((image, index) => (
              <div key={image.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start space-x-4">
                  {/* Image */}
                  <div className="flex-shrink-0 w-24 h-24 bg-gray-100 rounded-lg overflow-hidden">
                    <CatalogImage
                      image={{
                        id: image.id,
                        public_url: image.public_url,
                        filename: `${image.id}.jpg`,
                        description: image.description,
                        prompt_text: image.prompt_text,
                        tags: image.tags,
                        is_featured: image.is_featured,
                        created_at: image.created_at,
                        updated_at: image.created_at
                      }}
                      size="small"
                      showWatermark={false}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-900 font-medium truncate max-w-md">
                          {image.prompt_text}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{image.breed_name}</span>
                          <span>•</span>
                          <span>{image.theme_name}</span>
                          <span>•</span>
                          <span>{image.style_name}</span>
                          <span>•</span>
                          <span>{formatDate(image.created_at)}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Badge variant="outline" className="text-purple-600">
                            Score: {image.popularity_score}
                          </Badge>
                          {image.is_featured && (
                            <Badge className="bg-yellow-100 text-yellow-800">
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
                      </div>
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
    </div>
  );
}