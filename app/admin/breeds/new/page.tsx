'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import type { BreedCreate, AnimalType } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AddBreedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<BreedCreate & { animal_type: AnimalType }>({
    name: '',
    slug: '',
    description: '',
    animal_type: 'dog',
    physical_traits: {},
    personality_traits: [],
    alternative_names: [],
    popularity_rank: null,
    is_active: true,
    metadata: {}
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create slug from name if not provided
      const finalData = {
        ...formData,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        personality_traits: formData.personality_traits.filter(trait => trait.trim() !== ''),
        alternative_names: formData.alternative_names.filter(name => name.trim() !== '')
      };

      const response = await fetch('/api/breeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        throw new Error('Failed to create breed');
      }

      router.push('/admin/breeds');
    } catch (error) {
      alert('Failed to create breed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalityTraitChange = (index: number, value: string) => {
    const newTraits = [...formData.personality_traits];
    newTraits[index] = value;
    setFormData({ ...formData, personality_traits: newTraits });
  };

  const addPersonalityTrait = () => {
    setFormData({ 
      ...formData, 
      personality_traits: [...formData.personality_traits, ''] 
    });
  };

  const removePersonalityTrait = (index: number) => {
    const newTraits = formData.personality_traits.filter((_, i) => i !== index);
    setFormData({ ...formData, personality_traits: newTraits });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/admin/breeds" className="flex items-center hover:text-purple-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Breeds
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Breed</h1>
          <p className="text-gray-600 mt-2">Create a new dog breed for AI prompt generation</p>
        </div>

        {/* Form */}
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
                  <Label htmlFor="animal_type">Animal Type *</Label>
                  <Select value={formData.animal_type} onValueChange={(value: AnimalType) => setFormData({ ...formData, animal_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select animal type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dog">🐕 Dog</SelectItem>
                      <SelectItem value="cat">🐱 Cat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="slug">URL Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g., golden-retriever (auto-generated if empty)"
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
                  {formData.personality_traits.map((trait, index) => (
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
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Breed
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
      </div>
    </div>
  );
}