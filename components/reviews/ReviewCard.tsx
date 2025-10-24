'use client';

import Image from 'next/image';
import { Badge, Quote } from 'lucide-react';
import StarRating from './StarRating';
import type { Review } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface ReviewCardProps {
  review: Review;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const {
    rating,
    comment,
    customer_first_name,
    customer_city,
    customer_country,
    image_thumbnail_url,
    breed_name,
    is_early_adopter,
    created_at,
  } = review;

  // Format relative time
  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: true });

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-start gap-4 md:gap-6">
        {/* Image Thumbnail */}
        {image_thumbnail_url && (
          <div className="flex-shrink-0">
            <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden ring-4 ring-purple-100">
              <Image
                src={image_thumbnail_url}
                alt={`Portrait of ${breed_name || 'pet'}`}
                fill
                className="object-cover"
              />
            </div>
          </div>
        )}

        {/* Review Content */}
        <div className="flex-1 min-w-0">
          {/* Star Rating */}
          <div className="mb-3">
            <StarRating rating={rating} readonly size="lg" />
          </div>

          {/* Comment */}
          <div className="relative mb-4">
            <Quote className="absolute -left-1 -top-1 w-6 h-6 text-purple-200 opacity-50" />
            <p className="text-gray-700 text-base md:text-lg leading-relaxed pl-6">
              {comment}
            </p>
          </div>

          {/* Customer Info & Badges */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="font-semibold text-gray-900">
              {customer_first_name}
            </span>
            <span className="text-gray-400">•</span>
            <span>
              {customer_city}, {customer_country}
            </span>
            {breed_name && (
              <>
                <span className="text-gray-400">•</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {breed_name}
                </span>
              </>
            )}
            {is_early_adopter && (
              <>
                <span className="text-gray-400">•</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800">
                  <Badge className="w-3 h-3" />
                  Early Adopter
                </span>
              </>
            )}
          </div>

          {/* Timestamp */}
          <p className="text-xs text-gray-400 mt-2">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
}
