'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Heart,
  Star,
  Image as ImageIcon,
  TrendingUp,
  Users,
  RefreshCw,
  Info
} from 'lucide-react';
import Image from 'next/image';

interface ImageData {
  id: string;
  filename: string;
  public_url: string;
  prompt_text: string;
  description?: string;
  tags: string[];
  rating?: number;
  is_featured: boolean;
  created_at: string;
  breed_name: string;
  theme_name: string;
  style_name: string;
  like_count: number;
  share_count: number;
  interaction_summary: string;
}

interface ApiResponse {
  images: ImageData[];
  total_images: number;
  note: string;
  suggestion: string;
}

export default function AdminLikedImagesPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [filteredImages, setFilteredImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data) {
      filterImages();
    }
  }, [data, searchTerm, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/user-interactions?type=liked');
      if (response.ok) {
        const responseData = await response.json();
        setData(responseData);
      }
    } catch (error) {
      console.error('Error loading liked images data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterImages = () => {
    if (!data) return;

    let filtered = [...data.images];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(image => 
        image.prompt_text.toLowerCase().includes(term) ||
        image.description?.toLowerCase().includes(term) ||
        image.breed_name.toLowerCase().includes(term) ||
        image.theme_name.toLowerCase().includes(term) ||
        image.style_name.toLowerCase().includes(term) ||
        image.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Sort images
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'created_at':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'prompt_text':
          return a.prompt_text.localeCompare(b.prompt_text);
        default:
          return 0;
      }
    });

    setFilteredImages(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const stats = {
    totalImages: data?.total_images || 0,
    featuredImages: data?.images.filter(img => img.is_featured).length || 0,
    ratedImages: data?.images.filter(img => img.rating && img.rating > 0).length || 0,
    averageRating: data?.images.length ? 
      data.images.reduce((sum, img) => sum + (img.rating || 0), 0) / data.images.filter(img => img.rating).length || 0 : 0
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Liked Images Analytics</h1>
          <p className="text-gray-600 mt-2">Monitor image popularity and user engagement</p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Info Alert */}
      {data?.note && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-blue-900 font-medium">Implementation Note</p>
                <p className="text-blue-800 text-sm mt-1">{data.note}</p>
                <p className="text-blue-700 text-sm mt-2 font-medium">Suggestion: {data.suggestion}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.totalImages}</p>
                <p className="text-sm text-gray-600">Total Images</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.featuredImages}</p>
                <p className="text-sm text-gray-600">Featured</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.ratedImages}</p>
                <p className="text-sm text-gray-600">Rated Images</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Heart className="w-5 h-5 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search images by prompt, description, breed, theme, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="created_at">Sort by: Newest First</option>
                <option value="rating">Sort by: Highest Rated</option>
                <option value="prompt_text">Sort by: Title A-Z</option>
              </select>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Showing {filteredImages.length} of {data?.total_images || 0}
                </span>
                <Button variant="outline" onClick={() => {
                  setSearchTerm('');
                  setSortBy('created_at');
                }} size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredImages.map((image) => (
          <Card key={image.id} className="group hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-0">
              <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg relative overflow-hidden">
                <Image
                  src={image.public_url}
                  alt={image.prompt_text}
                  width={300}
                  height={300}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                
                {/* Featured badge */}
                {image.is_featured && (
                  <Badge className="absolute top-2 right-2 bg-yellow-500 text-white">
                    <Star className="w-3 h-3 mr-1" />
                    Featured
                  </Badge>
                )}

                {/* Rating */}
                {image.rating && image.rating > 0 && (
                  <Badge className="absolute top-2 left-2 bg-green-500 text-white">
                    ⭐ {image.rating}/5
                  </Badge>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                  {image.prompt_text}
                </h3>
                
                {image.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {image.description}
                  </p>
                )}

                {/* Metadata */}
                <div className="space-y-2 text-xs text-gray-500">
                  <div className="flex items-center justify-between">
                    <span>Breed: {image.breed_name}</span>
                    <span>Theme: {image.theme_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Style: {image.style_name}</span>
                    <span>{formatDate(image.created_at)}</span>
                  </div>
                </div>

                {/* Tags */}
                {image.tags && image.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
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

                {/* Interaction placeholder */}
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-500 text-center">
                  {image.interaction_summary}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredImages.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No images found matching your criteria</p>
        </div>
      )}
    </div>
  );
}