'use client';

import { useState, useEffect } from 'react';

// Force dynamic rendering - this prevents static generation
export const dynamic = 'force-dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Heart, X, Upload, Camera, Trash2, ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { UserProfile } from '@/lib/user-types';
import type { Breed, Coat, AnimalType } from '@/lib/types';

interface AddPetFormData {
  name: string;
  animal_type: AnimalType;
  breed_id: string;
  coat_id: string;
  gender: 'male' | 'female' | 'unknown';
  birthday?: string;
  weight?: number;
  personality_traits: string[];
  special_notes?: string;
}

export default function AddPetPage() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allBreeds, setAllBreeds] = useState<Breed[]>([]);
  const [allCoats, setAllCoats] = useState<Coat[]>([]);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [coats, setCoats] = useState<Coat[]>([]);
  const [availableCoats, setAvailableCoats] = useState<Coat[]>([]);
  const [newTrait, setNewTrait] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // AI Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showAnalysisReview, setShowAnalysisReview] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<AddPetFormData>({
    name: '',
    animal_type: 'dog',
    breed_id: '',
    coat_id: '',
    gender: 'unknown',
    birthday: '',
    weight: undefined,
    personality_traits: [],
    special_notes: ''
  });

  const supabase = getSupabaseClient();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      console.log('🔧 Loading initial data for add pet page...');
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('🔧 Auth user:', user?.id, user?.email, 'Error:', userError);
      
      if (!user) {
        console.error('🔧 No authenticated user found');
        alert('Please log in to add a pet.');
        return;
      }
      
      const [profileResult, breedsData, coatsData] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('breeds').select('*').eq('is_active', true).order('name'),
        supabase.from('coats').select('*').eq('is_active', true).order('name')
      ]);
      
      console.log('🔧 Profile result:', profileResult);
      console.log('🔧 Breeds data:', breedsData?.data?.length, 'breeds loaded');
      console.log('🔧 Coats data:', coatsData?.data?.length, 'coats loaded');
      
      if (profileResult.error) {
        console.log('🔧 Error loading user profile:', profileResult.error);
        
        // Try the debug API approach that works in other parts of the app
        try {
          const response = await fetch(`/api/debug/check-user-no-auth?email=${encodeURIComponent(user.email!)}`);
          
          if (response.ok) {
            const result = await response.json();
            console.log('🔧 Debug API result:', result);
            
            if (result.userProfile && result.userProfile.user_type === 'customer') {
              console.log('🔧 Using profile from debug API');
              setUserProfile(result.userProfile);
            } else {
              console.error('🔧 No customer profile found in debug API');
              alert('Customer profile not found. Please contact support.');
              return;
            }
          } else {
            console.error('🔧 Debug API failed:', response.status);
            alert('Unable to load profile. Please refresh the page.');
            return;
          }
        } catch (apiError) {
          console.error('🔧 Debug API error:', apiError);
          alert('Unable to load profile. Please refresh the page.');
          return;
        }
      } else {
        const profile = profileResult.data;
        console.log('🔧 Setting user profile:', profile);
        setUserProfile(profile);
      }
      
      const sortedBreeds = (breedsData?.data || []).sort((a: Breed, b: Breed) => a.name.localeCompare(b.name));
      const sortedCoats = (coatsData?.data || []).sort((a: Coat, b: Coat) => a.name.localeCompare(b.name));
      
      // Note: userProfile state might not be updated yet due to React's async state updates
      console.log('🔧 Final setup:', {
        breedsCount: sortedBreeds.length,
        coatsCount: sortedCoats.length,
        userProfileWillBeSet: true
      });
      
      setAllBreeds(sortedBreeds);
      setAllCoats(sortedCoats);
      
      // Filter for initial animal type (dog by default)
      const initialBreeds = sortedBreeds.filter((b: any) => b.animal_type === 'dog');
      const initialCoats = sortedCoats.filter((c: any) => c.animal_type === 'dog');
      
      setBreeds(initialBreeds);
      setCoats(initialCoats);
      setAvailableCoats(initialCoats);
    } catch (error) {
      console.error('🔧 Error loading initial data:', error);
      alert('Error loading page data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof AddPetFormData, value: any) => {
    console.log(`Setting ${field} to:`, value);
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      console.log('Updated form data:', newData);
      return newData;
    });
  };

  const handleAnimalTypeChange = (animalType: AnimalType) => {
    console.log('Animal type changed to:', animalType);
    handleInputChange('animal_type', animalType);
    
    // Reset breed and coat selection when animal type changes
    handleInputChange('breed_id', '');
    handleInputChange('coat_id', '');
    
    // Filter breeds and coats for the selected animal type
    const filteredBreeds = allBreeds.filter(b => b.animal_type === animalType);
    const filteredCoats = allCoats.filter(c => c.animal_type === animalType);
    
    setBreeds(filteredBreeds);
    setCoats(filteredCoats);
    setAvailableCoats(filteredCoats);
  };

  const handleBreedChange = async (breedId: string) => {
    console.log('Breed changed to:', breedId);
    handleInputChange('breed_id', breedId);
    
    // Reset coat selection when breed changes
    handleInputChange('coat_id', '');
    
    // Filter coats for this breed
    await loadAvailableCoats(breedId);
  };

  const loadAvailableCoats = async (breedId: string) => {
    if (!breedId) {
      setAvailableCoats(coats);
      return;
    }
    
    try {
      // Get coats available for this breed from breed_coat_details or breed_coats table
      const { data: breedCoats, error } = await supabase
        .from('breed_coat_details')
        .select(`
          coat_id,
          coats (
            id,
            name,
            hex_color,
            animal_type,
            is_active
          )
        `)
        .eq('breed_id', breedId);
      
      if (error) {
        console.warn('Could not load breed-specific coats, showing all coats for animal type:', error);
        setAvailableCoats(coats);
        return;
      }
      
      if (breedCoats && breedCoats.length > 0) {
        // Extract coat data and filter/sort
        const breedSpecificCoats = breedCoats
          .map((bc: any) => bc.coats)
          .filter((coat: any) => coat && coat.is_active && coat.animal_type === formData.animal_type)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        
        console.log(`Found ${breedSpecificCoats.length} coats for breed ${breedId}`);
        setAvailableCoats(breedSpecificCoats as Coat[]);
      } else {
        // No specific coats found, show all coats for this animal type
        console.log('No breed-specific coats found, showing all coats for animal type');
        setAvailableCoats(coats);
      }
    } catch (error) {
      console.error('Error loading available coats:', error);
      setAvailableCoats(coats);
    }
  };

  const addPersonalityTrait = () => {
    if (newTrait.trim() && !formData.personality_traits.includes(newTrait.trim())) {
      setFormData(prev => ({
        ...prev,
        personality_traits: [...prev.personality_traits, newTrait.trim()]
      }));
      setNewTrait('');
    }
  };

  const removePersonalityTrait = (trait: string) => {
    setFormData(prev => ({
      ...prev,
      personality_traits: prev.personality_traits.filter(t => t !== trait)
    }));
  };

  const handlePhotoSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file. Only image files are allowed.`);
        return false;
      }
      if (file.size > maxSize) {
        alert(`${file.name} is too large. Maximum file size is 10MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Add to selected photos (limit to 10 total)
    setSelectedPhotos(prev => {
      const combined = [...prev, ...validFiles];
      if (combined.length > 10) {
        alert('Maximum 10 photos allowed per pet.');
        return combined.slice(0, 10);
      }
      return combined;
    });

    // Create preview URLs
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPhotoPreviewUrls(prev => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));

    // Clear AI analysis if removing the first photo
    if (index === 0) {
      setAiAnalysis(null);
      setShowAnalysisReview(false);
      setAnalysisError(null);
    }
  };

  const analyzeFirstPhoto = async () => {
    if (!selectedPhotos[0] || !photoPreviewUrls[0]) {
      console.log('No photo to analyze');
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);
    console.log('🎨 Starting AI analysis of first photo...');

    try {
      // The photoPreviewUrls[0] is already in base64 data URL format
      const imageBase64 = photoPreviewUrls[0];

      const response = await fetch('/api/customers/pets/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          animalType: formData.animal_type
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const { analysis, processingTime } = await response.json();
        console.log(`✅ AI analysis complete in ${processingTime}ms:`, analysis);

        setAiAnalysis(analysis);
        setShowAnalysisReview(true);

        // Auto-fill breed if confidence is high enough
        if (analysis.breedConfidence >= 6 && analysis.breed) {
          // Try to find matching breed in our breeds list
          const matchingBreed = breeds.find(b => {
            const breedName = b.name.toLowerCase();
            const detectedBreed = analysis.breed.toLowerCase();
            // Check for exact match, partial match, or word-level match
            return breedName === detectedBreed ||
                   breedName.includes(detectedBreed) ||
                   detectedBreed.includes(breedName) ||
                   detectedBreed.split(' ').some(word => breedName.includes(word));
          });

          if (matchingBreed) {
            console.log('✅ Auto-filling breed:', matchingBreed.name);
            await handleBreedChange(matchingBreed.id);

            // After breed is selected, try to match coat
            if (analysis.coatConfidence >= 5 && analysis.coat && availableCoats.length > 0) {
              // Give breed change time to update availableCoats
              setTimeout(() => {
                const matchingCoat = availableCoats.find(c => {
                  const coatName = c.name.toLowerCase();
                  const detectedCoat = analysis.coat.toLowerCase();
                  // Match coat colors/patterns
                  return coatName.includes(detectedCoat) ||
                         detectedCoat.includes(coatName) ||
                         detectedCoat.split(/[\s/]/).some(word => coatName.includes(word));
                });

                if (matchingCoat) {
                  console.log('✅ Auto-filling coat:', matchingCoat.name);
                  handleInputChange('coat_id', matchingCoat.id);
                } else {
                  console.log('⚠️ No matching coat found for:', analysis.coat);
                }
              }, 300);
            }
          } else {
            console.log('⚠️ No matching breed found for:', analysis.breed);
          }
        }

        // Auto-fill personality traits if detected
        if (analysis.personalityTraits && analysis.personalityTraits.length > 0) {
          console.log('✅ Auto-filling personality traits:', analysis.personalityTraits);
          setFormData(prev => ({
            ...prev,
            personality_traits: [...new Set([...prev.personality_traits, ...analysis.personalityTraits])]
          }));
        }
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Analysis failed';
        console.error('❌ Analysis failed:', errorMessage);
        setAnalysisError(errorMessage);

        if (errorData.fallback) {
          // Analysis failed but we can continue with manual entry
          console.log('Fallback mode - user can enter details manually');
        }
      }
    } catch (error) {
      console.error('❌ Analysis error:', error);
      setAnalysisError('Unable to analyze image. Please fill in details manually.');
    } finally {
      setAnalyzing(false);
    }
  };

  const uploadPhotosForPet = async (petId: string) => {
    if (selectedPhotos.length === 0) return;

    setUploadingPhotos(true);
    
    try {
      const uploadPromises = selectedPhotos.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', userProfile!.user_id);
        formData.append('petId', petId);

        const response = await fetch('/api/upload/pet-photo', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Upload failed for ${file.name}: ${errorData.error || 'Unknown error'}`);
        }

        return response.json();
      });

      await Promise.all(uploadPromises);
      console.log('All photos uploaded successfully');
    } catch (error) {
      console.error('Error uploading photos:', error);
      throw error; // Re-throw to handle in main submit function
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔧 Form submitted with data:', formData);
    console.log('🔧 Current userProfile state:', userProfile);
    console.log('🔧 Validation check:', {
      userProfile: !!userProfile,
      userProfileId: userProfile?.user_id,
      name: formData.name,
      breed_id: formData.breed_id,
      name_length: formData.name.length,
      breed_id_length: formData.breed_id.length
    });
    
    // Double-check user profile by getting it fresh if needed
    if (!userProfile || !userProfile.user_id) {
      console.warn('🔧 User profile not available, attempting fresh load...');
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          alert('Please log in to add a pet.');
          return;
        }
        
        // Try direct query first
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (error || !profile) {
          // Fallback to debug API
          const response = await fetch(`/api/debug/check-user-no-auth?email=${encodeURIComponent(user.email!)}`);
          if (response.ok) {
            const result = await response.json();
            if (result.userProfile && result.userProfile.user_type === 'customer') {
              setUserProfile(result.userProfile);
              console.log('🔧 Fresh profile loaded via debug API');
            } else {
              alert('Customer profile not found. Please contact support.');
              return;
            }
          } else {
            alert('Unable to verify your profile. Please refresh the page and try again.');
            return;
          }
        } else {
          setUserProfile(profile);
          console.log('🔧 Fresh profile loaded directly');
        }
      } catch (error) {
        console.error('🔧 Error getting fresh profile:', error);
        alert('Unable to verify your profile. Please refresh the page and try again.');
        return;
      }
    }
    
    if (!formData.name.trim()) {
      alert('Please enter your pet\'s name.');
      return;
    }
    
    if (!formData.breed_id) {
      alert('Please select a breed.');
      return;
    }

    setSubmitting(true);

    try {
      // Get the authorization token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to add a pet.');
        return;
      }

      console.log('🔧 Submitting pet data via API...');
      
      const petData = {
        name: formData.name.trim(),
        animal_type: formData.animal_type,
        breed_id: formData.breed_id,
        coat_id: formData.coat_id || null,
        gender: formData.gender,
        birthday: formData.birthday || null,
        weight: formData.weight || null,
        personality_traits: formData.personality_traits,
        special_notes: formData.special_notes?.trim() || null,
        // Include AI analysis data if available
        ai_analysis_data: aiAnalysis ? {
          breed_detected: aiAnalysis.breed,
          breed_confidence: aiAnalysis.breedConfidence,
          coat_detected: aiAnalysis.coat,
          coat_confidence: aiAnalysis.coatConfidence,
          personality_detected: aiAnalysis.personalityTraits || [],
          physical_characteristics: aiAnalysis.physicalCharacteristics,
          species: aiAnalysis.species,
          analysis_timestamp: new Date().toISOString(),
          full_composition_analysis: aiAnalysis.fullAnalysis
        } : null
      };
      
      console.log('🔧 Pet data to submit:', petData);
      
      const response = await fetch('/api/customers/pets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(petData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🔧 Pet added successfully:', result);
        
        // Upload photos if any were selected
        if (selectedPhotos.length > 0 && result.pet?.id) {
          try {
            await uploadPhotosForPet(result.pet.id);
            alert(`${result.message || 'Pet added successfully!'} Photos uploaded successfully!`);
          } catch (photoError) {
            console.error('Photo upload failed:', photoError);
            alert(`${result.message || 'Pet added successfully!'} However, some photos failed to upload. You can add them later from the pet management page.`);
          }
        } else {
          alert(result.message || 'Pet added successfully!');
        }
        
        router.push('/customer/pets');
      } else {
        const errorData = await response.json();
        console.error('🔧 Failed to add pet:', errorData);
        alert(`Failed to add pet: ${errorData.error || 'Unknown error'}\n${errorData.details || ''}`);
      }
    } catch (error) {
      console.error('🔧 Error adding pet:', error);
      alert('Failed to add pet. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Pet</h1>
          <p className="text-gray-600 mt-1">
            Add your pet's details to start creating AI portraits
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="w-5 h-5 text-purple-600" />
              <span>Step 1: Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="animal_type">Pet Type *</Label>
              <Select value={formData.animal_type} onValueChange={handleAnimalTypeChange}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select pet type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dog">🐕 Dog</SelectItem>
                  <SelectItem value="cat">🐱 Cat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Pet Name *</Label>
              <Input
                id="name"
                placeholder="Enter your pet's name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
              <p className="text-sm text-gray-500">
                We'll use this to personalize your portraits
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Pet Photos - Upload First for AI Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="w-5 h-5 text-purple-600" />
              <span>Step 2: Upload Photos</span>
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2">
              Upload photos of your pet, then use our AI to detect breed, coat color, and personality traits!
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-300 transition-colors">
              <input
                type="file"
                id="photo-upload"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelection}
                disabled={selectedPhotos.length >= 10}
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Click to upload photos
                  </p>
                  <p className="text-xs text-gray-500">
                    Add up to 10 photos • Max 10MB per file • JPG, PNG, WebP
                  </p>
                  {selectedPhotos.length >= 10 && (
                    <p className="text-xs text-red-500 mt-1">
                      Maximum 10 photos reached
                    </p>
                  )}
                </div>
              </label>
            </div>

            {selectedPhotos.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Selected Photos ({selectedPhotos.length}/10)
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  {photoPreviewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={url}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                      <div className="absolute bottom-1 left-1 right-1">
                        <div className="bg-black/50 text-white text-xs px-2 py-1 rounded text-center truncate">
                          {selectedPhotos[index].name}
                        </div>
                      </div>
                      {index === 0 && (
                        <div className="absolute top-1 left-1">
                          <Badge className="bg-purple-600 text-white text-xs">Primary</Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Analysis Trigger Button - Show when photos uploaded but not yet analyzed */}
        {selectedPhotos.length > 0 && !analyzing && !showAnalysisReview && (
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="py-6">
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-purple-900">
                    Let Pawcasso Analyze Your Pet
                  </h3>
                  <p className="text-sm text-purple-700 mt-1">
                    Our AI will detect breed, coat color, and personality traits to pre-fill the form below
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={analyzeFirstPhoto}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  size="lg"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Analyze Photos with AI
                </Button>
                <p className="text-xs text-purple-600">
                  This will help us auto-fill the details below, saving you time!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Analysis Loading State */}
        {analyzing && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-6">
              <div className="flex items-center justify-center space-x-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    Pawcasso is studying your pet...
                  </p>
                  <p className="text-xs text-blue-700">
                    Analyzing breed, coat, and personality traits
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Analysis Results */}
        {showAnalysisReview && aiAnalysis && !analyzing && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <Sparkles className="w-5 h-5 text-blue-600" />
                Pawcasso's Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Detected Breed:</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base bg-white">
                    {aiAnalysis.breed || 'Unknown'}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    Confidence: {aiAnalysis.breedConfidence}/10
                    {aiAnalysis.breedConfidence >= 7 && ' ✨ High confidence'}
                    {aiAnalysis.breedConfidence < 5 && ' - Please verify'}
                  </span>
                </div>
              </div>

              {aiAnalysis.coat && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Detected Coat:</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white">
                      {aiAnalysis.coat}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      Confidence: {aiAnalysis.coatConfidence}/10
                    </span>
                  </div>
                </div>
              )}

              {aiAnalysis.personalityTraits?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Suggested Personality Traits:</p>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.personalityTraits.map((trait: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="bg-white">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {aiAnalysis.physicalCharacteristics && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Physical Characteristics:</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                    {aiAnalysis.physicalCharacteristics.pose && (
                      <span className="bg-white px-2 py-1 rounded">
                        Pose: {aiAnalysis.physicalCharacteristics.pose}
                      </span>
                    )}
                    {aiAnalysis.physicalCharacteristics.gaze && (
                      <span className="bg-white px-2 py-1 rounded">
                        Gaze: {aiAnalysis.physicalCharacteristics.gaze}
                      </span>
                    )}
                    {aiAnalysis.physicalCharacteristics.expression && (
                      <span className="bg-white px-2 py-1 rounded">
                        Expression: {aiAnalysis.physicalCharacteristics.expression}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-blue-200">
                <p className="text-xs text-blue-700">
                  ✨ We've pre-filled breed and coat details below based on this analysis. You can review and modify them if needed.
                </p>
              </div>

              <Button
                type="button"
                onClick={() => setShowAnalysisReview(false)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Continue to Details
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AI Analysis Error */}
        {analysisError && !analyzing && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900 mb-1">
                    AI Analysis Unavailable
                  </p>
                  <p className="text-xs text-yellow-700">
                    {analysisError}
                  </p>
                  {selectedPhotos.length > 0 && (
                    <Button
                      type="button"
                      onClick={analyzeFirstPhoto}
                      variant="outline"
                      size="sm"
                      className="mt-2"
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Breed & Physical Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Heart className="w-5 h-5 text-purple-600" />
              <span>Step 3: Breed & Physical Details</span>
            </CardTitle>
            {aiAnalysis && (
              <p className="text-sm text-gray-600 mt-2">
                ✨ Pre-filled from AI analysis - feel free to adjust if needed
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="breed">Breed *</Label>
                <Select value={formData.breed_id} onValueChange={handleBreedChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${formData.animal_type === 'cat' ? 'cat' : 'dog'} breed`} />
                  </SelectTrigger>
                  <SelectContent>
                    {breeds.map(breed => (
                      <SelectItem key={breed.id} value={breed.id}>
                        {breed.animal_type === 'cat' ? '🐱' : '🐕'} {breed.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="coat">Coat Color {formData.breed_id && availableCoats.length < coats.length ? `(${availableCoats.length} available for this breed)` : `(${coats.length} available for ${formData.animal_type === 'cat' ? 'cats' : 'dogs'})`}</Label>
                <Select value={formData.coat_id} onValueChange={(value) => handleInputChange('coat_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={formData.breed_id ? "Select coat color" : `Select ${formData.animal_type === 'cat' ? 'cat' : 'dog'} breed first`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoats.map(coat => (
                      <SelectItem key={coat.id} value={coat.id}>
                        <div className="flex items-center space-x-2">
                          {coat.hex_color && (
                            <div
                              className="w-3 h-3 rounded-full border border-gray-300"
                              style={{ backgroundColor: coat.hex_color }}
                            />
                          )}
                          <span>{coat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(value: 'male' | 'female' | 'unknown') => handleInputChange('gender', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="Weight in pounds"
                  value={formData.weight || ''}
                  onChange={(e) => handleInputChange('weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(e) => handleInputChange('birthday', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 4: Personality Traits */}
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Personality Traits</CardTitle>
            {aiAnalysis && aiAnalysis.personalityTraits?.length > 0 && (
              <p className="text-sm text-gray-600 mt-2">
                ✨ Pre-filled from AI analysis - add or remove as needed
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Add personality trait (e.g., playful, calm, energetic)"
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPersonalityTrait())}
              />
              <Button type="button" onClick={addPersonalityTrait}>
                Add
              </Button>
            </div>

            {formData.personality_traits.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.personality_traits.map((trait, index) => (
                  <Badge key={index} variant="secondary" className="bg-purple-50 text-purple-700">
                    {trait}
                    <button
                      type="button"
                      onClick={() => removePersonalityTrait(trait)}
                      className="ml-2 text-purple-500 hover:text-purple-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 5: Special Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Step 5: Special Notes (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any special notes about your pet (optional)"
              value={formData.special_notes}
              onChange={(e) => handleInputChange('special_notes', e.target.value)}
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            disabled={submitting || uploadingPhotos}
          >
            {submitting ? (uploadingPhotos ? 'Adding Pet & Uploading Photos...' : 'Adding Pet...') : 'Add Pet'}
          </Button>
        </div>
      </form>
    </div>
  );
}