'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Upload, Sparkles, Share2, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Pet {
  id: string;
  name: string;
  breed_id?: string;
  coat_id?: string;
  primary_photo_url?: string;
  photo_urls?: string[];
  animal_type: 'dog' | 'cat';
}

interface CatalogImage {
  id: string;
  description: string;
  imageUrl: string;
  thumbnailUrl?: string;
  theme?: { name: string; displayName: string };
  style?: { name: string; displayName: string };
  breed?: { name: string; displayName: string };
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

  const [catalogImage, setCatalogImage] = useState<CatalogImage | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [customImage, setCustomImage] = useState<CustomImage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const formData = new FormData();
      formData.append('catalogImageId', imageId);

      if (selectedPet) {
        formData.append('petId', selectedPet.id);
      } else if (uploadedFile) {
        formData.append('petPhoto', uploadedFile);
      }

      const response = await fetch('/api/customers/custom-images/generate', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      setCustomImage(result);

      // Poll for completion if status is generating
      if (result.status === 'generating' || result.status === 'pending') {
        pollForCompletion(result.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setGenerating(false);
    }
  }

  async function pollForCompletion(customImageId: string) {
    const maxAttempts = 60; // 2 minutes (2 second intervals)
    let attempts = 0;

    const poll = setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(`/api/customers/custom-images/${customImageId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setCustomImage(data);

          if (data.status === 'complete' || data.status === 'failed') {
            clearInterval(poll);

            if (data.status === 'complete') {
              toast({
                title: 'Image ready!',
                description: 'Your custom portrait has been generated'
              });
            } else {
              setError('Generation failed. Please try again.');
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        setError('Generation is taking longer than expected. Please check back later.');
      }
    }, 2000);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !catalogImage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Original Image */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Original Portrait</CardTitle>
              </CardHeader>
              <CardContent>
                {catalogImage && (
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden">
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

          {/* Right: Pet Selection / Generation / Result */}
          <div className="space-y-6">
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
                            key={pet.id}
                            onClick={() => handlePetSelect(pet)}
                            className={`relative p-4 border-2 rounded-lg transition-all ${
                              selectedPet?.id === pet.id
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
                            {selectedPet?.id === pet.id && (
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
                  <CardTitle>Your Custom Portrait</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {customImage.status === 'complete' && customImage.generated_image_url ? (
                    <>
                      <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                        <Image
                          src={customImage.generated_image_url}
                          alt="Custom portrait"
                          fill
                          className="object-cover"
                        />
                      </div>

                      <div className="space-y-2">
                        <Button
                          onClick={handleShare}
                          variant="outline"
                          className="w-full"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Your Portrait
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
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">
                        {customImage.status === 'pending' && 'Preparing your portrait...'}
                        {customImage.status === 'generating' && 'Generating your portrait...'}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        This usually takes 30-60 seconds
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
