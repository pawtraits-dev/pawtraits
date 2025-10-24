'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
}

export default function StarRating({
  rating,
  onChange,
  readonly = false,
  size = 'md',
  showCount = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number>(0);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = (value: number) => {
    if (!readonly && onChange) {
      onChange(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (!readonly) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => {
        const isFilled = value <= displayRating;
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleClick(value)}
            onMouseEnter={() => handleMouseEnter(value)}
            onMouseLeave={handleMouseLeave}
            disabled={readonly}
            className={`
              ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}
              transition-all duration-150
              ${!readonly && 'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded'}
            `}
            aria-label={`${value} star${value !== 1 ? 's' : ''}`}
          >
            <Star
              className={`
                ${sizeClasses[size]}
                transition-colors duration-150
                ${isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-gray-300'
                }
                ${!readonly && hoverRating >= value && 'fill-yellow-300 text-yellow-300'}
              `}
            />
          </button>
        );
      })}
      {showCount && (
        <span className="ml-2 text-sm text-gray-600">
          ({rating}/5)
        </span>
      )}
    </div>
  );
}
