'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle, AlertCircle, RefreshCw, Download } from 'lucide-react';
import Image from 'next/image';

interface SubjectData {
  subjectOrder: number;
  isPrimary: boolean;
  breedId?: string;
  suggestedBreed?: { name: string };
}

interface PreviewVariationPanelProps {
  referenceImagePreview: string; // Base64 data URL from admin upload form
  compositionPromptTemplate?: string; // From Claude analysis
  subjects: SubjectData[]; // Array of subjects from MultiSubjectEditor
  metadata: {
    breedName?: string;
    themeName?: string;
    styleName?: string;
    formatName?: string;
  };
}

interface GenerationResult {
  watermarkedUrl: string;
  fullSizeUrl?: string;
  metadata: {
    generationTimeMs: number;
    geminiModel: string;
    promptUsed?: string;
    cloudinaryPublicId?: string;
  };
}

export function PreviewVariationPanel({
  referenceImagePreview,
  compositionPromptTemplate,
  subjects,
  metadata
}: PreviewVariationPanelProps) {
  const subjectCount = subjects.length;
  const isMultiSubject = subjectCount > 1;

  // Track uploaded pet images for each subject
  const [petImages, setPetImages] = useState<Array<{ file: File | null; base64: string | null }>>(() =>
    Array(subjectCount).fill(null).map(() => ({ file: null, base64: null }))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [previewResult, setPreviewResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCustomPetUpload = async (e: React.ChangeEvent<HTMLInputElement>, subjectIndex: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
      setError('Please upload a JPEG, PNG, or WEBP image');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Maximum size is 10MB.');
      return;
    }

    setError(null);

    // Compress image if needed before converting to base64
    const compressedFile = await compressImageIfNeeded(file);

    // Convert to base64 for preview and API call
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setPetImages(prev => {
        const updated = [...prev];
        updated[subjectIndex] = { file: compressedFile, base64 };
        return updated;
      });
    };
    reader.readAsDataURL(compressedFile);
  };

  // Compress image to stay under Vercel's 4.5MB request body limit
  async function compressImageIfNeeded(file: File): Promise<File> {
    const maxSizeBytes = 3 * 1024 * 1024; // 3MB (conservative for base64 encoding overhead)

    if (file.size <= maxSizeBytes) {
      return file;
    }

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();

      img.onload = () => {
        // Calculate new dimensions (max 1024px)
        const maxDimension = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              console.log(`📦 Compressed: ${file.size} → ${compressedFile.size} bytes`);
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Compress base64 data URL image to stay under Vercel limits
  async function compressBase64ImageIfNeeded(base64DataUrl: string): Promise<string> {
    // Estimate size (base64 is ~1.37x original)
    const estimatedSizeBytes = base64DataUrl.length * 0.75;
    const maxSizeBytes = 2 * 1024 * 1024; // 2MB target for reference image

    console.log(`📏 Reference image estimated size: ${(estimatedSizeBytes / 1024 / 1024).toFixed(2)}MB`);

    if (estimatedSizeBytes <= maxSizeBytes) {
      console.log('✓ Reference image within limits, no compression needed');
      return base64DataUrl;
    }

    console.log('⚙️ Compressing reference image...');

    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new window.Image();

      img.onload = () => {
        // Calculate new dimensions (max 1024px)
        const maxDimension = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert back to base64 data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
        const newSize = compressedDataUrl.length * 0.75;
        console.log(`📦 Reference compressed: ${(estimatedSizeBytes / 1024 / 1024).toFixed(2)}MB → ${(newSize / 1024 / 1024).toFixed(2)}MB`);
        resolve(compressedDataUrl);
      };

      img.src = base64DataUrl;
    });
  }

  const handleGeneratePreview = async () => {
    // Validate all pets are uploaded
    const allPetsUploaded = petImages.every(p => p.base64 !== null);
    if (!allPetsUploaded) {
      setError(`Please upload ${isMultiSubject ? 'all' : 'a'} pet photo${isMultiSubject ? 's' : ''} (${petImages.filter(p => p.base64).length}/${subjectCount})`);
      return;
    }

    console.log(`🎨 [PREVIEW PANEL] Starting ${isMultiSubject ? 'pair' : 'single'} preview generation...`);
    setIsGenerating(true);
    setError(null);
    setGenerationProgress(0);

    try {
      // Simulate progress (Gemini takes 10-20s typically)
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 4, 95));
      }, 750);

      // Compress reference image if needed (it comes from parent as base64)
      console.log('📦 [PREVIEW PANEL] Compressing images for API call...');
      const compressedRefImage = await compressBase64ImageIfNeeded(referenceImagePreview);

      // Determine which endpoint to use and prepare request body
      const endpoint = isMultiSubject ? '/api/admin/preview-pair-variation' : '/api/admin/preview-variation';
      const requestBody: any = {
        referenceImageBase64: compressedRefImage,
        compositionPromptTemplate,
        metadata
      };

      if (isMultiSubject) {
        // Multi-subject: send all pet images
        requestBody.pet1ImageBase64 = petImages[0].base64;
        requestBody.pet2ImageBase64 = petImages[1].base64;
        console.log('📤 [PREVIEW PANEL] Sending PAIR request...');
      } else {
        // Single subject: send one pet image
        requestBody.petImageBase64 = petImages[0].base64;
        console.log('📤 [PREVIEW PANEL] Sending SINGLE request...');
      }

      console.log('📊 [PREVIEW PANEL] Request details:', {
        endpoint,
        subjectCount,
        hasReference: !!compressedRefImage,
        refSizeMB: (compressedRefImage.length * 0.75 / 1024 / 1024).toFixed(2)
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      console.log('📥 [PREVIEW PANEL] Response status:', response.status);

      // Handle non-JSON responses (like 413 errors)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ [PREVIEW PANEL] Non-JSON response:', response.status, contentType);
        const text = await response.text();
        console.error('Response text:', text.substring(0, 200));
        throw new Error(`Server error (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ [PREVIEW PANEL] Generation failed:', data);
        throw new Error(data.message || data.error || 'Generation failed');
      }

      console.log('✅ [PREVIEW PANEL] Generation successful:', {
        hasWatermarkedUrl: !!data.watermarkedUrl,
        generationTime: data.metadata?.generationTimeMs
      });

      setPreviewResult(data);

      // Scroll to result
      setTimeout(() => {
        const resultElement = document.getElementById('preview-result');
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err: any) {
      console.error('❌ [PREVIEW PANEL] Generation error:', err);
      setError(err.message || 'Failed to generate preview variation');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setPreviewResult(null);
    setError(null);
    setGenerationProgress(0);
    // Don't clear uploaded pet images - allow retry with same pets
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Test Variation Preview (Optional)</CardTitle>
        <p className="text-sm text-gray-600">
          Test how this reference image will look with {isMultiSubject ? `${subjectCount} customer pet photos` : 'a customer pet photo'} before saving to catalog
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pet Photo Upload - One slot per subject */}
        {!previewResult && (
          <div className="space-y-4">
            {subjects.map((subject, index) => (
              <div key={subject.subjectOrder}>
                <label className="text-sm font-medium block mb-2">
                  {isMultiSubject ? `Subject ${subject.subjectOrder}` : 'Upload Test Pet Photo'}
                  {subject.suggestedBreed && (
                    <span className="text-gray-500 ml-2">({subject.suggestedBreed.name})</span>
                  )}
                  {subject.isPrimary && isMultiSubject && (
                    <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Primary</span>
                  )}
                </label>
                <div className="flex items-center gap-4">
                  <label className="relative rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary transition-colors p-8 flex flex-col items-center justify-center flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={(e) => handleCustomPetUpload(e, index)}
                      disabled={isGenerating}
                      className="hidden"
                    />
                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 text-center">
                      {petImages[index]?.file ? petImages[index].file.name : 'Click to upload pet photo'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">JPEG, PNG, or WEBP (max 10MB)</p>
                  </label>

                  {/* Pet Photo Preview */}
                  {petImages[index]?.base64 && (
                    <div className="w-32 h-32 relative rounded-lg overflow-hidden border-2 border-gray-200">
                      <Image
                        src={petImages[index].base64}
                        alt={`Uploaded pet ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Generate Button */}
            <Button
              onClick={handleGeneratePreview}
              disabled={!petImages.every(p => p.base64) || isGenerating}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating {isMultiSubject ? 'Pair ' : ''}Preview... {generationProgress}%
                </>
              ) : (
                `🎨 Generate Test ${isMultiSubject ? 'Pair ' : ''}Variation`
              )}
            </Button>

            {/* Progress Bar */}
            {isGenerating && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 text-center">
                  This typically takes 10-20 seconds...
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Preview Results */}
        {previewResult && (
          <div id="preview-result" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Reference Image */}
              <div>
                <p className="text-sm font-medium mb-2">Reference Image</p>
                <div className="border rounded-lg overflow-hidden aspect-square relative">
                  <Image
                    src={referenceImagePreview}
                    alt="Reference"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Generated Variation */}
              <div>
                <p className="text-sm font-medium mb-2">Generated Variation</p>
                <div className="border rounded-lg overflow-hidden aspect-square relative">
                  <Image
                    src={previewResult.watermarkedUrl}
                    alt="Generated"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Quality Indicators */}
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">✓ Subject replaced successfully</p>
                  <p className="text-sm">
                    ⏱ Generation time: {(previewResult.metadata.generationTimeMs / 1000).toFixed(1)}s
                  </p>
                  <p className="text-xs text-gray-600">
                    Model: {previewResult.metadata.geminiModel}
                  </p>
                  {previewResult.metadata.cloudinaryPublicId && (
                    <p className="text-xs text-gray-500">
                      ID: {previewResult.metadata.cloudinaryPublicId}
                    </p>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Another Pet
              </Button>
              {previewResult.fullSizeUrl && (
                <Button variant="outline" asChild className="flex-1">
                  <a href={previewResult.fullSizeUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Download Full Size
                  </a>
                </Button>
              )}
            </div>

            {/* Debug Info (collapsible) */}
            {previewResult.metadata.promptUsed && process.env.NODE_ENV === 'development' && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                  Show Prompt Used (Dev Only)
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 rounded border text-xs overflow-x-auto">
                  {previewResult.metadata.promptUsed}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Help Text */}
        {!previewResult && (
          <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="font-medium mb-1">💡 Purpose:</p>
            <p>
              This preview simulates the customer-facing &quot;/create{isMultiSubject ? '-pair' : ''}&quot; workflow. Upload {isMultiSubject ? `${subjectCount} test pet photos (one per subject)` : 'a test pet photo'} to see how
              well the reference image works with subject replacement before adding it to the catalog.
            </p>
            {isMultiSubject && (
              <p className="mt-2 text-orange-700">
                ⚠️ For multi-subject images, upload one pet photo per subject in the order they appear in the reference image.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
