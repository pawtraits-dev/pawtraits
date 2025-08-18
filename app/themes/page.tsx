'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Heart, 
  Share2, 
  ShoppingCart, 
  Sparkles, 
  ArrowRight,
  ArrowLeft,
  Palette
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import PublicNavigation from '@/components/PublicNavigation';

interface Theme {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  animal_type: string;
}

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

export default function ThemesPage() {
  const router = useRouter();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadThemes();
    loadGalleryImages();
  }, []);

  const loadThemes = async () => {
    try {
      const themesData = await supabaseService.getThemes();
      setThemes(themesData.filter(theme => theme.is_active));
    } catch (error) {
      console.error('Error loading themes:', error);
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
    } finally {
      setLoading(false);
    }
  };

  const getImagesForTheme = (themeId: string) => {
    return images.filter(img => img.theme_id === themeId).slice(0, 3);
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
              <span className="font-[family-name:var(--font-margarine)] text-purple-600">Artistic</span> Themes
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Explore our diverse collection of artistic themes and styles. From classical Renaissance to modern abstract, 
              find the perfect artistic expression for your pet's personality.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                size="lg"
                onClick={() => router.push('/customer/shop')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Palette className="w-5 h-5 mr-2" />
                Start Creating
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/customer/gallery')}
              >
                View Gallery
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Themes Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-margarine)]">
              Available Themes
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose from our carefully curated collection of artistic themes and styles
            </p>
          </div>

          {themes.length === 0 ? (
            <div className="text-center py-12">
              <Palette className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Themes coming soon...</p>
            </div>
          ) : (
            <div className="space-y-12">
              {themes.map((theme) => {
                const themeImages = getImagesForTheme(theme.id);
                
                return (
                  <div key={theme.id} className="border-b border-gray-200 pb-12 last:border-b-0">
                    <div className="mb-8">
                      <div className="flex items-center space-x-3 mb-4">
                        <Palette className="w-8 h-8 text-purple-600" />
                        <h3 className="text-3xl font-bold text-gray-900 font-[family-name:var(--font-margarine)]">
                          {theme.name}
                        </h3>
                        <Badge variant="outline" className="ml-2">
                          {theme.animal_type === 'both' ? 'Dogs & Cats' : theme.animal_type.charAt(0).toUpperCase() + theme.animal_type.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-lg text-gray-600 max-w-3xl">
                        {theme.description}
                      </p>
                    </div>

                    {themeImages.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {themeImages.map((image) => (
                          <Card key={image.id} className="group hover:shadow-lg transition-all duration-300 overflow-hidden">
                            <div className="relative aspect-square">
                              <CatalogImage
                                imageId={image.id}
                                alt={image.prompt_text}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              {image.is_featured && (
                                <div className="absolute top-4 left-4">
                                  <Badge className="bg-purple-100 text-purple-800">
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    Featured
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{image.prompt_text}</h4>
                              <div className="flex items-center justify-between">
                                <div className="flex space-x-1">
                                  {image.breed && (
                                    <Badge variant="outline" className="text-xs">{image.breed.name}</Badge>
                                  )}
                                  {image.style && (
                                    <Badge variant="outline" className="text-xs">{image.style.name}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Heart className="w-4 h-4 text-gray-400 hover:text-red-500 transition-colors cursor-pointer" />
                                  <Share2 className="w-4 h-4 text-gray-400 hover:text-blue-500 transition-colors cursor-pointer" />
                                  <ShoppingCart className="w-4 h-4 text-gray-400 hover:text-green-500 transition-colors cursor-pointer" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Palette className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No images available for this theme yet</p>
                      </div>
                    )}

                    <div className="text-center mt-6">
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/customer/shop?theme=${theme.id}`)}
                      >
                        Create with {theme.name} Theme
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-center mt-12">
            <Button 
              size="lg"
              onClick={() => router.push('/customer/gallery')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              View All Portraits
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}