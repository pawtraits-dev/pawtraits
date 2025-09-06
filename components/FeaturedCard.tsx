'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface FeaturedCardProps {
  title: string;
  description: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  gradientFrom?: string;
  gradientTo?: string;
  borderColor?: string;
  icon?: string;
  badges?: Array<{
    text: string;
    className?: string;
  }>;
  metadata?: Array<{
    label: string;
    value: string;
    className?: string;
  }>;
}

export default function FeaturedCard({
  title,
  description,
  heroImageUrl,
  heroImageAlt,
  gradientFrom = 'blue-50',
  gradientTo = 'purple-50',
  borderColor = 'blue-200',
  icon = '🎨',
  badges = [],
  metadata = []
}: FeaturedCardProps) {
  return (
    <Card className={`bg-gradient-to-r from-${gradientFrom} to-${gradientTo} border-${borderColor} shadow-lg`}>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Hero Image - 1:1 aspect ratio container on the left */}
          {heroImageUrl && (
            <div className="w-64 h-64 flex-shrink-0">
              <div className="w-full h-full overflow-hidden rounded-lg shadow-lg bg-white/50 backdrop-blur-sm">
                <img 
                  src={heroImageUrl}
                  alt={heroImageAlt || `${title} hero image`}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          )}
          
          {/* Content on the right */}
          <div className="flex-1">
            {/* Title with brand font */}
            <div className="mb-4">
              <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3 font-serif tracking-wide">
                <span className="text-2xl">{icon}</span>
                <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  {title}
                </span>
              </h2>
            </div>
            
            {/* Description with markdown support */}
            <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed mb-4">
              <ReactMarkdown 
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                  em: ({ children }) => <em className="italic text-gray-800">{children}</em>
                }}
              >
                {description}
              </ReactMarkdown>
            </div>
            
            {/* Metadata */}
            {metadata.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {metadata.map((meta, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{meta.label}:</span>
                    <span className={`text-sm ${meta.className || 'text-gray-600'}`}>
                      {meta.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
          </div>
        </div>
      </CardContent>
    </Card>
  );
}