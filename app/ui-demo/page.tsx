'use client'

import { BrandedButton } from '@/src/components/ui/branded-button'
import { Heart, Star, ShoppingCart, Download, Plus, ArrowRight } from 'lucide-react'

export default function UIDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-yard">
      <div className="max-w-4xl mx-auto space-y-park">
        {/* Header */}
        <div className="text-center space-y-collar">
          <h1 className="text-4xl font-bold text-gray-900">🎨 Pawtraits Button Showcase</h1>
          <p className="text-lg text-gray-600">Branded buttons following our pet-friendly design system</p>
        </div>

        {/* Button Variants */}
        <div className="space-y-leash">
          <div className="space-y-toy">
            <h2 className="text-2xl font-semibold text-gray-900">Button Variants</h2>
            <div className="flex flex-wrap gap-collar">
              <BrandedButton variant="primary">
                Primary Button
              </BrandedButton>
              <BrandedButton variant="secondary">
                Secondary Button  
              </BrandedButton>
              <BrandedButton variant="tertiary">
                Tertiary Button
              </BrandedButton>
              <BrandedButton variant="outline">
                Outline Button
              </BrandedButton>
              <BrandedButton variant="ghost">
                Ghost Button
              </BrandedButton>
              <BrandedButton variant="link">
                Link Button
              </BrandedButton>
            </div>
          </div>

          {/* Button Sizes */}
          <div className="space-y-toy">
            <h2 className="text-2xl font-semibold text-gray-900">Button Sizes</h2>
            <div className="flex flex-wrap items-center gap-collar">
              <BrandedButton size="sm">Small</BrandedButton>
              <BrandedButton size="default">Default</BrandedButton>
              <BrandedButton size="lg">Large</BrandedButton>
              <BrandedButton size="xl">Extra Large</BrandedButton>
              <BrandedButton size="icon">
                <Heart className="h-4 w-4" />
              </BrandedButton>
            </div>
          </div>

          {/* Button States */}
          <div className="space-y-toy">
            <h2 className="text-2xl font-semibold text-gray-900">Button States</h2>
            <div className="flex flex-wrap gap-collar">
              <BrandedButton>Normal State</BrandedButton>
              <BrandedButton loading>Loading State</BrandedButton>
              <BrandedButton disabled>Disabled State</BrandedButton>
            </div>
          </div>

          {/* Buttons with Icons */}
          <div className="space-y-toy">
            <h2 className="text-2xl font-semibold text-gray-900">Buttons with Icons</h2>
            <div className="flex flex-wrap gap-collar">
              <BrandedButton leftIcon={<Heart className="h-4 w-4" />}>
                Like Portrait
              </BrandedButton>
              <BrandedButton rightIcon={<ArrowRight className="h-4 w-4" />}>
                Get Started
              </BrandedButton>
              <BrandedButton 
                variant="secondary" 
                leftIcon={<ShoppingCart className="h-4 w-4" />}
              >
                Add to Cart
              </BrandedButton>
              <BrandedButton 
                variant="tertiary" 
                rightIcon={<Download className="h-4 w-4" />}
              >
                Download
              </BrandedButton>
            </div>
          </div>

          {/* Animated Buttons */}
          <div className="space-y-toy">
            <h2 className="text-2xl font-semibold text-gray-900">Animated Buttons</h2>
            <div className="flex flex-wrap gap-collar">
              <BrandedButton animation="gentle">Gentle Bounce</BrandedButton>
              <BrandedButton animation="wiggle" variant="secondary">Playful Wiggle</BrandedButton>
              <BrandedButton animation="treat" variant="tertiary">Treat Drop</BrandedButton>
            </div>
          </div>

          {/* Mobile-Friendly Touch Targets */}
          <div className="space-y-toy">
            <h2 className="text-2xl font-semibold text-gray-900">Mobile-Friendly Touch Targets</h2>
            <p className="text-sm text-gray-600">All buttons meet 44px minimum touch target for accessibility</p>
            <div className="flex flex-wrap gap-collar">
              <BrandedButton size="sm">Small (44px min)</BrandedButton>
              <BrandedButton>Default (44px min)</BrandedButton>
              <BrandedButton size="lg">Large (48px min)</BrandedButton>
            </div>
          </div>

          {/* Real Use Cases */}
          <div className="space-y-toy">
            <h2 className="text-2xl font-semibold text-gray-900">Real Use Cases</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-collar">
              <div className="space-y-treat">
                <h3 className="font-medium">Pet Portrait Actions</h3>
                <div className="flex gap-treat">
                  <BrandedButton 
                    size="sm" 
                    leftIcon={<Heart className="h-4 w-4" />}
                    variant="ghost"
                  >
                    Like
                  </BrandedButton>
                  <BrandedButton 
                    size="sm"
                    leftIcon={<Star className="h-4 w-4" />}
                    variant="outline"
                  >
                    Favorite
                  </BrandedButton>
                  <BrandedButton 
                    size="sm"
                    leftIcon={<ShoppingCart className="h-4 w-4" />}
                  >
                    Add to Cart
                  </BrandedButton>
                </div>
              </div>
              
              <div className="space-y-treat">
                <h3 className="font-medium">Primary Actions</h3>
                <div className="flex gap-treat">
                  <BrandedButton 
                    size="lg"
                    rightIcon={<Plus className="h-4 w-4" />}
                    animation="gentle"
                  >
                    Create Portrait
                  </BrandedButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}