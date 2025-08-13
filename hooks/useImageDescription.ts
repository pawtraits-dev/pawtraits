import { useState } from 'react';

// Client-side image compression to stay under Vercel's 4.5MB request limit
async function compressImageIfNeeded(file: File): Promise<File> {
  const maxSizeBytes = 4 * 1024 * 1024; // 4MB to be safe
  
  if (file.size <= maxSizeBytes) {
    return file; // No compression needed
  }

  console.log(`Compressing large file: ${file.size} bytes`);

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions (max 1024px on longest side)
      const maxDimension = 1024;
      let { width, height } = img;
      
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

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            console.log(`Compressed to: ${compressedFile.size} bytes`);
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original if compression fails
          }
        },
        'image/jpeg',
        0.8 // 80% quality
      );
    };

    img.onerror = () => resolve(file); // Fallback to original if load fails
    img.src = URL.createObjectURL(file);
  });
}

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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate description`);
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
      // Compress image client-side if it's too large for Vercel's 4.5MB limit
      const compressedFile = await compressImageIfNeeded(file);
      console.log(`File compression: ${file.size} bytes -> ${compressedFile.size} bytes`);

      const formData = new FormData();
      formData.append('image', compressedFile);
      if (breed) formData.append('breed', breed);
      if (breedSlug) formData.append('breedSlug', breedSlug);

      const response = await fetch('/api/generate-description/file', {
        method: 'POST',
        body: formData
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

      const data = await response.json();
      console.log('AI Description API response (from file):', { 
        hasDescription: !!data.description, 
        descriptionLength: data.description?.length,
        breed: data.breed,
        traits: data.traits 
      });
      
      setResult({
        description: data.description,
        breed: data.breed,
        traits: data.traits
      });

    } catch (err) {
      console.error('Error in generateFromFile:', err);
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