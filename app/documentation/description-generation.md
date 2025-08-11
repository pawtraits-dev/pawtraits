// lib/image-description-generator.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY!,
});

export class ImageDescriptionGenerator {
  private buildDescriptionPrompt(breed?: string, traits?: string[]): string {
    const breedInfo = breed ? `
BREED CONTEXT:
- This is a ${breed}
- Key personality traits: ${traits?.join(', ') || 'playful, loyal, intelligent'}
- Use these traits to inform the pet's "personality" and likely thoughts/attitudes
- Reference breed-specific behaviors or stereotypes humorously` : '';

    return `
You are a witty pet portrait copywriter who writes fun, lighthearted descriptions in this specific style:

STYLE GUIDELINES:
- Start with a catchy title using "**" markdown
- Write 2-3 short, punchy paragraphs 
- Use humor and personality - imagine the pets have human-like thoughts and attitudes
- Reference what the pet is "thinking" or their apparent "personality"
- Use phrases like "clearly," "obviously," "apparently," "definitely"
- Make observations about their expression and apparent confidence
- End with an italicized quip in *asterisks*
- NO sales language, NO AI/tech mentions, NO business promotion
- Keep it fun and conversational
${breedInfo}

EXAMPLE TONE:
"This absolutely fabulous Goldendoodle has decided that Tuesday afternoon is the perfect time to debut her new spring collection... That gentle, knowing expression suggests she's fully aware of her floral fabulousness and is probably wondering why her humans aren't also wearing coordinating botanical headpieces."

BREED-SPECIFIC EXAMPLE:
"**The Labrador's Professional Food Quality Assessment**
This distinguished Labrador has clearly appointed himself as Chief Treat Inspector, and judging by that focused expression, he's taking his responsibilities very seriously. His gentle but determined gaze suggests he's mentally cataloguing every snack in a five-mile radius while maintaining the patient dignity that only a true food enthusiast can muster."

Now write a fun description for this image in exactly that style, incorporating the breed's personality traits naturally.`;
  }

  async generateDescription(
    imageUrl: string, 
    breed?: string, 
    traits?: string[]
  ): Promise<string> {
    try {
      const prompt = this.buildDescriptionPrompt(breed, traits);
      
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: await this.imageToBase64(imageUrl)
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      });

      return response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'Unable to generate description';

    } catch (error) {
      console.error('Error generating image description:', error);
      throw new Error('Failed to generate image description');
    }
  }

  private async imageToBase64(imageUrl: string): Promise<string> {
    try {
      const response = await fetch(imageUrl);
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return base64;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to process image');
    }
  }

  // Alternative method for local file uploads
  async generateDescriptionFromFile(
    file: File, 
    breed?: string, 
    traits?: string[]
  ): Promise<string> {
    try {
      const base64 = await this.fileToBase64(file);
      const prompt = this.buildDescriptionPrompt(breed, traits);
      
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: file.type as any,
                  data: base64
                }
              },
              {
                type: "text",
                text: prompt
              }
            ]
          }
        ]
      });

      return response.content[0].type === 'text' 
        ? response.content[0].text 
        : 'Unable to generate description';

    } catch (error) {
      console.error('Error generating description from file:', error);
      throw new Error('Failed to generate image description');
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// API Route Example
// app/api/generate-description/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ImageDescriptionGenerator } from '@/lib/image-description-generator';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, breed, breedSlug } = await req.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
    }

    // Fetch breed info from database if breedSlug provided
    let breedData = null;
    if (breedSlug) {
      const { data } = await supabase
        .from('breeds')
        .select('name, personality_traits')
        .eq('slug', breedSlug)
        .eq('is_active', true)
        .single();
      
      breedData = data;
    }

    const generator = new ImageDescriptionGenerator();
    const description = await generator.generateDescription(
      imageUrl,
      breedData?.name || breed,
      breedData?.personality_traits
    );

    return NextResponse.json({ 
      description,
      breed: breedData?.name || breed,
      traits: breedData?.personality_traits
    });

  } catch (error) {
    console.error('Description generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate description' }, 
      { status: 500 }
    );
  }
}

// React Hook for Frontend
// hooks/useImageDescription.ts
import { useState } from 'react';

interface DescriptionResult {
  description: string;
  breed?: string;
  traits?: string[];
}

