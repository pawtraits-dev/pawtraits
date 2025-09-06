'use client';

import { useState, useEffect } from 'react';
import { X, Download, Share2, ShoppingCart, Heart, Star, Wand2, Copy } from 'lucide-react';
import { PawSpinner } from '@/components/ui/paw-spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CloudinaryImageDisplay } from '@/components/CloudinaryImageDisplay';
import ProductSelectionModal from '@/components/ProductSelectionModal';
import { VariationsSelector } from '@/components/VariationsSelector';
import ReactMarkdown from 'react-markdown';
import type { Product, ProductPricing } from '@/lib/product-types';
import type { Breed, Outfit, Format, BreedCoatDetail } from '@/lib/types';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageId: string;
  imageData?: {
    id: string;
    description?: string;
    prompt_text?: string;
    breed_name?: string;
    theme_name?: string;
    style_name?: string;
    coat_name?: string;
    is_featured?: boolean;
    rating?: number;
    tags?: string[];
    public_url?: string;
    image_url?: string;
  };
  onBuyClick?: () => void;
  onLikeClick?: () => void;
  onShareClick?: () => void;
  onDownloadClick?: () => void;
  isLiked?: boolean;
  isShared?: boolean;
  isPurchased?: boolean;
  showActions?: boolean;
  products?: Product[];
  pricing?: ProductPricing[];
  isAdminMode?: boolean;
  breeds?: Breed[];
  availableCoats?: BreedCoatDetail[];
  outfits?: Outfit[];
  formats?: Format[];
  onVariationsGenerated?: () => void;
}

