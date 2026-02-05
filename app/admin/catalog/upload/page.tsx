'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { MultiSubjectEditor } from '@/components/admin/MultiSubjectEditor';
import { CompositionAnalysisPanel } from '@/components/admin/CompositionAnalysisPanel';
import { PreviewVariationPanel } from '@/components/admin/PreviewVariationPanel';

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

/**
 * Compress image if needed to stay under Vercel's 4.5MB limit
 * Uses client-side canvas compression before upload
 */
async function compressImageIfNeeded(file: File): Promise<File> {
  const maxSizeBytes = 4 * 1024 * 1024; // 4MB to stay under Vercel's 4.5MB limit
  if (file.size <= maxSizeBytes) {
    console.log(`File size ${file.size} bytes is within limit, no compression needed`);
    return file;
  }

  console.log(`File size ${file.size} bytes exceeds limit, compressing...`);

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    img.onerror = () => reject(new Error('Failed to load image for compression'));

    img.onload = () => {
      const maxDimension = 1024;
      let { width, height } = img;

      // Resize maintaining aspect ratio
      if (width > height) {
        if (width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          console.log(`Compressed: ${file.size} bytes → ${compressedFile.size} bytes`);
          resolve(compressedFile);
        },
        'image/jpeg',
        0.8 // 80% quality
      );
    };

    img.src = URL.createObjectURL(file);
  });
}

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
  const [coats, setCoats] = useState<any[]>([]); // All breed-coat relationships
  const [outfits, setOutfits] = useState<any[]>([]);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Load metadata options on mount
  useEffect(() => {
    loadMetadataOptions();
  }, []);

  const loadMetadataOptions = async () => {
    try {
      const [themesRes, stylesRes, formatsRes, breedsRes, breedCoatsRes, outfitsRes] = await Promise.all([
        fetch('/api/themes'),
        fetch('/api/styles'),
        fetch('/api/formats'),
        fetch('/api/breeds'),
        fetch('/api/breed-coats'), // Load all breed-coat relationships
        fetch('/api/outfits')
      ]);

      const [themesData, stylesData, formatsData, breedsData, breedCoatsData, outfitsData] = await Promise.all([
        themesRes.json(),
        stylesRes.json(),
        formatsRes.json(),
        breedsRes.json(),
        breedCoatsRes.json(),
        outfitsRes.json()
      ]);

      setThemes(themesData.filter((t: any) => t.is_active));
      setStyles(stylesData.filter((s: any) => s.is_active));
      setFormats(formatsData.filter((f: any) => f.is_active));
      setBreeds(breedsData.filter((b: any) => b.is_active));

      // Transform breed-coat relationships to include coat details
      // Each item has: { id, breed_id, coat_id, breeds: {...}, coats: {...} }
      const transformedCoats = breedCoatsData.map((bc: any) => ({
        id: bc.coats.id, // Coat ID
        breed_id: bc.breed_id, // Add breed_id for filtering
        name: bc.coats.name,
        display_name: bc.coats.display_name || bc.coats.name,
        slug: bc.coats.slug,
        hex_color: bc.coats.hex_color,
        pattern_type: bc.coats.pattern_type,
        rarity: bc.coats.rarity,
        is_common: bc.is_common,
        is_standard: bc.is_standard
      }));

      console.log('📦 Loaded breed-coat relationships:', transformedCoats.length);
      setCoats(transformedCoats);
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

    // Create preview and detect aspect ratio
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreviewUrl(dataUrl);

      // Detect aspect ratio and auto-select format
      detectAndSetFormat(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const detectAndSetFormat = (imageDataUrl: string) => {
    const img = new window.Image();
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      const aspectRatio = width / height;

      console.log(`📐 Image dimensions: ${width}x${height}, aspect ratio: ${aspectRatio.toFixed(2)}`);

      // Find matching format based on aspect ratio
      // Common aspect ratios with tolerance
      let matchedFormat = null;
      const tolerance = 0.05; // 5% tolerance

      if (Math.abs(aspectRatio - 1.0) < tolerance) {
        // 1:1 (Square)
        matchedFormat = formats.find(f => f.aspect_ratio === '1:1');
        console.log('🎯 Detected format: Square (1:1)');
      } else if (Math.abs(aspectRatio - 0.8) < tolerance) {
        // 4:5 (Portrait)
        matchedFormat = formats.find(f => f.aspect_ratio === '4:5');
        console.log('🎯 Detected format: Portrait (4:5)');
      } else if (Math.abs(aspectRatio - 1.25) < tolerance) {
        // 5:4 (Landscape)
        matchedFormat = formats.find(f => f.aspect_ratio === '5:4');
        console.log('🎯 Detected format: Landscape (5:4)');
      } else if (Math.abs(aspectRatio - (16/9)) < tolerance) {
        // 16:9 (Widescreen)
        matchedFormat = formats.find(f => f.aspect_ratio === '16:9');
        console.log('🎯 Detected format: Widescreen (16:9)');
      } else if (Math.abs(aspectRatio - (9/16)) < tolerance) {
        // 9:16 (Tall portrait)
        matchedFormat = formats.find(f => f.aspect_ratio === '9:16');
        console.log('🎯 Detected format: Tall Portrait (9:16)');
      } else if (Math.abs(aspectRatio - (3/4)) < tolerance) {
        // 3:4 (Standard portrait)
        matchedFormat = formats.find(f => f.aspect_ratio === '3:4');
        console.log('🎯 Detected format: Standard Portrait (3:4)');
      } else if (Math.abs(aspectRatio - (4/3)) < tolerance) {
        // 4:3 (Standard landscape)
        matchedFormat = formats.find(f => f.aspect_ratio === '4:3');
        console.log('🎯 Detected format: Standard Landscape (4:3)');
      } else {
        console.warn(`⚠️ No matching format for aspect ratio ${aspectRatio.toFixed(2)}`);
      }

      if (matchedFormat) {
        setSelectedFormat(matchedFormat.id);
        console.log(`✅ Auto-selected format: ${matchedFormat.name} (${matchedFormat.aspect_ratio})`);
      } else {
        console.log('⚠️ No format auto-selected, please select manually');
      }
    };
    img.src = imageDataUrl;
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
    setAnalysisProgress('Preparing image...');
    setError(null);

    try {
      // Compress image if needed (CRITICAL: Vercel 4.5MB limit)
      setAnalysisProgress('Compressing image...');
      const compressedFile = await compressImageIfNeeded(selectedFile);
      console.log(`Image prepared: ${selectedFile.size} → ${compressedFile.size} bytes`);

      setAnalysisStep('analyzing');
      setAnalysisProgress('Analyzing composition with Claude AI...');

      // Use FormData (following established pattern from /admin/generate)
      const formData = new FormData();
      formData.append('image', compressedFile); // Use compressed file
      if (selectedTheme) formData.append('themeId', selectedTheme);
      if (selectedStyle) formData.append('styleId', selectedStyle);

      // Call analysis API
      const response = await fetch('/api/admin/analyze-composition', {
        method: 'POST',
        body: formData // No Content-Type header needed with FormData
      });

      if (!response.ok) {
        console.error('API Response not ok:', response.status, response.statusText);
        try {
          const errorData = await response.json();
          console.error('Error data from API:', errorData);
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        } catch (jsonError) {
          console.error('Could not parse error response as JSON:', jsonError);
          throw new Error(`HTTP ${response.status}: ${response.statusText} - Could not parse error details`);
        }
      }

      const analysisData: CompositionAnalysis = await response.json();

      console.log('📊 Analysis received:', {
        subjectCount: analysisData.subjects.length,
        subjects: analysisData.subjects.map(s => ({
          order: s.subjectOrder,
          breedId: s.breedId,
          coatId: s.coatId,
          suggestedBreed: s.suggestedBreed?.name,
          suggestedCoat: s.suggestedCoat?.name
        }))
      });

      setAnalysisStep('complete');
      setAnalysisProgress('Analysis complete!');
      setAnalysis(analysisData);

      // Pre-populate editable fields
      setMarketingDescription(analysisData.marketingDescription);
      setCompositionAnalysis(analysisData.compositionAnalysis);
      setIsMultiSubject(analysisData.subjects.length > 1);

      // Set subjects with AI-matched breeds/coats already populated
      // Auto-accept high-confidence matches (>70%)
      const subjectsWithAutoAccept = analysisData.subjects.map(subject => {
        const updatedSubject = { ...subject };

        // Auto-accept breed if high confidence and not already set
        if (!updatedSubject.breedId && updatedSubject.suggestedBreed && updatedSubject.aiConfidence && updatedSubject.aiConfidence >= 0.7) {
          updatedSubject.breedId = updatedSubject.suggestedBreed.id;
          console.log(`✅ Auto-accepted breed: ${updatedSubject.suggestedBreed.name} (${Math.round(updatedSubject.aiConfidence * 100)}% confidence)`);
        }

        // Auto-accept coat if breed is set
        if (updatedSubject.breedId && !updatedSubject.coatId && updatedSubject.suggestedCoat) {
          updatedSubject.coatId = updatedSubject.suggestedCoat.id;
          console.log(`✅ Auto-accepted coat: ${updatedSubject.suggestedCoat.name}`);
        }

        return updatedSubject;
      });

      setSubjects(subjectsWithAutoAccept);

      // Auto-select format based on composition framing
      if (analysisData.compositionMetadata?.composition?.framing && formats.length > 0) {
        const framing = analysisData.compositionMetadata.composition.framing.toLowerCase();

        // Try to match framing to format
        const matchedFormat = formats.find((f: any) => {
          const formatName = (f.name || f.display_name || '').toLowerCase();

          // Map common framing types to formats
          if (framing.includes('portrait') && formatName.includes('portrait')) return true;
          if (framing.includes('square') && formatName.includes('square')) return true;
          if (framing.includes('landscape') && formatName.includes('landscape')) return true;
          if (framing.includes('closeup') && formatName.includes('square')) return true; // Closeups often work as square
          if (framing.includes('full') && formatName.includes('portrait')) return true; // Full body often portrait

          return false;
        });

        if (matchedFormat) {
          console.log(`📐 Auto-selected format: ${matchedFormat.name} (based on framing: ${framing})`);
          setSelectedFormat(matchedFormat.id);
        }
      }

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
      console.log('📤 Saving catalog entry to API...');

      // Call save API endpoint
      const response = await fetch('/api/admin/catalog/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: previewUrl, // This already contains the data URL with base64
          filename: selectedFile.name,
          marketingDescription,
          compositionAnalysis,
          isMultiSubject,
          subjects,
          themeId: selectedTheme,
          styleId: selectedStyle,
          formatId: selectedFormat,
          tags,
          isFeatured,
          isPublic,
          variationPromptTemplate: analysis.variationPromptTemplate,
          compositionMetadata: analysis.compositionMetadata
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to save catalog entry');
      }

      const result = await response.json();
      console.log('✅ Catalog entry saved successfully:', result);

      // Show success and redirect
      alert(`Catalog entry saved successfully!\n\nImage ID: ${result.imageId}\nSubjects: ${result.metadata.subjectCount}\nBreed: ${result.metadata.primaryBreed}`);
      router.push('/admin/catalog');

    } catch (error: any) {
      console.error('❌ Save error:', error);
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
            <h1 className="text-3xl font-bold">Upload Reference Image</h1>
            <p className="text-gray-600 mt-1">
              Upload a high-quality reference image 
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
                    Analyse Image Composition
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
                  <Badge variant="secondary" className="ml-2">Edit as needed</Badge>
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

          {/* Multi-Subject Editor */}
          <MultiSubjectEditor
            subjects={subjects}
            onChange={setSubjects}
            breeds={breeds}
            coats={coats}
            outfits={outfits}
            isMultiSubject={isMultiSubject}
            onMultiSubjectChange={setIsMultiSubject}
          />

          {/* Composition Analysis Panel */}
          <CompositionAnalysisPanel
            compositionAnalysis={compositionAnalysis}
            variationPromptTemplate={analysis.variationPromptTemplate}
            compositionMetadata={analysis.compositionMetadata}
            confidence={analysis.confidence.compositionAnalysis}
            onCompositionChange={setCompositionAnalysis}
            onPromptTemplateChange={(value) => {
              setAnalysis({ ...analysis, variationPromptTemplate: value });
            }}
            editable={true}
          />

          {/* Test Variation Preview Panel */}
          <PreviewVariationPanel
            referenceImagePreview={previewUrl}
            compositionPromptTemplate={analysis.variationPromptTemplate}
            subjects={subjects}
            metadata={{
              breedName: breeds.find(b => b.id === subjects[0]?.breedId)?.name,
              themeName: themes.find(t => t.id === selectedTheme)?.name,
              styleName: styles.find(s => s.id === selectedStyle)?.name,
              formatName: formats.find(f => f.id === selectedFormat)?.name
            }}
          />

          {/* Metadata Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Step 3: Metadata & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme, Style, Format Selection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme *</Label>
                  <select
                    id="theme"
                    value={selectedTheme}
                    onChange={(e) => setSelectedTheme(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select theme...</option>
                    {themes.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.display_name || theme.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="style">Style *</Label>
                  <select
                    id="style"
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select style...</option>
                    {styles.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.display_name || style.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="format">
                    Format *
                    {selectedFormat && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Auto-detected
                      </Badge>
                    )}
                  </Label>
                  <select
                    id="format"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="">Select format...</option>
                    {formats.map((format) => (
                      <option key={format.id} value={format.id}>
                        {format.display_name || format.name} ({format.aspect_ratio})
                      </option>
                    ))}
                  </select>
                  {selectedFormat && (
                    <p className="text-xs text-gray-600">
                      Format auto-detected based on image aspect ratio. Products will match this format.
                    </p>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Enter tag and press Enter..."
                  />
                  <Button type="button" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="cursor-pointer">
                        {tag}
                        <X
                          className="w-3 h-3 ml-1"
                          onClick={() => handleRemoveTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Featured & Public Toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Featured Image</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Public (visible to customers)</span>
                </label>
              </div>
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
