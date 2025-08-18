'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroImage {
  public_id: string;
  url: string;
  thumbnail: string;
  alt: string;
  created_at: string;
}

interface HeroCarouselProps {
  autoPlayInterval?: number; // milliseconds
  showThumbnails?: boolean;
  className?: string;
}

export default function HeroCarousel({ 
  autoPlayInterval = 5000, 
  showThumbnails = true,
  className = '' 
}: HeroCarouselProps) {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch hero images from API
  useEffect(() => {
    const fetchHeroImages = async () => {
      try {
        const response = await fetch('/api/hero-images');
        if (!response.ok) {
          throw new Error('Failed to fetch hero images');
        }
        const data = await response.json();
        setImages(data.images || []);
      } catch (err) {
        console.error('Error fetching hero images:', err);
        setError('Failed to load hero images');
      } finally {
        setLoading(false);
      }
    };

    fetchHeroImages();
  }, []);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [isPlaying, images.length, autoPlayInterval]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  }, [images.length]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case ' ':
          event.preventDefault();
          togglePlayPause();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevious, goToNext, togglePlayPause]);

  if (loading) {
    return (
      <div className={`relative w-full h-96 bg-gradient-to-br from-purple-50 to-blue-50 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error || images.length === 0) {
    return (
      <div className={`relative w-full h-96 bg-gradient-to-br from-purple-50 to-blue-50 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-600">
            <p className="text-lg mb-2">{error || 'No hero images available'}</p>
            <p className="text-sm">Using default background</p>
          </div>
        </div>
      </div>
    );
  }

  const currentImage = images[currentIndex];

  return (
    <div className={`relative w-full h-96 overflow-hidden ${className}`}>
      {/* Main Image Display */}
      <div className="relative w-full h-full">
        <img
          key={currentImage.public_id}
          src={currentImage.url}
          alt={currentImage.alt}
          className="w-full h-full object-cover transition-opacity duration-500"
          loading="lazy"
        />
      </div>

      {/* Navigation Controls */}
      <div className="absolute inset-y-0 left-0 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToPrevious}
          className="ml-4 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-0"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
      </div>

      <div className="absolute inset-y-0 right-0 flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={goToNext}
          className="mr-4 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-0"
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6" />
        </Button>
      </div>

      {/* Play/Pause Control */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlayPause}
          className="bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border-0"
          aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
      </div>

      {/* Dot Indicators */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="flex space-x-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-colors duration-200 ${
                index === currentIndex 
                  ? 'bg-white' 
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Thumbnail Strip (if enabled) */}
      {showThumbnails && images.length > 1 && (
        <div className="absolute bottom-4 left-4 right-16">
          <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
            {images.map((image, index) => (
              <button
                key={image.public_id}
                onClick={() => goToSlide(index)}
                className={`flex-shrink-0 w-16 h-10 overflow-hidden rounded border-2 transition-all duration-200 ${
                  index === currentIndex 
                    ? 'border-white shadow-lg' 
                    : 'border-white/50 hover:border-white/75'
                }`}
                aria-label={`View ${image.alt}`}
              >
                <img
                  src={image.thumbnail}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image Counter */}
      <div className="absolute top-4 left-4">
        <div className="bg-black/40 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
}