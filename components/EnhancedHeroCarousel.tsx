'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { CarouselSlide, PageType, TextPosition, TextColor, CTAStyle } from '@/lib/carousel-types';

interface EnhancedHeroCarouselProps {
  pageType: PageType;
  className?: string;
  showControls?: boolean;
  showThumbnails?: boolean;
  autoPlayOverride?: number;
}

interface CarouselData {
  carousel: {
    id: string;
    name: string;
    auto_play_interval: number;
    show_thumbnails: boolean;
  } | null;
  slides: CarouselSlide[];
}

export default function EnhancedHeroCarousel({ 
  pageType,
  className = '',
  showControls = true,
  showThumbnails,
  autoPlayOverride
}: EnhancedHeroCarouselProps) {
  const router = useRouter();
  const [carouselData, setCarouselData] = useState<CarouselData>({ carousel: null, slides: [] });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch carousel data from API
  useEffect(() => {
    const fetchCarouselData = async () => {
      try {
        const response = await fetch(`/api/carousel/${pageType}`);
        if (!response.ok) {
          throw new Error('Failed to fetch carousel data');
        }
        const data = await response.json();
        setCarouselData(data);
      } catch (err) {
        console.error('Error fetching carousel data:', err);
        setError('Failed to load carousel');
      } finally {
        setLoading(false);
      }
    };

    fetchCarouselData();
  }, [pageType]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || carouselData.slides.length <= 1) return;

    const interval = autoPlayOverride || carouselData.carousel?.auto_play_interval || 6000;
    const autoPlayInterval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselData.slides.length);
    }, interval);

    return () => clearInterval(autoPlayInterval);
  }, [isPlaying, carouselData.slides.length, carouselData.carousel?.auto_play_interval, autoPlayOverride]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prevIndex) => 
      prevIndex === 0 ? carouselData.slides.length - 1 : prevIndex - 1
    );
  }, [carouselData.slides.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % carouselData.slides.length);
  }, [carouselData.slides.length]);

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

  const handleCTAClick = (slide: CarouselSlide) => {
    if (slide.cta_url) {
      if (slide.cta_url.startsWith('/')) {
        router.push(slide.cta_url);
      } else {
        window.open(slide.cta_url, '_blank');
      }
    }
  };

  const getTextPositionClasses = (position: TextPosition) => {
    switch (position) {
      case 'center': return 'items-center justify-center text-center';
      case 'left': return 'items-center justify-start text-left pl-8 md:pl-16';
      case 'right': return 'items-center justify-end text-right pr-8 md:pr-16';
      case 'bottom-left': return 'items-end justify-start text-left pl-8 md:pl-16 pb-8 md:pb-16';
      case 'bottom-right': return 'items-end justify-end text-right pr-8 md:pr-16 pb-8 md:pb-16';
      case 'top-left': return 'items-start justify-start text-left pl-8 md:pl-16 pt-8 md:pt-16';
      case 'top-right': return 'items-start justify-end text-right pr-8 md:pr-16 pt-8 md:pt-16';
      default: return 'items-center justify-center text-center';
    }
  };

  const getTextColorClasses = (color: TextColor) => {
    switch (color) {
      case 'white': return 'text-white';
      case 'black': return 'text-black';
      case 'purple': return 'text-purple-600';
      case 'blue': return 'text-blue-600';
      default: return 'text-white';
    }
  };

  const getCTAButtonClasses = (style: CTAStyle, textColor: TextColor) => {
    const baseClasses = 'shadow-lg backdrop-blur-sm';
    
    switch (style) {
      case 'primary':
        return `${baseClasses} bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white`;
      case 'secondary':
        return `${baseClasses} bg-white/90 hover:bg-white text-purple-600 hover:text-purple-700`;
      case 'outline':
        return `${baseClasses} border-2 ${
          textColor === 'white' 
            ? 'border-white text-white hover:bg-white hover:text-purple-600' 
            : 'border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white'
        } bg-transparent hover:shadow-xl`;
      default:
        return `${baseClasses} bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white`;
    }
  };

  if (loading) {
    return (
      <div className={`relative w-full aspect-video bg-gradient-to-br from-purple-50 to-blue-50 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error || carouselData.slides.length === 0) {
    return (
      <div className={`relative w-full aspect-video bg-gradient-to-br from-purple-50 to-blue-50 ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-600">
            <p className="text-lg mb-2">{error || `No carousel configured for ${pageType} page`}</p>
            <p className="text-sm">Configure carousel content in admin panel</p>
          </div>
        </div>
      </div>
    );
  }

  const currentSlide = carouselData.slides[currentIndex];
  const shouldShowThumbnails = showThumbnails !== undefined ? showThumbnails : carouselData.carousel?.show_thumbnails;

  return (
    <div className={`relative w-full aspect-video overflow-hidden ${className}`}>
      {/* Main Image Display */}
      <div className="relative w-full h-full">
        <img
          key={currentSlide.id}
          src={currentSlide.image_url}
          alt={currentSlide.image_alt || 'Carousel image'}
          className="w-full h-full object-cover transition-opacity duration-500"
          loading="lazy"
        />
        
        {/* Overlay for text readability */}
        {currentSlide.show_overlay && (
          <div 
            className="absolute inset-0 bg-black transition-opacity duration-500"
            style={{ opacity: currentSlide.overlay_opacity / 100 }}
          />
        )}

        {/* Content Overlay */}
        {(currentSlide.title || currentSlide.subtitle || currentSlide.description || currentSlide.cta_text) && (
          <div className={`absolute inset-0 flex ${getTextPositionClasses(currentSlide.text_position)}`}>
            <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 ${getTextColorClasses(currentSlide.text_color)}`}>
              {currentSlide.title && (
                <h1 className="text-4xl md:text-6xl font-bold mb-4 drop-shadow-lg font-[family-name:var(--font-life-savers)]">
                  {currentSlide.title}
                </h1>
              )}
              
              {currentSlide.subtitle && (
                <h2 className="text-2xl md:text-3xl font-semibold mb-4 drop-shadow-lg">
                  {currentSlide.subtitle}
                </h2>
              )}
              
              {currentSlide.description && (
                <p className="text-lg md:text-xl mb-8 max-w-3xl drop-shadow-lg opacity-90 leading-relaxed">
                  {currentSlide.description}
                </p>
              )}
              
              {currentSlide.cta_text && (
                <Button 
                  size="lg"
                  onClick={() => handleCTAClick(currentSlide)}
                  className={getCTAButtonClasses(currentSlide.cta_style, currentSlide.text_color)}
                >
                  {currentSlide.cta_text}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {showControls && carouselData.slides.length > 1 && (
        <>
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
        </>
      )}

      {/* Dot Indicators */}
      {carouselData.slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="flex space-x-2">
            {carouselData.slides.map((_, index) => (
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
      )}

      {/* Thumbnail Strip */}
      {shouldShowThumbnails && carouselData.slides.length > 1 && (
        <div className="absolute bottom-4 left-4 right-16">
          <div className="flex space-x-2 overflow-x-auto scrollbar-hide">
            {carouselData.slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`flex-shrink-0 w-16 h-9 overflow-hidden rounded border-2 transition-all duration-200 ${
                  index === currentIndex 
                    ? 'border-white shadow-lg' 
                    : 'border-white/50 hover:border-white/75'
                }`}
                aria-label={`View ${slide.image_alt || 'slide'}`}
              >
                <img
                  src={slide.image_url}
                  alt={slide.image_alt || 'Slide thumbnail'}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slide Counter */}
      {carouselData.slides.length > 1 && (
        <div className="absolute top-4 left-4">
          <div className="bg-black/40 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} / {carouselData.slides.length}
          </div>
        </div>
      )}
    </div>
  );
}