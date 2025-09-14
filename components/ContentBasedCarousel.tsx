'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Palette, 
  Dog, 
  Cat,
  ArrowRight,
  Play,
  Pause
} from 'lucide-react';
import { CarouselContentWithDetails, PageType } from '@/lib/carousel-types';

interface ContentBasedCarouselProps {
  pageType: PageType;
  className?: string;
  showControls?: boolean;
  showThumbnails?: boolean;
  autoPlayOverride?: number;
}

export default function ContentBasedCarousel({
  pageType,
  className = '',
  showControls = true,
  showThumbnails = false,
  autoPlayOverride
}: ContentBasedCarouselProps) {
  const router = useRouter();
  const [content, setContent] = useState<CarouselContentWithDetails[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(true);
  const [autoPlayInterval, setAutoPlayInterval] = useState<number>(6000);

  useEffect(() => {
    loadCarouselContent();
  }, [pageType]);

  useEffect(() => {
    if (!isPlaying || content.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % content.length);
    }, autoPlayOverride || autoPlayInterval);

    return () => clearInterval(interval);
  }, [isPlaying, content.length, autoPlayInterval, autoPlayOverride]);

  const loadCarouselContent = async () => {
    try {
      setLoading(true);
      setError('');

      // Get carousel and content for this page type
      const response = await fetch(`/api/public/carousel-content?page_type=${pageType}`);
      if (!response.ok) throw new Error('Failed to load carousel content');
      
      const data = await response.json();
      
      if (!data.carousel) {
        setContent([]);
        return;
      }

      setAutoPlayInterval(data.carousel.auto_play_interval || 6000);
      setContent(data.content || []);

    } catch (err) {
      console.error('Error loading carousel content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load carousel');
      setContent([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSlideClick = (contentItem: CarouselContentWithDetails) => {
    // Navigate to the shop page with appropriate filters
    router.push(contentItem.cta_url);
  };

  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % content.length);
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + content.length) % content.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const getContentTypeIcon = (contentType: string, animalType?: string) => {
    switch (contentType) {
      case 'theme':
        return <Palette className="w-4 h-4" />;
      case 'dog_breed':
        return <Dog className="w-4 h-4" />;
      case 'cat_breed':
        return <Cat className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getContentTypeBadge = (contentType: string, animalType?: string) => {
    switch (contentType) {
      case 'theme':
        return { text: 'Theme', color: 'bg-purple-100 text-purple-800' };
      case 'dog_breed':
        return { text: 'Dog Breed', color: 'bg-orange-100 text-orange-800' };
      case 'cat_breed':
        return { text: 'Cat Breed', color: 'bg-blue-100 text-blue-800' };
      default:
        return { text: 'Content', color: 'bg-gray-100 text-gray-800' };
    }
  };

  if (loading) {
    return (
      <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error || content.length === 0) {
    return (
      <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <Palette className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>{error || 'No carousel content available'}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentContent = content[currentIndex];
  const badge = getContentTypeBadge(currentContent.content_type, currentContent.breed_animal_type);

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      {/* Main Carousel */}
      <div className="relative h-full">
        {/* Background Image - 1:1 aspect ratio centered, no masking */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: currentContent.hero_image_url 
              ? `url(${currentContent.hero_image_url})`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center'
          }}
        >
        </div>

        {/* Content Overlay - Positioned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          <div className="text-center text-white max-w-4xl mx-auto px-8 py-8">
            {/* Badge */}
            <div className="mb-4">
              <Badge className={`${badge.color} inline-flex items-center gap-2`}>
                {getContentTypeIcon(currentContent.content_type, currentContent.breed_animal_type)}
                {badge.text}
              </Badge>
            </div>

            {/* Title */}
            <h2 className="text-2xl md:text-4xl font-bold mb-2 font-[family-name:var(--font-life-savers)] drop-shadow-lg">
              {currentContent.title}
            </h2>

            {/* Subtitle/Description - First sentence only in bold, trim leading asterisks */}
            {currentContent.subtitle && (() => {
              // Clean up the subtitle text
              let cleanText = currentContent.subtitle;
              
              // Remove leading asterisks and whitespace
              cleanText = cleanText.replace(/^\*+\s*/, '');
              
              // Extract first sentence (ending with ., !, or ?) or first line
              const sentences = cleanText.match(/[^\.!?]*[\.!?]/);
              const firstSentence = sentences 
                ? sentences[0].trim()
                : cleanText.split('\n')[0].trim();
              
              return (
                <p className="text-sm md:text-lg mb-4 opacity-90 max-w-2xl mx-auto drop-shadow-lg">
                  <strong>{firstSentence}</strong>
                </p>
              );
            })()}

            {/* CTA Button */}
            <Button
              size="sm"
              className="bg-white text-purple-600 hover:bg-gray-100 font-semibold px-6 py-2 text-sm"
              onClick={() => handleSlideClick(currentContent)}
            >
              {currentContent.cta_text}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Navigation Controls */}
        {showControls && content.length > 1 && (
          <>
            {/* Previous/Next Buttons */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-3 text-white transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-3 text-white transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute bottom-4 left-4 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 text-white transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            {/* Slide Indicators */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {content.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentIndex
                      ? 'bg-white'
                      : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                  }`}
                />
              ))}
            </div>

            {/* Content Counter */}
            <div className="absolute top-4 right-4 bg-black bg-opacity-30 text-white px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {content.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {showThumbnails && content.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
          <div className="flex space-x-2 overflow-x-auto">
            {content.map((item, index) => (
              <button
                key={item.id}
                onClick={() => goToSlide(index)}
                className={`flex-shrink-0 w-20 h-12 rounded overflow-hidden border-2 transition-all ${
                  index === currentIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-80'
                }`}
              >
                {item.hero_image_url ? (
                  <img
                    src={item.hero_image_url}
                    alt={item.hero_image_alt}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                    {getContentTypeIcon(item.content_type, item.breed_animal_type)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}