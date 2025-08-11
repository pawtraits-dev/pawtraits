'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Wand2, RefreshCw, Download, Upload, Image, X, Star, Eye, Sparkles } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';
import { generateImageMetadata } from '@/lib/metadata-generator';
import type { Breed, Theme, Style, Format, Coat, BreedCoatDetail } from '@/lib/types';

export default function GeneratePromptsPage() {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [availableCoats, setAvailableCoats] = useState<BreedCoatDetail[]>([]);
  
  const [selectedBreed, setSelectedBreed] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedCoat, setSelectedCoat] = useState<string>('');
  
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Image upload states
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageDescription, setImageDescription] = useState('');
  const [imageTags, setImageTags] = useState('');
  const [imageRating, setImageRating] = useState(0);
  const [isImageFeatured, setIsImageFeatured] = useState(false);
  const [isImagePublic, setIsImagePublic] = useState(true);
  const [uploadResults, setUploadResults] = useState<any[]>([]);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBreed) {
      loadAvailableCoats(selectedBreed);
    } else {
      setAvailableCoats([]);
      setSelectedCoat('');
    }
  }, [selectedBreed]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [breedsData, themesData, stylesData, formatsData] = await Promise.all([
        supabaseService.getBreeds(),
        supabaseService.getThemes(),
        supabaseService.getStyles(),
        supabaseService.getFormats(),
      ]);

      setBreeds(breedsData?.filter((b: any) => b.is_active) || []);
      setThemes(themesData?.filter((t: any) => t.is_active) || []);
      setStyles(stylesData?.filter((s: any) => s.is_active) || []);
      setFormats(formatsData?.filter((f: any) => f.is_active) || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCoats = async (breedId: string) => {
    try {
      const response = await fetch(`/api/breed-coats?breed_id=${breedId}`);
      if (!response.ok) return;
      const data = await response.json();
      
      const transformedData = data.map((item: any) => ({
        id: item.id,
        breed_name: item.breeds.name,
        coat_name: item.coats.name,
        coat_slug: item.coats.slug,
        hex_color: item.coats.hex_color,
        pattern_type: item.coats.pattern_type,
        rarity: item.coats.rarity,
        is_common: item.is_common,
        popularity_rank: item.popularity_rank
      }));
      
      setAvailableCoats(transformedData);
    } catch (error) {
      console.error('Error loading coats:', error);
    }
  };

  const generatePrompt = () => {
    setGenerating(true);
    
    // Simulate generation delay
    setTimeout(() => {
      const breed = breeds.find(b => b.id === selectedBreed);
      const theme = themes.find(t => t.id === selectedTheme);
      const style = styles.find(s => s.id === selectedStyle);
      const format = formats.find(f => f.id === selectedFormat);
      const coat = availableCoats.find(c => c.id === selectedCoat);

      if (!breed) {
        setGeneratedPrompt('Please select a breed to generate a prompt.');
        setGenerating(false);
        return;
      }

      let prompt = `A beautiful ${breed.name.toLowerCase()}`;
      
      if (coat) {
        prompt += ` with ${coat.coat_name.toLowerCase()} coat`;
      }
      
      if (theme) {
        prompt += `, ${theme.base_prompt_template.replace('[BREED]', breed.name.toLowerCase())}`;
      }
      
      if (style) {
        prompt += `, ${style.prompt_suffix}`;
      }
      
      if (format) {
        prompt += `. ${format.prompt_adjustments || ''}`;
        if (format.midjourney_parameters) {
          prompt += ` ${format.midjourney_parameters}`;
        }
      }

      // Add some personality traits
      if (breed.personality_traits && breed.personality_traits.length > 0) {
        const traits = breed.personality_traits.slice(0, 2).join(', ');
        prompt += `. The dog should appear ${traits.toLowerCase()}.`;
      }

      prompt += ' Professional photography, high quality, detailed.';

      setGeneratedPrompt(prompt);
      setGenerating(false);
      setShowUploadSection(true); // Show upload section after generating prompt
    }, 1000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
  };

  const resetForm = () => {
    setSelectedBreed('');
    setSelectedTheme('');
    setSelectedStyle('');
    setSelectedFormat('');
    setSelectedCoat('');
    setGeneratedPrompt('');
    setShowUploadSection(false);
    setUploadedImages([]);
    setImageDescription('');
    setImageTags('');
    setImageRating(0);
    setIsImageFeatured(false);
    setUploadResults([]);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });
    
    setUploadedImages(prev => [...prev, ...validFiles]);
    
    // Auto-generate metadata when first image is uploaded
    if (validFiles.length > 0 && uploadedImages.length === 0) {
      generateMetadata();
    }
  };

  const generateMetadata = () => {
    if (!generatedPrompt) return;
    
    // Get selected entities
    const breed = breeds.find(b => b.id === selectedBreed);
    const theme = themes.find(t => t.id === selectedTheme);
    const style = styles.find(s => s.id === selectedStyle);
    const format = formats.find(f => f.id === selectedFormat);
    const coat = availableCoats.find(c => c.id === selectedCoat);
    
    const metadata = generateImageMetadata({
      promptText: generatedPrompt,
      breed,
      theme,
      style,
      format,
      coat: coat ? {
        name: coat.coat_name,
        pattern_type: coat.pattern_type,
        rarity: coat.rarity
      } : undefined
    });
    
    // Auto-populate if fields are empty
    if (!imageDescription) {
      setImageDescription(metadata.description);
    }
    
    if (!imageTags) {
      setImageTags(metadata.tags.join(', '));
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (!uploadedImages.length || !generatedPrompt) return;
    
    setUploading(true);
    const results = [];
    
    try {
      for (const file of uploadedImages) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('prompt_text', generatedPrompt);
        formData.append('description', imageDescription);
        formData.append('tags', JSON.stringify(imageTags.split(',').map(t => t.trim()).filter(Boolean)));
        formData.append('breed_id', selectedBreed || '');
        formData.append('theme_id', selectedTheme || '');
        formData.append('style_id', selectedStyle || '');
        formData.append('format_id', selectedFormat || '');
        formData.append('coat_id', selectedCoat || '');
        formData.append('rating', imageRating.toString());
        formData.append('is_featured', isImageFeatured.toString());
        formData.append('is_public', isImagePublic.toString());
        
        const response = await fetch('/api/images', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const result = await response.json();
          results.push({ success: true, filename: file.name, data: result });
        } else {
          const error = await response.json();
          results.push({ success: false, filename: file.name, error: error.error });
        }
      }
      
      setUploadResults(results);
      
      // Clear uploaded files if all were successful
      if (results.every(r => r.success)) {
        setUploadedImages([]);
        setImageDescription('');
        setImageTags('');
        setImageRating(0);
        setIsImageFeatured(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload images');
    } finally {
      setUploading(false);
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 AI Prompt Generator
          </h1>
          <p className="text-lg text-gray-600">
            Create perfect AI prompts for pet portraits using your configured breeds, themes, styles, and formats
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5" />
                <span>Prompt Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Breed Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Breed *
                </label>
                <Select value={selectedBreed} onValueChange={setSelectedBreed}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a breed..." />
                  </SelectTrigger>
                  <SelectContent>
                    {breeds.map(breed => (
                      <SelectItem key={breed.id} value={breed.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{breed.name}</span>
                          {breed.popularity_rank && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              #{breed.popularity_rank}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Coat Selection */}
              {availableCoats.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coat Color
                  </label>
                  <Select value={selectedCoat} onValueChange={setSelectedCoat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a coat color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCoats.map(coat => (
                        <SelectItem key={coat.id} value={coat.id}>
                          <div className="flex items-center space-x-2">
                            <div 
                              className="w-4 h-4 rounded-full border border-gray-300"
                              style={{ backgroundColor: coat.hex_color }}
                            ></div>
                            <span>{coat.coat_name}</span>
                            {coat.is_common && (
                              <Badge variant="outline" className="text-xs">Common</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a theme..." />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map(theme => (
                      <SelectItem key={theme.id} value={theme.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{theme.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            Level {theme.difficulty_level}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Style
                </label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a style..." />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map(style => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a format..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.map(format => (
                      <SelectItem key={format.id} value={format.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{format.name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {format.aspect_ratio}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={generatePrompt}
                  disabled={!selectedBreed || generating}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Prompt
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Generated Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Prompt</span>
                {generatedPrompt && (
                  <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedPrompt ? (
                <div className="space-y-4">
                  <Textarea
                    value={generatedPrompt}
                    onChange={(e) => setGeneratedPrompt(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="Your generated prompt will appear here..."
                  />
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={copyToClipboard} className="flex-1">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Prompt
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Save as File
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Wand2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a breed and click "Generate Prompt" to create your AI prompt.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selection Summary */}
        {(selectedBreed || selectedTheme || selectedStyle || selectedFormat || selectedCoat) && (
          <Card>
            <CardHeader>
              <CardTitle>Current Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedBreed && (
                  <Badge variant="secondary">
                    Breed: {breeds.find(b => b.id === selectedBreed)?.name}
                  </Badge>
                )}
                {selectedCoat && (
                  <Badge variant="secondary" className="flex items-center space-x-1">
                    <div 
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: availableCoats.find(c => c.id === selectedCoat)?.hex_color }}
                    ></div>
                    <span>Coat: {availableCoats.find(c => c.id === selectedCoat)?.coat_name}</span>
                  </Badge>
                )}
                {selectedTheme && (
                  <Badge variant="secondary">
                    Theme: {themes.find(t => t.id === selectedTheme)?.name}
                  </Badge>
                )}
                {selectedStyle && (
                  <Badge variant="secondary">
                    Style: {styles.find(s => s.id === selectedStyle)?.name}
                  </Badge>
                )}
                {selectedFormat && (
                  <Badge variant="secondary">
                    Format: {formats.find(f => f.id === selectedFormat)?.name}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Image Upload Section */}
        {showUploadSection && generatedPrompt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Upload Generated Images</span>
              </CardTitle>
              <p className="text-sm text-gray-600">
                Upload the images you generated using this prompt to add them to your catalog
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Images
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports JPEG, PNG, WebP. Maximum 10MB per image.
                </p>
              </div>

              {/* Image Previews */}
              {uploadedImages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Images ({uploadedImages.length})
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {uploadedImages.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
                          {file.name.substring(0, 10)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata Fields */}
              {uploadedImages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-700">Image Metadata</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generateMetadata}
                      className="text-purple-600 border-purple-300 hover:bg-purple-50"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Auto-Generate
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <Textarea
                      value={imageDescription}
                      onChange={(e) => setImageDescription(e.target.value)}
                      placeholder="Describe the generated images..."
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma separated)
                    </label>
                    <Textarea
                      value={imageTags}
                      onChange={(e) => setImageTags(e.target.value)}
                      placeholder="cute, professional, outdoor, portrait"
                      rows={3}
                    />
                  </div>
                  
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rating (1-5 stars)
                      </label>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setImageRating(rating)}
                            className={`p-1 ${imageRating >= rating ? 'text-yellow-500' : 'text-gray-300'} hover:text-yellow-400`}
                          >
                            <Star className="w-5 h-5 fill-current" />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="featured"
                          checked={isImageFeatured}
                          onChange={(e) => setIsImageFeatured(e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="featured" className="text-sm text-gray-700">
                          Featured image
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="public"
                          checked={isImagePublic}
                          onChange={(e) => setIsImagePublic(e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="public" className="text-sm text-gray-700">
                          Public (visible in catalog)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              {uploadedImages.length > 0 && (
                <div className="flex space-x-2">
                  <Button
                    onClick={uploadImages}
                    disabled={uploading}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Uploading {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''} to Catalog
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadedImages([]);
                      setUploadResults([]);
                    }}
                    disabled={uploading}
                  >
                    Clear
                  </Button>
                </div>
              )}

              {/* Upload Results */}
              {uploadResults.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Results
                  </label>
                  <div className="space-y-2">
                    {uploadResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          result.success
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{result.filename}</span>
                          <span className="text-sm">
                            {result.success ? '✓ Uploaded successfully' : '✗ Failed'}
                          </span>
                        </div>
                        {result.error && (
                          <p className="text-sm mt-1">{result.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}