'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { X, Wand2, ChevronRight, ChevronLeft, Sparkles, CreditCard, Info, AlertCircle, Check } from 'lucide-react';
import type { ImageCatalogWithDetails, Breed, Coat, Outfit, Format } from '@/lib/types';

interface CustomerImageCustomizationModalProps {
  image: ImageCatalogWithDetails;
  isOpen: boolean;
  onClose: () => void;
  onGenerationComplete?: (variations: any[]) => void;
}

type WizardStep = 'breed-selection' | 'coat-selection' | 'outfit-selection' | 'preview';

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
  const [currentStep, setCurrentStep] = useState<WizardStep>('breed-selection');

  // Animal selections
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(null);
  const [selectedCoat, setSelectedCoat] = useState<Coat | null>(null);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [keepCurrentBreed, setKeepCurrentBreed] = useState(false);
  const [keepCurrentCoat, setKeepCurrentCoat] = useState(false);

  // Data loading
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [coats, setCoats] = useState<Coat[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);

  // Breed-specific coats
  const [breedCoats, setBreedCoats] = useState<Coat[]>([]);

  const [breedSearch, setBreedSearch] = useState('');
  const [outfitSearch, setOutfitSearch] = useState('');

  // Store current image metadata
  const [currentBreed, setCurrentBreed] = useState<Breed | null>(null);
  const [currentCoatInfo, setCurrentCoatInfo] = useState<Coat | null>(null);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedVariations, setGeneratedVariations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Credits
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [creditsRequired, setCreditsRequired] = useState<number>(1);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Fetch credit balance and data on mount
  useEffect(() => {
    if (isOpen) {
      fetchCreditBalance();
      loadData();
      loadCurrentImageMetadata();
    }
  }, [isOpen]);

  // Calculate credits required based on selections
  useEffect(() => {
    // Base cost is always 1 credit for customization
    setCreditsRequired(1);
  }, [selectedBreed, selectedCoat, selectedOutfit]);

  // Fetch breed-specific coats when breed is selected
  useEffect(() => {
    if (selectedBreed && !keepCurrentBreed) {
      fetchBreedCoats(selectedBreed.id).then((coats) => {
        setBreedCoats(coats);
        // Clear selected coat if it's not available for this breed
        if (selectedCoat && !coats.some(c => c.id === selectedCoat?.id)) {
          setSelectedCoat(null);
        }
      });
    } else {
      setBreedCoats([]);
    }
  }, [selectedBreed, keepCurrentBreed]);

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
      const [breedsRes, coatsRes, outfitsRes] = await Promise.all([
        fetch('/api/breeds'),
        fetch('/api/coats'),
        fetch('/api/outfits')
      ]);

      if (breedsRes.ok) setBreeds(await breedsRes.json());
      if (coatsRes.ok) setCoats(await coatsRes.json());
      if (outfitsRes.ok) setOutfits(await outfitsRes.json());
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load customization options');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentImageMetadata = async () => {
    try {
      // Fetch current breed if available
      if (image.breed_id) {
        const breedRes = await fetch(`/api/breeds`);
        if (breedRes.ok) {
          const allBreeds = await breedRes.json();
          const breed = allBreeds.find((b: Breed) => b.id === image.breed_id);
          if (breed) setCurrentBreed(breed);
        }
      }

      // Fetch current coat if available
      if (image.coat_id) {
        const coatRes = await fetch(`/api/coats`);
        if (coatRes.ok) {
          const allCoats = await coatRes.json();
          const coat = allCoats.find((c: Coat) => c.id === image.coat_id);
          if (coat) setCurrentCoatInfo(coat);
        }
      }
    } catch (err) {
      console.error('Error loading current image metadata:', err);
    }
  };

  // Fetch breed-specific coats from API
  const fetchBreedCoats = async (breedId: string): Promise<Coat[]> => {
    try {
      const response = await fetch(`/api/breed-coats?breed_id=${breedId}`);
      if (!response.ok) return [];

      const breedCoats = await response.json();
      // Extract the coat objects from the breed_coats relationship
      return breedCoats.map((bc: any) => bc.coats);
    } catch (err) {
      console.error('Error fetching breed coats:', err);
      return [];
    }
  };

  const handleNext = () => {
    if (currentStep === 'breed-selection') {
      setCurrentStep('coat-selection');
    } else if (currentStep === 'coat-selection') {
      setCurrentStep('outfit-selection');
    } else if (currentStep === 'outfit-selection') {
      setCurrentStep('preview');
    }
  };

  const handleBack = () => {
    if (currentStep === 'coat-selection') {
      setCurrentStep('breed-selection');
    } else if (currentStep === 'outfit-selection') {
      setCurrentStep('coat-selection');
    } else if (currentStep === 'preview') {
      setCurrentStep('outfit-selection');
    }
  };

  const canProceedFromStep = (): boolean => {
    switch (currentStep) {
      case 'breed-selection':
        return keepCurrentBreed || selectedBreed !== null;
      case 'coat-selection':
        return keepCurrentCoat || selectedCoat !== null;
      case 'outfit-selection':
        return true; // Outfit is optional
      case 'preview':
        return generatedVariations.length > 0;
      default:
        return false;
    }
  };

  const getStepNumber = (step: WizardStep): number => {
    const steps: WizardStep[] = ['breed-selection', 'coat-selection', 'outfit-selection', 'preview'];
    return steps.indexOf(step) + 1;
  };

  const isStepCompleted = (step: WizardStep): boolean => {
    const currentStepNumber = getStepNumber(currentStep);
    const stepNumber = getStepNumber(step);

    if (stepNumber < currentStepNumber) return true;
    if (stepNumber > currentStepNumber) return false;

    return false; // Current step is not completed yet
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

      // Determine breed and coat to use
      const targetBreed = keepCurrentBreed ? image.breed_id : selectedBreed?.id;
      const targetCoat = keepCurrentCoat ? image.coat_id : selectedCoat?.id;

      if (targetBreed && targetCoat) {
        variationConfig.breedCoats = [{
          breedId: targetBreed,
          coatId: targetCoat
        }];
      }

      // Add outfit if selected
      if (selectedOutfit) {
        variationConfig.outfits = [selectedOutfit.id];
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
          targetAge: 'same',
          variationConfig,
          isMultiAnimal: false,
          multiAnimalConfig: null
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

  const filteredBreeds = breeds.filter(b =>
    b.name.toLowerCase().includes(breedSearch.toLowerCase())
  );

  const filteredOutfits = outfits.filter(o =>
    o.name.toLowerCase().includes(outfitSearch.toLowerCase())
  );

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

        {/* Progress Indicator */}
        <div className="flex items-center justify-between mb-6">
          {(['breed-selection', 'coat-selection', 'outfit-selection', 'preview'] as WizardStep[]).map((step, index) => {
            const stepNum = index + 1;
            const isActive = currentStep === step;
            const isCompleted = isStepCompleted(step);
            const stepLabels = {
              'breed-selection': 'Breed',
              'coat-selection': 'Coat',
              'outfit-selection': 'Outfit',
              'preview': 'Preview'
            };

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : stepNum}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'font-semibold text-purple-600' : 'text-gray-600'}`}>
                    {stepLabels[step]}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`h-0.5 flex-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Wizard Steps */}
        <div className="space-y-6">
          {/* Step 1: Breed Selection */}
          {currentStep === 'breed-selection' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Breed</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose the breed for your customized portrait
                </p>
              </div>

              {/* Current Breed Info */}
              {currentBreed && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Breed</p>
                      <p className="text-lg font-semibold text-blue-700">{currentBreed.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{currentBreed.animal_type}</p>
                    </div>
                    <Button
                      variant={keepCurrentBreed ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setKeepCurrentBreed(!keepCurrentBreed);
                        if (!keepCurrentBreed) {
                          setSelectedBreed(null);
                        }
                      }}
                    >
                      {keepCurrentBreed ? <Check className="w-4 h-4 mr-2" /> : null}
                      Keep Current
                    </Button>
                  </div>
                </div>
              )}

              {/* Breed Selection */}
              {!keepCurrentBreed && (
                <div>
                  <Label>Select New Breed</Label>
                  <Input
                    placeholder="Search breeds..."
                    value={breedSearch}
                    onChange={(e) => setBreedSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                    {filteredBreeds.map(breed => (
                      <button
                        key={breed.id}
                        onClick={() => setSelectedBreed(breed)}
                        className={`p-3 text-left border rounded-lg hover:border-purple-300 transition-colors ${
                          selectedBreed?.id === breed.id ? 'border-purple-500 bg-purple-50' : ''
                        }`}
                      >
                        <p className="font-medium text-sm">{breed.name}</p>
                        <p className="text-xs text-gray-600 capitalize">{breed.animal_type}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Coat Selection */}
          {currentStep === 'coat-selection' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Coat Color</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Choose the coat color for your customized portrait
                </p>
              </div>

              {/* Current Coat Info */}
              {currentCoatInfo && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-12 h-12 rounded-full border-2 border-white shadow"
                        style={{ backgroundColor: currentCoatInfo.hex_color || '#ccc' }}
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Current Coat</p>
                        <p className="text-lg font-semibold text-blue-700">{currentCoatInfo.name}</p>
                      </div>
                    </div>
                    <Button
                      variant={keepCurrentCoat ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setKeepCurrentCoat(!keepCurrentCoat);
                        if (!keepCurrentCoat) {
                          setSelectedCoat(null);
                        }
                      }}
                    >
                      {keepCurrentCoat ? <Check className="w-4 h-4 mr-2" /> : null}
                      Keep Current
                    </Button>
                  </div>
                </div>
              )}

              {/* Coat Selection */}
              {!keepCurrentCoat && (
                <div>
                  <Label>Select New Coat Color</Label>
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2 mt-2">
                    {(breedCoats.length > 0 ? breedCoats : coats).map(coat => (
                      <button
                        key={coat.id}
                        onClick={() => setSelectedCoat(coat)}
                        className={`p-3 text-left border rounded-lg hover:border-purple-300 transition-colors ${
                          selectedCoat?.id === coat.id ? 'border-purple-500 bg-purple-50' : ''
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-full mb-2 border-2 border-white shadow"
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

          {/* Step 3: Outfit Selection */}
          {currentStep === 'outfit-selection' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Outfit (Optional)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Add an outfit to your pet's portrait
                </p>
              </div>

              {/* Outfit Selection */}
              <div>
                <Label>Available Outfits</Label>
                <Input
                  placeholder="Search outfits..."
                  value={outfitSearch}
                  onChange={(e) => setOutfitSearch(e.target.value)}
                  className="mb-2 mt-2"
                />
                <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
                  {filteredOutfits.map(outfit => (
                    <button
                      key={outfit.id}
                      onClick={() => setSelectedOutfit(selectedOutfit?.id === outfit.id ? null : outfit)}
                      className={`p-3 text-center border rounded-lg hover:border-purple-300 transition-colors ${
                        selectedOutfit?.id === outfit.id ? 'border-purple-500 bg-purple-50' : ''
                      }`}
                    >
                      <p className="font-medium text-sm">{outfit.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{outfit.category}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Summary */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Estimated Cost</p>
                    <p className="text-sm text-gray-600">1 variation</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">{creditsRequired}</p>
                    <p className="text-xs text-gray-600">credit{creditsRequired > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {currentStep === 'preview' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Preview & Generate</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review your selections and generate your custom portrait
                </p>
              </div>

              {/* Summary */}
              <div className="space-y-2 p-4 border rounded-lg bg-gray-50">
                <h4 className="font-medium">Your Customization:</h4>
                <div className="space-y-1">
                  <p className="text-sm">
                    <strong>Breed:</strong> {keepCurrentBreed ? `${currentBreed?.name} (Current)` : selectedBreed?.name}
                  </p>
                  <p className="text-sm">
                    <strong>Coat:</strong> {keepCurrentCoat ? `${currentCoatInfo?.name} (Current)` : selectedCoat?.name}
                  </p>
                  {selectedOutfit && (
                    <p className="text-sm">
                      <strong>Outfit:</strong> {selectedOutfit.name}
                    </p>
                  )}
                </div>
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
            {currentStep !== 'breed-selection' && (
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
