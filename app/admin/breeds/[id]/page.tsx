'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Trash2, Plus, X, Upload } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { compressImage, formatFileSize, isValidImageType } from '@/lib/image-compression';
import type { Breed, BreedUpdate, Coat, BreedCoatDetail, AnimalType } from '@/lib/types';

interface EditBreedPageProps {
  params: Promise<{ id: string }>;
}

export default function EditBreedPage({ params }: EditBreedPageProps) {
  return <EditBreedPageClient params={params} />;
}

function EditBreedPageClient({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [breed, setBreed] = useState<Breed | null>(null);
  const [coats, setCoats] = useState<Coat[]>([]);
  const [breedCoats, setBreedCoats] = useState<BreedCoatDetail[]>([]);
  const [selectedCoatId, setSelectedCoatId] = useState<string>('');
  const [formData, setFormData] = useState<BreedUpdate>({
    name: '',
    slug: '',
    description: '',
    physical_traits: {},
    personality_traits: [],
    alternative_names: [],
    popularity_rank: null,
    is_active: true,
    metadata: {},
    hero_image_url: '',
    hero_image_alt: ''
  });
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;
    
    const initializePage = async () => {
      // Load breed first to get animal_type
      await loadBreed(id);
      // Then load remaining data in parallel
      await Promise.all([
        loadBreedCoats(id)
      ]);
    };
    
    initializePage();
  }, [id]);

  // Load coats when breed data is available (to filter by animal_type)
  useEffect(() => {
    if (breed) {
      loadCoats(breed.animal_type);
    }
  }, [breed]);

  const loadBreed = async (breedId: string) => {
    try {
      setLoading(true);
      const data = await supabaseService.getBreed(breedId);
      setBreed(data);
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description,
        physical_traits: data.physical_traits || {},
        personality_traits: data.personality_traits || [],
        alternative_names: data.alternative_names || [],
        popularity_rank: data.popularity_rank,
        is_active: data.is_active,
        metadata: data.metadata || {},
        hero_image_url: data.hero_image_url || '',
        hero_image_alt: data.hero_image_alt || ''
      });
    } catch (error) {
      alert('Failed to load breed');
      router.push('/admin/breeds');
    } finally {
      setLoading(false);
    }
  };

  const loadCoats = async (animalType: AnimalType) => {
    try {
      const data = await supabaseService.getCoats(animalType);
      setCoats(data || []);
    } catch (error) {
      console.error('Failed to load coats:', error);
    }
  };

  const loadBreedCoats = async (breedId: string) => {
    try {
      const response = await fetch(`/api/breed-coats?breed_id=${breedId}`);
      if (!response.ok) throw new Error('Failed to fetch breed-coat relationships');
      const data = await response.json();
      
      // Transform the data to match our expected format
      const transformedData = data.map((item: any) => ({
        id: item.id,
        breed_name: item.breeds.name,
        breed_slug: item.breeds.slug,
        coat_name: item.coats.name,
        coat_slug: item.coats.slug,
        coat_description: item.coats.description,
        hex_color: item.coats.hex_color,
        pattern_type: item.coats.pattern_type,
        rarity: item.coats.rarity,
        is_common: item.is_common,
        is_standard: item.is_standard,
        popularity_rank: item.popularity_rank,
        notes: item.notes
      }));
      
      setBreedCoats(transformedData);
    } catch (error) {
      console.error('Failed to load breed-coat relationships:', error);
    }
  };

  const handleHeroImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!isValidImageType(file)) {
      alert('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    try {
      setIsCompressing(true);
      
      // Show original file info
      console.log(`Original file: ${file.name} (${formatFileSize(file.size)})`);
      
      // Compress if file is larger than 2MB
      let processedFile = file;
      if (file.size > 2 * 1024 * 1024) {
        console.log('Compressing image...');
        processedFile = await compressImage(file, {
          maxWidth: 1200,
          maxHeight: 800,
          quality: 0.8,
          maxSizeKB: 4096 // 4MB max
        });
        console.log(`Compressed file: ${processedFile.name} (${formatFileSize(processedFile.size)})`);
      }
      
      setHeroImageFile(processedFile);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setHeroImagePreview(reader.result as string);
      };
      reader.readAsDataURL(processedFile);
      
    } catch (error) {
      console.error('Image compression failed:', error);
      alert('Failed to process image. Please try a different file.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemoveHeroImage = () => {
    setHeroImageFile(null);
    setHeroImagePreview(null);
    setFormData({ ...formData, hero_image_url: '', hero_image_alt: '' });
  };

  const uploadHeroImage = async (file: File): Promise<string> => {
    if (!id) throw new Error('No breed ID available');
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('type', 'hero-image');
    formDataUpload.append('entity', 'breed');
    formDataUpload.append('entity_id', id);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formDataUpload,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.public_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!id) throw new Error('No breed ID available');
      
      let finalData = {
        ...formData,
        personality_traits: (formData.personality_traits || []).filter(trait => trait.trim() !== ''),
        alternative_names: (formData.alternative_names || []).filter(name => name.trim() !== '')
      };

      // Upload hero image if a new one was selected
      if (heroImageFile) {
        const uploadedUrl = await uploadHeroImage(heroImageFile);
        finalData.hero_image_url = uploadedUrl;
      }

      const response = await fetch(`/api/breeds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        throw new Error('Failed to update breed');
      }

      router.push('/admin/breeds');
    } catch (error) {
      alert('Failed to update breed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!breed) return;
    
    if (!confirm(`Are you sure you want to delete "${breed.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/breeds/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete breed');
      }

      router.push('/admin/breeds');
    } catch (error) {
      alert('Failed to delete breed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleAddCoat = async () => {
    if (!selectedCoatId) return;

    try {
      const response = await fetch('/api/breed-coats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breed_id: id,
          coat_id: selectedCoatId,
          is_common: true,
          is_standard: true,
          popularity_rank: breedCoats.length + 1
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          alert('This coat color is already assigned to this breed.');
        } else {
          throw new Error(errorData.error || 'Failed to add coat');
        }
        return;
      }

      setSelectedCoatId('');
      if (id) await loadBreedCoats(id);
    } catch (error) {
      alert('Failed to add coat: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRemoveCoat = async (breedCoatId: string) => {
    try {
      const response = await fetch(`/api/breed-coats/${breedCoatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove coat');
      }

      if (id) await loadBreedCoats(id);
    } catch (error) {
      alert('Failed to remove coat: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handlePersonalityTraitChange = (index: number, value: string) => {
    const newTraits = [...(formData.personality_traits || [])];
    newTraits[index] = value;
    setFormData({ ...formData, personality_traits: newTraits });
  };

  const addPersonalityTrait = () => {
    setFormData({ 
      ...formData, 
      personality_traits: [...(formData.personality_traits || []), ''] 
    });
  };

  const removePersonalityTrait = (index: number) => {
    const newTraits = (formData.personality_traits || []).filter((_, i) => i !== index);
    setFormData({ ...formData, personality_traits: newTraits });
  };

  const availableCoats = coats.filter(coat => 
    !breedCoats.some(bc => bc.coat_name === coat.name)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (!breed) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center text-red-600">Breed not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/breeds" className="flex items-center hover:text-purple-600">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Breeds
            </Link>
          </div>
          <Button
            onClick={handleDelete}
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Breed
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Breed: {breed.name}</h1>
          <p className="text-gray-600 mt-2">Update breed information and manage coat colors</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Breed Details Form */}
          <Card>
          <CardHeader>
            <CardTitle>Breed Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Breed Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Golden Retriever"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="animal_type">Animal Type</Label>
                  <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50">
                    <Badge variant="outline">
                      {breed?.animal_type === 'dog' ? '🐕 Dog' : '🐱 Cat'}
                    </Badge>
                    <span className="text-sm text-gray-600">(Cannot be changed after creation)</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g., golden-retriever"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the breed characteristics, temperament, and notable features..."
                    rows={4}
                    required
                  />
                </div>

                {/* Hero Image Section */}
                <div className="space-y-4">
                  <Label>Hero Image</Label>
                  <div className="space-y-4">
                    {/* Current or Preview Image */}
                    {(heroImagePreview || formData.hero_image_url) && (
                      <div className="relative">
                        <img 
                          src={heroImagePreview || formData.hero_image_url || ''}
                          alt="Hero image preview"
                          className="w-full h-48 object-contain bg-gray-50 rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveHeroImage}
                          className="absolute top-2 right-2"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Upload Input */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-4">
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          onChange={handleHeroImageChange}
                          className="flex-1"
                          disabled={isCompressing}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          disabled={isCompressing}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isCompressing ? 'Compressing...' : 'Choose Image'}
                        </Button>
                      </div>
                      
                      {heroImageFile && (
                        <div className="text-xs text-gray-600">
                          File: {heroImageFile.name} ({formatFileSize(heroImageFile.size)})
                        </div>
                      )}
                      
                      {isCompressing && (
                        <div className="text-xs text-blue-600 flex items-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-2"></div>
                          Compressing image...
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        Max file size: 8MB. Images over 2MB will be automatically compressed.
                      </div>
                    </div>
                    
                    {/* Alt Text Input */}
                    <div>
                      <Label htmlFor="hero_image_alt">Alt Text (for accessibility)</Label>
                      <Input
                        id="hero_image_alt"
                        value={formData.hero_image_alt || ''}
                        onChange={(e) => setFormData({ ...formData, hero_image_alt: e.target.value })}
                        placeholder="Describe the image for screen readers"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="popularity_rank">Popularity Rank (optional)</Label>
                  <Input
                    id="popularity_rank"
                    type="number"
                    value={formData.popularity_rank || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      popularity_rank: e.target.value ? parseInt(e.target.value) : null 
                    })}
                    placeholder="1-200 (AKC ranking)"
                    min="1"
                    max="200"
                  />
                </div>
              </div>

              {/* Personality Traits */}
              <div>
                <Label>Personality Traits</Label>
                <div className="space-y-2">
                  {(formData.personality_traits || []).map((trait, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        value={trait}
                        onChange={(e) => handlePersonalityTraitChange(index, e.target.value)}
                        placeholder="e.g., Friendly, Loyal, Energetic"
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => removePersonalityTrait(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={addPersonalityTrait}
                  >
                    Add Trait
                  </Button>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active (visible for prompt generation)</Label>
              </div>

              {/* Submit */}
              <div className="flex space-x-4 pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Link href="/admin/breeds">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

          {/* Coat Management */}
          <Card>
            <CardHeader>
              <CardTitle>Available Coat Colors ({breedCoats.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Coat */}
              <div className="flex space-x-2">
                <Select value={selectedCoatId} onValueChange={setSelectedCoatId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select coat color to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoats.map(coat => (
                      <SelectItem key={coat.id} value={coat.id}>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-4 h-4 rounded-full border border-gray-300"
                            style={{ backgroundColor: coat.hex_color }}
                          ></div>
                          <span>{coat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddCoat} disabled={!selectedCoatId} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Current Coats */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {breedCoats.map((breedCoat, index) => (
                  <div key={`${breedCoat.coat_name}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-6 h-6 rounded-full border border-gray-300"
                        style={{ backgroundColor: breedCoat.hex_color }}
                      ></div>
                      <div>
                        <span className="font-medium">{breedCoat.coat_name}</span>
                        <div className="flex space-x-1 mt-1">
                          {breedCoat.is_common && (
                            <Badge variant="outline" className="text-xs">Common</Badge>
                          )}
                          {breedCoat.is_standard && (
                            <Badge variant="outline" className="text-xs">Standard</Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{breedCoat.pattern_type}</Badge>
                          <Badge variant="outline" className="text-xs">{breedCoat.rarity}</Badge>
                          {breedCoat.popularity_rank && (
                            <Badge variant="outline" className="text-xs">#{breedCoat.popularity_rank}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCoat(breedCoat.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {breedCoats.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No coat colors assigned to this breed yet.
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Manage which coat colors are available for {breed.name}. These will be used in AI prompt generation.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}