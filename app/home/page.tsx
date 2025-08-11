'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Heart, Search, Filter, Star, Palette, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import type { Breed, Coat } from '@/lib/types';

interface UserPet {
  pet_id: string;
  name: string;
  breed_id: string;
  breed_name: string;
  breed_slug: string;
  coat_id: string;
  coat_name: string;
  coat_hex_color: string;
  primary_photo_url: string | null;
}

interface PortraitStyle {
  id: string;
  name: string;
  description: string;
  preview_url?: string;
  price: number;
  category?: string;
  theme_id?: string;
  style_id?: string;
  is_active?: boolean;
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === 'true';
  const discount = searchParams.get('discount');
  
  const [user, setUser] = useState<any>(null);
  const [userPets, setUserPets] = useState<UserPet[]>([]);
  const [loading, setLoading] = useState(true);
  const [portraitStyles, setPortraitStyles] = useState<PortraitStyle[]>([]);
  const [filteredStyles, setFilteredStyles] = useState<PortraitStyle[]>([]);
  const [selectedBreed, setSelectedBreed] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadUserData();
    loadPortraitStyles();
  }, []);

  useEffect(() => {
    // Auto-filter by user's pet breed on first load
    if (userPets.length > 0 && selectedBreed === 'all' && !searchQuery && !showFilters) {
      const primaryPet = userPets[0];
      setSelectedBreed(primaryPet.breed_slug || 'all');
    }
  }, [userPets, selectedBreed, searchQuery, showFilters]);

  useEffect(() => {
    filterPortraitStyles();
  }, [selectedBreed, selectedCategory, searchQuery, portraitStyles]);

  const loadUserData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        setUser(currentUser);
        
        // Load user's pets
        const { data: pets, error } = await supabase
          .rpc('get_user_pets', { user_uuid: currentUser.id });
        
        if (!error && pets) {
          setUserPets(pets);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPortraitStyles = async () => {
    try {
      console.log('Loading portrait styles...');
      // Load both styles and themes to create combined portrait options
      const [
        { data: stylesData },
        { data: themesData }
      ] = await Promise.all([
        supabase.from('styles').select('*'),
        supabase.from('themes').select('*')
      ]);

      console.log('Styles data:', stylesData);
      console.log('Themes data:', themesData);

      const combinedStyles: PortraitStyle[] = [];

      // Add styles
      if (stylesData) {
        stylesData.forEach((style: any) => {
          if (style.is_active !== false) {
            combinedStyles.push({
              id: `style-${style.id}`,
              name: style.name,
              description: style.description || `${style.name} portrait style`,
              preview_url: style.preview_url,
              price: style.price || 39.99,
              category: 'Style',
              style_id: style.id,
              is_active: style.is_active
            });
          }
        });
      }

      // Add themes
      if (themesData) {
        themesData.forEach((theme: any) => {
          if (theme.is_active !== false) {
            combinedStyles.push({
              id: `theme-${theme.id}`,
              name: theme.name,
              description: theme.description || `${theme.name} themed portrait`,
              preview_url: theme.preview_url,
              price: theme.price || 44.99,
              category: 'Theme',
              theme_id: theme.id,
              is_active: theme.is_active
            });
          }
        });
      }

      console.log('Combined styles:', combinedStyles);
      setPortraitStyles(combinedStyles);
    } catch (error) {
      console.error('Error loading portrait styles:', error);
      // Set empty array on error
      setPortraitStyles([]);
    }
  };

  const filterPortraitStyles = () => {
    let filtered = [...portraitStyles];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(style =>
        style.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        style.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        style.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(style => style.category === selectedCategory);
    }

    // Breed filter - for now, show all styles but could implement breed-specific recommendations
    // if (selectedBreed !== 'all') {
    //   filtered = filtered.filter(style => 
    //     style.breed_compatible.length === 0 || 
    //     style.breed_compatible.includes(selectedBreed)
    //   );
    // }

    setFilteredStyles(filtered);
  };

  const clearFilters = () => {
    setSelectedBreed('all');
    setSelectedCategory('all');
    setSearchQuery('');
    setShowFilters(false);
  };

  const categories = Array.from(new Set(portraitStyles.map(style => style.category).filter(Boolean)));
  const breeds = Array.from(new Set(userPets.map(pet => ({ id: pet.breed_slug, name: pet.breed_name }))));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Heart className="w-8 h-8 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {isWelcome ? `Welcome to Pawtraits${user?.user_metadata?.first_name ? `, ${user.user_metadata.first_name}` : ''}!` : 'Pawtraits'}
                </h1>
                {userPets.length > 0 && (
                  <p className="text-gray-600">
                    Create beautiful portraits for {userPets.map(pet => pet.name).join(', ')}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {discount && (
                <Badge className="bg-green-100 text-green-800 px-3 py-1">
                  {discount}% Off Applied!
                </Badge>
              )}
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-800">
                My Account
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome Message */}
        {isWelcome && (
          <Card className="mb-8 border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Star className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-purple-900 mb-2">
                    Your account has been created successfully!
                  </h2>
                  <p className="text-purple-700">
                    {userPets.length > 0 
                      ? `We've curated portrait styles perfect for ${userPets[0].breed_name} breeds. Explore all styles below or browse by category.`
                      : 'Explore our collection of AI-generated portrait styles to create the perfect artwork for your pet.'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pet Summary */}
        {userPets.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Pets</h2>
            <div className="flex flex-wrap gap-4">
              {userPets.map((pet) => (
                <Card key={pet.pet_id} className="w-fit">
                  <CardContent className="p-4 flex items-center space-x-3">
                    {pet.primary_photo_url ? (
                      <Image
                        src={pet.primary_photo_url}
                        alt={pet.name}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                        <Heart className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{pet.name}</p>
                      <p className="text-sm text-gray-600">{pet.breed_name}</p>
                      {pet.coat_name && (
                        <div className="flex items-center space-x-1 mt-1">
                          {pet.coat_hex_color && (
                            <div 
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: pet.coat_hex_color }}
                            />
                          )}
                          <span className="text-xs text-gray-500">{pet.coat_name}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search portrait styles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center space-x-2"
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
              </Button>
              
              {(selectedBreed !== 'all' || selectedCategory !== 'all' || searchQuery) && (
                <Button variant="ghost" onClick={clearFilters} size="sm">
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {showFilters && (
            <Card className="mt-4">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(category => category ? (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ) : null)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {breeds.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Breed
                      </label>
                      <Select value={selectedBreed} onValueChange={setSelectedBreed}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Breeds" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Breeds</SelectItem>
                          {breeds.map(breed => (
                            <SelectItem key={breed.id} value={breed.id}>
                              {breed.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Portrait Styles Grid */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Portrait Styles
              {selectedBreed !== 'all' && breeds.find(b => b.id === selectedBreed) && (
                <span className="text-lg font-normal text-gray-600 ml-2">
                  for {breeds.find(b => b.id === selectedBreed)?.name}
                </span>
              )}
            </h2>
            <p className="text-gray-600">
              {filteredStyles.length} style{filteredStyles.length !== 1 ? 's' : ''} available
            </p>
          </div>

          {filteredStyles.length === 0 ? (
            <Card className="p-8 text-center">
              <CardContent>
                <Palette className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No styles found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search or filter criteria.
                </p>
                <Button onClick={clearFilters} variant="outline">
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStyles.map((style) => (
                <Card key={style.id} className="group hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-0">
                    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg flex items-center justify-center relative overflow-hidden">
                      {style.preview_url ? (
                        <Image
                          src={style.preview_url}
                          alt={style.name}
                          width={300}
                          height={300}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center">
                          <Palette className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">{style.name}</p>
                        </div>
                      )}
                      
                      {/* Category badge */}
                      {style.category && (
                        <Badge className="absolute top-2 left-2 bg-white/90 text-gray-700">
                          {style.category}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">{style.name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{style.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-gray-900">
                          ${discount ? (style.price * (1 - parseInt(discount) / 100)).toFixed(2) : style.price}
                          {discount && (
                            <span className="text-sm font-normal text-gray-500 line-through ml-2">
                              ${style.price}
                            </span>
                          )}
                        </div>
                        
                        <Button size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600">
                          Create Portrait
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}