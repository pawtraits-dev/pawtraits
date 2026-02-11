/**
 * Breed Size Mapping
 * Maps dog and cat breeds to relative size categories for accurate multi-subject composition
 */

export type BreedSize = 'tiny' | 'small' | 'medium' | 'large' | 'giant';

export interface BreedSizeInfo {
  size: BreedSize;
  typicalWeightKg: { min: number; max: number };
  heightCm?: { min: number; max: number };
}

/**
 * Dog breed size mapping based on typical adult weight
 * Tiny: < 5kg (Chihuahua, Yorkshire Terrier)
 * Small: 5-10kg (Pug, French Bulldog, Shih Tzu)
 * Medium: 10-25kg (Cocker Spaniel, Bulldog, Border Collie)
 * Large: 25-45kg (Labrador, Golden Retriever, German Shepherd)
 * Giant: > 45kg (Great Dane, Saint Bernard, Mastiff)
 */
const DOG_BREED_SIZES: Record<string, BreedSizeInfo> = {
  // Tiny breeds (< 5kg)
  'chihuahua': { size: 'tiny', typicalWeightKg: { min: 1.5, max: 3 }, heightCm: { min: 15, max: 23 } },
  'yorkshire-terrier': { size: 'tiny', typicalWeightKg: { min: 2, max: 3.5 }, heightCm: { min: 18, max: 23 } },
  'pomeranian': { size: 'tiny', typicalWeightKg: { min: 1.8, max: 3.5 }, heightCm: { min: 18, max: 30 } },
  'toy-poodle': { size: 'tiny', typicalWeightKg: { min: 2, max: 4 }, heightCm: { min: 24, max: 28 } },
  'maltese': { size: 'tiny', typicalWeightKg: { min: 2, max: 4 }, heightCm: { min: 20, max: 25 } },

  // Small breeds (5-10kg)
  'pug': { size: 'small', typicalWeightKg: { min: 6, max: 8 }, heightCm: { min: 25, max: 36 } },
  'french-bulldog': { size: 'small', typicalWeightKg: { min: 8, max: 12 }, heightCm: { min: 28, max: 33 } },
  'shih-tzu': { size: 'small', typicalWeightKg: { min: 4, max: 7.5 }, heightCm: { min: 23, max: 28 } },
  'dachshund': { size: 'small', typicalWeightKg: { min: 7, max: 15 }, heightCm: { min: 20, max: 27 } },
  'jack-russell-terrier': { size: 'small', typicalWeightKg: { min: 5, max: 8 }, heightCm: { min: 25, max: 38 } },
  'miniature-schnauzer': { size: 'small', typicalWeightKg: { min: 5, max: 9 }, heightCm: { min: 30, max: 36 } },
  'cavalier-king-charles-spaniel': { size: 'small', typicalWeightKg: { min: 5.5, max: 8.5 }, heightCm: { min: 30, max: 33 } },
  'boston-terrier': { size: 'small', typicalWeightKg: { min: 5, max: 11 }, heightCm: { min: 38, max: 43 } },

  // Medium breeds (10-25kg)
  'cocker-spaniel': { size: 'medium', typicalWeightKg: { min: 12, max: 16 }, heightCm: { min: 36, max: 43 } },
  'english-bulldog': { size: 'medium', typicalWeightKg: { min: 18, max: 25 }, heightCm: { min: 31, max: 40 } },
  'bulldog': { size: 'medium', typicalWeightKg: { min: 18, max: 25 }, heightCm: { min: 31, max: 40 } },
  'border-collie': { size: 'medium', typicalWeightKg: { min: 14, max: 20 }, heightCm: { min: 46, max: 56 } },
  'beagle': { size: 'medium', typicalWeightKg: { min: 9, max: 16 }, heightCm: { min: 33, max: 41 } },
  'corgi': { size: 'medium', typicalWeightKg: { min: 10, max: 14 }, heightCm: { min: 25, max: 30 } },
  'welsh-corgi': { size: 'medium', typicalWeightKg: { min: 10, max: 14 }, heightCm: { min: 25, max: 30 } },
  'australian-shepherd': { size: 'medium', typicalWeightKg: { min: 16, max: 32 }, heightCm: { min: 46, max: 58 } },
  'springer-spaniel': { size: 'medium', typicalWeightKg: { min: 18, max: 25 }, heightCm: { min: 46, max: 56 } },
  'staffordshire-bull-terrier': { size: 'medium', typicalWeightKg: { min: 11, max: 17 }, heightCm: { min: 36, max: 41 } },

  // Large breeds (25-45kg)
  'labrador-retriever': { size: 'large', typicalWeightKg: { min: 25, max: 36 }, heightCm: { min: 54, max: 62 } },
  'golden-retriever': { size: 'large', typicalWeightKg: { min: 25, max: 34 }, heightCm: { min: 51, max: 61 } },
  'german-shepherd': { size: 'large', typicalWeightKg: { min: 22, max: 40 }, heightCm: { min: 55, max: 65 } },
  'rottweiler': { size: 'large', typicalWeightKg: { min: 35, max: 60 }, heightCm: { min: 56, max: 69 } },
  'boxer': { size: 'large', typicalWeightKg: { min: 25, max: 32 }, heightCm: { min: 53, max: 63 } },
  'doberman': { size: 'large', typicalWeightKg: { min: 27, max: 45 }, heightCm: { min: 63, max: 72 } },
  'siberian-husky': { size: 'large', typicalWeightKg: { min: 16, max: 27 }, heightCm: { min: 51, max: 60 } },
  'weimaraner': { size: 'large', typicalWeightKg: { min: 25, max: 40 }, heightCm: { min: 56, max: 69 } },
  'vizsla': { size: 'large', typicalWeightKg: { min: 20, max: 30 }, heightCm: { min: 53, max: 64 } },

  // Giant breeds (> 45kg)
  'great-dane': { size: 'giant', typicalWeightKg: { min: 45, max: 90 }, heightCm: { min: 71, max: 86 } },
  'saint-bernard': { size: 'giant', typicalWeightKg: { min: 54, max: 82 }, heightCm: { min: 65, max: 90 } },
  'mastiff': { size: 'giant', typicalWeightKg: { min: 54, max: 104 }, heightCm: { min: 70, max: 91 } },
  'newfoundland': { size: 'giant', typicalWeightKg: { min: 45, max: 70 }, heightCm: { min: 63, max: 74 } },
  'bernese-mountain-dog': { size: 'giant', typicalWeightKg: { min: 36, max: 50 }, heightCm: { min: 58, max: 70 } },
  'irish-wolfhound': { size: 'giant', typicalWeightKg: { min: 40, max: 70 }, heightCm: { min: 71, max: 86 } },
};

