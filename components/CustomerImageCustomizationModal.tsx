'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { X, Wand2, ChevronRight, ChevronLeft, Sparkles, CreditCard, Info, AlertCircle } from 'lucide-react';
import type { ImageCatalogWithDetails, Breed, Coat, Outfit, Format } from '@/lib/types';

interface CustomerImageCustomizationModalProps {
  image: ImageCatalogWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onGenerationComplete?: (variations: any[]) => void;
}

type WizardStep = 'animal-count' | 'primary-animal' | 'secondary-animal' | 'options' | 'preview';

interface AnimalSelection {
  breed: Breed | null;
  coat: Coat | null;
  outfit: Outfit | null;
  age: 'same' | 'adult' | 'young';
}

export default function CustomerImageCustomizationModal({
  image,
  isOpen,
  onClose,
  onGenerationComplete
}: CustomerImageCustomizationModalProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('animal-count');
  const [isMultiAnimal, setIsMultiAnimal] = useState(false);

  // Animal selections
  const [primaryAnimal, setPrimaryAnimal] = useState<AnimalSelection>({
    breed: null,
    coat: null,
    outfit: null,
    age: 'same'
  });

  const [secondaryAnimal, setSecondaryAnimal] = useState<AnimalSelection>({
    breed: null,
    coat: null,
    outfit: null,
    age: 'same'
  });

  // Options
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

  // Data loading
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [coats, setCoats] = useState<Coat[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);

  const [primaryBreedSearch, setPrimaryBreedSearch] = useState('');
  const [secondaryBreedSearch, setSecondaryBreedSearch] = useState('');
  const [primaryOutfitSearch, setPrimaryOutfitSearch] = useState('');
  const [secondaryOutfitSearch, setSecondaryOutfitSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Credits
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditsRequired, setCreditsRequired] = useState<number>(1);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Fetch credit balance on mount
  useEffect(() => {
    if (isOpen) {
      fetchCreditBalance();
      loadData();
    }
  }, [isOpen]);

  // Calculate credits required based on selections
  useEffect(() => {
    const variations = countSelectedVariations();
    setCreditsRequired(Math.max(1, variations));
  }, [primaryAnimal, secondaryAnimal, selectedFormats, isMultiAnimal]);

  const fetchCreditBalance = async () => {
    try {
      setLoadingCredits(true);
      const response = await fetch('/api/customers/credits');
      if (response.ok) {
        const data = await response.json();
        setCreditBalance(data.credits?.remaining || 0);
      }
    } catch (err) {
      console.error('Error fetching credit balance:', err);
    } finally {
      setLoadingCredits(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [breedsRes, coatsRes, outfitsRes, formatsRes] = await Promise.all([
        fetch('/api/breeds'),
        fetch('/api/coats'),
        fetch('/api/outfits'),
        fetch('/api/formats')
      ]);

      if (breedsRes.ok) setBreeds(await breedsRes.json());
      if (coatsRes.ok) setCoats(await coatsRes.json());
      if (outfitsRes.ok) setOutfits(await outfitsRes.json());
      if (formatsRes.ok) setFormats(await formatsRes.json());
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load customization options');
    } finally {
      setLoading(false);
    }
  };

  const countSelectedVariations = (): number => {
    if (isMultiAnimal) {
      return 1; // Multi-animal is one complex generation
    }

    // Single animal: count breed-coat combinations + formats
    let count = 0;

    // Base variation: breed + coat combination (always counts as 1 if both selected)
    if (primaryAnimal.breed && primaryAnimal.coat) {
      count = 1;
    }

    // Additional format variations beyond the base
    if (selectedFormats.length > 0) {
      count += selectedFormats.length;
    }

    return count;
  };

  const handleNext = () => {
    if (currentStep === 'animal-count') {
      setCurrentStep(isMultiAnimal ? 'primary-animal' : 'primary-animal');
    } else if (currentStep === 'primary-animal') {
      if (isMultiAnimal) {
        setCurrentStep('secondary-animal');
      } else {
        setCurrentStep('options');
      }
    } else if (currentStep === 'secondary-animal') {
      setCurrentStep('options');
    } else if (currentStep === 'options') {
      setCurrentStep('preview');
    }
  };

  const handleBack = () => {
    if (currentStep === 'secondary-animal') {
      setCurrentStep('primary-animal');
    } else if (currentStep === 'primary-animal') {
      setCurrentStep('animal-count');
    } else if (currentStep === 'options') {
      if (isMultiAnimal) {
        setCurrentStep('secondary-animal');
      } else {
        setCurrentStep('primary-animal');
      }
    } else if (currentStep === 'preview') {
      setCurrentStep('options');
    }
  };

  const canProceedFromStep = (): boolean => {
    switch (currentStep) {
      case 'animal-count':
        return true;
      case 'primary-animal':
        return primaryAnimal.breed !== null && primaryAnimal.coat !== null;
      case 'secondary-animal':
        return secondaryAnimal.breed !== null && secondaryAnimal.coat !== null;
      case 'options':
        return true; // Options are optional
      case 'preview':
        return generatedVariations.length > 0;
      default:
        return false;
    }
  };

  const handleGenerate = async () => {
    if (creditBalance < creditsRequired) {
      setError(`Insufficient credits. You need ${creditsRequired} credits but only have ${creditBalance}.`);
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      // Prepare variation config
      const variationConfig: any = {};

      if (isMultiAnimal) {
        // Multi-animal configuration
        variationConfig.multiAnimal = {
          primary: {
            breedId: primaryAnimal.breed?.id,
            coatId: primaryAnimal.coat?.id,
            outfitId: primaryAnimal.outfit?.id,
            age: primaryAnimal.age
          },
          secondary: {
            breedId: secondaryAnimal.breed?.id,
            coatId: secondaryAnimal.coat?.id,
            outfitId: secondaryAnimal.outfit?.id,
            age: secondaryAnimal.age
          }
        };
      } else {
        // Single animal: breed-coat combination
        if (primaryAnimal.breed && primaryAnimal.coat) {
          variationConfig.breedCoats = [{
            breedId: primaryAnimal.breed.id,
            coatId: primaryAnimal.coat.id
          }];
        }

        // Add outfit variations
        if (primaryAnimal.outfit) {
          variationConfig.outfits = [primaryAnimal.outfit.id];
        }

        // Add format variations
        if (selectedFormats.length > 0) {
          variationConfig.formats = selectedFormats;
        }
      }

      // Get image data as base64
      const imageData = await fetchImageAsBase64(image.public_url || '');

      // Call customer generation API
      const response = await fetch('/api/customers/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImageData: imageData,
          originalImageId: image.id,
          originalPrompt: image.prompt_text || '',
          currentBreed: image.breed_id,
          currentCoat: image.coat_id,
          currentTheme: image.theme_id,
          currentStyle: image.style_id,
          currentFormat: image.format_id,
          targetAge: primaryAnimal.age,
          variationConfig,
          isMultiAnimal,
          multiAnimalConfig: isMultiAnimal ? variationConfig.multiAnimal : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();

      if (result.success) {
        setGeneratedVariations(result.variations);
        setCreditBalance(result.creditsRemaining);

        if (onGenerationComplete) {
          onGenerationComplete(result.variations);
        }
      } else {
        throw new Error(result.error || 'Generation failed');
      }

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const fetchImageAsBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data:image/png;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handlePurchaseCredits = () => {
    // Open credit purchase modal or redirect
    window.location.href = '/customer/customize?show_credit_purchase=true';
  };

  const filteredPrimaryBreeds = breeds.filter(b =>
    b.name.toLowerCase().includes(primaryBreedSearch.toLowerCase())
  );

  const filteredSecondaryBreeds = breeds.filter(b =>
    b.name.toLowerCase().includes(secondaryBreedSearch.toLowerCase())
  );

  const filteredPrimaryOutfits = outfits.filter(o =>
    o.name.toLowerCase().includes(primaryOutfitSearch.toLowerCase())
  );

  const filteredSecondaryOutfits = outfits.filter(o =>
    o.name.toLowerCase().includes(secondaryOutfitSearch.toLowerCase())
  );

  // Get available coats for selected breed
  const getAvailableCoatsForBreed = (breed: Breed | null): Coat[] => {
    if (!breed) return [];
    return coats.filter(c => c.animal_type === breed.animal_type);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            <span>Customize Your Portrait</span>
          </DialogTitle>
          <DialogDescription>
            Create unique variations of this portrait with AI
          </DialogDescription>
        </DialogHeader>

        {/* Credit Balance Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Your Credit Balance</p>
              <p className="text-xs text-gray-600">Credits are used to generate custom variations</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-600">
              {loadingCredits ? '...' : creditBalance}
            </p>
            <p className="text-xs text-gray-600">credits available</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">{error}</p>
              {creditBalance < creditsRequired && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={handlePurchaseCredits}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Purchase Credits
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Wizard Steps */}
        <div className="space-y-6">
          {/* Step 1: Animal Count */}
          {currentStep === 'animal-count' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">How many animals?</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose whether you want one animal or two animals together in your portrait
                </p>
              </div>

              <RadioGroup
                value={isMultiAnimal ? 'multi' : 'single'}
                onValueChange={(value) => setIsMultiAnimal(value === 'multi')}
              >
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:border-purple-300 cursor-pointer">
                  <RadioGroupItem value="single" id="single" />
                  <Label htmlFor="single" className="flex-1 cursor-pointer">
                    <p className="font-medium">Single Animal</p>
                    <p className="text-sm text-gray-600">Customize one pet with different breeds, coats, and outfits</p>
                  </Label>
                </div>

                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:border-purple-300 cursor-pointer">
                  <RadioGroupItem value="multi" id="multi" />
                  <Label htmlFor="multi" className="flex-1 cursor-pointer">
                    <p className="font-medium">Two Animals Together</p>
                    <p className="text-sm text-gray-600">Create a portrait with two different animals in the same scene</p>
                    <Badge variant="secondary" className="mt-1">Premium Feature</Badge>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 2: Primary Animal Selection */}
          {currentStep === 'primary-animal' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {isMultiAnimal ? 'Primary Animal' : 'Customize Your Pet'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select the breed and coat color for your customized portrait
                </p>
              </div>

              {/* Breed Selection */}
              <div>
                <Label>Breed</Label>
                <Input
                  placeholder="Search breeds..."
                  value={primaryBreedSearch}
                  onChange={(e) => setPrimaryBreedSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {filteredPrimaryBreeds.map(breed => (
                    <button
                      key={breed.id}
                      onClick={() => {
                        setPrimaryAnimal({ ...primaryAnimal, breed, coat: null });
                      }}
                      className={`p-3 text-left border rounded-lg hover:border-purple-300 transition-colors ${
                        primaryAnimal.breed?.id === breed.id ? 'border-purple-500 bg-purple-50' : ''
                      }`}
                    >
                      <p className="font-medium text-sm">{breed.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{breed.animal_type}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coat Selection */}
              {primaryAnimal.breed && (
                <div>
                  <Label>Coat Color</Label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {getAvailableCoatsForBreed(primaryAnimal.breed).map(coat => (
                      <button
                        key={coat.id}
                        onClick={() => setPrimaryAnimal({ ...primaryAnimal, coat })}
                        className={`p-3 text-left border rounded-lg hover:border-purple-300 transition-colors ${
                          primaryAnimal.coat?.id === coat.id ? 'border-purple-500 bg-purple-50' : ''
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full mb-2 border"
                          style={{ backgroundColor: coat.hex_color || '#ccc' }}
                        />
                        <p className="font-medium text-xs">{coat.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Secondary Animal Selection (Multi-animal only) */}
          {currentStep === 'secondary-animal' && isMultiAnimal && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Secondary Animal</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select the breed and coat color for the second animal
                </p>
              </div>

              {/* Breed Selection */}
              <div>
                <Label>Breed</Label>
                <Input
                  placeholder="Search breeds..."
                  value={secondaryBreedSearch}
                  onChange={(e) => setSecondaryBreedSearch(e.target.value)}
                  className="mb-2"
                />
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                  {filteredSecondaryBreeds.map(breed => (
                    <button
                      key={breed.id}
                      onClick={() => {
                        setSecondaryAnimal({ ...secondaryAnimal, breed, coat: null });
                      }}
                      className={`p-3 text-left border rounded-lg hover:border-purple-300 transition-colors ${
                        secondaryAnimal.breed?.id === breed.id ? 'border-purple-500 bg-purple-50' : ''
                      }`}
                    >
                      <p className="font-medium text-sm">{breed.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{breed.animal_type}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coat Selection */}
              {secondaryAnimal.breed && (
                <div>
                  <Label>Coat Color</Label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                    {getAvailableCoatsForBreed(secondaryAnimal.breed).map(coat => (
                      <button
                        key={coat.id}
                        onClick={() => setSecondaryAnimal({ ...secondaryAnimal, coat })}
                        className={`p-3 text-left border rounded-lg hover:border-purple-300 transition-colors ${
                          secondaryAnimal.coat?.id === coat.id ? 'border-purple-500 bg-purple-50' : ''
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-full mb-2 border"
                          style={{ backgroundColor: coat.hex_color || '#ccc' }}
                        />
                        <p className="font-medium text-xs">{coat.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Additional Options */}
          {currentStep === 'options' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Additional Options</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Customize outfit and format (optional)
                </p>
              </div>

              {/* Format Selection */}
              <div>
                <Label>Format Variations (Optional)</Label>
                <p className="text-xs text-gray-600 mb-2">
                  Select additional aspect ratios to generate
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {formats.map(format => (
                    <button
                      key={format.id}
                      onClick={() => {
                        if (selectedFormats.includes(format.id)) {
                          setSelectedFormats(selectedFormats.filter(id => id !== format.id));
                        } else {
                          setSelectedFormats([...selectedFormats, format.id]);
                        }
                      }}
                      className={`p-3 text-center border rounded-lg hover:border-purple-300 transition-colors ${
                        selectedFormats.includes(format.id) ? 'border-purple-500 bg-purple-50' : ''
                      }`}
                    >
                      <p className="font-medium text-sm">{format.name}</p>
                      <p className="text-xs text-gray-600">{format.aspect_ratio}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Summary */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Estimated Cost</p>
                    <p className="text-sm text-gray-600">{countSelectedVariations()} variation(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{creditsRequired}</p>
                    <p className="text-xs text-gray-600">credits</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Preview & Generate</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review your selections and generate your custom portrait
                </p>
              </div>

              {/* Summary */}
              <div className="space-y-2 p-4 border rounded-lg">
                <h4 className="font-medium">Your Customization:</h4>
                {isMultiAnimal ? (
                  <>
                    <p className="text-sm">
                      <strong>Primary:</strong> {primaryAnimal.breed?.name} with {primaryAnimal.coat?.name} coat
                    </p>
                    <p className="text-sm">
                      <strong>Secondary:</strong> {secondaryAnimal.breed?.name} with {secondaryAnimal.coat?.name} coat
                    </p>
                  </>
                ) : (
                  <p className="text-sm">
                    {primaryAnimal.breed?.name} with {primaryAnimal.coat?.name} coat
                  </p>
                )}
                {selectedFormats.length > 0 && (
                  <p className="text-sm">
                    <strong>Formats:</strong> {selectedFormats.length} variations
                  </p>
                )}
              </div>

              {/* Generated Variations */}
              {generatedVariations.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Generated Variations:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {generatedVariations.map((variation, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden">
                        <img
                          src={`data:image/png;base64,${variation.imageData}`}
                          alt={variation.filename}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="p-2 bg-gray-50">
                          <p className="text-xs font-medium truncate">{variation.filename}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <Separator className="my-4" />
        <div className="flex items-center justify-between">
          <div>
            {currentStep !== 'animal-count' && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep !== 'preview' ? (
              <Button
                onClick={handleNext}
                disabled={!canProceedFromStep() || loading}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <>
                {generatedVariations.length === 0 ? (
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || creditBalance < creditsRequired}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate ({creditsRequired} credit{creditsRequired > 1 ? 's' : ''})
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      // Handle saving/purchasing generated variations
                      onClose();
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Save & Continue
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
