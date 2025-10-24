'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { X, Wand2, ChevronRight, ChevronLeft, Sparkles, CreditCard, Info, AlertCircle, Check, Heart, Share2, ShoppingCart, Star } from 'lucide-react';
import type { ImageCatalogWithDetails, Breed, Coat, Outfit, Format } from '@/lib/types';
import { PawSpinner } from '@/components/ui/paw-spinner';
import Image from 'next/image';
import ShareModal from '@/components/share-modal';
import UserInteractionsService from '@/lib/user-interactions';
import { useRouter } from 'next/navigation';

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

  // Progress messages
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // AI-generated description
  const [generatedDescription, setGeneratedDescription] = useState('');

  // Social features
  const [likedVariations, setLikedVariations] = useState<Set<number>>(new Set());
  const [showShareModal, setShowShareModal] = useState(false);
  const [variationToShare, setVariationToShare] = useState<any>(null);
  const [variationRatings, setVariationRatings] = useState<Map<number, number>>(new Map());

  const router = useRouter();

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
    let cost = 0;

    // Base customization: 1 credit if breed OR coat changes
    const breedChanged = !keepCurrentBreed && selectedBreed !== null;
    const coatChanged = !keepCurrentCoat && selectedCoat !== null;

    if (breedChanged || coatChanged) {
      cost = 1; // Base customization cost
    }

    // Outfit: +1 credit if selected
    if (selectedOutfit) {
      cost += 1;
    }

    setCreditsRequired(cost);
  }, [selectedBreed, selectedCoat, selectedOutfit, keepCurrentBreed, keepCurrentCoat]);

  // Fetch breed-specific coats when breed is selected or when keeping current breed
  useEffect(() => {
    const loadBreedSpecificCoats = async () => {
      let breedId: string | null = null;

      if (keepCurrentBreed && image.breed_id) {
        breedId = image.breed_id;
      } else if (selectedBreed) {
        breedId = selectedBreed.id;
      }

      if (breedId) {
        const coats = await fetchBreedCoats(breedId);
        setBreedCoats(coats);
        // Clear selected coat if it's not available for this breed
        if (selectedCoat && !coats.some(c => c.id === selectedCoat?.id)) {
          setSelectedCoat(null);
        }
      } else {
        setBreedCoats([]);
      }
    };

    loadBreedSpecificCoats();
  }, [selectedBreed, keepCurrentBreed, image.breed_id]);

  // Rotate progress messages every 6 seconds during generation
  useEffect(() => {
    if (generating && progressMessages.length > 0) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % progressMessages.length);
      }, 6000); // 6 seconds

      return () => clearInterval(interval);
    }
  }, [generating, progressMessages]);

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

  // Generate progress messages using AI
  const generateProgressMessages = async () => {
    try {
      setLoadingMessages(true);

      // Get breed info
      const breed = keepCurrentBreed ? currentBreed : selectedBreed;
      const coat = keepCurrentCoat ? currentCoatInfo : selectedCoat;

      if (!breed || !coat) {
        console.warn('Missing breed or coat info for progress messages');
        return;
      }

      // Fetch theme info from image
      let themeName = 'studio portrait';
      let themeDescription = '';
      if (image.theme_id) {
        try {
          const themeRes = await fetch('/api/themes');
          if (themeRes.ok) {
            const themes = await themeRes.json();
            const theme = themes.find((t: any) => t.id === image.theme_id);
            if (theme) {
              themeName = theme.name;
              themeDescription = theme.description || '';
            }
          }
        } catch (err) {
          console.error('Failed to fetch theme:', err);
        }
      }

      const response = await fetch('/api/customers/generate-progress-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breedName: breed.name,
          breedDescription: breed.personality_traits?.join(', ') || breed.description || '',
          themeName,
          themeDescription,
          coatColor: coat.name
        })
      });

      if (response.ok) {
        const data = await response.json();
        setProgressMessages(data.messages);
        setCurrentMessageIndex(0);
      }
    } catch (err) {
      console.error('Failed to generate progress messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Generate AI description for completed image
  const generateImageDescription = async (imageData: string) => {
    try {
      const breed = keepCurrentBreed ? currentBreed : selectedBreed;
      if (!breed) return;

      // Convert base64 to blob
      const byteString = atob(imageData);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([uint8Array], { type: 'image/png' });
      const file = new File([blob], 'generated.png', { type: 'image/png' });

      const formData = new FormData();
      formData.append('image', file);
      formData.append('breed', breed.name);

      const response = await fetch('/api/generate-description/file', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const description = data.description;
        setGeneratedDescription(description);

        // Save description to all generated variations
        for (const variation of generatedVariations) {
          if (variation.id) {
            try {
              await fetch(`/api/customers/generated-images/${variation.id}/description`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiDescription: description })
              });
            } catch (saveErr) {
              console.error(`Failed to save description for variation ${variation.id}:`, saveErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to generate description:', err);
      // Gracefully degrade - don't show error to user
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
      setGeneratedDescription(''); // Clear previous description

      // Generate progress messages first
      await generateProgressMessages();

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
          multiAnimalConfig: null,
          aiDescription: generatedDescription || null
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

        // Generate AI description for the first variation
        if (result.variations && result.variations.length > 0) {
          const firstVariation = result.variations[0];
          if (firstVariation.imageData) {
            await generateImageDescription(firstVariation.imageData);
          }
        }

        // Don't call onGenerationComplete - keep modal open to show results
        // if (onGenerationComplete) {
        //   onGenerationComplete(result.variations);
        // }
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

  const handleLikeVariation = (index: number) => {
    setLikedVariations(prev => {
      const newLiked = new Set(prev);
      if (newLiked.has(index)) {
        newLiked.delete(index);
      } else {
        newLiked.add(index);
      }
      return newLiked;
    });
  };

  const handleShareVariation = (variation: any) => {
    setVariationToShare(variation);
    setShowShareModal(true);
  };

  const handleRateVariation = (index: number, rating: number) => {
    setVariationRatings(prev => {
      const newRatings = new Map(prev);
      newRatings.set(index, rating);
      return newRatings;
    });
  };

  const handleBuyNow = (variation: any) => {
    // Navigate to shop page with the generated image
    if (variation.id) {
      router.push(`/customer/shop/${variation.id}`);
    } else {
      console.error('Variation ID not available');
    }
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
              <p className="text-xs text-gray-600">
                {creditsRequired > 0 ? (
                  <>This generation will cost <span className="font-semibold text-purple-700">{creditsRequired}</span> credit{creditsRequired > 1 ? 's' : ''}</>
                ) : (
                  'Credits are used to generate custom variations'
                )}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-purple-600">
              {loadingCredits ? '...' : creditBalance}
            </p>
            <p className="text-xs text-gray-600">
              {creditsRequired > 0 && creditBalance >= creditsRequired ? (
                <>{creditBalance - creditsRequired} after generation</>
              ) : (
                'credits available'
              )}
            </p>
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

            // Get selected value for each step
            const getSelectedValue = (step: WizardStep): string | null => {
              switch (step) {
                case 'breed-selection':
                  if (keepCurrentBreed && currentBreed) return currentBreed.name;
                  if (selectedBreed) return selectedBreed.name;
                  return null;
                case 'coat-selection':
                  if (keepCurrentCoat && currentCoatInfo) return currentCoatInfo.name;
                  if (selectedCoat) return selectedCoat.name;
                  return null;
                case 'outfit-selection':
                  return selectedOutfit?.name || null;
                case 'preview':
                  return null;
                default:
                  return null;
              }
            };

            const selectedValue = getSelectedValue(step);
            const shouldShowValue = (isCompleted || (isActive && selectedValue)) && selectedValue;

            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <Image
                    src={`/assets/logos/paw-svgrepo-200x200-${
                      isCompleted ? 'green' : isActive ? 'purple' : 'gold'
                    }.svg`}
                    alt={stepLabels[step]}
                    width={40}
                    height={40}
                    className="filter drop-shadow-sm"
                  />
                  <span className={`text-xs mt-1 ${isActive ? 'font-semibold text-purple-600' : 'text-gray-600'}`}>
                    {stepLabels[step]}
                  </span>
                  {shouldShowValue && (
                    <span className="text-xs mt-0.5 text-green-600 font-medium text-center max-w-[80px] truncate">
                      {selectedValue}
                    </span>
                  )}
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

              {/* Unified Breed Selection Box */}
              {currentBreed && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  {/* Current Breed */}
                  <div>
                    <p className="text-sm font-medium text-gray-900">Current Breed</p>
                    <p className="text-lg font-semibold text-blue-700">{currentBreed.name}</p>
                    <p className="text-xs text-gray-600 capitalize">{currentBreed.animal_type}</p>
                  </div>

                  {/* New Breed (if selected) */}
                  {selectedBreed && !keepCurrentBreed && (
                    <div className="border-t border-blue-300 pt-3">
                      <p className="text-sm font-medium text-gray-900">New Breed</p>
                      <p className="text-lg font-semibold text-purple-700">{selectedBreed.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{selectedBreed.animal_type}</p>
                    </div>
                  )}

                  {/* Change Breed Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (selectedBreed) {
                        // Navigate to next step
                        setCurrentStep('coat-selection');
                      } else {
                        // Toggle breed selection visibility
                        setKeepCurrentBreed(!keepCurrentBreed);
                      }
                    }}
                  >
                    {selectedBreed ? 'Continue to Coat Selection' : 'Change Breed'}
                  </Button>
                </div>
              )}

              {/* Breed Selection Grid (shown when changing breed) */}
              {!keepCurrentBreed && !selectedBreed && (
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

              {/* Unified Coat Selection Box */}
              {currentCoatInfo && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                  {/* Current Coat */}
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

                  {/* New Coat (if selected) */}
                  {selectedCoat && !keepCurrentCoat && (
                    <div className="border-t border-blue-300 pt-3">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-12 h-12 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: selectedCoat.hex_color || '#ccc' }}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">New Coat</p>
                          <p className="text-lg font-semibold text-purple-700">{selectedCoat.name}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Change Coat Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (selectedCoat) {
                        // Navigate to next step
                        setCurrentStep('outfit-selection');
                      } else {
                        // Toggle coat selection visibility
                        setKeepCurrentCoat(!keepCurrentCoat);
                      }
                    }}
                  >
                    {selectedCoat ? 'Continue to Outfit Selection' : 'Change Coat'}
                  </Button>
                </div>
              )}

              {/* Coat Selection Grid (shown when changing coat) */}
              {!keepCurrentCoat && !selectedCoat && (
                <div>
                  <Label>Select New Coat Color</Label>
                  {breedCoats.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2 mt-2">
                      {breedCoats.map(coat => (
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
                  ) : (
                    <div className="p-4 border rounded-lg text-center text-gray-500 mt-2">
                      <p className="text-sm">Loading coat colors for selected breed...</p>
                    </div>
                  )}
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

              {/* Unified Outfit Selection Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                {/* Selected Outfit Display */}
                <div>
                  <p className="text-sm font-medium text-gray-900">Outfit</p>
                  {selectedOutfit ? (
                    <div>
                      <p className="text-lg font-semibold text-purple-700">{selectedOutfit.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{selectedOutfit.category}</p>
                    </div>
                  ) : (
                    <p className="text-lg font-semibold text-gray-500 italic">No outfit selected</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      if (selectedOutfit) {
                        // If outfit selected, navigate to preview
                        setCurrentStep('preview');
                      } else {
                        // Show outfit selection grid
                        // We'll use a state flag for this
                      }
                    }}
                  >
                    {selectedOutfit ? 'Continue to Preview' : 'Add Outfit (+1 credit)'}
                  </Button>
                  {!selectedOutfit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentStep('preview')}
                    >
                      Skip
                    </Button>
                  )}
                </div>
              </div>

              {/* Outfit Selection Grid (shown when adding outfit) */}
              {!selectedOutfit && (
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
                        onClick={() => setSelectedOutfit(outfit)}
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
              )}
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

              {/* Progress Messages with Paw Spinner */}
              {generating && (
                <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg">
                  <div className="flex items-center space-x-4">
                    {/* Rotating Paw Logo Spinner */}
                    <PawSpinner size="xl" speed="normal" />

                    {/* Progress Message */}
                    <div className="flex-1">
                      <p className="text-lg font-medium text-purple-900 leading-relaxed">
                        {loadingMessages
                          ? "Preparing your customization..."
                          : progressMessages[currentMessageIndex] || "Pawcasso is working his magic... 🎨"
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                <div className="space-y-6">
                  {generatedVariations.map((variation, index) => {
                    const isLiked = likedVariations.has(index);
                    const rating = variationRatings.get(index) || 0;

                    return (
                      <div key={index} className="border rounded-lg overflow-hidden bg-white">
                        {/* Side-by-Side Comparison Layout */}
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50">
                          {/* Original Pawtrait */}
                          <div>
                            <h3 className="text-lg font-bold mb-3">Original Pawtrait</h3>
                            <div className="space-y-1 text-sm">
                              <p><span className="font-medium">Breed</span> : <strong>{currentBreed?.name || 'Unknown'}</strong></p>
                              <p><span className="font-medium">Coat</span> : <strong>{currentCoatInfo?.name || 'Unknown'}</strong></p>
                              <p><span className="font-medium">Outfit</span> : <strong>{image.outfit_name || 'None'}</strong></p>
                            </div>
                          </div>

                          {/* Custom Pawtrait */}
                          <div>
                            <h3 className="text-lg font-bold mb-3">Custom Pawtrait</h3>
                            <div className="space-y-1 text-sm">
                              <p><span className="font-medium">Breed</span> : <strong>{variation.metadata?.breed?.name || selectedBreed?.name || currentBreed?.name}</strong></p>
                              <p><span className="font-medium">Coat</span> : <strong>{variation.metadata?.coat?.coat_name || selectedCoat?.name || currentCoatInfo?.name}</strong></p>
                              <p><span className="font-medium">Outfit</span> : <strong>{selectedOutfit?.name || image.outfit_name || 'None'}</strong></p>
                            </div>
                          </div>
                        </div>

                        {/* Side-by-Side Images */}
                        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-100">
                          {/* Original Image */}
                          <div className="relative bg-white rounded-lg overflow-hidden">
                            <img
                              src={image.public_url || image.image_url}
                              alt="Original pawtrait"
                              className="w-full h-auto object-contain max-h-[500px]"
                            />
                          </div>

                          {/* Generated Image */}
                          <div className="relative bg-white rounded-lg overflow-hidden">
                            <img
                              src={`data:image/png;base64,${variation.imageData}`}
                              alt="Generated variation"
                              className="w-full h-auto object-contain max-h-[500px]"
                            />

                            {/* Action Buttons Overlay */}
                            <div className="absolute top-4 right-4 flex gap-2">
                              <button
                                onClick={() => handleLikeVariation(index)}
                                className={`p-2 rounded-full transition-all ${
                                  isLiked
                                    ? 'bg-red-500 text-white'
                                    : 'bg-white bg-opacity-80 text-gray-700 hover:bg-red-500 hover:text-white'
                                }`}
                                title={isLiked ? 'Unlike' : 'Like'}
                              >
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleShareVariation(variation)}
                                className="p-2 rounded-full transition-all bg-white bg-opacity-80 text-gray-700 hover:bg-blue-500 hover:text-white"
                                title="Share"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* AI Description, Rating, and Actions */}
                        <div className="p-4 space-y-4">
                          {/* AI-Generated Description */}
                          {generatedDescription && index === 0 && (
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <h4 className="font-semibold mb-2 text-blue-900 flex items-center">
                                <Sparkles className="w-4 h-4 mr-2" />
                                Pawcasso's Description
                              </h4>
                              <div className="text-sm text-gray-800">
                                {generatedDescription}
                              </div>
                            </div>
                          )}

                          {/* Star Rating */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Rate this image:</span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => handleRateVariation(index, star)}
                                    className="transition-colors"
                                    title={`${star} star${star > 1 ? 's' : ''}`}
                                  >
                                    <Star
                                      className={`w-5 h-5 ${
                                        star <= rating
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Buy Now Button */}
                            <Button
                              onClick={() => handleBuyNow(variation)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              Buy Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
            {currentStep === 'preview' && (
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
                      // Navigate to first generated variation for purchase
                      if (generatedVariations.length > 0 && generatedVariations[0].id) {
                        router.push(`/customer/shop/${generatedVariations[0].id}`);
                      } else {
                        onClose();
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    View in Shop
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Share Modal */}
      {variationToShare && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setVariationToShare(null);
          }}
          image={{
            id: image.id,
            public_url: `data:image/png;base64,${variationToShare.imageData}`,
            prompt_text: variationToShare.prompt || '',
            description: generatedDescription || image.description || ''
          }}
          onShare={(platform) => {
            console.log(`Shared to ${platform}`);
            setShowShareModal(false);
            setVariationToShare(null);
          }}
        />
      )}
    </Dialog>
  );
}
