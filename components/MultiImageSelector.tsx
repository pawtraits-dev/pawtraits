'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, Image as ImageIcon } from 'lucide-react';

interface MultiImageSelectorProps {
  productId: string;
  productName: string;
  imageCount: number; // 4, 6, or 8
  onComplete: (selectedImageIds: string[]) => void;
  onCancel?: () => void;
}

interface CatalogImage {
  id: string;
  public_url: string;
  description: string;
  filename: string;
}

export function MultiImageSelector({
  productId,
  productName,
  imageCount,
  onComplete,
  onCancel
}: MultiImageSelectorProps) {
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [catalogImages, setCatalogImages] = useState<CatalogImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCatalogImages();
  }, []);

  async function loadCatalogImages() {
    try {
      setLoading(true);
      const response = await fetch('/api/images?public=true&limit=100');

      if (!response.ok) {
        throw new Error('Failed to load images');
      }

      const data = await response.json();
      setCatalogImages(data || []);
    } catch (err: any) {
      console.error('Error loading catalog images:', err);
      setError('Failed to load catalog images. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function toggleImageSelection(imageId: string) {
    setSelectedImages(prev => {
      if (prev.includes(imageId)) {
        // Deselect image
        return prev.filter(id => id !== imageId);
      } else if (prev.length < imageCount) {
        // Select image (if not at max)
        return [...prev, imageId];
      } else {
        // Already at max, can't select more
        return prev;
      }
    });
  }

  function handleComplete() {
    if (selectedImages.length === imageCount) {
      onComplete(selectedImages);
    }
  }

  function handleClear() {
    setSelectedImages([]);
  }

  const isImageSelected = (imageId: string) => selectedImages.includes(imageId);
  const selectionComplete = selectedImages.length === imageCount;
  const canSelectMore = selectedImages.length < imageCount;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading images...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertDescription className="text-red-800">{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Select {imageCount} Images for Your {productName}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Choose {imageCount} different pet portraits for your personalized set
            </p>
          </div>
          <Badge
            variant={selectionComplete ? "default" : "outline"}
            className={selectionComplete ? "bg-green-600" : ""}
          >
            {selectedImages.length}/{imageCount} selected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Selection Progress */}
        <div className="bg-gray-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Selection Progress</span>
            {selectedImages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="text-xs"
              >
                Clear All
              </Button>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${
                selectionComplete ? 'bg-green-600' : 'bg-blue-600'
              }`}
              style={{ width: `${(selectedImages.length / imageCount) * 100}%` }}
            ></div>
          </div>
          {!selectionComplete && (
            <p className="text-xs text-gray-600 mt-2">
              Select {imageCount - selectedImages.length} more {imageCount - selectedImages.length === 1 ? 'image' : 'images'}
            </p>
          )}
          {selectionComplete && (
            <p className="text-xs text-green-700 mt-2 flex items-center">
              <Check className="w-3 h-3 mr-1" />
              Selection complete! Click "Add to Cart" to continue.
            </p>
          )}
        </div>

        {/* Image Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto p-2">
          {catalogImages.map((image) => {
            const isSelected = isImageSelected(image.id);
            const selectionIndex = selectedImages.indexOf(image.id);

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => toggleImageSelection(image.id)}
                disabled={!canSelectMore && !isSelected}
                className={`
                  relative rounded-lg overflow-hidden border-2 transition-all
                  ${isSelected
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!canSelectMore && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <img
                  src={image.public_url}
                  alt={image.filename}
                  className="w-full h-32 object-cover"
                />

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-sm shadow-lg">
                    {selectionIndex + 1}
                  </div>
                )}

                {/* Deselect button */}
                {isSelected && (
                  <div className="absolute top-2 left-2">
                    <div className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg">
                      <X className="w-4 h-4" />
                    </div>
                  </div>
                )}

                {/* Image title */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <p className="text-xs text-white truncate">
                    {image.filename}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {catalogImages.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No catalog images found</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleComplete}
            disabled={!selectionComplete}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            Add to Cart
          </Button>
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
