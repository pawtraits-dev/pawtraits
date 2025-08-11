'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Upload, Image as ImageIcon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { ThemeCreate } from '@/lib/types';

export default function AddThemePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [seedImage, setSeedImage] = useState<File | null>(null);
  const [seedImagePreview, setSeedImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<ThemeCreate>({
    name: '',
    slug: '',
    description: '',
    base_prompt_template: '',
    style_keywords: [],
    seasonal_relevance: {},
    difficulty_level: 1,
    is_active: true,
    sort_order: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalData = {
        ...formData,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        style_keywords: formData.style_keywords.filter(keyword => keyword.trim() !== '')
      };

      const response = await fetch('/api/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        throw new Error('Failed to create theme');
      }

      router.push('/admin/themes');
    } catch (error) {
      alert('Failed to create theme: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordChange = (index: number, value: string) => {
    const newKeywords = [...formData.style_keywords];
    newKeywords[index] = value;
    setFormData({ ...formData, style_keywords: newKeywords });
  };

  const addKeyword = () => {
    setFormData({ 
      ...formData, 
      style_keywords: [...formData.style_keywords, ''] 
    });
  };

  const removeKeyword = (index: number) => {
    const newKeywords = formData.style_keywords.filter((_, i) => i !== index);
    setFormData({ ...formData, style_keywords: newKeywords });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSeedImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSeedImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setSeedImage(null);
    setSeedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateThemeFromImage = async () => {
    if (!seedImage) return;

    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', seedImage);

      const response = await fetch('/api/themes/generate-from-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze image');
      }

      const themeData = await response.json();
      
      // Populate form with AI-generated data
      setFormData(prev => ({
        ...prev,
        name: themeData.name || prev.name,
        description: themeData.description || prev.description,
        base_prompt_template: themeData.base_prompt_template || prev.base_prompt_template,
        style_keywords: themeData.style_keywords || prev.style_keywords,
        seasonal_relevance: themeData.seasonal_relevance || prev.seasonal_relevance,
        difficulty_level: themeData.difficulty_level || prev.difficulty_level,
      }));

      alert('Theme details generated successfully! Review and modify as needed.');
    } catch (error) {
      console.error('Error generating theme:', error);
      alert('Failed to generate theme: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/admin/themes" className="flex items-center hover:text-purple-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Themes
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Theme</h1>
          <p className="text-gray-600 mt-2">Create a new theme for AI prompt generation</p>
        </div>

        {/* AI Image Analysis Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Sparkles className="w-5 h-5 mr-2" />
              AI Theme Generation (Optional)
            </CardTitle>
            <p className="text-sm text-gray-600">
              Upload a seed image to automatically generate theme details using AI analysis
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="seed-image">Upload Seed Image</Label>
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  id="seed-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {!seedImagePreview ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 transition-colors"
                  >
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Click to upload an image</p>
                    <p className="text-sm text-gray-500 mt-1">JPEG, PNG, WebP, or GIF (max 10MB)</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative inline-block">
                      <Image
                        src={seedImagePreview}
                        alt="Seed image preview"
                        width={300}
                        height={200}
                        className="rounded-lg object-cover border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={clearImage}
                        className="absolute top-2 right-2"
                      >
                        ×
                      </Button>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={generateThemeFromImage}
                      disabled={aiLoading}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {aiLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analyzing Image...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Theme from Image
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

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
                  <Label htmlFor="slug">URL Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g., christmas-portrait (auto-generated if empty)"
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
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Style Keywords */}
              <div>
                <Label>Style Keywords</Label>
                <div className="space-y-2">
                  {formData.style_keywords.map((keyword, index) => (
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
                      Create Theme
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