'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Search, Filter, Star, Eye, Download, Tag, Calendar, User, Trash2, X, EyeOff, Wand2, Copy } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { ImageCatalogWithDetails, Breed, Theme, Style, Format, AnimalType, BreedCoatDetail, Outfit } from '@/lib/types';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';
import { extractDescriptionTitle } from '@/lib/utils';
import ImageVariantGenerationModal from '@/components/ImageVariantGenerationModal';
import { VariationsSelector } from '@/components/VariationsSelector';

export default function AdminCatalogPage() {
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [availableCoats, setAvailableCoats] = useState<BreedCoatDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [animalType, setAnimalType] = useState<AnimalType | ''>('');
  const [selectedBreed, setSelectedBreed] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState(''); // 'all', 'public', 'hidden'
  const [ratingFilter, setRatingFilter] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedImageForDetail, setSelectedImageForDetail] = useState<ImageCatalogWithDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedImageForVariation, setSelectedImageForVariation] = useState<ImageCatalogWithDetails | null>(null);
  const [showVariationModal, setShowVariationModal] = useState(false);

  const supabaseService = new SupabaseService();
  const adminSupabaseService = new AdminSupabaseService();

  useEffect(() => {
    loadData();
  }, []);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [animalType, selectedBreed, selectedTheme, selectedStyle, selectedFormat, featuredOnly, visibleOnly, visibilityFilter, ratingFilter, debouncedSearchTerm]);

  useEffect(() => {
    loadImages();
  }, [page, animalType, selectedBreed, selectedTheme, selectedStyle, selectedFormat, featuredOnly, visibleOnly, visibilityFilter, ratingFilter, debouncedSearchTerm]);

  const loadData = async () => {
    try {
      const [breedsData, themesData, stylesData, formatsData, outfitsData] = await Promise.all([
        supabaseService.getBreeds(),
        supabaseService.getThemes(),
        supabaseService.getStyles(),
        supabaseService.getFormats(),
        supabaseService.getOutfits()
      ]);

      setBreeds(breedsData?.filter((b: any) => b.is_active) || []);
      setThemes(themesData?.filter((t: any) => t.is_active) || []);
      setStyles(stylesData?.filter((s: any) => s.is_active) || []);
      setFormats(formatsData?.filter((f: any) => f.is_active) || []);
      setOutfits(outfitsData?.filter((o: any) => o.is_active) || []);
    } catch (error) {
      console.error('Error loading filter data:', error);
    }
  };

  const loadImages = async () => {
    try {
      setLoading(true);
      const imageData = await supabaseService.getImages({
        page,
        limit: 20,
        breedId: selectedBreed || null,
        themeId: selectedTheme || null,
        styleId: selectedStyle || null,
        formatId: selectedFormat || null,
        featured: featuredOnly,
        publicOnly: false, // Admin can see all images
        search: debouncedSearchTerm || undefined
      });

      let filteredImages = imageData;

      // Client-side filtering for rating, animal type, and visibility
      if (ratingFilter && ratingFilter !== 'all') {
        const minRating = parseInt(ratingFilter);
        filteredImages = filteredImages.filter(img => (img.rating || 0) >= minRating);
      }

      if (animalType) {
        filteredImages = filteredImages.filter(img => img.breed_animal_type === animalType);
      }

      // Admin visibility filtering (for customer/partner visibility control)
      if (visibleOnly) {
        filteredImages = filteredImages.filter(img => img.is_public);
      }

      // Additional visibility filter for specific states
      if (visibilityFilter) {
        if (visibilityFilter === 'public') {
          filteredImages = filteredImages.filter(img => img.is_public);
        } else if (visibilityFilter === 'hidden') {
          filteredImages = filteredImages.filter(img => !img.is_public);
        }
        // 'all' shows both public and hidden images (default admin behavior)
      }

      setImages(filteredImages);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAnimalType('');
    setSelectedBreed('');
    setSelectedTheme('');
    setSelectedStyle('');
    setSelectedFormat('');
    setFeaturedOnly(false);
    setVisibleOnly(false);
    setVisibilityFilter('');
    setRatingFilter('');
    setPage(1);
  };

  const handleDeleteImage = async (imageId: string, imageName: string) => {
    if (!confirm(`Are you sure you want to delete "${imageName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove image from local state
        setImages(prev => prev.filter(img => img.id !== imageId));
      } else {
        const error = await response.json();
        alert(`Failed to delete image: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      alert('Failed to delete image. Please try again.');
    }
  };

  const handleToggleFeatured = async (imageId: string, currentFeatured: boolean) => {
    try {
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !currentFeatured }),
      });

      if (response.ok) {
        // Update image in local state
        setImages(prev => prev.map(img => 
          img.id === imageId 
            ? { ...img, is_featured: !currentFeatured }
            : img
        ));
      } else {
        const error = await response.json();
        alert(`Failed to update featured status: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating featured status:', error);
      alert('Failed to update featured status. Please try again.');
    }
  };

  const handleToggleVisibility = async (imageId: string, currentPublic: boolean) => {
    try {
      const response = await fetch(`/api/images/${imageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: !currentPublic }),
      });

      if (response.ok) {
        // Update image in local state
        setImages(prev => prev.map(img => 
          img.id === imageId 
            ? { ...img, is_public: !currentPublic }
            : img
        ));
      } else {
        const error = await response.json();
        alert(`Failed to update visibility: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      alert('Failed to update visibility. Please try again.');
    }
  };

  const handleCardClick = async (image: ImageCatalogWithDetails) => {
    setSelectedImageForDetail(image);
    setShowDetailModal(true);
    
    // Load coats for the image's breed
    if (image.breed_id) {
      try {
        const coatsData = await supabaseService.getBreedCoats(image.breed_id);
        setAvailableCoats(coatsData || []);
      } catch (error) {
        console.error('Error loading breed coats:', error);
      }
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-3 h-3 ${
              star <= rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  // Get filtered breeds based on animal type
  const filteredBreeds = animalType ? breeds.filter(b => b.animal_type === animalType) : breeds;

  if (loading && page === 1) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🖼️ Image Catalog
            </h1>
            <p className="text-lg text-gray-600">
              Manage and review all generated pet portraits
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search images, tags, descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Row */}
              <div className="grid grid-cols-2 md:grid-cols-8 gap-4">
                <select
                  value={animalType}
                  onChange={(e) => setAnimalType(e.target.value as AnimalType | '')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Animals</option>
                  <option value="dog">🐕 Dogs</option>
                  <option value="cat">🐱 Cats</option>
                </select>

                <select
                  value={selectedBreed}
                  onChange={(e) => setSelectedBreed(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Breeds</option>
                  {filteredBreeds.map(breed => (
                    <option key={breed.id} value={breed.id}>
                      {breed.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Themes</option>
                  {themes.map(theme => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Styles</option>
                  {styles.map(style => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Formats</option>
                  {formats.map(format => (
                    <option key={format.id} value={format.id}>
                      {format.name}
                    </option>
                  ))}
                </select>

                <select
                  value={visibilityFilter}
                  onChange={(e) => setVisibilityFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Images</option>
                  <option value="public">👁️ Public Only</option>
                  <option value="hidden">👁️‍🗨️ Hidden Only</option>
                </select>

                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="2">2+ Stars</option>
                  <option value="1">1+ Star</option>
                </select>

                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="featured"
                      checked={featuredOnly}
                      onChange={(e) => setFeaturedOnly(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="featured" className="text-sm text-gray-700">
                      Featured only
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="visible"
                      checked={visibleOnly}
                      onChange={(e) => setVisibleOnly(e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="visible" className="text-sm text-gray-700">
                      Visible only
                    </label>
                  </div>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="flex justify-between items-center">
                <Button variant="outline" onClick={clearFilters} size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
                <p className="text-sm text-gray-600">
                  Showing {images.length} images
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Images Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.map((image) => (
            <Card key={image.id} className="group hover:shadow-lg transition-shadow overflow-hidden cursor-pointer" onClick={() => handleCardClick(image)}>
              {/* Image */}
              <div className="relative overflow-hidden bg-gray-100 rounded-t-lg" style={{ aspectRatio: image.format_aspect_ratio || '1:1' }}>
                <CatalogImage
                  imageId={image.id}
                  alt={image.description || 'Generated image'}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
                {image.rating && image.rating > 0 && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    {renderStars(image.rating)}
                  </div>
                )}
                
                {/* Admin control icons */}
                <div className="absolute top-2 right-2 flex flex-col space-y-1">
                  {/* Visibility toggle - always visible in selected state (public = green, hidden = gray) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(image.id, image.is_public);
                    }}
                    className={`p-1 rounded-full shadow-md transition-opacity ${
                      image.is_public 
                        ? 'bg-green-500 text-white opacity-100' 
                        : 'bg-gray-600 text-white opacity-100'
                    } hover:scale-110`}
                    title={image.is_public ? 'Hide from public' : 'Make public'}
                  >
                    {image.is_public ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </button>
                  
                  {/* Featured toggle - always visible if featured, appears on hover if not */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFeatured(image.id, image.is_featured);
                    }}
                    className={`p-1 rounded-full shadow-md transition-opacity ${
                      image.is_featured 
                        ? 'bg-yellow-500 text-white opacity-100' 
                        : 'bg-white text-gray-600 opacity-0 group-hover:opacity-100 hover:bg-yellow-50'
                    }`}
                    title={image.is_featured ? 'Remove from featured' : 'Add to featured'}
                  >
                    <Star className={`w-3 h-3 ${image.is_featured ? 'fill-current' : ''}`} />
                  </button>
                  
                  {/* Delete button - appears on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteImage(image.id, image.original_filename);
                    }}
                    className="bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                    title="Delete image"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Metadata Tags - Visual only */}
                <div className="flex flex-wrap gap-1">
                  {image.breed_name && (
                    <Badge variant="outline" className="text-xs">
                      {image.breed_animal_type === 'cat' ? '🐱' : '🐕'} {image.breed_name}
                    </Badge>
                  )}
                  {image.theme_name && (
                    <Badge variant="outline" className="text-xs">
                      🎨 {image.theme_name}
                    </Badge>
                  )}
                  {image.style_name && (
                    <Badge variant="outline" className="text-xs">
                      ✨ {image.style_name}
                    </Badge>
                  )}
                  {image.coat_name && (
                    <Badge variant="outline" className="text-xs flex items-center space-x-1">
                      <div 
                        className="w-2 h-2 rounded-full border border-gray-300"
                        style={{ backgroundColor: image.coat_hex_color }}
                      />
                      <span>{image.coat_name}</span>
                    </Badge>
                  )}
                </div>

                {/* Description - First line only */}
                {image.description && (
                  <p className="text-sm text-gray-900 font-medium truncate">
                    {extractDescriptionTitle(image.description)}
                  </p>
                )}

                {/* Date and AI Model */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(image.created_at).toLocaleDateString()}</span>
                  </div>
                  {image.ai_model && (
                    <Badge variant="outline" className="text-xs">
                      {image.ai_model}
                    </Badge>
                  )}
                </div>

                {/* Generate Variants Button - only show for images with prompts */}
                {image.prompt_text && (
                  <div className="pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImageForVariation(image);
                        setShowVariationModal(true);
                      }}
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Variants
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {images.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No images found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
            <Button onClick={clearFilters} variant="outline">
              Clear all filters
            </Button>
          </div>
        )}

        {/* Load More Button */}
        {images.length > 0 && images.length % 20 === 0 && (
          <div className="text-center pt-6">
            <Button
              onClick={() => setPage(prev => prev + 1)}
              disabled={loading}
              variant="outline"
            >
              {loading ? 'Loading...' : 'Load More Images'}
            </Button>
          </div>
        )}

        {/* Detailed View Modal */}
        <ImageDetailModal 
          image={selectedImageForDetail}
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedImageForDetail(null);
          }}
          onUpdate={(updatedImage) => {
            setImages(prev => prev.map(img => 
              img.id === updatedImage.id ? updatedImage : img
            ));
          }}
          breeds={breeds}
          outfits={outfits}
          formats={formats}
          availableCoats={availableCoats}
        />

        {/* Image Variant Generation Modal */}
        <ImageVariantGenerationModal
          image={selectedImageForVariation}
          isOpen={showVariationModal}
          onClose={() => {
            setShowVariationModal(false);
            setSelectedImageForVariation(null);
          }}
          onVariationsGenerated={() => {
            // Refresh the images list to show new variations
            loadImages();
          }}
        />
      </div>
    </div>
  );
}

// Image Detail Modal Component
function ImageDetailModal({ 
  image, 
  isOpen, 
  onClose, 
  onUpdate,
  breeds,
  outfits,
  formats,
  availableCoats
}: {
  image: ImageCatalogWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (image: ImageCatalogWithDetails) => void;
  breeds: Breed[];
  outfits: Outfit[];
  formats: Format[];
  availableCoats: BreedCoatDetail[];
}) {
  const [editedDescription, setEditedDescription] = useState('');
  const [editedTags, setEditedTags] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVariations, setShowVariations] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [variationResults, setVariationResults] = useState<any[]>([]);

  useEffect(() => {
    if (image) {
      setEditedDescription(image.description || '');
      setEditedTags((image.tags || []).join(', '));
      setIsEditing(false);
    }
  }, [image]);

  if (!image) return null;

  const handleSave = async () => {
    if (!image) return;
    
    setIsSaving(true);
    try {
      const tagsArray = editedTags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const response = await fetch(`/api/images/${image.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: editedDescription,
          tags: tagsArray
        })
      });

      if (response.ok) {
        const updatedImage = await response.json();
        onUpdate(updatedImage);
        setIsEditing(false);
      } else {
        const error = await response.json();
        alert(`Failed to update image: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating image:', error);
      alert('Failed to update image. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateVariations = async (config: {
    breeds: string[];
    coats: string[];
    outfits: string[];
    formats: string[];
  }) => {
    if (!image?.prompt_text || !image?.id) return;
    
    setIsGeneratingVariations(true);
    setVariationResults([]);
    
    try {
      // Get the Cloudinary URL for the image
      const imageResponse = await fetch(image.public_url || '');
      const imageBlob = await imageResponse.blob();
      const imageData64 = await blobToBase64(imageBlob);
      
      const response = await fetch('/api/admin/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageData: imageData64,
          originalPrompt: image.prompt_text,
          currentBreed: image.breed_id || '',
          currentTheme: image.theme_id || '',
          currentStyle: image.style_id || '',
          variationConfig: config
        })
      });
      
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('Image too large for processing. Please use a smaller image.');
        }
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`Variation generation failed: ${errorData.error || response.statusText}`);
      }
      
      const results = await response.json();
      setVariationResults(results);
      
    } catch (error) {
      console.error('Variation generation error:', error);
      alert(`Failed to generate variations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const copyPromptToClipboard = () => {
    if (image?.prompt_text) {
      navigator.clipboard.writeText(image.prompt_text);
      alert('Prompt copied to clipboard!');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Image Details</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Image */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg bg-gray-100" style={{ aspectRatio: image.format_aspect_ratio || '1:1' }}>
              <CatalogImage
                imageId={image.id}
                alt={image.description || 'Generated image'}
                className="w-full h-full object-contain"
              />
            </div>
            
            {/* Metadata */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {image.breed_name && (
                  <Badge variant="outline">
                    {image.breed_animal_type === 'cat' ? '🐱' : '🐕'} {image.breed_name}
                  </Badge>
                )}
                {image.theme_name && (
                  <Badge variant="outline">🎨 {image.theme_name}</Badge>
                )}
                {image.style_name && (
                  <Badge variant="outline">✨ {image.style_name}</Badge>
                )}
                {image.coat_name && (
                  <Badge variant="outline" className="flex items-center space-x-1">
                    <div 
                      className="w-2 h-2 rounded-full border border-gray-300"
                      style={{ backgroundColor: image.coat_hex_color }}
                    />
                    <span>{image.coat_name}</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Details */}
          <div className="space-y-4">
            {/* Status Indicators */}
            <div className="flex gap-2">
              <Badge variant={image.is_featured ? 'default' : 'outline'}>
                <Star className={`w-3 h-3 mr-1 ${image.is_featured ? 'fill-current' : ''}`} />
                {image.is_featured ? 'Featured' : 'Not Featured'}
              </Badge>
              <Badge variant={image.is_public ? 'default' : 'secondary'}>
                {image.is_public ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Public
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3 mr-1" />
                    Hidden
                  </>
                )}
              </Badge>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Description</label>
                {!isEditing ? (
                  <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setEditedDescription(image.description || '');
                      setEditedTags((image.tags || []).join(', '));
                      setIsEditing(false);
                    }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  rows={4}
                  placeholder="Enter image description..."
                />
              ) : (
                <p className="text-sm bg-gray-50 p-3 rounded border min-h-[100px]">
                  {image.description || 'No description'}
                </p>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="text-sm font-medium block mb-2">Tags</label>
              {isEditing ? (
                <Input
                  value={editedTags}
                  onChange={(e) => setEditedTags(e.target.value)}
                  placeholder="Enter tags separated by commas"
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(image.tags && image.tags.length > 0) ? (
                    image.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        #{tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No tags</span>
                  )}
                </div>
              )}
            </div>

            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">AI Prompt</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyPromptToClipboard}
                  className="p-1 h-auto"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="bg-gray-50 p-3 rounded font-mono text-xs text-gray-600 max-h-32 overflow-y-auto">
                {image.prompt_text}
              </div>
            </div>

            {/* Generate Variations */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                className="w-full mb-4"
                onClick={() => setShowVariations(!showVariations)}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                {showVariations ? 'Hide' : 'Generate'} Variations
              </Button>
              
              {showVariations && (
                <div className="space-y-4">
                  <VariationsSelector
                    originalImage={null}
                    originalPrompt={image.prompt_text || ''}
                    currentBreed={image.breed_id || ''}
                    breeds={breeds}
                    availableCoats={availableCoats}
                    outfits={outfits}
                    formats={formats}
                    onGenerateVariations={handleGenerateVariations}
                    isGenerating={isGeneratingVariations}
                  />
                  
                  {/* Variation Results */}
                  {variationResults.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Generated Variations</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {variationResults.map((result, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0">
                              {result.cloudinary_url && (
                                <img
                                  src={result.cloudinary_url}
                                  alt={`Variation ${index + 1}`}
                                  className="w-full h-full object-cover rounded"
                                />
                              )}
                            </div>
                            <div className="flex-1 text-xs space-y-1">
                              <p className="font-medium">{result.variation_type}</p>
                              {result.breed_name && <p>Breed: {result.breed_name}</p>}
                              {result.coat_name && <p>Coat: {result.coat_name}</p>}
                              {result.outfit_name && <p>Outfit: {result.outfit_name}</p>}
                              {result.format_name && <p>Format: {result.format_name}</p>}
                              <p className={result.success ? 'text-green-600' : 'text-red-600'}>
                                {result.success ? 'Uploaded to catalog' : result.error}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="text-xs font-medium text-gray-500">Created</label>
                <p className="text-sm">{new Date(image.created_at).toLocaleString()}</p>
              </div>
              {image.ai_model && (
                <div>
                  <label className="text-xs font-medium text-gray-500">AI Model</label>
                  <p className="text-sm">{image.ai_model}</p>
                </div>
              )}
              {image.rating && (
                <div>
                  <label className="text-xs font-medium text-gray-500">Rating</label>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= image.rating! ? 'text-yellow-500 fill-current' : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}