export function useImageDescription() {
  const [result, setResult] = useState<DescriptionResult>({ description: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateDescription = async (
    imageUrl: string, 
    breed?: string, 
    breedSlug?: string
  ) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, breed, breedSlug })
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      setResult({
        description: data.description,
        breed: data.breed,
        traits: data.traits
      });
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFromFile = async (
    file: File, 
    breed?: string, 
    breedSlug?: string
  ) => {
    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (breed) formData.append('breed', breed);
      if (breedSlug) formData.append('breedSlug', breedSlug);

      const response = await fetch('/api/generate-description/file', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to generate description');
      }

      const data = await response.json();
      setResult({
        description: data.description,
        breed: data.breed,
        traits: data.traits
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    ...result,
    isGenerating,
    error,
    generateDescription,
    generateFromFile,
    setDescription: (description: string) => setResult(prev => ({ ...prev, description }))
  };
}

// Usage in Component
// components/ImageDescriptionGenerator.tsx
'use client';

import { useState, useEffect } from 'react';
import { useImageDescription } from '@/hooks/useImageDescription';

interface Breed {
  id: string;
  name: string;
  slug: string;
  personality_traits: string[];
}

export default function ImageDescriptionDemo() {
  const [imageUrl, setImageUrl] = useState('');
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(null);
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [loadingBreeds, setLoadingBreeds] = useState(true);
  
  const { 
    description, 
    breed: detectedBreed,
    traits,
    isGenerating, 
    error, 
    generateDescription,
    generateFromFile 
  } = useImageDescription();

  // Load breeds from database
  useEffect(() => {
    const fetchBreeds = async () => {
      try {
        const response = await fetch('/api/breeds');
        const data = await response.json();
        setBreeds(data);
      } catch (error) {
        console.error('Error loading breeds:', error);
      } finally {
        setLoadingBreeds(false);
      }
    };

    fetchBreeds();
  }, []);

  const handleUrlGeneration = () => {
    if (imageUrl) {
      generateDescription(
        imageUrl, 
        selectedBreed?.name, 
        selectedBreed?.slug
      );
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      generateFromFile(
        file, 
        selectedBreed?.name, 
        selectedBreed?.slug
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Pet Portrait Description Generator</h1>
      
      {/* Breed Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Select Breed (optional - for better personality matching):
        </label>
        {loadingBreeds ? (
          <div className="p-2 text-gray-500">Loading breeds...</div>
        ) : (
          <select
            value={selectedBreed?.id || ''}
            onChange={(e) => {
              const breed = breeds.find(b => b.id === e.target.value);
              setSelectedBreed(breed || null);
            }}
            className="w-full p-2 border rounded-md"
          >
            <option value="">Auto-detect breed from image</option>
            {breeds.map(breed => (
              <option key={breed.id} value={breed.id}>
                {breed.name}
              </option>
            ))}
          </select>
        )}
        
        {selectedBreed && (
          <div className="mt-2 p-3 bg-blue-50 rounded-md">
            <p className="text-blue-800 font-medium">{selectedBreed.name}</p>
            <p className="text-blue-600 text-sm">
              Traits: {selectedBreed.personality_traits.join(', ')}
            </p>
          </div>
        )}
      </div>
      
      {/* URL Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Image URL:
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/pet-image.jpg"
            className="flex-1 p-2 border rounded-md"
          />
          <button
            onClick={handleUrlGeneration}
            disabled={!imageUrl || isGenerating}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Or upload image:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isGenerating}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
        />
      </div>

      {/* Loading State */}
      {isGenerating && (
        <div className="mb-6 p-4 bg-purple-50 rounded-md">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            <span className="text-purple-800">
              Generating witty description
              {selectedBreed ? ` for ${selectedBreed.name}` : ''}...
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Generated Description */}
      {description && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Generated Description:</h3>
            {detectedBreed && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">{detectedBreed}</span>
                {traits && traits.length > 0 && (
                  <span className="ml-2">({traits.join(', ')})</span>
                )}
              </div>
            )}
          </div>
          <div className="p-4 bg-gray-50 rounded-md">
            <div 
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                    .replace(/\n/g, '<br/>')
              }}
            />
          </div>
        </div>
      )}

      {/* Preview Image */}
      {imageUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Image Preview:</h3>
          <img 
            src={imageUrl} 
            alt="Pet portrait" 
            className="max-w-md rounded-lg shadow-md"
          />
        </div>
      )}
    </div>
  );
}