'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Plus, X, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Outfit } from '@/lib/types';

interface EditOutfitPageProps {
  params: Promise<{ id: string }>;
}

export default function EditOutfitPage({ params }: EditOutfitPageProps) {
  const router = useRouter();
  const [outfitId, setOutfitId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clothing_description: '',
    color_scheme: [] as string[],
    style_keywords: [] as string[],
    seasonal_relevance: {} as Record<string, boolean>,
    animal_compatibility: [] as string[],
    is_active: true,
    sort_order: 0
  });

  const [newColor, setNewColor] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const seasons = ['spring', 'summer', 'autumn', 'winter', 'christmas', 'halloween', 'valentine'];
  const animals = ['dog', 'cat'];

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params;
      setOutfitId(resolvedParams.id);
      loadOutfit(resolvedParams.id);
    };
    loadParams();
  }, [params]);

  const loadOutfit = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/outfits/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load outfit');
      }
      
      const outfit: Outfit = await response.json();
      
      setFormData({
        name: outfit.name,
        description: outfit.description || '',
        clothing_description: outfit.clothing_description,
        color_scheme: outfit.color_scheme || [],
        style_keywords: outfit.style_keywords || [],
        seasonal_relevance: outfit.seasonal_relevance || {},
        animal_compatibility: outfit.animal_compatibility || [],
        is_active: outfit.is_active,
        sort_order: outfit.sort_order
      });
    } catch (error) {
      console.error('Error loading outfit:', error);
      alert('Failed to load outfit. Please try again.');
      router.push('/admin/outfits');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addColor = () => {
    if (newColor.trim() && !formData.color_scheme.includes(newColor.trim().toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        color_scheme: [...prev.color_scheme, newColor.trim().toLowerCase()]
      }));
      setNewColor('');
    }
  };

  const removeColor = (color: string) => {
    setFormData(prev => ({
      ...prev,
      color_scheme: prev.color_scheme.filter(c => c !== color)
    }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.style_keywords.includes(newKeyword.trim().toLowerCase())) {
      setFormData(prev => ({
        ...prev,
        style_keywords: [...prev.style_keywords, newKeyword.trim().toLowerCase()]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      style_keywords: prev.style_keywords.filter(k => k !== keyword)
    }));
  };

  const handleSeasonChange = (season: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      seasonal_relevance: {
        ...prev.seasonal_relevance,
        [season]: checked
      }
    }));
  };

  const handleAnimalChange = (animal: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      animal_compatibility: checked
        ? [...prev.animal_compatibility, animal]
        : prev.animal_compatibility.filter(a => a !== animal)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/outfits/${outfitId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update outfit');
      }

      router.push('/admin/outfits');
    } catch (error) {
      console.error('Error updating outfit:', error);
      alert('Failed to update outfit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this outfit? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`/api/outfits/${outfitId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete outfit');
      }

      router.push('/admin/outfits');
    } catch (error) {
      console.error('Error deleting outfit:', error);
      alert('Failed to delete outfit. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/outfits">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Outfits
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Outfit</h1>
              <p className="text-gray-600">Update outfit information</p>
            </div>
          </div>
          
          <Button
            onClick={handleDelete}
            disabled={deleting}
            variant="destructive"
            size="sm"
          >
            {deleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </>
            )}
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Outfit Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Christmas Sweater"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sort Order
                  </label>
                  <Input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => handleInputChange('sort_order', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Brief description of the outfit"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clothing Description for AI Prompt *
                </label>
                <Textarea
                  value={formData.clothing_description}
                  onChange={(e) => handleInputChange('clothing_description', e.target.value)}
                  placeholder="e.g., wearing a cozy red and green Christmas sweater with reindeer patterns"
                  rows={3}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This text will be inserted directly into the AI prompt. Leave empty for "No Outfit" options.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  placeholder="Add a color (e.g., red, blue)"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addColor())}
                />
                <Button type="button" onClick={addColor} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {formData.color_scheme.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.color_scheme.map((color) => (
                    <Badge key={color} variant="secondary" className="flex items-center space-x-1">
                      <span>{color}</span>
                      <button
                        type="button"
                        onClick={() => removeColor(color)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Style Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Style Keywords</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Add a style keyword (e.g., casual, formal)"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button type="button" onClick={addKeyword} variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              {formData.style_keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.style_keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="flex items-center space-x-1">
                      <span>{keyword}</span>
                      <button
                        type="button"
                        onClick={() => removeKeyword(keyword)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seasonal Relevance */}
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Relevance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {seasons.map((season) => (
                  <div key={season} className="flex items-center space-x-2">
                    <Checkbox
                      id={season}
                      checked={formData.seasonal_relevance[season] || false}
                      onCheckedChange={(checked) => handleSeasonChange(season, checked as boolean)}
                    />
                    <label htmlFor={season} className="text-sm font-medium capitalize">
                      {season}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Animal Compatibility */}
          <Card>
            <CardHeader>
              <CardTitle>Animal Compatibility</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-6">
                {animals.map((animal) => (
                  <div key={animal} className="flex items-center space-x-2">
                    <Checkbox
                      id={`animal-${animal}`}
                      checked={formData.animal_compatibility.includes(animal)}
                      onCheckedChange={(checked) => handleAnimalChange(animal, checked as boolean)}
                    />
                    <label htmlFor={`animal-${animal}`} className="text-sm font-medium capitalize">
                      {animal === 'dog' ? '🐕 Dog' : '🐱 Cat'}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => handleInputChange('is_active', checked as boolean)}
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Active (visible in outfit selection)
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Link href="/admin/outfits">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button 
              type="submit" 
              disabled={saving || !formData.name}
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
          </div>
        </form>
      </div>
    </div>
  );
}