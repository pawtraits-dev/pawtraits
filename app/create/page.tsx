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
import { VariationPreview } from '@/components/create/VariationPreview';
import { ConversionModal } from '@/components/create/ConversionModal';

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

function CreatePageContent() {
  const searchParams = useSearchParams();
  const catalogId = searchParams?.get('id');

  const [catalogImage, setCatalogImage] = useState<CatalogImage | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [userDogFile, setUserDogFile] = useState<File | null>(null);
  const [userDogBase64, setUserDogBase64] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [rateLimitRemaining, setRateLimitRemaining] = useState(3);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [conversionAction, setConversionAction] = useState<'download' | 'print'>('download');

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

      console.log('📸 [CREATE PAGE] Loading catalog image:', id);
      const response = await fetch(`/api/public/catalog-images/${id}`);

      console.log('📸 [CREATE PAGE] API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [CREATE PAGE] API error:', response.status, errorData);

        if (response.status === 404) {
          throw new Error('Portrait not found. Please check your link.');
        }
        throw new Error('Failed to load portrait');
      }

      const data = await response.json();
      console.log('✅ [CREATE PAGE] Catalog data received:', {
        id: data.id,
        hasImageUrl: !!data.imageUrl,
        imageUrl: data.imageUrl?.substring(0, 100),
        breedName: data.breed?.displayName,
        cloudinaryPublicId: data.cloudinaryPublicId
      });

      setCatalogImage(data);
    } catch (error: any) {
      console.error('❌ [CREATE PAGE] Error loading catalog image:', error);
      setCatalogError(error.message || 'Failed to load portrait');
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleDogUpload = (file: File, base64: string) => {
    setUserDogFile(file);
    setUserDogBase64(base64);
    setUploadError(null);
  };

  const handleUploadError = (error: string) => {
    setUploadError(error);
  };

  const handleGenerate = async () => {
    if (!catalogImage || !userDogBase64) {
      console.log('⚠️ [CREATE PAGE] Missing data for generation');
      return;
    }

    console.log('🎨 [CREATE PAGE] Starting generation...');
    setIsGenerating(true);
    setGenerationError(null);

    try {
      console.log('📤 [CREATE PAGE] Sending request to generate API');
      const response = await fetch('/api/public/generate-variation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          catalogImageId: catalogImage.id,
          userImageBase64: userDogBase64,
        }),
      });

      console.log('📥 [CREATE PAGE] Generation response status:', response.status);
      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [CREATE PAGE] Generation failed:', data);

        if (response.status === 429) {
          // Rate limit exceeded
          const retryMinutes = Math.ceil(data.retryAfter / 60);
          throw new Error(
            `You've reached the limit of 3 free generations per hour. Please try again in ${retryMinutes} minutes, or create an account for unlimited generations!`
          );
        }

        throw new Error(data.message || data.error || 'Generation failed');
      }

      console.log('✅ [CREATE PAGE] Generation successful:', {
        hasWatermarkedUrl: !!data.watermarkedUrl,
        watermarkedUrl: data.watermarkedUrl?.substring(0, 100),
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
      console.error('Generation error:', error);
      setGenerationError(error.message || 'Failed to generate portrait');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadClick = () => {
    setConversionAction('download');
    setShowConversionModal(true);
  };

  const handlePrintClick = () => {
    setConversionAction('print');
    setShowConversionModal(true);
  };

  const handleShareClick = (platform: string) => {
    // TODO: Implement social sharing
    console.log('Share on:', platform);
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
          <h1 className="text-lg font-bold">Create Your Portrait</h1>
          <div className="w-20" /> {/* Spacer for centering */}
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
              Create an account for unlimited generations!
            </AlertDescription>
          </Alert>
        )}

        {/* Catalog image display */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Portrait Style</CardTitle>
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

        {/* Dog uploader */}
        <div>
          <h2 className="text-xl font-bold mb-3">Upload Your Dog&apos;s Photo</h2>
          <DogUploader
            onUpload={handleDogUpload}
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
        {userDogBase64 && !generationResult && (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !userDogBase64}
            className="w-full h-14 text-lg font-bold sticky bottom-4 shadow-lg"
            size="lg"
          >
            {isGenerating ? (
              <>
                <PawSpinner className="mr-2" />
                Generating Your Portrait...
              </>
            ) : (
              'Generate My Dog\'s Portrait'
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
          <div>
            <h2 className="text-xl font-bold mb-3">Your Custom Portrait</h2>
            <VariationPreview
              watermarkedUrl={generationResult.watermarkedUrl}
              metadata={generationResult.metadata}
              onDownloadClick={handleDownloadClick}
              onPrintClick={handlePrintClick}
              onShareClick={handleShareClick}
            />
          </div>
        )}
      </main>

      {/* Conversion modal */}
      <ConversionModal
        open={showConversionModal}
        onOpenChange={setShowConversionModal}
        action={conversionAction}
        variationData={
          generationResult && catalogImage
            ? {
                catalogImageId: catalogImage.id,
                watermarkedUrl: generationResult.watermarkedUrl,
                metadata: generationResult.metadata,
              }
            : undefined
        }
      />
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function CreatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <PawSpinner size="large" />
      </div>
    }>
      <CreatePageContent />
    </Suspense>
  );
}
