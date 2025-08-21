'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Users, ArrowRight, Heart, Star, Gift, Search, ShoppingCart, Filter } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { Breed, Coat, Theme, ImageCatalogWithDetails, AnimalType } from '@/lib/types';

export default function PublicHomepage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [animalType, setAnimalType] = useState<AnimalType | 'all'>('all');
  const [selectedBreed, setSelectedBreed] = useState('all');
  const [selectedCoat, setSelectedCoat] = useState('all');
  const [selectedTheme, setSelectedTheme] = useState('all');
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [coats, setCoats] = useState<Coat[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<string[]>([]);

  // Create supabase client instance  
  const supabase = getSupabaseClient();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadImages();
  }, [searchTerm, animalType, selectedBreed, selectedCoat, selectedTheme]);

  const loadData = async () => {
    try {
      const [
        { data: breedsData },
        { data: coatsData },
        { data: themesData }
      ] = await Promise.all([
        supabase.from('breeds').select('*'),
        supabase.from('coats').select('*'),
        supabase.from('themes').select('*')
      ]);
      
      setBreeds(breedsData?.filter((b: any) => b.is_active) || []);
      setCoats(coatsData?.filter((c: any) => c.is_active) || []);
      setThemes(themesData?.filter((t: any) => t.is_active) || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  // Reset breed and coat when animal type changes
  useEffect(() => {
    if (animalType !== 'all') {
      setSelectedBreed('all');
      setSelectedCoat('all');
    }
  }, [animalType]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const filters = {
        search: searchTerm,
        breed_id: selectedBreed && selectedBreed !== 'all' ? selectedBreed : undefined,
        coat_id: selectedCoat && selectedCoat !== 'all' ? selectedCoat : undefined,  
        theme_id: selectedTheme && selectedTheme !== 'all' ? selectedTheme : undefined
      };

      // Build the query
      let query = supabase
        .from('image_catalog')
        .select(`
          *,
          breeds(name),
          coats(name, hex_color),
          themes(name)
        `)
        .eq('is_public', true);

      // Apply filters
      if (filters.search) {
        query = query.or(`prompt_text.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters.breed_id) {
        query = query.eq('breed_id', filters.breed_id);
      }
      if (filters.coat_id) {
        query = query.eq('coat_id', filters.coat_id);
      }
      if (filters.theme_id) {
        query = query.eq('theme_id', filters.theme_id);
      }

      const { data: imagesData } = await query.limit(12);
      setImages(imagesData || []);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (imageId: string) => {
    setCart(prev => [...prev, imageId]);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAnimalType('all');
    setSelectedBreed('all');
    setSelectedCoat('all');
    setSelectedTheme('all');
  };

  // Get filtered breeds and coats based on animal type
  const filteredBreeds = animalType === 'all' ? breeds : breeds.filter(b => b.animal_type === animalType);
  const filteredCoats = animalType === 'all' ? coats : coats.filter(c => c.animal_type === animalType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              🎨 Pawtraits
            </h1>
            <p className="text-xl md:text-2xl text-purple-100 mb-8">
              Perfect
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/auth/login">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 px-8">
                  <Camera className="w-5 h-5 mr-2" />
                  Sign In
                </Button>
              </Link>
              <Link href="/signup/user">
                <Button size="lg" variant="outline" className="border-white text-purple-600 hover:bg-white hover:text-purple-600 px-8">
                  <Users className="w-5 h-5 mr-2" />
                  Create Account
                </Button>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">AI-Powered Portraits</h3>
              <p className="text-purple-100 text-sm">Transform photos into stunning artwork</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Professional Quality</h3>
              <p className="text-purple-100 text-sm">High-resolution, print-ready results</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="font-semibold mb-2">Perfect Gifts</h3>
              <p className="text-purple-100 text-sm">Unique keepsakes for pet lovers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Catalog Browse Section */}
      <div className="py-16 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Browse Our Gallery</h2>
            <p className="text-gray-600 mb-8">Explore amazing pet portraits created by our AI</p>
            
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Animal</label>
                  <Select value={animalType} onValueChange={(value: AnimalType | 'all') => setAnimalType(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All animals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All animals</SelectItem>
                      <SelectItem value="dog">🐕 Dogs</SelectItem>
                      <SelectItem value="cat">🐱 Cats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Breed</label>
                  <Select value={selectedBreed} onValueChange={setSelectedBreed}>
                    <SelectTrigger>
                      <SelectValue placeholder="All breeds" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All breeds</SelectItem>
                      {filteredBreeds.map(breed => (
                        <SelectItem key={breed.id} value={breed.id}>{breed.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Coat</label>
                  <Select value={selectedCoat} onValueChange={setSelectedCoat}>
                    <SelectTrigger>
                      <SelectValue placeholder="All coats" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All coats</SelectItem>
                      {filteredCoats.map(coat => (
                        <SelectItem key={coat.id} value={coat.id}>{coat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                  <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                    <SelectTrigger>
                      <SelectValue placeholder="All themes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All themes</SelectItem>
                      {themes.map(theme => (
                        <SelectItem key={theme.id} value={theme.id}>{theme.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={clearFilters} variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* Image Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-lg aspect-square animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {images.map(image => (
                <Card key={image.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square relative">
                    {image.public_url ? (
                      <img 
                        src={image.public_url} 
                        alt={image.prompt_text || 'Pet portrait'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <Camera className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-sm mb-2">{image.prompt_text || 'Untitled'}</h3>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        {image.breed_name && (
                          <span className="bg-gray-100 px-2 py-1 rounded">{image.breed_name}</span>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => addToCart(image.id)}
                        disabled={cart.includes(image.id)}
                      >
                        <ShoppingCart className="w-4 h-4 mr-1" />
                        {cart.includes(image.id) ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {images.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No images found matching your criteria.</p>
            </div>
          )}

          {/* View All CTA */}
          <div className="text-center mt-12">
            <Link href="/catalog">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                View Full Catalog
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Partner CTA Section */}
      <div className="bg-green-50 py-16 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Become a Partner</h2>
          <p className="text-gray-600 mb-8">
            Join our network of pet professionals and earn commissions by referring customers
          </p>
          <Link href="/signup/partner">
            <Button size="lg" className="bg-green-600 hover:bg-green-700">
              <Users className="w-5 h-5 mr-2" />
              Partner With Us
            </Button>
          </Link>
        </div>
      </div>

      {/* Shopping Cart Indicator */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 right-4">
          <Link href="/auth/login">
            <Button className="bg-purple-600 hover:bg-purple-700 rounded-full p-4">
              <ShoppingCart className="w-6 h-6 mr-2" />
              {cart.length}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}