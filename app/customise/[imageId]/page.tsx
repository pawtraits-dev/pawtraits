'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Upload, Sparkles, Share2, Check, ShoppingCart } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import UserAwareNavigation from '@/components/UserAwareNavigation';
import { CountryProvider } from '@/lib/country-context';

interface Pet {
  pet_id: string;  // Note: RPC function returns 'pet_id', not 'id'
  name: string;
  breed_id?: string;
  breed_name?: string;
  breed_slug?: string;
  coat_id?: string;
  coat_name?: string;
  coat_hex_color?: string;
  primary_photo_url?: string;
  photo_urls?: string[];
  animal_type?: 'dog' | 'cat';
  age?: number;
  personality_traits?: string[];
}

interface CatalogImage {
  id: string;
  description: string;
  imageUrl: string;
  thumbnailUrl?: string;
  theme?: { name: string; displayName: string };
  style?: { name: string; displayName: string };
  breed?: { name: string; displayName: string };
  format?: { id: string; name: string; aspectRatio: string };
}

interface CustomImage {
  id: string;
  generated_image_url: string;
  share_token: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
}

export default function CustomisePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const imageId = params.imageId as string;

  // Cloudinary URLs for progress graphics (with specific version and public IDs)
  const PROGRESS_IMAGES = [
    'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770800877/pawcasso-progress-1_selbwy.png',
    'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770800877/pawcasso-progress-2_m14aix.png',
    'https://res.cloudinary.com/dnhzfz8xv/image/upload/v1770800876/pawcasso-progress-3_sxffsu.png'
  ];

  const [catalogImage, setCatalogImage] = useState<CatalogImage | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [customImage, setCustomImage] = useState<CustomImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hasRated, setHasRated] = useState(false);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentProgressGraphic, setCurrentProgressGraphic] = useState(0);

  // Helper function to get aspect ratio style
  const getAspectRatioStyle = (aspectRatio?: string) => {
    if (!aspectRatio) return { aspectRatio: '1 / 1' }; // Default to square
    return { aspectRatio: aspectRatio.replace(':', ' / ') }; // Convert '16:9' to '16 / 9'
  };

  // Load catalog image and user's pets
  useEffect(() => {
    loadData();
  }, [imageId]);

  async function loadData() {
    try {
      setLoading(true);

      // Fetch catalog image
      console.log('🎨 Fetching catalog image:', imageId);
      const imageRes = await fetch(`/api/public/catalog-images/${imageId}`);
      console.log('📥 Catalog image response status:', imageRes.status);

      if (!imageRes.ok) throw new Error('Image not found');

      const imageData = await imageRes.json();
      console.log('✅ Catalog image loaded:', {
        id: imageData.id,
        hasImageUrl: !!imageData.imageUrl,
        imageUrl: imageData.imageUrl,
        theme: imageData.theme?.name,
        style: imageData.style?.name
      });
      setCatalogImage(imageData);

      // Fetch user's pets
      console.log('🐕 Fetching user pets...');
      const petsRes = await fetch('/api/customers/pets', {
        credentials: 'include'
      });
      console.log('📥 Pets response status:', petsRes.status);

      if (petsRes.ok) {
        const petsData = await petsRes.json();
        console.log('✅ Pets loaded:', petsData.pets?.length || 0);
        console.log('📦 Pet data structure:', petsData.pets?.[0] ? Object.keys(petsData.pets[0]) : 'No pets');
        console.log('📦 First pet full data:', petsData.pets?.[0]);
        setPets(petsData.pets || []);
      }
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file',
        variant: 'destructive'
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 10MB',
        variant: 'destructive'
      });
      return;
    }

    setUploadedFile(file);
    setSelectedPet(null); // Clear pet selection if uploading

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handlePetSelect(pet: Pet) {
    setSelectedPet(pet);
    setUploadedFile(null);
    setUploadPreview(null);
  }

  async function loadProgressMessages() {
    // Use simple, direct progress messages with pet's name and breed
    const petName = selectedPet?.name || 'your pet';
    const breedName = selectedPet?.breed_name || 'unique';

    setProgressMessages([
      `Pawcasso is studying his Muse, ${petName}`,
      `Pawcasso is hard at work capturing that ${breedName} personality`,
      `Pawcasso is putting the final touches in place, ready for the big reveal!`
    ]);
    setCurrentMessageIndex(0);
    setCurrentProgressGraphic(0);
  }

  async function handleRating(stars: number) {
    if (!customImage?.id || hasRated) return;

    try {
      const response = await fetch(`/api/customers/custom-images/${customImage.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: stars }),
        credentials: 'include'
      });

      if (response.ok) {
        setRating(stars);
        setHasRated(true);
        toast({
          title: 'Thanks for your feedback!',
          description: 'Your rating helps us help you.'
        });
      }
    } catch (error) {
      console.error('Failed to save rating:', error);
      toast({
        title: 'Rating failed',
        description: 'Could not save your rating. Please try again.',
        variant: 'destructive'
      });
    }
  }

  // Cycle through progress messages and graphics every 10 seconds
  useEffect(() => {
    if (generating && progressMessages.length > 0) {
      const interval = setInterval(() => {
        setCurrentMessageIndex((prev) =>
          (prev + 1) % progressMessages.length
        );
        setCurrentProgressGraphic((prev) =>
          (prev + 1) % 3 // Cycle through 3 graphics
        );
      }, 10000); // 10 seconds per message/graphic

      return () => clearInterval(interval);
    }
  }, [generating, progressMessages.length]);

  async function handleGenerate() {
    if (!selectedPet && !uploadedFile) {
      toast({
        title: 'Select a pet',
        description: 'Please select one of your pets or upload a photo',
        variant: 'destructive'
      });
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      // Load progress messages before starting generation
      await loadProgressMessages();

      const formData = new FormData();
      formData.append('catalogImageId', imageId);

      if (selectedPet) {
        formData.append('petId', selectedPet.pet_id);
        console.log('🐕 Using existing pet:', selectedPet.pet_id, selectedPet.name);
      } else if (uploadedFile) {
        formData.append('petPhoto', uploadedFile);
        console.log('📤 Uploading new pet photo:', uploadedFile.name, uploadedFile.size);
      }

      console.log('🚀 Calling generate endpoint:', '/api/customers/custom-images/generate');
      const response = await fetch('/api/customers/custom-images/generate', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      console.log('📥 Generate response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      console.log('📦 Generate response:', result);
      console.log('🆔 Custom image ID:', result.id);
      setCustomImage(result);

      // Poll for completion if status is generating
      if (result.status === 'generating' || result.status === 'pending') {
        if (!result.id) {
          console.error('❌ No ID in result, cannot poll:', result);
          setError('Generation started but cannot track status (no ID returned)');
          return;
        }
        pollForCompletion(result.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
      setGenerating(false); // Set to false on error
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive'
      });
    }
  }

  async function pollForCompletion(customImageId: string) {
    console.log('🎯 pollForCompletion called with ID:', customImageId);
    const maxAttempts = 60; // 2 minutes (2 second intervals)
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;
      console.log('🔄 Poll attempt', attempts, 'with ID:', customImageId);

      try {
        const url = `/api/customers/custom-images/${customImageId}`;
        console.log('🌐 Polling URL:', url);
        const response = await fetch(url, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          console.log('📊 Poll response:', {
            status: data.status,
            hasImageUrl: !!data.generated_image_url,
            imageUrl: data.generated_image_url?.substring(0, 50) + '...'
          });
          setCustomImage(data);

          if (data.status === 'complete' || data.status === 'failed') {
            clearInterval(poll);
            setGenerating(false); // Stop showing progress graphics

            if (data.status === 'complete') {
              console.log('✅ Generation complete!', data);
              toast({
                title: 'Image ready!',
                description: 'Your custom Pawtrait is ready!'
              });
            } else {
              console.error('❌ Generation failed:', data.error_message);
              setError('Generation failed. Please try again.');
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        setGenerating(false); // Stop showing progress graphics
        setError('Generation is taking longer than expected. Please check back later.');
      }
    }, 2000);
  }

  async function handlePurchase() {
    if (!customImage?.id) {
      toast({
        title: 'Error',
        description: 'Custom portrait ID not found',
        variant: 'destructive'
      });
      return;
    }

    // Navigate to dedicated custom portrait purchase page
    // This ensures the custom image (not catalog image) is displayed throughout checkout
    router.push(`/shop/custom-portrait/${customImage.id}`);
  }

  async function handleShare() {
    if (!customImage?.share_token) return;

    const shareUrl = `${window.location.origin}/share/custom/${customImage.share_token}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link copied!',
        description: 'Share link copied to clipboard'
      });
    } catch (err) {
      toast({
        title: 'Copy failed',
        description: 'Please copy the link manually',
        variant: 'destructive'
      });
    }
  }

  if (loading) {
    return (
      <CountryProvider>
        <div className="min-h-screen bg-gray-50">
          <UserAwareNavigation />
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        </div>
      </CountryProvider>
    );
  }

  if (error && !catalogImage) {
    return (
      <CountryProvider>
        <div className="min-h-screen bg-gray-50">
          <UserAwareNavigation />
          <div className="flex items-center justify-center h-64 px-4">
            <Card className="max-w-md">
              <CardContent className="pt-6">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={() => router.push('/browse')} className="mt-4 w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Gallery
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </CountryProvider>
    );
  }

  return (
    <CountryProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Global Navigation */}
        <UserAwareNavigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/browse"
            className="inline-flex items-center text-gray-600 hover:text-purple-600 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Gallery
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            Customise Your Portrait
          </h1>
          <p className="text-gray-600 mt-2">
            Put your own pet into this {catalogImage?.theme?.name || ''} themed portrait
          </p>
        </div>

        <div className={`grid grid-cols-1 ${!generating && (!customImage || customImage.status === 'failed') ? 'lg:grid-cols-2' : ''} gap-8`}>
          {/* Left: Original Image - Hidden during generation */}
          {!generating && (!customImage || customImage.status === 'failed') && (
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Original Portrait</CardTitle>
                </CardHeader>
                <CardContent>
                  {catalogImage && (
                    <div
                      className="relative w-full rounded-lg overflow-hidden bg-gray-100"
                      style={getAspectRatioStyle(catalogImage.format?.aspectRatio)}
                    >
                      <Image
                        src={catalogImage.imageUrl}
                        alt={catalogImage.description || 'Catalog image'}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    {catalogImage?.theme && (
                      <p><strong>Theme:</strong> {catalogImage.theme.name}</p>
                    )}
                    {catalogImage?.style && (
                      <p><strong>Style:</strong> {catalogImage.style.name}</p>
                    )}
                    {catalogImage?.breed && (
                      <p><strong>Original Breed:</strong> {catalogImage.breed.name}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Right: Pet Selection / Generation / Result */}
          <div className={`space-y-6 ${generating || (customImage && customImage.status !== 'failed') ? 'mx-auto max-w-2xl' : ''}`}>
            {!customImage || customImage.status === 'failed' ? (
              <>
                {/* Pet Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Choose Your Pet</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {pets.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {pets.map((pet) => (
                          <button
                            key={pet.pet_id}
                            onClick={() => handlePetSelect(pet)}
                            className={`relative p-4 border-2 rounded-lg transition-all ${
                              selectedPet?.pet_id === pet.pet_id
                                ? 'border-purple-600 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                          >
                            {pet.primary_photo_url && (
                              <div className="relative aspect-square w-full mb-2 rounded-lg overflow-hidden">
                                <Image
                                  src={pet.primary_photo_url}
                                  alt={pet.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <p className="font-semibold text-center">{pet.name}</p>
                            {selectedPet?.pet_id === pet.pet_id && (
                              <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-center py-4">
                        No pets found. Upload a photo below or{' '}
                        <Link href="/customer/pets" className="text-purple-600 hover:underline">
                          add your pet
                        </Link>{' '}
                        first.
                      </p>
                    )}

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">or</span>
                      </div>
                    </div>

                    {/* Upload New Photo */}
                    <div>
                      <label className="block">
                        <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                          uploadedFile ? 'border-purple-600 bg-purple-50' : 'border-gray-300 hover:border-purple-400'
                        }`}>
                          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600">
                            {uploadedFile ? 'Photo uploaded!' : 'Upload a photo of your pet'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Max 10MB, JPG/PNG
                          </p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                      </label>

                      {uploadPreview && (
                        <div className="mt-4 relative aspect-square w-full max-w-xs mx-auto rounded-lg overflow-hidden">
                          <Image
                            src={uploadPreview}
                            alt="Upload preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Generate Button */}
                <Button
                  onClick={handleGenerate}
                  disabled={generating || (!selectedPet && !uploadedFile)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 text-lg"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Generating Your Portrait...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Custom Portrait
                    </>
                  )}
                </Button>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              /* Result */
              <Card>
                <CardHeader>
                  <CardTitle>Your Custom Pawtrait</CardTitle>
                  <p className="text-sm text-gray-600 mt-2">
                    Your personalized Pawtrait is ready! Purchase to download the high-resolution version without watermark.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customImage.status === 'complete' && customImage.generated_image_url ? (
                    <>
                      {/* Image with copy protection */}
                      <div
                        className="relative w-full rounded-lg overflow-hidden bg-gray-100"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        style={{
                          ...getAspectRatioStyle(catalogImage?.format?.aspectRatio),
                          userSelect: 'none',
                          WebkitUserSelect: 'none'
                        }}
                      >
                        <Image
                          src={customImage.generated_image_url}
                          alt="Custom portrait"
                          fill
                          className="object-contain pointer-events-none"
                          draggable={false}
                          onContextMenu={(e) => e.preventDefault()}
                        />
                        {/* Watermark indicator */}
                        <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-xs">
                          Preview • Watermarked
                        </div>
                      </div>

                      {/* Purchase CTA Section */}
                      <Alert className="border-blue-200 bg-blue-50">
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-900">Love your portrait?</AlertTitle>
                        <AlertDescription className="text-blue-800">
                          Purchase to get the full high-resolution version without watermark, perfect for printing or sharing!
                        </AlertDescription>
                      </Alert>

                      {/* Rating Section */}
                      {!hasRated && (
                        <Card className="border-purple-200 bg-purple-50">
                          <CardContent className="pt-6">
                            <h4 className="font-semibold text-purple-900 mb-2">
                              How does it look?
                            </h4>
                            <p className="text-sm text-purple-700 mb-3">
                              Rate this portrait to help us improve Pawcasso's skills
                            </p>
                            <div className="flex gap-2 justify-center">
                              {[1, 2, 3, 4, 5].map((heartNum) => (
                                <button
                                  key={heartNum}
                                  onClick={() => handleRating(heartNum)}
                                  className={`text-3xl transition-all hover:scale-110 ${
                                    heartNum <= rating
                                      ? 'text-purple-600'
                                      : 'text-purple-300 hover:text-purple-400'
                                  }`}
                                >
                                  ❤️
                                </button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {hasRated && (
                        <Alert className="border-green-200 bg-green-50">
                          <Check className="h-4 w-4 text-green-600" />
                          <AlertTitle className="text-green-900">Thanks for rating!</AlertTitle>
                          <AlertDescription className="text-green-800">
                            Your feedback helps us make better Pawtraits for everyone.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-2">
                        <Button
                          onClick={handlePurchase}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          size="lg"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Purchase Digital Download
                        </Button>

                        <Button
                          onClick={handleShare}
                          variant="outline"
                          className="w-full"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Your Pawtrait
                        </Button>

                        <Button
                          onClick={() => {
                            setCustomImage(null);
                            setSelectedPet(null);
                            setUploadedFile(null);
                            setUploadPreview(null);
                          }}
                          variant="outline"
                          className="w-full"
                        >
                          Create Another
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      {/* Progress Graphic */}
                      <div className="relative w-full max-w-md mx-auto mb-6">
                        <img
                          src={PROGRESS_IMAGES[currentProgressGraphic]}
                          alt={`Pawcasso progress ${currentProgressGraphic + 1}`}
                          className="w-full h-auto rounded-lg"
                        />
                      </div>

                      {progressMessages.length > 0 ? (
                        <>
                          <p className="text-lg text-gray-700 font-medium mb-2">
                            {progressMessages[currentMessageIndex]}
                          </p>
                          <p className="text-sm text-gray-500">
                            This shouldn't take too long - good things come to those who wait!
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-600">
                            {customImage.status === 'pending' && 'Preparing your Pawtrait...'}
                            {customImage.status === 'generating' && 'Generating your Pawtrait...'}
                          </p>
                          <p className="text-sm text-gray-500 mt-2">
                            This shouldn't take too long - good things come to those who wait!
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      </div>
    </CountryProvider>
  );
}
