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
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';

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
    animal_type: string;
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

export default function CatsPage() {
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadCatImages();
  }, []);

  const loadCatImages = async () => {
    try {
      const response = await fetch('/api/gallery/images');
      if (response.ok) {
        const data = await response.json();
        // Filter for cat images only
        const catImages = (data.images || []).filter((img: GalleryImage) => 
          img.breed?.animal_type === 'cat' || 
          img.tags?.includes('cat')
        );
        setImages(catImages);
      }
    } catch (error) {
      console.error('Error loading cat images:', error);
    } finally {
      setLoading(false);
    }
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
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-600" />
              <span className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-margarine)]">PawTraits</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <Link href="/cart">
                <ShoppingCart className="w-6 h-6 text-gray-700 hover:text-purple-600 transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              <span className="font-[family-name:var(--font-margarine)] text-purple-600">Cat</span> Portraits
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Honor your feline friend with elegant AI-generated portraits. From playful kittens to regal cats, 
              capture their independent spirit and mysterious charm.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                size="lg"
                onClick={() => router.push('/customer/shop')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Heart className="w-5 h-5 mr-2" />
                Create Cat Portrait
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => router.push('/dogs')}
              >
                View Dog Portraits
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4 font-[family-name:var(--font-margarine)]">
              Elegant Cat Portraits
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Browse our collection of AI-generated cat portraits showcasing feline grace and beauty
            </p>
          </div>

          {images.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Cat portraits coming soon...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {images.map((image) => (
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
                    <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{image.prompt_text}</h3>
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