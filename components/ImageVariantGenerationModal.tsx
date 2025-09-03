'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Wand2, RefreshCw, X } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';
import type { ImageCatalogWithDetails, Breed, Outfit, Format, BreedCoatDetail } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Copy, ArrowLeft, CheckCircle, Brain } from 'lucide-react';
import { uploadImagesDirectBatch } from '@/lib/cloudinary-client';

interface ImageVariantGenerationModalProps {
  image: ImageCatalogWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onVariationsGenerated?: () => void;
}

interface VariationPreviewStepProps {
  image: ImageCatalogWithDetails;
  variations: any[];
  onGenerateAIDescription: (variation: any) => void;
  onUpdateVariation: (updatedVariation: any) => void;
  onApproveAll: () => void;
  onApproveSelected: (selectedIds: string[]) => void;
  onBackToSelection: () => void;
  isSaving: boolean;
  saveResults: any[];
}

function VariationPreviewStep({
  image,
  variations,
  onGenerateAIDescription,
  onUpdateVariation,
  onApproveAll,
  onApproveSelected,
  onBackToSelection,
  isSaving,
  saveResults
}: VariationPreviewStepProps) {
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]);

  const toggleVariationSelection = (variationId: string) => {
    setSelectedVariations(prev => 
      prev.includes(variationId) 
        ? prev.filter(id => id !== variationId)
        : [...prev, variationId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedVariations.length === variations.length) {
      setSelectedVariations([]);
    } else {
      setSelectedVariations(variations.map(v => v.id));
    }
  };

  if (saveResults.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Save Results</h3>
          <Button variant="outline" onClick={onBackToSelection}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Generate More
          </Button>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {saveResults.map((result, index) => (
            <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="w-12 h-12 bg-gray-200 rounded flex-shrink-0">
                {result.cloudinary_url && (
                  <img
                    src={result.cloudinary_url}
                    alt={`Saved variation ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                  />
                )}
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">{result.variation_type}</p>
                {result.breed_name && <p className="text-gray-600">Breed: {result.breed_name}</p>}
                {result.coat_name && <p className="text-gray-600">Coat: {result.coat_name}</p>}
                {result.outfit_name && <p className="text-gray-600">Outfit: {result.outfit_name}</p>}
                {result.format_name && <p className="text-gray-600">Format: {result.format_name}</p>}
              </div>
              <div className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {result.success ? (
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Saved to catalog
                  </div>
                ) : (
                  <div>{result.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Generated Variations ({variations.length})</h3>
        <Button variant="outline" onClick={onBackToSelection}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Selection
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
        {variations.map((variation) => (
          <div key={variation.id} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedVariations.includes(variation.id)}
                onCheckedChange={() => toggleVariationSelection(variation.id)}
              />
              <div className="flex-1">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                  <img
                    src={`data:image/png;base64,${variation.imageData}`}
                    alt={variation.variation_type}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-sm">{variation.variation_type}</p>
                  <div className="text-xs text-gray-600 space-y-1">
                    {variation.breed_name && <p>Breed: {variation.breed_name}</p>}
                    {variation.coat_name && <p>Coat: {variation.coat_name}</p>}
                    {variation.outfit_name && <p>Outfit: {variation.outfit_name}</p>}
                    {variation.format_name && <p>Format: {variation.format_name}</p>}
                  </div>
                  
                  {variation.aiDescription && (
                    <div className="mt-2">
                      <Textarea
                        value={variation.aiDescription}
                        readOnly
                        className="text-xs"
                        rows={3}
                      />
                    </div>
                  )}
                  
                  {variation.gemini_prompt && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                      <p className="font-medium text-blue-800 mb-1">Gemini Prompt (actual):</p>
                      <p className="text-blue-700 font-mono text-xs break-words">
                        {variation.gemini_prompt}
                      </p>
                    </div>
                  )}
                  
                  {variation.prompt && (
                    <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                      <p className="font-medium text-green-800 mb-1">Midjourney Prompt (for catalog):</p>
                      <p className="text-green-700 font-mono text-xs break-all">{variation.prompt}</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGenerateAIDescription(variation)}
                      className="text-xs"
                    >
                      <Brain className="w-3 h-3 mr-1" />
                      AI Description
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(variation.prompt)}
                      className="text-xs"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy Prompt
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAll}
          >
            {selectedVariations.length === variations.length ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-sm text-gray-600">
            {selectedVariations.length} of {variations.length} selected
          </span>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onApproveSelected(selectedVariations)}
            disabled={selectedVariations.length === 0 || isSaving}
          >
            Save Selected ({selectedVariations.length})
          </Button>
          <Button
            onClick={onApproveAll}
            disabled={isSaving}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving to Catalog...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Save All to Catalog
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ImageVariantGenerationModal({
  image,
  isOpen,
  onClose,
  onVariationsGenerated
}: ImageVariantGenerationModalProps) {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [availableCoats, setAvailableCoats] = useState<BreedCoatDetail[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedBreeds, setSelectedBreeds] = useState<string[]>([]);
  const [selectedCoats, setSelectedCoats] = useState<string[]>([]);
  const [selectedOutfits, setSelectedOutfits] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSavingToCategory, setIsSavingToCategory] = useState(false);
  const [saveResults, setSaveResults] = useState<any[]>([]);

  const supabaseService = new SupabaseService();

  useEffect(() => {
    if (isOpen && image) {
      loadData();
    }
  }, [isOpen, image]);

  const loadData = async () => {
    if (!image) return;
    
    setLoading(true);
    try {
      // Use API endpoints with proper error handling like admin generate page
      const [breedsRes, outfitsRes, formatsRes] = await Promise.all([
        fetch(`/api/breeds${image.breed_animal_type ? `?animal_type=${image.breed_animal_type}` : ''}`).catch((error) => {
          console.error('Failed to fetch breeds:', error);
          return { ok: false, json: () => [] };
        }),
        fetch('/api/outfits').catch((error) => {
          console.error('Failed to fetch outfits:', error);
          return { ok: false, json: () => [] };
        }),
        fetch('/api/formats').catch((error) => {
          console.error('Failed to fetch formats:', error);
          return { ok: false, json: () => [] };
        })
      ]);

      let breedsData = [];
      let outfitsData = [];
      let formatsData = [];

      try {
        breedsData = breedsRes.ok ? await breedsRes.json() : [];
      } catch (e) {
        console.error('Error parsing breeds data:', e);
        breedsData = [];
      }

      try {
        outfitsData = outfitsRes.ok ? await outfitsRes.json() : [];
      } catch (e) {
        console.error('Error parsing outfits data:', e);
        outfitsData = [];
      }

      try {
        formatsData = formatsRes.ok ? await formatsRes.json() : [];
      } catch (e) {
        console.error('Error parsing formats data:', e);
        formatsData = [];
      }

      console.log('Loaded data:', { breedsData, outfitsData, formatsData });

      // Filter breeds by active status and exclude current breed
      const filteredBreeds = breedsData?.filter((breed: any) => 
        breed.is_active && breed.id !== image.breed_id
      ) || [];
      
      setBreeds(filteredBreeds);
      setOutfits(outfitsData?.filter((outfit: any) => outfit.is_active) || []);
      setFormats(formatsData?.filter((format: any) => format.is_active) || []);

      // Load coats for the current breed
      if (image.breed_id) {
        try {
          const coatsResponse = await fetch(`/api/breed-coats?breed_id=${image.breed_id}`);
          if (coatsResponse.ok) {
            const coatsData = await coatsResponse.json();
            
            // Transform API data to match BreedCoatDetail interface
            const transformedCoats = coatsData?.map((item: any) => ({
              id: item.coat_id,
              breed_id: item.breed_id,
              coat_id: item.coat_id,
              coat_name: item.coats?.name || '',
              hex_color: item.coats?.hex_color || '#000000',
              popularity_rank: item.popularity_rank,
              is_common: item.is_common,
              is_standard: item.is_standard
            })) || [];
            
            console.log('Loaded coats:', transformedCoats);
            setAvailableCoats(transformedCoats);
          }
        } catch (error) {
          console.error('Error loading coats:', error);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBreedToggle = (breedId: string) => {
    setSelectedBreeds(prev => 
      prev.includes(breedId) 
        ? prev.filter(id => id !== breedId)
        : [...prev, breedId]
    );
  };

  const handleCoatToggle = (coatId: string) => {
    setSelectedCoats(prev => 
      prev.includes(coatId) 
        ? prev.filter(id => id !== coatId)
        : [...prev, coatId]
    );
  };

  const handleOutfitToggle = (outfitId: string) => {
    setSelectedOutfits(prev => 
      prev.includes(outfitId) 
        ? prev.filter(id => id !== outfitId)
        : [...prev, outfitId]
    );
  };

  const handleFormatToggle = (formatId: string) => {
    setSelectedFormats(prev => 
      prev.includes(formatId) 
        ? prev.filter(id => id !== formatId)
        : [...prev, formatId]
    );
  };

  const getTotalVariations = () => {
    return selectedBreeds.length + selectedCoats.length + selectedOutfits.length + selectedFormats.length;
  };

  const handleGenerateVariations = async () => {
    if (!image?.prompt_text || !image?.id) return;
    
    setIsGenerating(true);
    setGeneratedVariations([]);
    setShowPreview(false);
    
    try {
      // Get the image data
      const imageResponse = await fetch(image.public_url || '');
      const imageBlob = await imageResponse.blob();
      const imageData64 = await blobToBase64(imageBlob);
      
      const response = await fetch('/api/admin/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageData: imageData64,
          originalPrompt: image.prompt_text,
          currentBreed: image.breed_id || '',
          currentTheme: image.theme_id || '',
          currentStyle: image.style_id || '',
          variationConfig: {
            breeds: selectedBreeds,
            coats: selectedCoats,
            outfits: selectedOutfits,
            formats: selectedFormats
          }
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
      setGeneratedVariations(results);
      setShowPreview(true);
      
    } catch (error) {
      console.error('Variation generation error:', error);
      alert(`Failed to generate variations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
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

  const generateAIDescription = async (variation: any) => {
    try {
      const response = await fetch('/api/generate-description/base64', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: variation.imageData,
          breedName: variation.breed_name || image?.breed_name || ''
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const updatedVariations = generatedVariations.map(v => 
          v.id === variation.id ? { ...v, aiDescription: result.description } : v
        );
        setGeneratedVariations(updatedVariations);
      } else {
        console.error('AI description generation failed:', await response.text());
      }
    } catch (error) {
      console.error('Error generating AI description:', error);
    }
  };

  const handleApproveAll = async () => {
    const variationsToSave = generatedVariations.map(v => ({
      ...v,
      description: v.aiDescription || v.description || `Generated ${v.variation_type} variation`,
      rating: 4,
      is_featured: false,
      is_public: true
    }));

    await saveVariationsToCategory(variationsToSave);
  };

  const handleApproveSelected = async (selectedIds: string[]) => {
    const variationsToSave = generatedVariations
      .filter(v => selectedIds.includes(v.id))
      .map(v => ({
        ...v,
        description: v.aiDescription || v.description || `Generated ${v.variation_type} variation`,
        rating: 4,
        is_featured: false,
        is_public: true
      }));

    await saveVariationsToCategory(variationsToSave);
  };

  const saveVariationsToCategory = async (variations: any[]) => {
    setIsSavingToCategory(true);
    setSaveResults([]);

    try {
      // First, convert base64 data to File objects for Cloudinary upload
      const filesToUpload = variations.map(variation => {
        const imageBuffer = Buffer.from(variation.imageData, 'base64');
        const file = new File([imageBuffer], variation.filename, { type: 'image/png' });
        return file;
      });

      console.log(`Uploading ${filesToUpload.length} variations to Cloudinary...`);

      // Upload to Cloudinary using the same method as admin generate
      const cloudinaryResults = await uploadImagesDirectBatch(
        filesToUpload,
        {
          tags: ['variation', 'gemini-generated', 'admin-upload'].filter(Boolean)
        },
        (uploaded, total, current) => {
          console.log(`📤 Variation upload progress: ${uploaded}/${total} - ${current}`);
        }
      );

      console.log('✅ All variations uploaded to Cloudinary successfully');

      // Now save metadata to database for each uploaded variation
      const results = [];
      for (let i = 0; i < cloudinaryResults.length; i++) {
        const cloudinaryResult = cloudinaryResults[i];
        const variation = variations[i];
        
        try {
          console.log(`💾 Saving metadata for variation ${i + 1}/${variations.length}: ${variation.filename}`);
          
          const response = await fetch('/api/images/cloudinary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cloudinary_public_id: cloudinaryResult.public_id,
              cloudinary_secure_url: cloudinaryResult.secure_url,
              cloudinary_signature: cloudinaryResult.signature,
              original_filename: variation.filename,
              file_size: cloudinaryResult.bytes,
              mime_type: 'image/png',
              width: cloudinaryResult.width,
              height: cloudinaryResult.height,
              prompt_text: variation.prompt,
              description: variation.description || `Generated variation: ${variation.variation_type}`,
              tags: variation.metadata?.tags || ['variation', 'gemini-generated'],
              breed_id: variation.metadata?.breed_id || undefined,
              theme_id: variation.theme_id || undefined,
              style_id: variation.style_id || undefined,
              format_id: variation.metadata?.format_id || undefined,
              coat_id: variation.metadata?.coat_id || undefined,
              rating: variation.rating || 4,
              is_featured: variation.is_featured || false,
              is_public: variation.is_public !== false
            })
          });
          
          if (response.ok) {
            const dbResult = await response.json();
            results.push({
              success: true,
              variation_type: variation.variation_type,
              breed_name: variation.breed_name,
              coat_name: variation.coat_name,
              outfit_name: variation.outfit_name,
              format_name: variation.format_name,
              cloudinary_url: cloudinaryResult.secure_url,
              database_id: dbResult.id
            });
            console.log(`✅ Variation ${i + 1} saved successfully: ID ${dbResult.id}`);
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            results.push({
              success: false,
              error: `Database save failed: ${errorData.error}`,
              variation_type: variation.variation_type
            });
            console.error(`❌ Database save failed for variation ${i + 1}:`, errorData.error);
          }
        } catch (variationError) {
          results.push({
            success: false,
            error: `Save error: ${variationError instanceof Error ? variationError.message : 'Unknown error'}`,
            variation_type: variation.variation_type
          });
          console.error(`❌ Error saving variation ${i + 1}:`, variationError);
        }
      }

      setSaveResults(results);
      
      if (onVariationsGenerated) {
        onVariationsGenerated();
      }
      
    } catch (error) {
      console.error('Error saving variations:', error);
      alert(`Failed to save variations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingToCategory(false);
    }
  };

  const handleBackToSelection = () => {
    setShowPreview(false);
    setGeneratedVariations([]);
    setSaveResults([]);
  };

  if (!image) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wand2 className="w-5 h-5" />
              <span>Generate Image Variations</span>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : showPreview ? (
          <VariationPreviewStep 
            image={image}
            variations={generatedVariations}
            onGenerateAIDescription={generateAIDescription}
            onUpdateVariation={(updatedVariation) => {
              const updatedVariations = generatedVariations.map(v => 
                v.id === updatedVariation.id ? updatedVariation : v
              );
              setGeneratedVariations(updatedVariations);
            }}
            onApproveAll={handleApproveAll}
            onApproveSelected={handleApproveSelected}
            onBackToSelection={handleBackToSelection}
            isSaving={isSavingToCategory}
            saveResults={saveResults}
          />
        ) : (
          <div className="space-y-6">
            {/* Original Image Info */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium mb-2">Original Image</h3>
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-gray-200 rounded overflow-hidden">
                  <img
                    src={image.public_url}
                    alt={image.description || 'Original image'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">{image.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {image.breed_name && (
                      <Badge variant="outline" className="text-xs">
                        {image.breed_animal_type === 'cat' ? '🐱' : '🐕'} {image.breed_name}
                      </Badge>
                    )}
                    {image.theme_name && (
                      <Badge variant="outline" className="text-xs">🎨 {image.theme_name}</Badge>
                    )}
                    {image.style_name && (
                      <Badge variant="outline" className="text-xs">✨ {image.style_name}</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Breed Variations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">Breed Variations</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const availableBreedIds = breeds.filter(breed => breed.id !== image.breed_id).map(breed => breed.id);
                    const allSelected = availableBreedIds.every(id => selectedBreeds.includes(id));
                    if (allSelected) {
                      setSelectedBreeds([]);
                    } else {
                      setSelectedBreeds(availableBreedIds);
                    }
                  }}
                >
                  {breeds.filter(breed => breed.id !== image.breed_id).every(breed => selectedBreeds.includes(breed.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                {breeds.filter(breed => breed.id !== image.breed_id).map(breed => (
                  <div key={breed.id} className="flex items-center space-x-2 p-2 border rounded-lg">
                    <Checkbox
                      id={`breed-${breed.id}`}
                      checked={selectedBreeds.includes(breed.id)}
                      onCheckedChange={() => handleBreedToggle(breed.id)}
                    />
                    <label htmlFor={`breed-${breed.id}`} className="text-sm cursor-pointer flex-1">
                      {breed.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Coat Variations */}
            {availableCoats.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-700">Coat Variations</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allCoatIds = availableCoats.map(coat => coat.id);
                      const allSelected = allCoatIds.every(id => selectedCoats.includes(id));
                      if (allSelected) {
                        setSelectedCoats([]);
                      } else {
                        setSelectedCoats(allCoatIds);
                      }
                    }}
                  >
                    {availableCoats.every(coat => selectedCoats.includes(coat.id)) ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {availableCoats.map(coat => (
                    <div key={coat.id} className="flex items-center space-x-2 p-2 border rounded-lg">
                      <Checkbox
                        id={`coat-${coat.id}`}
                        checked={selectedCoats.includes(coat.id)}
                        onCheckedChange={() => handleCoatToggle(coat.id)}
                      />
                      <div className="flex items-center space-x-2 flex-1">
                        <div 
                          className="w-3 h-3 rounded-full border border-gray-300"
                          style={{ backgroundColor: coat.hex_color }}
                        />
                        <label htmlFor={`coat-${coat.id}`} className="text-sm cursor-pointer">
                          {coat.coat_name}
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outfit Variations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">Outfit Variations</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allOutfitIds = outfits.map(outfit => outfit.id);
                    const allSelected = allOutfitIds.every(id => selectedOutfits.includes(id));
                    if (allSelected) {
                      setSelectedOutfits([]);
                    } else {
                      setSelectedOutfits(allOutfitIds);
                    }
                  }}
                >
                  {outfits.every(outfit => selectedOutfits.includes(outfit.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {outfits.map(outfit => (
                  <div key={outfit.id} className="flex items-center space-x-2 p-2 border rounded-lg">
                    <Checkbox
                      id={`outfit-${outfit.id}`}
                      checked={selectedOutfits.includes(outfit.id)}
                      onCheckedChange={() => handleOutfitToggle(outfit.id)}
                    />
                    <div className="flex-1">
                      <label htmlFor={`outfit-${outfit.id}`} className="text-sm cursor-pointer font-medium">
                        {outfit.name}
                      </label>
                      {outfit.clothing_description && (
                        <p className="text-xs text-gray-500 mt-1">{outfit.clothing_description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Format Variations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">Format Variations</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allFormatIds = formats.map(format => format.id);
                    const allSelected = allFormatIds.every(id => selectedFormats.includes(id));
                    if (allSelected) {
                      setSelectedFormats([]);
                    } else {
                      setSelectedFormats(allFormatIds);
                    }
                  }}
                >
                  {formats.every(format => selectedFormats.includes(format.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {formats.map(format => (
                  <div key={format.id} className="flex items-center space-x-2 p-2 border rounded-lg">
                    <Checkbox
                      id={`format-${format.id}`}
                      checked={selectedFormats.includes(format.id)}
                      onCheckedChange={() => handleFormatToggle(format.id)}
                    />
                    <div className="flex-1">
                      <label htmlFor={`format-${format.id}`} className="text-sm cursor-pointer font-medium">
                        {format.name} ({format.aspect_ratio})
                      </label>
                      <p className="text-xs text-gray-500 mt-1">{format.use_case}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {getTotalVariations() > 0 && (
                  <span>
                    Will generate {getTotalVariations()} variation{getTotalVariations() > 1 ? 's' : ''}
                  </span>
                )}
                {getTotalVariations() > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedBreeds([]);
                      setSelectedCoats([]);
                      setSelectedOutfits([]);
                      setSelectedFormats([]);
                    }}
                    className="text-xs"
                  >
                    Deselect All
                  </Button>
                )}
              </div>
              <Button
                onClick={handleGenerateVariations}
                disabled={getTotalVariations() === 0 || isGenerating}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating Variations...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Generate {getTotalVariations()} Variation{getTotalVariations() > 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}