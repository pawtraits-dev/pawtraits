'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Edit, 
  Eye, 
  EyeOff, 
  Trash2, 
  Upload,
  Save,
  X,
  ArrowLeft,
  GripVertical,
  Image as ImageIcon
} from 'lucide-react';
import { 
  CarouselWithSlides, 
  CarouselSlide, 
  CarouselSlideFormData,
  TextPositionOptions,
  TextColorOptions,
  CTAStyleOptions,
  DefaultSlideSettings 
} from '@/lib/carousel-types';
import { compressImage, formatFileSize, isValidImageType } from '@/lib/image-compression';

export default function CarouselSlidesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [carousel, setCarousel] = useState<CarouselWithSlides | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);
  const [showNewSlideForm, setShowNewSlideForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<CarouselSlideFormData | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCarousel();
  }, [params.id]);

  const loadCarousel = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/carousels/${params.id}`);
      if (!response.ok) throw new Error('Failed to load carousel');
      
      const data = await response.json();
      setCarousel(data);
    } catch (err) {
      console.error('Error loading carousel:', err);
      setError(err instanceof Error ? err.message : 'Failed to load carousel');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!carousel || !file) return null;

    // Validate file type
    if (!isValidImageType(file)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP)');
      return null;
    }

    setUploading(true);
    try {
      console.log(`Original file: ${file.name} (${formatFileSize(file.size)})`);
      
      // Compress if file is larger than 2MB
      let processedFile = file;
      if (file.size > 2 * 1024 * 1024) {
        console.log('Compressing image for carousel upload...');
        processedFile = await compressImage(file, {
          maxWidth: 1920,  // Hero images can be larger
          maxHeight: 1080,
          quality: 0.85,
          maxSizeKB: 8192  // 8MB max for hero images
        });
        console.log(`Compressed file: ${processedFile.name} (${formatFileSize(processedFile.size)})`);
      }

      const uploadFormData = new FormData();
      uploadFormData.append('file', processedFile);
      uploadFormData.append('pageType', carousel.page_type);
      uploadFormData.append('slideName', `slide_${Date.now()}`);

      const response = await fetch('/api/admin/carousel-upload', {
        method: 'POST',
        body: uploadFormData
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      return result.data;
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleCreateSlide = async (slideData: CarouselSlideFormData) => {
    try {
      const response = await fetch('/api/admin/carousel-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slideData)
      });

      if (!response.ok) throw new Error('Failed to create slide');
      
      await loadCarousel(); // Refresh the data
      setShowNewSlideForm(false);
      setFormData(null);
    } catch (err) {
      console.error('Error creating slide:', err);
      setError(err instanceof Error ? err.message : 'Failed to create slide');
    }
  };

  const handleUpdateSlide = async (slideId: string, updates: Partial<CarouselSlide>) => {
    try {
      const response = await fetch(`/api/admin/carousel-slides/${slideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update slide');
      
      await loadCarousel(); // Refresh the data
      setEditingSlide(null);
    } catch (err) {
      console.error('Error updating slide:', err);
      setError(err instanceof Error ? err.message : 'Failed to update slide');
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;

    try {
      const response = await fetch(`/api/admin/carousel-slides/${slideId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete slide');
      
      await loadCarousel(); // Refresh the data
    } catch (err) {
      console.error('Error deleting slide:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete slide');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !carousel) return;

    const uploadResult = await handleImageUpload(file);
    if (uploadResult) {
      console.log('Upload result:', uploadResult);
      const newFormData: CarouselSlideFormData = {
        ...DefaultSlideSettings,
        carousel_id: carousel.id,
        image_url: uploadResult.url,
        cloudinary_public_id: uploadResult.public_id,
        image_alt: `Slide image for ${carousel.name}`
      };
      
      console.log('New form data:', newFormData);
      setFormData(newFormData);
      setShowNewSlideForm(true);
    }
  };

  const NewSlideForm = ({ onSubmit, initialData }: { 
    onSubmit: (data: CarouselSlideFormData) => void; 
    initialData?: CarouselSlideFormData;
  }) => {
    const [data, setData] = useState<CarouselSlideFormData>(() => {
      if (initialData) {
        // Ensure carousel_id is set even in initialData
        return {
          ...initialData,
          carousel_id: carousel?.id || initialData.carousel_id || ''
        };
      }
      
      return {
        ...DefaultSlideSettings,
        carousel_id: carousel?.id || ''
      };
    });

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Add New Slide
            <Button variant="ghost" size="sm" onClick={() => setShowNewSlideForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Image</label>
            {data.image_url ? (
              <div className="relative">
                <img 
                  src={data.image_url} 
                  alt="Slide preview" 
                  className="w-full h-32 object-cover rounded border"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2"
                >
                  Change Image
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-32 border-dashed"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Compressing & Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 mr-2" />
                    Upload Carousel Image
                  </>
                )}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-xs text-gray-500 mt-2">
              Supports JPEG, PNG, and WebP files. Images over 2MB will be automatically compressed.
            </p>
          </div>

          {/* Content Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input
                value={data.title || ''}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                placeholder="Slide title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Subtitle</label>
              <Input
                value={data.subtitle || ''}
                onChange={(e) => setData({ ...data, subtitle: e.target.value })}
                placeholder="Slide subtitle"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <Textarea
              value={data.description || ''}
              onChange={(e) => setData({ ...data, description: e.target.value })}
              placeholder="Slide description"
              rows={3}
            />
          </div>

          {/* CTA Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">CTA Text</label>
              <Input
                value={data.cta_text || ''}
                onChange={(e) => setData({ ...data, cta_text: e.target.value })}
                placeholder="Button text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">CTA URL</label>
              <Input
                value={data.cta_url || ''}
                onChange={(e) => setData({ ...data, cta_url: e.target.value })}
                placeholder="/page or https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">CTA Style</label>
              <select
                value={data.cta_style}
                onChange={(e) => setData({ ...data, cta_style: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {CTAStyleOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Display Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Text Position</label>
              <select
                value={data.text_position}
                onChange={(e) => setData({ ...data, text_position: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {TextPositionOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Text Color</label>
              <select
                value={data.text_color}
                onChange={(e) => setData({ ...data, text_color: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {TextColorOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Overlay Opacity (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={data.overlay_opacity}
                onChange={(e) => setData({ ...data, overlay_opacity: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={data.show_overlay}
                onChange={(e) => setData({ ...data, show_overlay: e.target.checked })}
                className="mr-2"
              />
              Show Overlay
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={data.is_active}
                onChange={(e) => setData({ ...data, is_active: e.target.checked })}
                className="mr-2"
              />
              Active
            </label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowNewSlideForm(false)}>
              Cancel
            </Button>
            <Button onClick={() => onSubmit(data)} disabled={!data.image_url || !carousel?.id}>
              <Save className="w-4 h-4 mr-2" />
              Save Slide
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
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
                {carousel.page_type?.charAt(0).toUpperCase() + carousel.page_type?.slice(1) || 'Unknown'} Page Carousel
              </p>
            </div>
          </div>
          <Button onClick={() => setShowNewSlideForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Slide
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      {/* New Slide Form */}
      {showNewSlideForm && (
        <NewSlideForm 
          onSubmit={handleCreateSlide}
          initialData={formData || undefined}
        />
      )}

      {/* Slides List */}
      <div className="space-y-4">
        {carousel.slides.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No slides yet</h3>
              <p className="text-gray-600 mb-4">Add your first slide to get started</p>
              <Button onClick={() => setShowNewSlideForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Slide
              </Button>
            </CardContent>
          </Card>
        ) : (
          carousel.slides.map((slide, index) => (
            <Card key={slide.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start space-x-6">
                  {/* Drag Handle */}
                  <div className="flex items-center justify-center w-6 h-full pt-2">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                  </div>

                  {/* Image Preview */}
                  <div className="w-32 h-20 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={slide.image_url}
                      alt={slide.image_alt || 'Slide'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {slide.title || `Slide ${index + 1}`}
                        </h3>
                        {slide.subtitle && (
                          <p className="text-sm text-gray-600 mb-2">{slide.subtitle}</p>
                        )}
                        {slide.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">{slide.description}</p>
                        )}
                        
                        <div className="flex items-center space-x-4 mt-3">
                          <Badge variant={slide.is_active ? 'default' : 'secondary'}>
                            {slide.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {slide.cta_text && (
                            <Badge variant="outline">{slide.cta_text}</Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            Position: {slide.text_position}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleUpdateSlide(slide.id, { is_active: !slide.is_active })}
                          className={`p-2 rounded ${
                            slide.is_active 
                              ? 'text-green-600 hover:bg-green-50' 
                              : 'text-gray-400 hover:bg-gray-50'
                          }`}
                          title={slide.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {slide.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSlide(slide.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}