/**
 * Cat breed size mapping
 * Small: < 4kg (Singapura, Munchkin)
 * Medium: 4-6kg (Domestic Shorthair, Siamese)
 * Large: > 6kg (Maine Coon, Ragdoll, British Shorthair)
 */
const CAT_BREED_SIZES: Record<string, BreedSizeInfo> = {
  // Small cats (< 4kg)
  'singapura': { size: 'small', typicalWeightKg: { min: 2, max: 3.5 } },
  'munchkin': { size: 'small', typicalWeightKg: { min: 2.5, max: 4 } },
  'devon-rex': { size: 'small', typicalWeightKg: { min: 2.5, max: 4.5 } },
  'cornish-rex': { size: 'small', typicalWeightKg: { min: 2.5, max: 4.5 } },

  // Medium cats (4-6kg)
  'domestic-shorthair': { size: 'medium', typicalWeightKg: { min: 3.5, max: 5.5 } },
  'siamese': { size: 'medium', typicalWeightKg: { min: 3.5, max: 5.5 } },
  'abyssinian': { size: 'medium', typicalWeightKg: { min: 3.5, max: 6 } },
  'burmese': { size: 'medium', typicalWeightKg: { min: 3.5, max: 6 } },
  'russian-blue': { size: 'medium', typicalWeightKg: { min: 3.5, max: 6.5 } },
  'bengal': { size: 'medium', typicalWeightKg: { min: 4, max: 7 } },

  // Large cats (> 6kg)
  'maine-coon': { size: 'large', typicalWeightKg: { min: 5.5, max: 11 } },
  'ragdoll': { size: 'large', typicalWeightKg: { min: 4.5, max: 9 } },
  'british-shorthair': { size: 'large', typicalWeightKg: { min: 4, max: 8 } },
  'norwegian-forest': { size: 'large', typicalWeightKg: { min: 4.5, max: 9 } },
  'savannah': { size: 'large', typicalWeightKg: { min: 5.5, max: 11 } },
  'persian': { size: 'large', typicalWeightKg: { min: 3.5, max: 7.5 } },
};

