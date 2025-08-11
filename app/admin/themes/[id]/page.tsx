'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Trash2, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { compressImage, formatFileSize, isValidImageType } from '@/lib/image-compression';
import type { Theme, ThemeUpdate } from '@/lib/types';

interface EditThemePageProps {
  params: Promise<{ id: string }>;
}

export default function EditThemePage({ params }: EditThemePageProps) {
  return <EditThemePageClient params={params} />;
}

function EditThemePageClient({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [formData, setFormData] = useState<ThemeUpdate>({
    name: '',
    slug: '',
    description: '',
    base_prompt_template: '',
    style_keywords: [],
    seasonal_relevance: {},
    difficulty_level: 1,
    is_active: true,
    sort_order: 0,
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
    loadTheme(id);
  }, [id]);

  const loadTheme = async (themeId: string) => {
    try {
      setLoading(true);
      const data = await supabaseService.getTheme(themeId);
      setTheme(data);
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description,
        base_prompt_template: data.base_prompt_template,
        style_keywords: data.style_keywords || [],
        seasonal_relevance: data.seasonal_relevance || {},
        difficulty_level: data.difficulty_level,
        is_active: data.is_active,
        sort_order: data.sort_order,
        hero_image_url: data.hero_image_url || '',
        hero_image_alt: data.hero_image_alt || ''
      });
    } catch (error) {
      alert('Failed to load theme');
      router.push('/admin/themes');
    } finally {
      setLoading(false);
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
    if (!id) throw new Error('No theme ID available');
    
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('type', 'hero-image');
    formDataUpload.append('entity', 'theme');
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
      if (!id) throw new Error('No theme ID available');
      
      let finalData = {
        ...formData,
        style_keywords: formData.style_keywords?.filter(keyword => keyword.trim() !== '') || []
      };

      // Upload hero image if a new one was selected
      if (heroImageFile) {
        const uploadedUrl = await uploadHeroImage(heroImageFile);
        finalData.hero_image_url = uploadedUrl;
      }

      const response = await fetch(`/api/themes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        throw new Error('Failed to update theme');
      }

      router.push('/admin/themes');
    } catch (error) {
      alert('Failed to update theme: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!theme) return;
    
    if (!confirm(`Are you sure you want to delete "${theme.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      if (!id) throw new Error('No theme ID available');
      
      const response = await fetch(`/api/themes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete theme');
      }

      router.push('/admin/themes');
    } catch (error) {
      alert('Failed to delete theme: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...(formData.style_keywords || [])];
    newKeywords[index] = value;
    setFormData({ ...formData, style_keywords: newKeywords });
  };

  const addKeyword = () => {
    setFormData({ 
      ...formData, 
      style_keywords: [...(formData.style_keywords || []), ''] 
    });
  };

  const removeKeyword = (index: number) => {
    const newKeywords = (formData.style_keywords || []).filter((_, i) => i !== index);
    setFormData({ ...formData, style_keywords: newKeywords });
  };

  if (loading || !id) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center text-red-600">Theme not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/admin/themes" className="flex items-center hover:text-purple-600">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Themes
            </Link>
          </div>
          <Button
            onClick={handleDelete}
            variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Theme
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Theme: {theme.name}</h1>
          <p className="text-gray-600 mt-2">Update theme information for AI prompt generation</p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Theme Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Theme Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Christmas Portrait"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g., christmas-portrait"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the theme and its visual characteristics..."
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

                <div>
                  <Label htmlFor="base_prompt_template">Base Prompt Template *</Label>
                  <Textarea
                    id="base_prompt_template"
                    value={formData.base_prompt_template}
                    onChange={(e) => setFormData({ ...formData, base_prompt_template: e.target.value })}
                    placeholder="A [BREED] in a [THEME_STYLE] setting..."
                    rows={4}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="difficulty_level">Difficulty Level (1-5)</Label>
                  <Input
                    id="difficulty_level"
                    type="number"
                    value={formData.difficulty_level}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      difficulty_level: parseInt(e.target.value) || 1 
                    })}
                    min="1"
                    max="5"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      sort_order: parseInt(e.target.value) || 0 
                    })}
                  />
                </div>
              </div>

              {/* Style Keywords */}
              <div>
                <Label>Style Keywords</Label>
                <div className="space-y-2">
                  {(formData.style_keywords || []).map((keyword, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        value={keyword}
                        onChange={(e) => handleKeywordChange(index, e.target.value)}
                        placeholder="e.g., festive, warm lighting, cozy"
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        size="sm"
                        onClick={() => removeKeyword(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={addKeyword}
                  >
                    Add Keyword
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
                <Link href="/admin/themes">
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