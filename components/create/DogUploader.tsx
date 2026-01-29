'use client';

import { useState, useRef, ChangeEvent } from 'react';
import Image from 'next/image';
import { Upload, X, Camera, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DogUploaderProps {
  onUpload: (file: File, base64: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function DogUploader({ onUpload, onError, disabled = false }: DogUploaderProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateImage = async (file: File): Promise<boolean> => {
    // Check file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setValidationError('Please upload a JPEG or PNG image');
      onError('Invalid file type. Only JPEG and PNG images are supported.');
      return false;
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setValidationError('Image is too large (max 5MB)');
      onError('Image file is too large. Please use an image smaller than 5MB.');
      return false;
    }

    // Check minimum dimensions
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const minDimension = 512;
        if (img.width < minDimension || img.height < minDimension) {
          setValidationError(`Image too small (minimum ${minDimension}x${minDimension}px)`);
          onError(`Image resolution is too low. Please use an image at least ${minDimension}x${minDimension} pixels.`);
          resolve(false);
        } else {
          resolve(true);
        }
      };
      img.onerror = () => {
        setValidationError('Failed to load image');
        onError('Could not load the image. Please try a different file.');
        resolve(false);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to base64'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      // Validate the image
      const isValid = await validateImage(file);
      if (!isValid) {
        setIsValidating(false);
        return;
      }

      // Convert to base64
      const base64 = await convertToBase64(file);

      // Set preview
      setPreview(base64);
      setFileName(file.name);

      // Notify parent component
      onUpload(file, base64);
    } catch (error: any) {
      console.error('Error processing image:', error);
      setValidationError('Failed to process image');
      onError('An error occurred while processing your image. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setFileName('');
    setValidationError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        capture="environment" // Enables camera on mobile
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isValidating}
      />

      {/* Upload button or preview */}
      {!preview ? (
        <Card className="border-2 border-dashed border-gray-300 hover:border-primary transition-colors">
          <CardContent className="p-6">
            <button
              onClick={handleButtonClick}
              disabled={disabled || isValidating}
              className="w-full flex flex-col items-center justify-center space-y-4 py-8 touch-target min-h-[14rem] disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
            >
              <div className="p-4 rounded-full bg-primary/10">
                {isValidating ? (
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-12 h-12 text-primary" />
                )}
              </div>

              <div className="text-center space-y-2">
                <p className="text-lg font-semibold text-gray-900">
                  {isValidating ? 'Processing image...' : 'Upload Your Dog\'s Photo'}
                </p>
                <p className="text-sm text-gray-600">
                  Tap to take a photo or choose from gallery
                </p>
                <p className="text-xs text-gray-500">
                  JPEG or PNG • Max 5MB • Min 512x512px
                </p>
              </div>

              <div className="flex items-center gap-2 text-primary">
                <Camera className="w-5 h-5" />
                <Upload className="w-5 h-5" />
              </div>
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              {/* Image preview */}
              <div className="relative w-full aspect-square overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={preview}
                  alt="Your dog"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>

              {/* Remove button */}
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 p-2 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors touch-target"
                type="button"
                disabled={disabled}
              >
                <X className="w-5 h-5" />
              </button>

              {/* File name */}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm text-gray-600 truncate flex-1">
                  {fileName}
                </p>
                <Button
                  onClick={handleButtonClick}
                  variant="outline"
                  size="sm"
                  disabled={disabled || isValidating}
                  type="button"
                >
                  Replace
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation error */}
      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