/**
 * Get breed size information from breed slug
 */
export function getBreedSize(breedSlug: string | undefined, animalType: 'dog' | 'cat' = 'dog'): BreedSizeInfo | null {
  if (!breedSlug) return null;

  const normalizedSlug = breedSlug.toLowerCase();
  const sizeMap = animalType === 'cat' ? CAT_BREED_SIZES : DOG_BREED_SIZES;

  return sizeMap[normalizedSlug] || null;
}

/**
 * Get breed size from weight (fallback when breed is unknown)
 */
export function getBreedSizeFromWeight(weight: number, animalType: 'dog' | 'cat' = 'dog'): BreedSize {
  if (animalType === 'cat') {
    if (weight < 4) return 'small';
    if (weight < 6) return 'medium';
    return 'large';
  }

  // Dog size categories
  if (weight < 5) return 'tiny';
  if (weight < 10) return 'small';
  if (weight < 25) return 'medium';
  if (weight < 45) return 'large';
  return 'giant';
}

/**
 * Calculate relative size ratio between two pets
 * Returns a description suitable for AI prompts
 */
export function getRelativeSizeDescription(
  pet1Size: BreedSize,
  pet2Size: BreedSize,
  pet1Name: string = 'Subject 1',
  pet2Name: string = 'Subject 2'
): string {
  const sizeOrder: BreedSize[] = ['tiny', 'small', 'medium', 'large', 'giant'];
  const index1 = sizeOrder.indexOf(pet1Size);
  const index2 = sizeOrder.indexOf(pet2Size);
  const diff = Math.abs(index1 - index2);

  if (diff === 0) {
    return `${pet1Name} and ${pet2Name} should be approximately equal in size`;
  }

  const larger = index1 > index2 ? pet1Name : pet2Name;
  const smaller = index1 > index2 ? pet2Name : pet1Name;

  if (diff === 1) {
    return `${larger} should be noticeably larger than ${smaller}`;
  }

  if (diff === 2) {
    return `${larger} should be significantly larger than ${smaller} (approximately 2-3x the size)`;
  }

  if (diff >= 3) {
    return `${larger} should be dramatically larger than ${smaller} (at least 3-4x the size). ${smaller} is a much smaller breed.`;
  }

  return '';
}

/**
 * Build size instruction for AI prompt
 */
export function buildSizeInstruction(pets: Array<{
  name: string;
  breedSlug?: string;
  weight?: number;
  animalType?: 'dog' | 'cat';
}>): string {
  if (pets.length <= 1) return '';

  const petSizes = pets.map(pet => {
    const breedSize = getBreedSize(pet.breedSlug, pet.animalType || 'dog');
    if (breedSize) return breedSize.size;

    // Fallback to weight if available
    if (pet.weight) {
      return getBreedSizeFromWeight(pet.weight, pet.animalType || 'dog');
    }

    return 'medium'; // Default fallback
  });

  const sizeDescriptions: string[] = [];
  for (let i = 0; i < pets.length - 1; i++) {
    const desc = getRelativeSizeDescription(
      petSizes[i],
      petSizes[i + 1],
      pets[i].name || `Subject ${i + 1}`,
      pets[i + 1].name || `Subject ${i + 2}`
    );
    if (desc) sizeDescriptions.push(desc);
  }

  if (sizeDescriptions.length === 0) return '';

  return `\n🎯 CRITICAL SIZE REQUIREMENT:\n${sizeDescriptions.join('\n')}\nMaintain anatomically accurate size proportions based on breed characteristics.\n`;
}