export default function ImageModal({
  isOpen,
  onClose,
  imageId,
  imageData,
  onBuyClick,
  onLikeClick,
  onShareClick,
  onDownloadClick,
  isLiked = false,
  isShared = false,
  isPurchased = false,
  showActions = true,
  products = [],
  pricing = [],
  isAdminMode = false,
  breeds = [],
  availableCoats = [],
  outfits = [],
  formats = [],
  onVariationsGenerated
}: ImageModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showVariations, setShowVariations] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [variationResults, setVariationResults] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setImageLoaded(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const handleGenerateVariations = async (config: {
    breeds: string[];
    coats: string[];
    outfits: string[];
    formats: string[];
  }) => {
    if (!imageData?.prompt_text || !imageId) return;
    
    setIsGeneratingVariations(true);
    setVariationResults([]);
    
    try {
      // Download the original image to get base64 data
      const imageResponse = await fetch(`/api/images/${imageId}/download`);
      if (!imageResponse.ok) {
        throw new Error('Failed to download original image');
      }
      
      const imageBlob = await imageResponse.blob();
      const imageData64 = await blobToBase64(imageBlob);
      
      const response = await fetch('/api/admin/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageData: imageData64,
          originalPrompt: imageData.prompt_text,
          currentBreed: '', // Will extract from prompt
          currentTheme: '', // Will extract from prompt  
          currentStyle: '', // Will extract from prompt
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
      
      if (onVariationsGenerated) {
        onVariationsGenerated();
      }
      
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
    if (imageData?.prompt_text) {
      navigator.clipboard.writeText(imageData.prompt_text);
      alert('Prompt copied to clipboard!');
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 transition-all"
        >
          <X className="w-6 h-6 text-gray-700" />
        </button>

        <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
          {/* Image Section */}
          <div className="flex-1 bg-gray-100 flex items-center justify-center relative min-h-[60vh] lg:min-h-[70vh]">
            <div className="w-full h-full flex items-center justify-center p-4">
              <CloudinaryImageDisplay
                imageId={imageId}
                variant="full_size"
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                alt={imageData?.description || imageData?.prompt_text || 'Pet portrait'}
                fallbackUrl={imageData?.public_url || imageData?.image_url}
                onLoad={() => setImageLoaded(true)}
              />
            </div>
            
            {/* Loading overlay */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <PawSpinner size="lg" />
                  <div className="text-gray-500">Loading high resolution image...</div>
                </div>
              </div>
            )}

            {/* Image badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {imageData?.is_featured && (
                <Badge className="bg-yellow-500 text-white">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  Featured
                </Badge>
              )}
              {isPurchased && (
                <Badge className="bg-green-500 text-white">
                  Purchased
                </Badge>
              )}
              {imageData?.rating && imageData.rating > 0 && (
                <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                  {renderStars(imageData.rating)}
                </div>
              )}
            </div>
          </div>

          {/* Info Panel */}
          <div className="lg:w-80 bg-white p-6 overflow-y-auto">
            <div className="space-y-4">
              {/* AI Description */}
              <div>
                {imageData?.description ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({children}) => <h2 className="text-xl font-bold text-gray-900 mb-2">{children}</h2>,
                        h2: ({children}) => <h3 className="text-lg font-semibold text-gray-800 mb-2">{children}</h3>,
                        p: ({children}) => <p className="text-sm text-gray-600 mb-2">{children}</p>,
                        strong: ({children}) => <strong className="font-bold text-gray-900">{children}</strong>,
                        em: ({children}) => <em className="italic text-gray-700">{children}</em>,
                      }}
                    >
                      {imageData.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Pet Portrait</h2>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-2">
                {imageData?.breed_name && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Breed</Badge>
                    <span className="text-sm text-gray-700">{imageData.breed_name}</span>
                  </div>
                )}
                {imageData?.theme_name && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Theme</Badge>
                    <span className="text-sm text-gray-700">{imageData.theme_name}</span>
                  </div>
                )}
                {imageData?.style_name && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Style</Badge>
                    <span className="text-sm text-gray-700">{imageData.style_name}</span>
                  </div>
                )}
                {imageData?.coat_name && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Coat</Badge>
                    <span className="text-sm text-gray-700">{imageData.coat_name}</span>
                  </div>
                )}
              </div>


              {/* Admin-only: Prompt Display */}
              {isAdminMode && imageData?.prompt_text && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">Midjourney Prompt</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyPromptToClipboard}
                      className="p-1 h-auto"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-700 font-mono break-words">
                      {imageData.prompt_text}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              {showActions && (
                <div className="pt-4 border-t space-y-3">
                  <div className="flex gap-2">
                    {onLikeClick && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onLikeClick}
                        className={isLiked ? 'bg-red-50 border-red-200 text-red-700' : ''}
                      >
                        <Heart className={`w-4 h-4 mr-2 ${isLiked ? 'fill-current' : ''}`} />
                        {isLiked ? 'Liked' : 'Like'}
                      </Button>
                    )}
                    {onShareClick && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onShareClick}
                        className={isShared ? 'bg-blue-50 border-blue-200 text-blue-700' : ''}
                      >
                        <Share2 className="w-4 h-4 mr-2" />
                        Share
                      </Button>
                    )}
                  </div>

                  {isPurchased && onDownloadClick && (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={onDownloadClick}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download High Resolution
                    </Button>
                  )}

                  {!isPurchased && (
                    <Button
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                      onClick={() => {
                        if (products.length > 0 && pricing.length > 0) {
                          setShowProductModal(true);
                        } else if (onBuyClick) {
                          onBuyClick();
                        }
                      }}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Buy Now
                    </Button>
                  )}

                  {/* Admin-only: Generate Variations */}
                  {isAdminMode && imageData?.prompt_text && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowVariations(!showVariations)}
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      {showVariations ? 'Hide' : 'Generate'} Variations
                    </Button>
                  )}
                </div>
              )}

              {/* Admin-only: Variations Section */}
              {isAdminMode && showVariations && (
                <div className="pt-4 border-t">
                  <div className="max-h-96 overflow-y-auto">
                    <VariationsSelector
                      originalImage={null} // We'll get it from the existing image
                      originalPrompt={imageData?.prompt_text || ''}
                      currentBreed={''} // Will extract from metadata
                      breeds={breeds}
                      availableCoats={availableCoats}
                      outfits={outfits}
                      formats={formats}
                      onGenerateVariations={handleGenerateVariations}
                      isGenerating={isGeneratingVariations}
                    />
                  </div>
                </div>
              )}

              {/* Variation Results */}
              {variationResults.length > 0 && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Generated Variations</h3>
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

              {/* Image Info */}
              <div className="pt-4 border-t text-xs text-gray-500">
                <p>This is a watermarked preview.</p>
                {!isPurchased && (
                  <p>Purchase to get the full resolution version without watermarks.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      {showProductModal && imageData && (
        <ProductSelectionModal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          image={{
            id: imageData.id,
            filename: imageData.description || imageData.prompt_text || 'portrait.jpg',
            public_url: imageData.public_url || imageData.image_url || '',
            prompt_text: imageData.prompt_text || '',
            description: imageData.description || '',
            tags: imageData.tags || [],
            breed_id: undefined,
            theme_id: undefined,
            style_id: undefined,
            format_id: undefined,
            rating: imageData.rating,
            is_featured: imageData.is_featured || false,
            created_at: new Date().toISOString(),
            breed_name: imageData.breed_name,
            theme_name: imageData.theme_name,
            style_name: imageData.style_name,
            coat_name: imageData.coat_name
          }}
          products={products}
          pricing={pricing}
          onAddToBasket={() => {
            setShowProductModal(false);
            // Optionally refresh or callback
          }}
        />
      )}
    </div>
  );
}