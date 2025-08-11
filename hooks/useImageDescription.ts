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
      const formData = new FormData();
      formData.append('image', file);
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