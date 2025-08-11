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

interface ImageAnalytics {
  id: string;
  image_url: string;
  prompt_text: string;
  breed_name: string;
  theme_name: string;
  style_name: string;
  created_at: string;
  views: number;
  likes: number;
  shares: number;
  purchases: number;
  popularity_score: number;
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
  
  const [breeds, setBreeds] = useState<{id: string, name: string}[]>([]);
  const [themes, setThemes] = useState<{id: string, name: string}[]>([]);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterAndSortImages();
  }, [images, searchTerm, sortField, sortDirection, breedFilter, themeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load image analytics data
      const { data: imageData, error: imageError } = await supabaseService.getClient()
        .from('image_catalog')
        .select(`
          id,
          image_url,
          prompt_text,
          created_at,
          breeds!inner(name),
          themes!inner(name),
          styles!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (imageError) throw imageError;

      // Load interaction analytics
      const { data: analyticsData, error: analyticsError } = await supabaseService.getClient()
        .from('interaction_analytics')
        .select('image_id, interaction_type, COUNT(*)')
        .group('image_id, interaction_type');

      if (analyticsError) console.warn('Analytics error:', analyticsError);

      // Load purchase data
      const { data: purchaseData, error: purchaseError } = await supabaseService.getClient()
        .from('order_items')
        .select('image_id, COUNT(*)')
        .group('image_id');

      if (purchaseError) console.warn('Purchase error:', purchaseError);

      // Process and combine data
      const processedImages = imageData.map((image: any) => {
        const analytics = analyticsData?.filter((a: any) => a.image_id === image.id) || [];
        const purchases = purchaseData?.find((p: any) => p.image_id === image.id);
        
        const views = analytics.find((a: any) => a.interaction_type === 'view')?.count || 0;
        const likes = analytics.find((a: any) => a.interaction_type === 'like')?.count || 0;
        const shares = analytics.find((a: any) => a.interaction_type === 'share')?.count || 0;
        const purchaseCount = purchases?.count || 0;
        
        // Calculate popularity score: (likes × 3) + (shares × 5) + (views × 1) + (purchases × 10)
        const popularityScore = (likes * 3) + (shares * 5) + (views * 1) + (purchaseCount * 10);

        return {
          id: image.id,
          image_url: image.image_url,
          prompt_text: image.prompt_text,
          breed_name: image.breeds?.name || 'Unknown',
          theme_name: image.themes?.name || 'Unknown',
          style_name: image.styles?.name || 'Unknown',
          created_at: image.created_at,
          views,
          likes,
          shares,
          purchases: purchaseCount,
          popularity_score: popularityScore
        };
      });

      setImages(processedImages);

      // Load filter options
      const uniqueBreeds = Array.from(new Set(processedImages.map((img: any) => img.breed_name))) as string[];
      const uniqueThemes = Array.from(new Set(processedImages.map((img: any) => img.theme_name))) as string[];
      
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    <Image
                      src={image.image_url}
                      alt="Generated image"
                      width={96}
                      height={96}
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