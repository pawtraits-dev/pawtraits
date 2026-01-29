'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Download, ShoppingCart, Share2, Instagram, Facebook, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VariationPreviewProps {
  watermarkedUrl: string;
  metadata: {
    breedName: string;
    themeName: string;
    styleName: string;
  };
  onDownloadClick: () => void;
  onPrintClick: () => void;
  onShareClick?: (platform: string) => void;
}

export function VariationPreview({
  watermarkedUrl,
  metadata,
  onDownloadClick,
  onPrintClick,
  onShareClick
}: VariationPreviewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleShare = (platform: string) => {
    setShowShareMenu(false);
    onShareClick?.(platform);
  };

  return (
    <div className="w-full space-y-4">
      {/* Generated image card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Your Custom Portrait</span>
            <Badge variant="secondary" className="text-xs">
              Watermarked Preview
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {/* Image display */}
          <div className="relative w-full aspect-square bg-gray-100">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <Image
              src={watermarkedUrl}
              alt="Your dog's custom portrait"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              onLoad={() => setImageLoaded(true)}
              priority
            />
          </div>

          {/* Metadata badges */}
          <div className="p-4 flex flex-wrap gap-2 bg-gray-50">
            <Badge variant="outline" className="text-xs">
              🐕 {metadata.breedName}
            </Badge>
            <Badge variant="outline" className="text-xs">
              🎨 {metadata.themeName}
            </Badge>
            <Badge variant="outline" className="text-xs">
              ✨ {metadata.styleName}
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3 pt-4">
          {/* Primary CTA: Download */}
          <Button
            onClick={onDownloadClick}
            className="w-full h-14 text-lg font-semibold touch-target"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Download HD Version
          </Button>

          {/* Secondary CTA: Order Prints */}
          <Button
            onClick={onPrintClick}
            variant="outline"
            className="w-full h-14 text-lg font-semibold touch-target"
            size="lg"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Order Prints
          </Button>

          {/* Tertiary: Share button */}
          <div className="relative w-full">
            <Button
              onClick={() => setShowShareMenu(!showShareMenu)}
              variant="ghost"
              className="w-full touch-target"
              size="sm"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>

            {/* Share menu */}
            {showShareMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-white rounded-lg shadow-lg border z-10">
                <p className="text-xs text-gray-600 mb-2">Share on:</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => handleShare('instagram')}
                    className="p-3 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white hover:opacity-90 transition-opacity touch-target"
                    type="button"
                  >
                    <Instagram className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleShare('facebook')}
                    className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors touch-target"
                    type="button"
                  >
                    <Facebook className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleShare('twitter')}
                    className="p-3 rounded-full bg-sky-500 text-white hover:bg-sky-600 transition-colors touch-target"
                    type="button"
                  >
                    <Twitter className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Info callout */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-900">
            <strong>Love it?</strong> Create a free account to download the HD version without watermark,
            order professional prints, and generate unlimited portraits!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
