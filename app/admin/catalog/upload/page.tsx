'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Sparkles, AlertCircle, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface SubjectIdentification {
  subjectOrder: number;
  isPrimary: boolean;
  suggestedBreed?: { id: string; name: string; confidence: number };
  suggestedCoat?: { id: string; name: string; confidence: number };
  breedId?: string;
  coatId?: string;
  outfitId?: string;
  position: string;
  poseDescription: string;
  gazeDirection?: string;
  expression?: string;
}

interface CompositionAnalysis {
  marketingDescription: string;
  compositionAnalysis: string; // Markdown
  subjects: SubjectIdentification[];
  compositionMetadata: any;
  variationPromptTemplate: string;
  confidence: {
    overall: number;
    breedIdentification: number;
    compositionAnalysis: number;
  };
}

type AnalysisStep = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

export default function CatalogUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // AI Analysis results
  const [analysis, setAnalysis] = useState<CompositionAnalysis | null>(null);

  // Editable fields
  const [marketingDescription, setMarketingDescription] = useState('');
  const [compositionAnalysis, setCompositionAnalysis] = useState('');
  const [isMultiSubject, setIsMultiSubject] = useState(false);
  const [subjects, setSubjects] = useState<SubjectIdentification[]>([]);

  // Metadata
  const [selectedTheme, setSelectedTheme] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPublic, setIsPublic] = useState(true);

  // Metadata options (loaded from API)
  const [themes, setThemes] = useState<any[]>([]);
  const [styles, setStyles] = useState<any[]>([]);
  const [formats, setFormats] = useState<any[]>([]);
  const [breeds, setBreeds] = useState<any[]>([]);
  const [coats, setCoats] = useState<any[]>([]);
  const [outfits, setOutfits] = useState<any[]>([]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Load metadata options on mount
  useState(() => {
    loadMetadataOptions();
  });

  const loadMetadataOptions = async () => {
    try {
      const [themesRes, stylesRes, formatsRes, breedsRes, coatsRes, outfitsRes] = await Promise.all([
        fetch('/api/themes'),
        fetch('/api/styles'),
        fetch('/api/formats'),
        fetch('/api/breeds'),
        fetch('/api/coats'),
        fetch('/api/outfits')
      ]);

      const [themesData, stylesData, formatsData, breedsData, coatsData, outfitsData] = await Promise.all([
        themesRes.json(),
        stylesRes.json(),
        formatsRes.json(),
        breedsRes.json(),
        coatsRes.json(),
        outfitsRes.json()
      ]);

      setThemes(themesData.filter((t: any) => t.is_active));
      setStyles(stylesData.filter((s: any) => s.is_active));
      setFormats(formatsData.filter((f: any) => f.is_active));
      setBreeds(breedsData.filter((b: any) => b.is_active));
      setCoats(coatsData);
      setOutfits(outfitsData.filter((o: any) => o.is_active));
    } catch (error) {
      console.error('Failed to load metadata options:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
      setError('Please upload a JPEG, PNG, or WebP image');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be smaller than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysis(null);
    setAnalysisStep('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyzeImage = async () => {
    if (!selectedFile) return;

    setAnalysisStep('uploading');
    setAnalysisProgress('Uploading image...');
    setError(null);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      setAnalysisStep('analyzing');
      setAnalysisProgress('Analyzing composition with Claude AI...');

      // Call analysis API
      const response = await fetch('/api/admin/analyze-composition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64: base64,
          themeId: selectedTheme || undefined,
          styleId: selectedStyle || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const analysisData: CompositionAnalysis = await response.json();

      setAnalysisStep('complete');
      setAnalysisProgress('Analysis complete!');
      setAnalysis(analysisData);

      // Pre-populate editable fields
      setMarketingDescription(analysisData.marketingDescription);
      setCompositionAnalysis(analysisData.compositionAnalysis);
      setIsMultiSubject(analysisData.subjects.length > 1);
      setSubjects(analysisData.subjects);

    } catch (error: any) {
      console.error('Analysis error:', error);
      setAnalysisStep('error');
      setError(error.message || 'Failed to analyze image');
    }
  };

  const handleSave = async () => {
    if (!selectedFile || !analysis) {
      setError('Please analyze an image first');
      return;
    }

    // Validate required fields
    if (!selectedTheme || !selectedStyle || !selectedFormat) {
      setError('Please select theme, style, and format');
      return;
    }

    if (subjects.length === 0 || !subjects[0].breedId) {
      setError('Please select at least one breed for the subject(s)');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // TODO: Implement save to database
      // This will upload to Cloudinary, save to image_catalog, and create junction table entries

      console.log('Saving catalog entry:', {
        file: selectedFile,
        marketingDescription,
        compositionAnalysis,
        isMultiSubject,
        subjects,
        theme: selectedTheme,
        style: selectedStyle,
        format: selectedFormat,
        tags,
        isFeatured,
        isPublic,
        variationPromptTemplate: analysis.variationPromptTemplate,
        compositionMetadata: analysis.compositionMetadata
      });

      // For now, show success and redirect
      alert('Catalog entry saved successfully! (API endpoint to be implemented)');
      router.push('/admin/catalog');

    } catch (error: any) {
      console.error('Save error:', error);
      setError(error.message || 'Failed to save catalog entry');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const updateSubjectBreed = (index: number, breedId: string) => {
    const newSubjects = [...subjects];
    newSubjects[index].breedId = breedId;
    setSubjects(newSubjects);
  };

  const updateSubjectCoat = (index: number, coatId: string) => {
    const newSubjects = [...subjects];
    newSubjects[index].coatId = coatId;
    setSubjects(newSubjects);
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/catalog">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Catalog
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Upload Curated Reference Image</h1>
            <p className="text-gray-600 mt-1">
              Upload a high-quality reference image for AI-powered composition analysis
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Step 1: Upload Image
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!previewUrl ? (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center space-y-4 py-8"
                type="button"
              >
                <div className="p-4 rounded-full bg-primary/10">
                  <Upload className="w-12 h-12 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">Click to upload reference image</p>
                  <p className="text-sm text-gray-600 mt-2">
                    JPEG, PNG, or WebP • Max 10MB • Minimum 512x512px
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative w-full aspect-square max-w-md mx-auto overflow-hidden rounded-lg border">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 500px"
                />
              </div>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleRemoveImage}
                  disabled={analysisStep === 'analyzing' || isSaving}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove Image
                </Button>
                {analysisStep === 'idle' && (
                  <Button onClick={handleAnalyzeImage}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze with Claude AI
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Progress */}
      {(analysisStep === 'uploading' || analysisStep === 'analyzing') && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <div>
                <p className="font-semibold">{analysisProgress}</p>
                <p className="text-sm text-gray-600">This may take 10-15 seconds...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysisStep === 'complete' && analysis && (
        <>
          {/* Marketing Description */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Step 2: Marketing Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="marketing-description">
                  Website Description
                  <Badge variant="secondary" className="ml-2">AI Generated - Edit as needed</Badge>
                </Label>
                <Textarea
                  id="marketing-description"
                  value={marketingDescription}
                  onChange={(e) => setMarketingDescription(e.target.value)}
                  rows={4}
                  className="mt-2"
                  placeholder="Fun, witty description for pet owners..."
                />
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-600">
                  AI Confidence: {Math.round(analysis.confidence.overall * 100)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* TODO: Add MultiSubjectEditor component here */}
          {/* TODO: Add CompositionAnalysisPanel component here */}

          {/* Metadata Section - Placeholder */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Step 3: Metadata & Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Theme, Style, Format selectors and subject management will be added here.
              </p>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => router.push('/admin/catalog')}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save to Catalog'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
