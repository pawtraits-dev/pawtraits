'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Wand2, RefreshCw, Upload, Download } from 'lucide-react';
import type { Breed, Outfit, Format, BreedCoatDetail, AnimalType } from '@/lib/types';

interface VariationsSelectorProps {
  originalImage: File | null;
  originalPrompt: string;
  currentBreed: string;
  currentAnimalType?: AnimalType;
  breeds: Breed[];
  availableCoats: BreedCoatDetail[];
  outfits: Outfit[];
  formats: Format[];
  onGenerateVariations: (config: {
    breeds: string[];
    coats: string[];
    outfits: string[];
    formats: string[];
  }) => Promise<void>;
  isGenerating: boolean;
}

export function VariationsSelector({
  originalImage,
  originalPrompt,
  currentBreed,
  currentAnimalType,
  breeds,
  availableCoats,
  outfits,
  formats,
  onGenerateVariations,
  isGenerating
}: VariationsSelectorProps) {
  const [selectedAnimalType, setSelectedAnimalType] = useState<AnimalType | ''>(currentAnimalType || '');
  const [selectedAge, setSelectedAge] = useState<'same' | 'adult' | 'young'>('same');
  const [selectedBreeds, setSelectedBreeds] = useState<string[]>([]);
  const [selectedCoats, setSelectedCoats] = useState<string[]>([]);
  const [selectedOutfits, setSelectedOutfits] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

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

  const getFilteredBreeds = () => {
    let filteredBreeds = breeds;
    
    if (selectedAnimalType) {
      filteredBreeds = filteredBreeds.filter(breed => breed.animal_type === selectedAnimalType);
    }
    
    return filteredBreeds;
  };

  const getTotalVariations = () => {
    return selectedBreeds.length + selectedCoats.length + selectedOutfits.length + selectedFormats.length;
  };

  const handleGenerate = async () => {
    await onGenerateVariations({
      breeds: selectedBreeds,
      coats: selectedCoats,
      outfits: selectedOutfits,
      formats: selectedFormats
    });
  };

  const isDisabled = !originalPrompt || getTotalVariations() === 0 || isGenerating;

  if (!originalPrompt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wand2 className="w-5 h-5" />
            <span>Generate Variations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p>No prompt available for variation generation</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wand2 className="w-5 h-5" />
            <span>Generate Variations</span>
          </div>
          <Badge variant="outline">
            {getTotalVariations()} variations selected
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Create variations of your generated image with different breeds (including same breed with different coats), outfits, and formats
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Animal Type Selection */}
        <div>
          <h3 className="font-medium text-gray-700 mb-3">Target Animal Type</h3>
          <div className="flex gap-3">
            <div className="flex items-center space-x-2 p-2 border rounded-lg">
              <input
                type="radio"
                id="animal-same"
                name="animalType"
                checked={selectedAnimalType === currentAnimalType}
                onChange={() => {
                  setSelectedAnimalType(currentAnimalType || '');
                  setSelectedBreeds([]); // Clear breed selection when changing animal type
                }}
                className="text-purple-600"
              />
              <label htmlFor="animal-same" className="text-sm cursor-pointer">
                Same ({currentAnimalType === 'dog' ? '🐕 Dog' : '🐱 Cat'}) breeds
              </label>
            </div>
            <div className="flex items-center space-x-2 p-2 border rounded-lg">
              <input
                type="radio"
                id="animal-cross"
                name="animalType"
                checked={selectedAnimalType !== currentAnimalType && selectedAnimalType !== ''}
                onChange={() => {
                  setSelectedAnimalType(currentAnimalType === 'dog' ? 'cat' : 'dog');
                  setSelectedBreeds([]); // Clear breed selection when changing animal type
                }}
                className="text-purple-600"
              />
              <label htmlFor="animal-cross" className="text-sm cursor-pointer">
                Cross-species ({currentAnimalType === 'dog' ? '🐱 Cat' : '🐕 Dog'}) breeds
              </label>
            </div>
            <div className="flex items-center space-x-2 p-2 border rounded-lg">
              <input
                type="radio"
                id="animal-all"
                name="animalType"
                checked={selectedAnimalType === ''}
                onChange={() => {
                  setSelectedAnimalType('');
                  setSelectedBreeds([]); // Clear breed selection when changing animal type
                }}
                className="text-purple-600"
              />
              <label htmlFor="animal-all" className="text-sm cursor-pointer">
                All breeds (🐕🐱)
              </label>
            </div>
          </div>
        </div>

        {/* Age Selection */}
        <div>
          <h3 className="font-medium text-gray-700 mb-3">Target Age</h3>
          <div className="flex gap-3">
            <div className="flex items-center space-x-2 p-2 border rounded-lg">
              <input
                type="radio"
                id="age-same"
                name="ageType"
                checked={selectedAge === 'same'}
                onChange={() => setSelectedAge('same')}
                className="text-purple-600"
              />
              <label htmlFor="age-same" className="text-sm cursor-pointer">
                Same age as original
              </label>
            </div>
            <div className="flex items-center space-x-2 p-2 border rounded-lg">
              <input
                type="radio"
                id="age-adult"
                name="ageType"
                checked={selectedAge === 'adult'}
                onChange={() => setSelectedAge('adult')}
                className="text-purple-600"
              />
              <label htmlFor="age-adult" className="text-sm cursor-pointer">
                Adult {currentAnimalType || 'pet'}
              </label>
            </div>
            <div className="flex items-center space-x-2 p-2 border rounded-lg">
              <input
                type="radio"
                id="age-young"
                name="ageType"
                checked={selectedAge === 'young'}
                onChange={() => setSelectedAge('young')}
                className="text-purple-600"
              />
              <label htmlFor="age-young" className="text-sm cursor-pointer">
                {currentAnimalType === 'cat' ? 'Kitten' : 'Puppy'}
              </label>
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
                const availableBreeds = getFilteredBreeds();
                const availableBreedIds = availableBreeds.map(breed => breed.id);
                const allSelected = availableBreedIds.every(id => selectedBreeds.includes(id));
                if (allSelected) {
                  setSelectedBreeds([]);
                } else {
                  setSelectedBreeds(availableBreedIds);
                }
              }}
            >
              {getFilteredBreeds().every(breed => selectedBreeds.includes(breed.id)) ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {getFilteredBreeds().map(breed => (
              <div key={breed.id} className="flex items-center space-x-2 p-2 border rounded-lg">
                <Checkbox
                  id={`breed-${breed.id}`}
                  checked={selectedBreeds.includes(breed.id)}
                  onCheckedChange={() => handleBreedToggle(breed.id)}
                />
                <label htmlFor={`breed-${breed.id}`} className="text-sm cursor-pointer flex-1">
                  {breed.animal_type === 'cat' ? '🐱' : '🐕'} {breed.name}
                  {breed.popularity_rank && (
                    <span className="text-xs text-gray-500 ml-1">#{breed.popularity_rank}</span>
                  )}
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                  <div className="flex items-center mt-1">
                    {outfit.animal_compatibility.map(animal => (
                      <span key={animal} className="text-xs mr-1">
                        {animal === 'dog' ? '🐕' : '🐱'}
                      </span>
                    ))}
                  </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
          <div className="text-sm text-gray-600">
            {getTotalVariations() > 0 && (
              <span>
                Will generate {getTotalVariations()} variation{getTotalVariations() > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isDisabled}
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
      </CardContent>
    </Card>
  );
}