'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Wand2, RefreshCw, X, Search } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';
import type { ImageCatalogWithDetails, Breed, Outfit, Format, BreedCoatDetail, AnimalType } from '@/lib/types';
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
  onGenerateAIDescriptions: (selectedIds: string[]) => void;
  onUpdateVariation: (updatedVariation: any) => void;
  onApproveAll: () => void;
  onApproveSelected: (selectedIds: string[]) => void;
  onBackToSelection: () => void;
  onClose: () => void;
  isSaving: boolean;
  isGeneratingDescriptions: boolean;
  saveResults: any[];
}

function VariationPreviewStep({
  image,
  variations,
  onGenerateAIDescriptions,
  onUpdateVariation,
  onApproveAll,
  onApproveSelected,
  onBackToSelection,
  onClose,
  isSaving,
  isGeneratingDescriptions,
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
              <div className="w-12 bg-gray-200 rounded flex-shrink-0" style={{ aspectRatio: '1:1' }}>
                {result.cloudinary_url && (
                  <img
                    src={result.cloudinary_url}
                    alt={`Saved variation ${index + 1}`}
                    className="w-full h-full object-contain rounded"
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
        {console.log('🎨 Rendering variations in preview:', variations) || 
         console.log('🔢 Variations count:', variations?.length) || 
         console.log('📋 Variations type:', typeof variations) || 
         variations.map((variation) => (
          <div key={variation.id} className="border rounded-lg p-3 space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedVariations.includes(variation.id)}
                onCheckedChange={() => toggleVariationSelection(variation.id)}
              />
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg overflow-hidden mb-2" style={{ aspectRatio: variation.metadata.format?.aspect_ratio || '1:1' }}>
                  <img
                    src={`data:image/png;base64,${variation.imageData}`}
                    alt={variation.variation_type}
                    className="w-full h-full object-contain"
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
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        AI Description (editable):
                      </label>
                      <Textarea
                        value={variation.aiDescription}
                        onChange={(e) => {
                          const updatedVariation = { ...variation, aiDescription: e.target.value };
                          onUpdateVariation(updatedVariation);
                        }}
                        className="text-xs"
                        rows={3}
                        placeholder="AI description will appear here..."
                      />
                    </div>
                  )}
                  
                  {(variation.gemini_prompt || variation.metadata?.gemini_prompt) && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                      <p className="font-medium text-blue-800 mb-1">Gemini Prompt (actual):</p>
                      <p className="text-blue-700 font-mono text-xs break-words">
                        {variation.gemini_prompt || variation.metadata?.gemini_prompt}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
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
            onClick={() => onGenerateAIDescriptions(selectedVariations)}
            disabled={selectedVariations.length === 0 || isGeneratingDescriptions || isSaving}
          >
            {isGeneratingDescriptions ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Generate AI Description ({selectedVariations.length})
              </>
            )}
          </Button>
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
  
  const [selectedBreedCoats, setSelectedBreedCoats] = useState<{[breedId: string]: string[]}>({});
  const [expandedBreeds, setExpandedBreeds] = useState<string[]>([]);
  const [breedCoatsData, setBreedCoatsData] = useState<{[breedId: string]: BreedCoatDetail[]}>({});
  const [selectedOutfits, setSelectedOutfits] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  
  // Search states for filtering
  const [breedSearch, setBreedSearch] = useState('');
  const [outfitSearch, setOutfitSearch] = useState('');
  const [formatSearch, setFormatSearch] = useState('');
  const [selectedAnimalType, setSelectedAnimalType] = useState<AnimalType | ''>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Filtered arrays based on search and animal type - sort breeds alphabetically
  const filteredBreeds = breeds
    .filter(breed => {
      const matchesSearch = breed.name.toLowerCase().includes(breedSearch.toLowerCase());
      const matchesAnimalType = selectedAnimalType ? breed.animal_type === selectedAnimalType : true;
      return matchesSearch && matchesAnimalType;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const filteredOutfits = outfits.filter(outfit =>
    outfit.name.toLowerCase().includes(outfitSearch.toLowerCase()) ||
    (outfit.clothing_description && outfit.clothing_description.toLowerCase().includes(outfitSearch.toLowerCase()))
  );
  
  const filteredFormats = formats.filter(format =>
    format.name.toLowerCase().includes(formatSearch.toLowerCase())
  );
  const [generatedVariations, setGeneratedVariations] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isSavingToCategory, setIsSavingToCategory] = useState(false);
  const [isGeneratingDescriptions, setIsGeneratingDescriptions] = useState(false);
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
        fetch('/api/breeds').catch((error) => {
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

      // Filter breeds by active status
      const filteredBreeds = breedsData?.filter((breed: any) => 
        breed.is_active
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

  const toggleBreedExpansion = (breedId: string) => {
    setExpandedBreeds(prev => 
      prev.includes(breedId) 
        ? prev.filter(id => id !== breedId)
        : [...prev, breedId]
    );
  };

  const loadBreedCoats = async (breedId: string) => {
    if (breedCoatsData[breedId]) return; // Already loaded
    
    try {
      const response = await fetch(`/api/breed-coats?breed_id=${breedId}`);
      if (response.ok) {
        const coatsData = await response.json();
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
        
        setBreedCoatsData(prev => ({
          ...prev,
          [breedId]: transformedCoats
        }));
      }
    } catch (error) {
      console.error('Error loading breed coats:', error);
    }
  };

  const handleBreedCoatToggle = (breedId: string, coatId: string) => {
    setSelectedBreedCoats(prev => {
      const currentCoats = prev[breedId] || [];
      const newCoats = currentCoats.includes(coatId)
        ? currentCoats.filter(id => id !== coatId)
        : [...currentCoats, coatId];
      
      if (newCoats.length === 0) {
        const { [breedId]: removed, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [breedId]: newCoats
      };
    });
  };

  const handleBreedSelectAll = (breedId: string, allCoats: BreedCoatDetail[]) => {
    const coatIds = allCoats.map(coat => coat.id);
    const currentSelection = selectedBreedCoats[breedId] || [];
    const allSelected = coatIds.every(id => currentSelection.includes(id));
    
    if (allSelected) {
      setSelectedBreedCoats(prev => {
        const { [breedId]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      setSelectedBreedCoats(prev => ({
        ...prev,
        [breedId]: coatIds
      }));
    }
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
    const breedCoatVariations = Object.values(selectedBreedCoats).reduce((sum, coats) => sum + coats.length, 0);
    return breedCoatVariations + selectedOutfits.length + selectedFormats.length;
  };

  const getSelectedBreedCoatPairs = (): {breedId: string, coatId: string}[] => {
    const pairs: {breedId: string, coatId: string}[] = [];
    Object.entries(selectedBreedCoats).forEach(([breedId, coatIds]) => {
      coatIds.forEach(coatId => {
        pairs.push({ breedId, coatId });
      });
    });
    return pairs;
  };

  const handleSelectAllBreedCoats = async () => {
    // Load coat data for all breeds first
    const loadPromises = filteredBreeds.map(breed => loadBreedCoats(breed.id));
    await Promise.all(loadPromises);
    
    // Select all coats for all breeds
    const allBreedCoats: {[breedId: string]: string[]} = {};
    filteredBreeds.forEach(breed => {
      const coats = breedCoatsData[breed.id] || [];
      if (coats.length > 0) {
        allBreedCoats[breed.id] = coats.map(coat => coat.id);
      }
    });
    
    setSelectedBreedCoats(allBreedCoats);
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
      
      const variationConfigToSend = {
        breedCoats: getSelectedBreedCoatPairs().map(pair => ({
          breedId: pair.breedId,
          coatId: pair.coatId
        })),
        outfits: selectedOutfits,
        formats: selectedFormats
      };
      
      console.log('🚀 Sending variationConfig:', variationConfigToSend);
      console.log('🎯 Breed-coat pairs:', getSelectedBreedCoatPairs());
      console.log('📊 Selected breed coats state:', selectedBreedCoats);
      console.log('🗂️ Breed coats data cache:', breedCoatsData);
      
      const response = await fetch('/api/admin/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageData: imageData64,
          originalPrompt: image.prompt_text,
          currentBreed: image.breed_id || '',
          currentCoat: image.coat_id || '', // Pass original coat for inheritance
          currentTheme: image.theme_id || '',
          currentStyle: image.style_id || '',
          currentFormat: image.format_id || '', // Pass original format for inheritance
          variationConfig: variationConfigToSend
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
      console.log('✅ Received variations from API:', results);
      console.log('📊 Number of variations received:', results?.length || 0);
      console.log('🔍 Results structure check:', {
        isArray: Array.isArray(results),
        hasLength: results?.length,
        firstItem: results?.[0],
        keys: results ? Object.keys(results) : 'null'
      });
      
      // Ensure results is an array
      const variationsArray = Array.isArray(results) ? results : [];
      console.log('🎯 Setting variations array:', variationsArray);
      
      setGeneratedVariations(variationsArray);
      setShowPreview(true);
      
      // Auto-generate AI descriptions for all variations
      if (variationsArray.length > 0) {
        console.log(`Auto-generating AI descriptions for ${variationsArray.length} variations...`);
        const allVariationIds = variationsArray.map((v: any) => v.id);
        await generateAIDescriptions(allVariationIds, variationsArray);
      }
      
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

  const generateAIDescriptions = async (selectedIds: string[], currentVariations?: any[]) => {
    if (selectedIds.length === 0) return;
    
    setIsGeneratingDescriptions(true);
    
    try {
      // Use provided variations or fall back to state (for backward compatibility)
      const variationsToUse = currentVariations || generatedVariations;
      console.log('🔍 GenerateAIDescriptions - using variations:', variationsToUse);
      
      // Generate descriptions for selected variations in parallel
      const selectedVariations = variationsToUse.filter(v => selectedIds.includes(v.id));
      
      const descriptionPromises = selectedVariations.map(async (variation) => {
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
            return { ...variation, aiDescription: result.description };
          } else {
            console.error('AI description generation failed for variation:', variation.id);
            return variation; // Return unchanged if failed
          }
        } catch (error) {
          console.error('Error generating AI description for variation:', variation.id, error);
          return variation; // Return unchanged if failed
        }
      });
      
      const updatedVariations = await Promise.all(descriptionPromises);
      
      // Update the full variations array with new descriptions
      const newGeneratedVariations = variationsToUse.map(v => {
        const updated = updatedVariations.find(uv => uv.id === v.id);
        return updated || v;
      });
      
      console.log('🔍 Updated variations with AI descriptions:', newGeneratedVariations);
      setGeneratedVariations(newGeneratedVariations);
      
    } catch (error) {
      console.error('Error generating AI descriptions:', error);
      alert(`Failed to generate AI descriptions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingDescriptions(false);
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
      
      // Close modal after successful save (after a brief delay to show results)
      const successfulSaves = results.filter(r => r.success).length;
      if (successfulSaves > 0) {
        setTimeout(() => {
          onClose();
        }, 2000); // 2 second delay to show success message
      }
      
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
    // Reset selections for fresh start
    setSelectedBreedCoats({});
    setSelectedOutfits([]);
    setSelectedFormats([]);
    setExpandedBreeds([]);
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
            onGenerateAIDescriptions={generateAIDescriptions}
            onUpdateVariation={(updatedVariation) => {
              const updatedVariations = generatedVariations.map(v => 
                v.id === updatedVariation.id ? updatedVariation : v
              );
              setGeneratedVariations(updatedVariations);
            }}
            onApproveAll={handleApproveAll}
            onApproveSelected={handleApproveSelected}
            onBackToSelection={handleBackToSelection}
            onClose={onClose}
            isSaving={isSavingToCategory}
            isGeneratingDescriptions={isGeneratingDescriptions}
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

            {/* Animal Type Filter */}
            <div>
              <h3 className="font-medium text-gray-700 mb-3">Target Animal Type</h3>
              <div className="flex gap-3 mb-4">
                <div className="flex items-center space-x-2 p-2 border rounded-lg">
                  <input
                    type="radio"
                    id="animal-same-modal"
                    name="animalTypeModal"
                    checked={selectedAnimalType === image.breed_animal_type}
                    onChange={() => {
                      setSelectedAnimalType(image.breed_animal_type || '');
                      setSelectedBreedCoats({}); // Clear selections when changing animal type
                    }}
                    className="text-purple-600"
                  />
                  <label htmlFor="animal-same-modal" className="text-sm cursor-pointer">
                    Same ({image.breed_animal_type === 'dog' ? '🐕 Dog' : '🐱 Cat'}) breeds
                  </label>
                </div>
                <div className="flex items-center space-x-2 p-2 border rounded-lg">
                  <input
                    type="radio"
                    id="animal-cross-modal"
                    name="animalTypeModal"
                    checked={selectedAnimalType !== image.breed_animal_type && selectedAnimalType !== ''}
                    onChange={() => {
                      setSelectedAnimalType(image.breed_animal_type === 'dog' ? 'cat' : 'dog');
                      setSelectedBreedCoats({}); // Clear selections when changing animal type
                    }}
                    className="text-purple-600"
                  />
                  <label htmlFor="animal-cross-modal" className="text-sm cursor-pointer">
                    Cross-species ({image.breed_animal_type === 'dog' ? '🐱 Cat' : '🐕 Dog'}) breeds
                  </label>
                </div>
                <div className="flex items-center space-x-2 p-2 border rounded-lg">
                  <input
                    type="radio"
                    id="animal-all-modal"
                    name="animalTypeModal"
                    checked={selectedAnimalType === ''}
                    onChange={() => {
                      setSelectedAnimalType('');
                      setSelectedBreedCoats({}); // Clear selections when changing animal type
                    }}
                    className="text-purple-600"
                  />
                  <label htmlFor="animal-all-modal" className="text-sm cursor-pointer">
                    All breeds (🐕🐱)
                  </label>
                </div>
              </div>
            </div>

            {/* Breed & Coat Variations - Nested Structure */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">Breed & Coat Variations</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllBreedCoats}
                    className="text-xs"
                  >
                    Select All Breed/Coat Combinations
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedBreedCoats({})}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              {/* Breed Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search breeds..."
                  value={breedSearch}
                  onChange={(e) => setBreedSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredBreeds.map(breed => {
                  const isExpanded = expandedBreeds.includes(breed.id);
                  const breedCoats = breedCoatsData[breed.id] || [];
                  const selectedCoatsForBreed = selectedBreedCoats[breed.id] || [];
                  
                  return (
                    <div key={breed.id} className="border rounded-lg">
                      <div 
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          toggleBreedExpansion(breed.id);
                          if (!isExpanded) {
                            loadBreedCoats(breed.id);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <span className={`transform transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}>▶</span>
                          <span className="font-medium text-sm">
                            {breed.animal_type === 'cat' ? '🐱' : '🐕'} {breed.name}
                          </span>
                          {selectedCoatsForBreed.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {selectedCoatsForBreed.length} coat{selectedCoatsForBreed.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        {breedCoats.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBreedSelectAll(breed.id, breedCoats);
                            }}
                            className="text-xs"
                          >
                            {breedCoats.every(coat => selectedCoatsForBreed.includes(coat.id)) ? 'None' : 'All'}
                          </Button>
                        )}
                      </div>
                      
                      {isExpanded && (
                        <div className="px-3 pb-3">
                          {breedCoats.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">Loading coat colors...</p>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 ml-6">
                              {breedCoats.map(coat => (
                                <div key={coat.id} className="flex items-center space-x-2 p-2 border rounded">
                                  <Checkbox
                                    id={`breed-${breed.id}-coat-${coat.id}`}
                                    checked={selectedCoatsForBreed.includes(coat.id)}
                                    onCheckedChange={() => handleBreedCoatToggle(breed.id, coat.id)}
                                  />
                                  <div className="flex items-center space-x-1 flex-1">
                                    <div 
                                      className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"
                                      style={{ backgroundColor: coat.hex_color }}
                                    />
                                    <label 
                                      htmlFor={`breed-${breed.id}-coat-${coat.id}`} 
                                      className="text-xs cursor-pointer leading-tight"
                                    >
                                      {coat.coat_name}
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outfit Variations */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-700">Outfit Variations</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allOutfitIds = filteredOutfits.map(outfit => outfit.id);
                    const allSelected = allOutfitIds.every(id => selectedOutfits.includes(id));
                    if (allSelected) {
                      setSelectedOutfits([]);
                    } else {
                      setSelectedOutfits(allOutfitIds);
                    }
                  }}
                >
                  {filteredOutfits.every(outfit => selectedOutfits.includes(outfit.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              {/* Outfit Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search outfits (e.g. pyjamas)..."
                  value={outfitSearch}
                  onChange={(e) => setOutfitSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {filteredOutfits.map(outfit => (
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
                    const allFormatIds = filteredFormats.map(format => format.id);
                    const allSelected = allFormatIds.every(id => selectedFormats.includes(id));
                    if (allSelected) {
                      setSelectedFormats([]);
                    } else {
                      setSelectedFormats(allFormatIds);
                    }
                  }}
                >
                  {filteredFormats.every(format => selectedFormats.includes(format.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              {/* Format Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search formats..."
                  value={formatSearch}
                  onChange={(e) => setFormatSearch(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {filteredFormats.map(format => (
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
                      setSelectedBreedCoats({});
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