'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReviewCard from './ReviewCard';
import type { Review } from '@/lib/types';

interface ReviewsCarouselProps {
  autoPlayInterval?: number; // milliseconds, default 6000
}

export default function ReviewsCarousel({ autoPlayInterval = 6000 }: ReviewsCarouselProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch reviews on mount
  useEffect(() => {
    async function fetchReviews() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/public/reviews?limit=20&random=true');

        if (!response.ok) {
          throw new Error('Failed to fetch reviews');
        }

        const data = await response.json();
        setReviews(data.reviews || []);
      } catch (err) {
        console.error('Error fetching reviews:', err);
        setError('Failed to load reviews');
      } finally {
        setIsLoading(false);
      }
    }

    fetchReviews();
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (reviews.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [reviews.length, autoPlayInterval, isPaused]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full py-12">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse bg-gray-200 rounded-lg h-64"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full py-12">
        <div className="max-w-2xl mx-auto text-center text-gray-500">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // No reviews state
  if (reviews.length === 0) {
    return null; // Don't show carousel if no reviews
  }

  const currentReview = reviews[currentIndex];

  return (
    <div
      className="w-full py-12 relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="max-w-4xl mx-auto px-4">
        {/* Navigation Buttons */}
        {reviews.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Previous review"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Next review"
            >
              <ChevronRight className="w-6 h-6 text-gray-700" />
            </button>
          </>
        )}

        {/* Review Card */}
        <div className="transition-opacity duration-500">
          <ReviewCard review={currentReview} />
        </div>

        {/* Dots Indicator */}
        {reviews.length > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {reviews.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`
                  w-2 h-2 rounded-full transition-all duration-300
                  ${
                    index === currentIndex
                      ? 'bg-purple-600 w-8'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }
                `}
                aria-label={`Go to review ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
