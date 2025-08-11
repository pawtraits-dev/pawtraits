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
import type { Coat, CoatUpdate, Breed, BreedCoatDetail, AnimalType } from '@/lib/types';

interface EditCoatPageProps {
  params: Promise<{ id: string }>;
}

export default function EditCoatPage({ params }: EditCoatPageProps) {
  return <EditCoatPageClient params={params} />;
}

function EditCoatPageClient({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coat, setCoat] = useState<Coat | null>(null);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [breedCoats, setBreedCoats] = useState<BreedCoatDetail[]>([]);
  const [selectedBreedId, setSelectedBreedId] = useState<string>('');
  const [formData, setFormData] = useState<CoatUpdate>({
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
      // Load coat first to get animal_type
      await loadCoat(id);
      // Then load remaining data in parallel
      await Promise.all([
        loadBreedCoats(id)
      ]);
    };
    
    initializePage();
  }, [id]);

  // Load breeds when coat data is available (to filter by animal_type)
  useEffect(() => {
    if (coat) {
      loadBreeds(coat.animal_type);
    }
  }, [coat]);

  const loadCoat = async (coatId: string) => {
    try {
      setLoading(true);
      const data = await supabaseService.getCoat(coatId);
      setCoat(data);
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description,
        hex_color: data.hex_color,
        pattern_type: data.pattern_type,
        rarity: data.rarity,
        is_active: data.is_active,
        sort_order: data.sort_order,
        hero_image_url: data.hero_image_url || '',
        hero_image_alt: data.hero_image_alt || ''
      });
    } catch (error) {
      alert('Failed to load coat');
      router.push('/admin/coats');
    } finally {
      setLoading(false);
    }
  };

  const loadBreeds = async (animalType: AnimalType) => {
    try {
      const data = await supabaseService.getBreeds(animalType);
      setBreeds(data || []);
    } catch (error) {
      console.error('Failed to load breeds:', error);
    }
  };

  const loadBreedCoats = async (coatId: string) => {
    try {
      const response = await fetch(`/api/breed-coats?coat_id=${coatId}`);
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
    if (!id) throw new Error('No coat ID available');
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('type', 'hero-image');
    formDataUpload.append('entity', 'coat');
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
      let finalData = { ...formData };

      // Upload hero image if a new one was selected
      if (heroImageFile) {
        const uploadedUrl = await uploadHeroImage(heroImageFile);
        finalData.hero_image_url = uploadedUrl;
      }

      const response = await fetch(`/api/coats/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        throw new Error('Failed to update coat');
      }

      router.push('/admin/coats');
    } catch (error) {
      alert('Failed to update coat: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!coat) return;
    
    if (!confirm(`Are you sure you want to delete "${coat.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/coats/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete coat');
      }

      router.push('/admin/coats');
    } catch (error) {
      alert('Failed to delete coat: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleAddBreed = async () => {
    if (!selectedBreedId) return;

    try {
      if (!id) throw new Error('No coat ID available');
      
      const response = await fetch('/api/breed-coats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breed_id: selectedBreedId,
          coat_id: id,
          is_common: true,
          is_standard: true,
          popularity_rank: breedCoats.length + 1
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          alert('This breed already has this coat color assigned.');
        } else {
          throw new Error(errorData.error || 'Failed to add breed');
        }
        return;
      }

      setSelectedBreedId('');
      await loadBreedCoats(id);
    } catch (error) {
      alert('Failed to add breed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRemoveBreed = async (breedCoatId: string) => {
    try {
      const response = await fetch(`/api/breed-coats/${breedCoatId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove breed');
      }

      if (id) await loadBreedCoats(id);
    } catch (error) {
      alert('Failed to remove breed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const availableBreeds = breeds.filter(breed => 
    !breedCoats.some(bc => bc.breed_name === breed.name)
  );

  if (loading || !id) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (!coat) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center text-red-600">Coat not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/coats" className="flex items-center hover:text-purple-600">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Coats
            </Link>
          </div>
          <Button
            onClick={handleDelete}
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Coat
          </Button>
        </div>

        <div className="flex items-center space-x-3">
          <div 
            className="w-8 h-8 rounded-full border border-gray-300"
            style={{ backgroundColor: coat.hex_color }}
          ></div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Coat: {coat.name}</h1>
            <p className="text-gray-600 mt-2">Update coat information and manage breed relationships</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coat Details Form */}
          <Card>
            <CardHeader>
              <CardTitle>Coat Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="name">Coat Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="animal_type">Animal Type</Label>
                  <div className="flex items-center space-x-2 p-2 border rounded-md bg-gray-50">
                    <Badge variant="outline">
                      {coat?.animal_type === 'dog' ? '🐕 Dog' : '🐱 Cat'}
                    </Badge>
                    <span className="text-sm text-gray-600">(Cannot be changed after creation)</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
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
                          className="w-full h-48 object-cover rounded-lg border"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hex_color">Color *</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="hex_color"
                        type="color"
                        value={formData.hex_color || '#000000'}
                        onChange={(e) => setFormData({ ...formData, hex_color: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        value={formData.hex_color || ''}
                        onChange={(e) => setFormData({ ...formData, hex_color: e.target.value })}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pattern_type">Pattern Type *</Label>
                    <Select value={formData.pattern_type || ''} onValueChange={(value) => setFormData({ ...formData, pattern_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="bi-color">Bi-color</SelectItem>
                        <SelectItem value="tri-color">Tri-color</SelectItem>
                        <SelectItem value="merle">Merle</SelectItem>
                        <SelectItem value="brindle">Brindle</SelectItem>
                        <SelectItem value="sable">Sable</SelectItem>
                        <SelectItem value="spotted">Spotted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rarity">Rarity *</Label>
                    <Select value={formData.rarity || ''} onValueChange={(value) => setFormData({ ...formData, rarity: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="common">Common</SelectItem>
                        <SelectItem value="uncommon">Uncommon</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="sort_order">Sort Order</Label>
                    <Input
                      id="sort_order"
                      type="number"
                      value={formData.sort_order || 0}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="flex space-x-4 pt-4">
                  <Button type="submit" disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Link href="/admin/coats">
                    <Button type="button" variant="outline">Cancel</Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Breed Relationships */}
          <Card>
            <CardHeader>
              <CardTitle>Compatible Breeds ({breedCoats.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Breed */}
              <div className="flex space-x-2">
                <Select value={selectedBreedId} onValueChange={setSelectedBreedId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select breed to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBreeds.map(breed => (
                      <SelectItem key={breed.id} value={breed.id}>
                        {breed.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddBreed} disabled={!selectedBreedId} size="sm">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Current Breeds */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {breedCoats.map((breedCoat) => (
                  <div key={breedCoat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{breedCoat.breed_name}</span>
                      <div className="flex space-x-1">
                        {breedCoat.is_common && (
                          <Badge variant="outline" className="text-xs">Common</Badge>
                        )}
                        {breedCoat.is_standard && (
                          <Badge variant="outline" className="text-xs">Standard</Badge>
                        )}
                        {breedCoat.popularity_rank && (
                          <Badge variant="outline" className="text-xs">#{breedCoat.popularity_rank}</Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveBreed(breedCoat.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {breedCoats.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No breeds associated with this coat color yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}