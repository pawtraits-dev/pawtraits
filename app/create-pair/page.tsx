'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PawSpinner } from '@/components/ui/paw-spinner';
import { DogUploader } from '@/components/create/DogUploader';

interface CatalogImage {
  id: string;
  cloudinaryPublicId: string;
  imageUrl: string;
  thumbnailUrl: string;
  prompt: string;
  breed: {
    id: string;
    name: string;
    displayName: string;
    animalType: string;
  } | null;
  theme: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  style: {
    id: string;
    name: string;
    displayName: string;
  } | null;
}

interface GenerationResult {
  watermarkedUrl: string;
  metadata: {
    breedName: string;
    themeName: string;
    styleName: string;
  };
  rateLimitRemaining: number;
  generationTimeMs: number;
}

function CreatePairPageContent() {
  const searchParams = useSearchParams();
  const catalogId = searchParams?.get('id');

  const [catalogImage, setCatalogImage] = useState<CatalogImage | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Two pet images
  const [pet1File, setPet1File] = useState<File | null>(null);
  const [pet1Base64, setPet1Base64] = useState<string>('');
  const [pet2File, setPet2File] = useState<File | null>(null);
  const [pet2Base64, setPet2Base64] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [rateLimitRemaining, setRateLimitRemaining] = useState(3);

  // Load catalog image on mount
  useEffect(() => {
    if (!catalogId) {
      setCatalogError('No image ID provided. Please use a valid link.');
      setIsLoadingCatalog(false);
      return;
    }

    loadCatalogImage(catalogId);
  }, [catalogId]);

  const loadCatalogImage = async (id: string) => {
    try {
      setIsLoadingCatalog(true);
      setCatalogError(null);

      console.log('📸 [CREATE PAIR PAGE] Loading catalog image:', id);
      const response = await fetch(`/api/public/catalog-images/${id}`);

      console.log('📸 [CREATE PAIR PAGE] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [CREATE PAIR PAGE] API error:', response.status, errorData);

        if (response.status === 404) {
          throw new Error('Portrait not found. Please check your link.');
        }
        throw new Error('Failed to load portrait');
      }

      const data = await response.json();
      console.log('✅ [CREATE PAIR PAGE] Catalog data received:', {
        id: data.id,
        hasImageUrl: !!data.imageUrl,
        breedName: data.breed?.displayName
      });

      setCatalogImage(data);
    } catch (error: any) {
      console.error('❌ [CREATE PAIR PAGE] Error loading catalog image:', error);
      setCatalogError(error.message || 'Failed to load portrait');
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handlePet1Upload = (file: File, base64: string) => {
    setPet1File(file);
    setPet1Base64(base64);
    setUploadError(null);
  };

  const handlePet2Upload = (file: File, base64: string) => {
    setPet2File(file);
    setPet2Base64(base64);
    setUploadError(null);
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
  };

  const handleGenerate = async () => {
    if (!catalogImage || !pet1Base64 || !pet2Base64) {
      setGenerationError('Please upload both pet photos');
      return;
    }

    console.log('🎨 [CREATE PAIR PAGE] Starting pair generation...');
    setIsGenerating(true);
    setGenerationError(null);

    try {
      console.log('📤 [CREATE PAIR PAGE] Sending request to pair generation API');
      const response = await fetch('/api/public/generate-pair-variation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          catalogImageId: catalogImage.id,
          pet1ImageBase64: pet1Base64,
          pet2ImageBase64: pet2Base64,
        }),
      });

      console.log('📥 [CREATE PAIR PAGE] Generation response status:', response.status);
      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [CREATE PAIR PAGE] Generation failed:', data);

        if (response.status === 429) {
          const retryMinutes = Math.ceil(data.retryAfter / 60);
          throw new Error(
            `You've reached the limit. Please try again in ${retryMinutes} minutes.`
          );
        }

        throw new Error(data.message || data.error || 'Generation failed');
      }

      console.log('✅ [CREATE PAIR PAGE] Generation successful:', {
        hasWatermarkedUrl: !!data.watermarkedUrl,
        metadata: data.metadata,
        rateLimitRemaining: data.rateLimitRemaining
      });

      setGenerationResult(data);
      setRateLimitRemaining(data.rateLimitRemaining);

      // Scroll to result
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);
    } catch (error: any) {
      console.error('❌ [CREATE PAIR PAGE] Generation error:', error);
      setGenerationError(error.message || 'Failed to generate portrait');
    } finally {
      setIsGenerating(false);
    }
  };

  // Loading state
  if (isLoadingCatalog) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <PawSpinner size="large" />
          <p className="text-gray-600">Loading portrait...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (catalogError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h2 className="text-xl font-semibold">Oops!</h2>
              <p className="text-gray-600">{catalogError}</p>
              <Button asChild>
                <Link href="/">Go to Gallery</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!catalogImage) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-lg font-bold">Create Pair Portrait (TEST)</h1>
          <div className="w-20" />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Rate limit indicator */}
        {rateLimitRemaining <= 1 && !generationResult && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You have {rateLimitRemaining} free {rateLimitRemaining === 1 ? 'generation' : 'generations'} remaining this hour.
            </AlertDescription>
          </Alert>
        )}

        {/* Catalog image display */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Target Portrait Style (2 Animals)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative w-full aspect-square overflow-hidden rounded-lg">
              <Image
                src={catalogImage.imageUrl}
                alt={`${catalogImage.breed?.displayName || 'Pet'} portrait`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {catalogImage.breed && (
                <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                  🐕 {catalogImage.breed.displayName}
                </span>
              )}
              {catalogImage.theme && (
                <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                  🎨 {catalogImage.theme.displayName}
                </span>
              )}
              {catalogImage.style && (
                <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                  ✨ {catalogImage.style.displayName}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pet 1 uploader */}
        <div>
          <h2 className="text-xl font-bold mb-3">Upload First Pet Photo</h2>
          <DogUploader
            onUpload={handlePet1Upload}
            onError={handleUploadError}
            disabled={isGenerating}
          />
        </div>

        {/* Pet 2 uploader */}
        <div>
          <h2 className="text-xl font-bold mb-3">Upload Second Pet Photo</h2>
          <DogUploader
            onUpload={handlePet2Upload}
            onError={handleUploadError}
            disabled={isGenerating}
          />
        </div>

        {/* Upload error */}
        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* Generate button */}
        {pet1Base64 && pet2Base64 && !generationResult && (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !pet1Base64 || !pet2Base64}
            className="w-full h-14 text-lg font-bold sticky bottom-4 shadow-lg"
            size="lg"
          >
            {isGenerating ? (
              <>
                <PawSpinner className="mr-2" />
                Generating Pair Portrait...
              </>
            ) : (
              'Generate Pair Portrait'
            )}
          </Button>
        )}

        {/* Generation error */}
        {generationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{generationError}</AlertDescription>
          </Alert>
        )}

        {/* Generated result */}
        {generationResult && (
          <Card>
            <CardHeader>
              <CardTitle>Your Pair Portrait</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative w-full aspect-square bg-gray-100">
                <Image
                  src={generationResult.watermarkedUrl}
                  alt="Generated pair portrait"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                  Generation time: {(generationResult.generationTimeMs / 1000).toFixed(1)}s
                </span>
                <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                  Remaining: {generationResult.rateLimitRemaining}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                This is a test page. No download/purchase options yet.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function CreatePairPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <PawSpinner size="large" />
      </div>
    }>
      <CreatePairPageContent />
    </Suspense>
  );
}
