'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  GripVertical,
  Search,
  Palette,
  Dog,
  Cat,
  Check,
  X
} from 'lucide-react';
import { 
  Carousel,
  CarouselContentWithDetails,
  Theme,
  Breed,
  CarouselContentFormData
} from '@/lib/carousel-types';

interface ContentPageProps {
  params: { id: string };
}

export default function CarouselContentPage({ params }: ContentPageProps) {
  const router = useRouter();
  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [currentContent, setCurrentContent] = useState<CarouselContentWithDetails[]>([]);
  const [availableThemes, setAvailableThemes] = useState<Theme[]>([]);
  const [availableDogBreeds, setAvailableDogBreeds] = useState<Breed[]>([]);
  const [availableCatBreeds, setAvailableCatBreeds] = useState<Breed[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'themes' | 'dogs' | 'cats'>('themes');
  
  // Form state
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [selectedDogBreeds, setSelectedDogBreeds] = useState<string[]>([]);
  const [selectedCatBreeds, setSelectedCatBreeds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [params.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load carousel info
      const carouselResponse = await fetch(`/api/admin/carousels/${params.id}`);
      if (!carouselResponse.ok) throw new Error('Failed to load carousel');
      
      const carouselData = await carouselResponse.json();
      setCarousel(carouselData.carousel);

      // Load content and available options
      const contentResponse = await fetch(`/api/admin/carousel-content?carousel_id=${params.id}`);
      if (!contentResponse.ok) throw new Error('Failed to load carousel content');
      
      const contentData = await contentResponse.json();
      setCurrentContent(contentData.content || []);
      setAvailableThemes(contentData.available_themes || []);
      setAvailableDogBreeds(contentData.available_dog_breeds || []);
      setAvailableCatBreeds(contentData.available_cat_breeds || []);

      // Set current selections
      const themeSelections = contentData.content
        ?.filter((c: CarouselContentWithDetails) => c.content_type === 'theme')
        .map((c: CarouselContentWithDetails) => c.content_id) || [];
      const dogBreedSelections = contentData.content
        ?.filter((c: CarouselContentWithDetails) => c.content_type === 'dog_breed')
        .map((c: CarouselContentWithDetails) => c.content_id) || [];
      const catBreedSelections = contentData.content
        ?.filter((c: CarouselContentWithDetails) => c.content_type === 'cat_breed')
        .map((c: CarouselContentWithDetails) => c.content_id) || [];

      setSelectedThemes(themeSelections);
      setSelectedDogBreeds(dogBreedSelections);
      setSelectedCatBreeds(catBreedSelections);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const formData: CarouselContentFormData = {
        carousel_id: params.id,
        selected_themes: selectedThemes,
        selected_dog_breeds: selectedDogBreeds,
        selected_cat_breeds: selectedCatBreeds
      };

      const response = await fetch('/api/admin/carousel-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save carousel content');
      
      const result = await response.json();
      setCurrentContent(result.content || []);
      
      // Show success feedback
      const originalText = 'Save Configuration';
      setSaving(false);
      // You could add a toast notification here
      
    } catch (err) {
      console.error('Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  const toggleThemeSelection = (themeId: string) => {
    setSelectedThemes(prev => 
      prev.includes(themeId) 
        ? prev.filter(id => id !== themeId)
        : [...prev, themeId]
    );
  };

  const toggleDogBreedSelection = (breedId: string) => {
    setSelectedDogBreeds(prev => 
      prev.includes(breedId) 
        ? prev.filter(id => id !== breedId)
        : [...prev, breedId]
    );
  };

  const toggleCatBreedSelection = (breedId: string) => {
    setSelectedCatBreeds(prev => 
      prev.includes(breedId) 
        ? prev.filter(id => id !== breedId)
        : [...prev, breedId]
    );
  };

  const filterItems = (items: (Theme | Breed)[], term: string) => {
    if (!term.trim()) return items;
    return items.filter(item => 
      item.name.toLowerCase().includes(term.toLowerCase()) ||
      item.description?.toLowerCase().includes(term.toLowerCase())
    );
  };

  const renderContentCard = (item: Theme | Breed, isSelected: boolean, onToggle: () => void) => {
    const isTheme = 'color_palette' in item;
    const isBreed = 'animal_type' in item;
    
    return (
      <Card 
        key={item.id} 
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
        }`}
        onClick={onToggle}
      >
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            {/* Hero Image */}
            <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
              {item.hero_image_url ? (
                <img
                  src={item.hero_image_url}
                  alt={item.hero_image_alt || item.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  {isTheme ? <Palette className="w-6 h-6 text-gray-400" /> : 
                   isBreed && (item as Breed).animal_type === 'dog' ? <Dog className="w-6 h-6 text-gray-400" /> :
                   <Cat className="w-6 h-6 text-gray-400" />}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  
                  {/* Metadata badges */}
                  <div className="flex items-center space-x-2 mt-2">
                    {isTheme && (
                      <Badge variant="outline" className="text-xs">
                        <Palette className="w-3 h-3 mr-1" />
                        Theme
                      </Badge>
                    )}
                    {isBreed && (
                      <Badge variant="outline" className="text-xs">
                        {(item as Breed).animal_type === 'dog' ? 
                          <><Dog className="w-3 h-3 mr-1" />Dog</> : 
                          <><Cat className="w-3 h-3 mr-1" />Cat</>
                        }
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Selection indicator */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-2 ${
                  isSelected 
                    ? 'bg-blue-500 border-blue-500 text-white' 
                    : 'border-gray-300'
                }`}>
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!carousel) {
    return (
      <div className="p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Carousel not found</h1>
          <Button onClick={() => router.push('/admin/carousels')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Carousels
          </Button>
        </div>
      </div>
    );
  }

  const totalSelections = selectedThemes.length + selectedDogBreeds.length + selectedCatBreeds.length;
  const filteredThemes = filterItems(availableThemes, searchTerm);
  const filteredDogBreeds = filterItems(availableDogBreeds, searchTerm);
  const filteredCatBreeds = filterItems(availableCatBreeds, searchTerm);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => router.push('/admin/carousels')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{carousel.name}</h1>
              <p className="text-gray-600">
                Configure carousel content • {totalSelections} items selected
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      {/* Current Content Preview */}
      {currentContent.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Carousel Content ({currentContent.length} items)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentContent.map((content, index) => (
                <div key={content.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-white rounded overflow-hidden flex-shrink-0">
                    {content.hero_image_url ? (
                      <img
                        src={content.hero_image_url}
                        alt={content.hero_image_alt}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        {content.content_type === 'theme' ? <Palette className="w-4 h-4 text-gray-400" /> : 
                         content.breed_animal_type === 'dog' ? <Dog className="w-4 h-4 text-gray-400" /> :
                         <Cat className="w-4 h-4 text-gray-400" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate">{content.title}</h4>
                    <p className="text-xs text-gray-600 truncate">{content.subtitle}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {content.content_type.replace('_', ' ')} • {index + 1}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Tabs */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-1">
            <Button
              variant={activeTab === 'themes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('themes')}
            >
              <Palette className="w-4 h-4 mr-2" />
              Themes ({selectedThemes.length})
            </Button>
            <Button
              variant={activeTab === 'dogs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('dogs')}
            >
              <Dog className="w-4 h-4 mr-2" />
              Dogs ({selectedDogBreeds.length})
            </Button>
            <Button
              variant={activeTab === 'cats' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('cats')}
            >
              <Cat className="w-4 h-4 mr-2" />
              Cats ({selectedCatBreeds.length})
            </Button>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Content Selection */}
      <div className="space-y-4">
        {activeTab === 'themes' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredThemes.map(theme => 
              renderContentCard(
                theme, 
                selectedThemes.includes(theme.id),
                () => toggleThemeSelection(theme.id)
              )
            )}
          </div>
        )}

        {activeTab === 'dogs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDogBreeds.map(breed => 
              renderContentCard(
                breed, 
                selectedDogBreeds.includes(breed.id),
                () => toggleDogBreedSelection(breed.id)
              )
            )}
          </div>
        )}

        {activeTab === 'cats' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatBreeds.map(breed => 
              renderContentCard(
                breed, 
                selectedCatBreeds.includes(breed.id),
                () => toggleCatBreedSelection(breed.id)
              )
            )}
          </div>
        )}

        {/* Empty state */}
        {((activeTab === 'themes' && filteredThemes.length === 0) ||
          (activeTab === 'dogs' && filteredDogBreeds.length === 0) ||
          (activeTab === 'cats' && filteredCatBreeds.length === 0)) && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-2">
              {searchTerm ? 'No results found' : 'No items available'}
            </div>
            {searchTerm && (
              <Button variant="outline" size="sm" onClick={() => setSearchTerm('')}>
                Clear search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}