'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Wand2, RefreshCw, Download, Upload, Image, X, Star, Eye, Sparkles, Brain } from 'lucide-react';
import { generateImageMetadata } from '@/lib/metadata-generator';
import { useImageDescription } from '@/hooks/useImageDescription';
import { uploadImagesDirectBatch } from '@/lib/cloudinary-client';
import type { Breed, Theme, Style, Format, Coat, Outfit, BreedCoatDetail } from '@/lib/types';

export default function GeneratePromptsPage() {
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [availableCoats, setAvailableCoats] = useState<BreedCoatDetail[]>([]);
  
  const [selectedBreed, setSelectedBreed] = useState<string>('');
  const [selectedTheme, setSelectedTheme] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedOutfit, setSelectedOutfit] = useState<string>('');
  const [selectedCoat, setSelectedCoat] = useState<string>('');
  
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Image upload states
  const [showUploadSection, setShowUploadSection] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageDescription, setImageDescription] = useState('');
  const [imageTags, setImageTags] = useState('');
  const [imageRating, setImageRating] = useState(0);
  const [isImageFeatured, setIsImageFeatured] = useState(false);
  const [isImagePublic, setIsImagePublic] = useState(true);
  const [uploadResults, setUploadResults] = useState<any[]>([]);

  // AI Description Generation
  const { 
    description: aiDescription, 
    isGenerating: isGeneratingDescription, 
    error: descriptionError,
    generateFromFile,
    setDescription 
  } = useImageDescription();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBreed) {
      loadAvailableCoats(selectedBreed);
    } else {
      setAvailableCoats([]);
      setSelectedCoat('');
    }
  }, [selectedBreed]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading data from APIs...');
      
      const [breedsRes, themesRes, stylesRes, formatsRes, outfitsRes] = await Promise.all([
        fetch('/api/breeds').catch((error) => {
          console.error('Failed to fetch breeds:', error);
          return { ok: false, json: () => [] };
        }),
        fetch('/api/themes').catch((error) => {
          console.error('Failed to fetch themes:', error);
          return { ok: false, json: () => [] };
        }),
        fetch('/api/styles').catch((error) => {
          console.error('Failed to fetch styles:', error);
          return { ok: false, json: () => [] };
        }),
        fetch('/api/formats').catch((error) => {
          console.error('Failed to fetch formats:', error);
          return { ok: false, json: () => [] };
        }),
        fetch('/api/outfits').catch((error) => {
          console.error('Failed to fetch outfits:', error);
          return { ok: false, json: () => [] };
        }),
      ]);

      let breedsData = [];
      let themesData = [];
      let stylesData = [];
      let formatsData = [];
      let outfitsData = [];

      try {
        breedsData = breedsRes.ok ? await breedsRes.json() : [];
      } catch (e) {
        breedsData = [];
      }

      try {
        themesData = themesRes.ok ? await themesRes.json() : [];
      } catch (e) {
        themesData = [];
      }

      try {
        stylesData = stylesRes.ok ? await stylesRes.json() : [];
      } catch (e) {
        stylesData = [];
      }

      try {
        formatsData = formatsRes.ok ? await formatsRes.json() : [];
      } catch (e) {
        formatsData = [];
      }

      try {
        outfitsData = outfitsRes.ok ? await outfitsRes.json() : [];
      } catch (e) {
        outfitsData = [];
      }

      setBreeds(breedsData?.filter((b: any) => b.is_active) || []);
      setThemes(themesData?.filter((t: any) => t.is_active) || []);
      setStyles(stylesData?.filter((s: any) => s.is_active) || []);
      setFormats(formatsData?.filter((f: any) => f.is_active) || []);
      setOutfits(outfitsData?.filter((o: any) => o.is_active) || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCoats = async (breedId: string) => {
    try {
      const response = await fetch(`/api/breed-coats?breed_id=${breedId}`);
      if (!response.ok) {
        console.warn(`Failed to load coats for breed ${breedId}:`, response.status);
        setAvailableCoats([]);
        return;
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        console.warn('Invalid response format for breed coats:', data);
        setAvailableCoats([]);
        return;
      }
      
      const transformedData = data.map((item: any) => ({
        id: item.coats?.id || item.id, // Use the actual coat ID, not the breed_coats relationship ID
        breed_coat_id: item.id, // Keep the relationship ID for reference
        breed_name: item.breeds?.name || 'Unknown',
        coat_name: item.coats?.name || 'Unknown',
        coat_slug: item.coats?.slug || '',
        hex_color: item.coats?.hex_color || '#000000',
        pattern_type: item.coats?.pattern_type || 'solid',
        rarity: item.coats?.rarity || 'common',
        is_common: item.is_common || false,
        popularity_rank: item.popularity_rank || 0
      }));
      
      setAvailableCoats(transformedData);
      
      console.log('🎨 Loaded coat data for breed:', {
        breedId,
        coatCount: transformedData.length,
        sampleCoat: transformedData[0] ? {
          name: transformedData[0].coat_name,
          coat_id: transformedData[0].id,
          breed_coat_id: transformedData[0].breed_coat_id
        } : null
      });
    } catch (error) {
      console.error('Error loading coats:', error);
      setAvailableCoats([]);
    }
  };

  const generatePrompt = () => {
    setGenerating(true);
    
    // Simulate generation delay
    setTimeout(() => {
      const breed = breeds.find(b => b.id === selectedBreed);
      const theme = themes.find(t => t.id === selectedTheme);
      const style = styles.find(s => s.id === selectedStyle);
      const format = formats.find(f => f.id === selectedFormat);
      const outfit = outfits.find(o => o.id === selectedOutfit);
      const coat = availableCoats.find(c => c.id === selectedCoat);

      if (!breed) {
        setGeneratedPrompt('Please select a breed to generate a prompt.');
        setGenerating(false);
        return;
      }

      // New format: {breed}{coat}{outfit}{theme}{style}{format}{breed traits}{midjourney params}
      let promptParts = [];

      // 1. Breed
      promptParts.push(`A ${breed.name.toLowerCase()}`);
      
      // 2. Coat (if selected)
      if (coat) {
        promptParts.push(`with ${coat.coat_name.toLowerCase()} fur`);
      }
      
      // 3. Outfit (if selected and not "No Outfit")
      if (outfit && outfit.clothing_description) {
        promptParts.push(outfit.clothing_description);
      }
      
      // 4. Theme (if selected)
      if (theme) {
        let themeText = theme.base_prompt_template
          .replace('[BREED]', breed.name.toLowerCase())
          .replace('{breed_description}', breed.name.toLowerCase());
        
        // Replace [COAT] placeholder with selected coat
        if (coat) {
          themeText = themeText.replace('[COAT]', coat.coat_name.toLowerCase());
        } else {
          // Remove [COAT] placeholder if no coat selected
          themeText = themeText.replace(/\[COAT\]\s*/g, '');
        }
        
        // Replace [OUTFIT] placeholder with selected outfit
        if (outfit && outfit.clothing_description) {
          themeText = themeText.replace('[OUTFIT]', outfit.clothing_description);
        } else {
          // Remove [OUTFIT] placeholder if no outfit selected
          themeText = themeText.replace(/\[OUTFIT\]\s*/g, '');
        }
        
        promptParts.push(themeText);
      }
      
      // 5. Style (if selected)
      if (style) {
        promptParts.push(style.prompt_suffix);
      }
      
      // 6. Format adjustments (if selected)
      if (format && format.prompt_adjustments) {
        promptParts.push(format.prompt_adjustments);
      }

      // Join the main prompt parts
      let prompt = promptParts.join(', ');

      // 7. Breed traits
      if (breed.personality_traits && breed.personality_traits.length > 0) {
        const traits = breed.personality_traits.slice(0, 2).join(' and ');
        prompt += `. The ${breed.name.toLowerCase()} should appear ${traits.toLowerCase()}`;
      }

      // Add professional photography qualifiers
      prompt += '. Professional pet photography, high quality, detailed, studio lighting';

      // 8. Midjourney parameters (if format or style has them)
      const midjourneyParams = [];
      
      if (format?.midjourney_parameters) {
        midjourneyParams.push(format.midjourney_parameters);
      }
      
      if (style?.midjourney_sref) {
        midjourneyParams.push(`--sref ${style.midjourney_sref}`);
      }
      
      // Add default aspect ratio if not specified
      if (!midjourneyParams.some(param => param.includes('--ar'))) {
        midjourneyParams.push('--ar 2:3');
      }
      
      if (midjourneyParams.length > 0) {
        prompt += ` ${midjourneyParams.join(' ')}`;
      }

      setGeneratedPrompt(prompt);
      setGenerating(false);
      setShowUploadSection(true); // Show upload section after generating prompt
    }, 1000);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
  };

  const resetForm = () => {
    setSelectedBreed('');
    setSelectedTheme('');
    setSelectedStyle('');
    setSelectedFormat('');
    setSelectedCoat('');
    setSelectedOutfit('');
    setGeneratedPrompt('');
    setShowUploadSection(false);
    setUploadedImages([]);
    setImageDescription('');
    setImageTags('');
    setImageRating(0);
    setIsImageFeatured(false);
    setUploadResults([]);
    setDescription(''); // Clear AI description
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });
    
    setUploadedImages(prev => [...prev, ...validFiles]);
    
    // Auto-generate metadata when first image is uploaded
    if (validFiles.length > 0 && uploadedImages.length === 0) {
      generateMetadata();
    }
  };

  const generateMetadata = () => {
    if (!generatedPrompt) return;
    
    // Get selected entities
    const breed = breeds.find(b => b.id === selectedBreed);
    const theme = themes.find(t => t.id === selectedTheme);
    const style = styles.find(s => s.id === selectedStyle);
    const format = formats.find(f => f.id === selectedFormat);
    const coat = availableCoats.find(c => c.id === selectedCoat);
    
    const metadata = generateImageMetadata({
      promptText: generatedPrompt,
      breed,
      theme,
      style,
      format,
      coat: coat ? {
        name: coat.coat_name,
        pattern_type: coat.pattern_type,
        rarity: coat.rarity
      } : undefined
    });
    
    // Auto-populate if fields are empty
    if (!imageDescription) {
      setImageDescription(metadata.description);
    }
    
    if (!imageTags) {
      setImageTags(metadata.tags.join(', '));
    }
  };

  const generateAIDescription = async () => {
    console.log('generateAIDescription called', { 
      hasImages: uploadedImages.length > 0,
      selectedBreed,
      isGenerating: isGeneratingDescription 
    });
    
    if (!uploadedImages.length) {
      console.log('No uploaded images, returning');
      return;
    }
    
    const breed = breeds.find(b => b.id === selectedBreed);
    const firstImage = uploadedImages[0];
    
    console.log('Starting AI description generation:', {
      imageName: firstImage.name,
      imageType: firstImage.type,
      breedName: breed?.name,
      breedSlug: breed?.slug
    });
    
    try {
      await generateFromFile(
        firstImage,
        breed?.name,
        breed?.slug
      );
      console.log('AI description generation completed');
    } catch (error) {
      console.error('Error generating AI description:', error);
    }
  };

  // Update description when AI description is generated
  useEffect(() => {
    console.log('AI Description effect:', { aiDescription: !!aiDescription, imageDescription: !!imageDescription });
    if (aiDescription) {
      console.log('Setting AI description:', aiDescription.substring(0, 100) + '...');
      setImageDescription(aiDescription);
      
      // Generate structured tags: [animal] [breed] [coat] [outfit] [setting] [style]
      const suggestedTags = [];
      
      // Animal type (dog/cat)
      const selectedBreedData = breeds.find(b => b.id === selectedBreed);
      if (selectedBreedData) {
        suggestedTags.push(selectedBreedData.animal_type || 'dog');
        suggestedTags.push(selectedBreedData.name.toLowerCase());
      }
      
      // Coat color
      const selectedCoatData = availableCoats.find(c => c.id === selectedCoat);
      if (selectedCoatData) {
        suggestedTags.push(selectedCoatData.coat_name.toLowerCase());
      }
      
      // Outfit
      const selectedOutfitData = outfits.find(o => o.id === selectedOutfit);
      if (selectedOutfitData && selectedOutfitData.name !== 'No Outfit') {
        suggestedTags.push(selectedOutfitData.name.toLowerCase());
      }
      
      // Setting (default to portrait/studio)
      suggestedTags.push('portrait');
      
      // Style (from selected style or default)
      const selectedStyleData = styles.find(s => s.id === selectedStyle);
      if (selectedStyleData) {
        suggestedTags.push(selectedStyleData.name.toLowerCase());
      } else {
        suggestedTags.push('professional');
      }
      
      // Only update tags if they're currently empty
      if (!imageTags && suggestedTags.length > 0) {
        setImageTags(suggestedTags.join(', '));
      }
    }
  }, [aiDescription, breeds, selectedBreed, availableCoats, selectedCoat, outfits, selectedOutfit, styles, selectedStyle, imageTags]);

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    if (!uploadedImages.length || !generatedPrompt) return;
    
    // Validate required fields
    if (!selectedBreed) {
      alert('Please select a breed before uploading images');
      return;
    }
    
    setUploading(true);
    const results = [];
    
    try {
      console.log('🚀 Starting direct Cloudinary upload for print quality preservation');
      
      // Get breed/theme/style names for Cloudinary metadata
      const breed = breeds.find(b => b.id === selectedBreed);
      const theme = themes.find(t => t.id === selectedTheme);
      const style = styles.find(s => s.id === selectedStyle);
      
      // Upload directly to Cloudinary (bypasses Vercel size limits)
      const cloudinaryResults = await uploadImagesDirectBatch(
        uploadedImages,
        {
          breed: breed?.name,
          theme: theme?.name,
          style: style?.name,
          tags: ['admin-upload', 'print-quality', breed?.animal_type || 'dog'].filter(Boolean)
        },
        (uploaded, total, current) => {
          console.log(`📤 Upload progress: ${uploaded}/${total} - ${current}`);
          // You could update a progress indicator here
        }
      );
      
      console.log('✅ All images uploaded to Cloudinary successfully');
      
      // Now save metadata to our database for each uploaded image
      for (let i = 0; i < cloudinaryResults.length; i++) {
        const cloudinaryResult = cloudinaryResults[i];
        const originalFile = uploadedImages[i];
        
        try {
          console.log('📝 Selected values for database save:', {
            selectedBreed,
            selectedTheme,
            selectedStyle,
            selectedFormat,
            selectedCoat,
            breedName: breeds.find(b => b.id === selectedBreed)?.name,
            themeName: themes.find(t => t.id === selectedTheme)?.name,
            styleName: styles.find(s => s.id === selectedStyle)?.name,
            formatName: formats.find(f => f.id === selectedFormat)?.name,
            coatName: availableCoats.find(c => c.id === selectedCoat)?.coat_name
          });
          
          // Create database record with Cloudinary data
          const response = await fetch('/api/images/cloudinary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cloudinary_public_id: cloudinaryResult.public_id,
              cloudinary_secure_url: cloudinaryResult.secure_url,
              cloudinary_signature: cloudinaryResult.signature,
              original_filename: originalFile.name,
              file_size: cloudinaryResult.bytes,
              mime_type: originalFile.type,
              width: cloudinaryResult.width,
              height: cloudinaryResult.height,
              prompt_text: generatedPrompt,
              description: imageDescription,
              tags: imageTags.split(',').map(t => t.trim()).filter(Boolean),
              breed_id: selectedBreed || undefined,
              theme_id: selectedTheme || undefined,
              style_id: selectedStyle || undefined,
              format_id: selectedFormat || undefined,
              coat_id: selectedCoat || undefined,
              rating: imageRating > 0 ? imageRating : undefined,
              is_featured: isImageFeatured,
              is_public: isImagePublic
            })
          });
          
          if (response.ok) {
            const dbResult = await response.json();
            results.push({ 
              success: true, 
              filename: originalFile.name, 
              data: dbResult,
              cloudinary_public_id: cloudinaryResult.public_id,
              print_dimensions: `${cloudinaryResult.width}×${cloudinaryResult.height}px`
            });
            console.log(`✅ Database record created for: ${cloudinaryResult.public_id}`);
          } else {
            const error = await response.json();
            results.push({ 
              success: false, 
              filename: originalFile.name, 
              error: `Database save failed: ${error.error}`,
              cloudinary_public_id: cloudinaryResult.public_id // Still uploaded to Cloudinary
            });
          }
        } catch (dbError) {
          console.error('Database save error:', dbError);
          results.push({ 
            success: false, 
            filename: originalFile.name, 
            error: `Database save failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`,
            cloudinary_public_id: cloudinaryResult.public_id // Still uploaded to Cloudinary
          });
        }
      }
      
      setUploadResults(results);
      
      // Clear uploaded files if all database saves were successful
      if (results.every(r => r.success)) {
        setUploadedImages([]);
        setImageDescription('');
        setImageTags('');
        setImageRating(0);
        setIsImageFeatured(false);
        console.log('🎉 All images uploaded and cataloged successfully!');
      } else {
        console.warn('⚠️ Some images may have uploaded to Cloudinary but failed to save to database');
      }
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      results.push({ 
        success: false, 
        filename: 'batch', 
        error: error instanceof Error ? error.message : 'Unknown upload error'
      });
      setUploadResults(results);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎨 AI Prompt Generator
          </h1>
          <p className="text-lg text-gray-600">
            Create perfect AI prompts for pet portraits using your configured breeds, themes, styles, and formats
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wand2 className="w-5 h-5" />
                <span>Prompt Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Breed Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Breed *
                </label>
                <Select value={selectedBreed} onValueChange={setSelectedBreed}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a breed..." />
                  </SelectTrigger>
                  <SelectContent>
                    {breeds.filter(breed => breed.id && breed.id.trim() !== '').map(breed => (
                      <SelectItem key={breed.id} value={breed.id}>
                        <span>
                          {breed.name}
                          {breed.popularity_rank && ` (#${breed.popularity_rank})`}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Coat Selection */}
              {availableCoats.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coat Color
                  </label>
                  <Select value={selectedCoat} onValueChange={setSelectedCoat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a coat color..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCoats.filter(coat => coat.id && coat.id.trim() !== '').map(coat => (
                        <SelectItem key={coat.id} value={coat.id}>
                          <span>
                            {coat.coat_name}
                            {coat.is_common && ' (Common)'}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Outfit Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Outfit
                </label>
                <Select value={selectedOutfit} onValueChange={setSelectedOutfit}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an outfit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {outfits.filter(outfit => outfit.id && outfit.id.trim() !== '').map(outfit => (
                      <SelectItem key={outfit.id} value={outfit.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{outfit.name}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {outfit.animal_compatibility.map(animal => 
                              animal === 'dog' ? '🐕' : '🐱'
                            ).join(' ')}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Theme Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a theme..." />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.filter(theme => theme.id && theme.id.trim() !== '').map(theme => (
                      <SelectItem key={theme.id} value={theme.id}>
                        <span>
                          {theme.name} (Level {theme.difficulty_level})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Style
                </label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a style..." />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.filter(style => style.id && style.id.trim() !== '').map(style => (
                      <SelectItem key={style.id} value={style.id}>
                        {style.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Format
                </label>
                <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a format..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formats.filter(format => format.id && format.id.trim() !== '').map(format => (
                      <SelectItem key={format.id} value={format.id}>
                        <span>
                          {format.name} ({format.aspect_ratio})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-4">
                <Button
                  onClick={generatePrompt}
                  disabled={!selectedBreed || generating}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate Prompt
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Generated Prompt */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Prompt</span>
                {generatedPrompt && (
                  <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedPrompt ? (
                <div className="space-y-4">
                  <Textarea
                    value={generatedPrompt}
                    onChange={(e) => setGeneratedPrompt(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="Your generated prompt will appear here..."
                  />
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={copyToClipboard} className="flex-1">
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Prompt
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Download className="w-4 h-4 mr-2" />
                      Save as File
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Wand2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Select a breed and click "Generate Prompt" to create your AI prompt.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selection Summary */}
        {(selectedBreed || selectedTheme || selectedStyle || selectedFormat || selectedCoat || selectedOutfit) && (
          <Card>
            <CardHeader>
              <CardTitle>Current Selection</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedBreed && (
                  <Badge variant="secondary">
                    Breed: {breeds.find(b => b.id === selectedBreed)?.name}
                  </Badge>
                )}
                {selectedCoat && (
                  <Badge variant="secondary" className="flex items-center space-x-1">
                    <div 
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: availableCoats.find(c => c.id === selectedCoat)?.hex_color }}
                    ></div>
                    <span>Coat: {availableCoats.find(c => c.id === selectedCoat)?.coat_name}</span>
                  </Badge>
                )}
                {selectedOutfit && (
                  <Badge variant="secondary">
                    Outfit: {outfits.find(o => o.id === selectedOutfit)?.name}
                  </Badge>
                )}
                {selectedTheme && (
                  <Badge variant="secondary">
                    Theme: {themes.find(t => t.id === selectedTheme)?.name}
                  </Badge>
                )}
                {selectedStyle && (
                  <Badge variant="secondary">
                    Style: {styles.find(s => s.id === selectedStyle)?.name}
                  </Badge>
                )}
                {selectedFormat && (
                  <Badge variant="secondary">
                    Format: {formats.find(f => f.id === selectedFormat)?.name}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Image Upload Section */}
        {showUploadSection && generatedPrompt && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Upload className="w-5 h-5" />
                <span>Upload Generated Images</span>
              </CardTitle>
              <p className="text-sm text-gray-600">
                Upload the images you generated using this prompt to add them to your catalog
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Images
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports JPEG, PNG, WebP. Maximum 10MB per image.
                </p>
              </div>

              {/* Image Previews */}
              {uploadedImages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Images ({uploadedImages.length})
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {uploadedImages.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded">
                          {file.name.substring(0, 10)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata Fields */}
              {uploadedImages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-700">Image Metadata</h3>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateAIDescription}
                        disabled={!uploadedImages.length || isGeneratingDescription}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        {isGeneratingDescription ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Brain className="w-4 h-4 mr-2" />
                            AI Description
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={generateMetadata}
                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Auto-Generate
                      </Button>
                    </div>
                  </div>

                  {/* AI Description Error */}
                  {descriptionError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-red-800 text-sm">
                        <strong>AI Description Error:</strong> {descriptionError}
                      </p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <Textarea
                      value={imageDescription}
                      onChange={(e) => setImageDescription(e.target.value)}
                      placeholder="Describe the generated images..."
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma separated)
                    </label>
                    <Textarea
                      value={imageTags}
                      onChange={(e) => setImageTags(e.target.value)}
                      placeholder="cute, professional, outdoor, portrait"
                      rows={3}
                    />
                  </div>
                  
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rating (1-5 stars)
                      </label>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setImageRating(rating)}
                            className={`p-1 ${imageRating >= rating ? 'text-yellow-500' : 'text-gray-300'} hover:text-yellow-400`}
                          >
                            <Star className="w-5 h-5 fill-current" />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="featured"
                          checked={isImageFeatured}
                          onChange={(e) => setIsImageFeatured(e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="featured" className="text-sm text-gray-700">
                          Featured image
                        </label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="public"
                          checked={isImagePublic}
                          onChange={(e) => setIsImagePublic(e.target.checked)}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <label htmlFor="public" className="text-sm text-gray-700">
                          Public (visible in catalog)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              {uploadedImages.length > 0 && (
                <div className="flex space-x-2">
                  <Button
                    onClick={uploadImages}
                    disabled={uploading}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Uploading {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''}...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''} to Catalog
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadedImages([]);
                      setUploadResults([]);
                    }}
                    disabled={uploading}
                  >
                    Clear
                  </Button>
                </div>
              )}

              {/* Upload Results */}
              {uploadResults.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Results
                  </label>
                  <div className="space-y-2">
                    {uploadResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          result.success
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{result.filename}</span>
                          <span className="text-sm">
                            {result.success ? '✓ Uploaded successfully' : '✗ Failed'}
                          </span>
                        </div>
                        {result.error && (
                          <p className="text-sm mt-1">{result.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}