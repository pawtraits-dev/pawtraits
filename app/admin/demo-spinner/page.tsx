'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PawSpinner, PawSpinnerWithText, PawLoadingOverlay } from '@/components/ui/paw-spinner';
import Image from 'next/image';
import { useState } from 'react';

export default function SpinnerDemoPage() {
  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">PawSpinner Demo</h1>
        <p className="text-gray-600 mt-2">Custom paw logo spinner with pause-and-spin animation</p>
        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            ✨ <strong>New Animation:</strong> Each spinner does a full 360° rotation, then pauses for 75% of the cycle before spinning again. This creates a distinctive, attention-grabbing pattern that's more interesting than continuous spinning.
          </p>
        </div>
      </div>

      {/* Sizes */}
      <Card>
        <CardHeader>
          <CardTitle>Sizes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-8 items-center">
            <div className="text-center space-y-2">
              <PawSpinner size="sm" />
              <p className="text-sm text-gray-600">Small (16px)</p>
            </div>
            <div className="text-center space-y-2">
              <PawSpinner size="md" />
              <p className="text-sm text-gray-600">Medium (24px)</p>
            </div>
            <div className="text-center space-y-2">
              <PawSpinner size="lg" />
              <p className="text-sm text-gray-600">Large (32px)</p>
            </div>
            <div className="text-center space-y-2">
              <PawSpinner size="xl" />
              <p className="text-sm text-gray-600">Extra Large (48px)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Animation Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Animation Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-8 items-center">
            <div className="text-center space-y-3 p-4 border-2 border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900">New: Pause-and-Spin</h3>
              <PawSpinner size="xl" speed="normal" />
              <p className="text-sm text-gray-600">
                Spins 360°, then pauses for 75% of cycle.<br/>
                More attention-grabbing and distinctive.
              </p>
            </div>
            <div className="text-center space-y-3 p-4 border-2 border-gray-200 rounded-lg">
              <h3 className="font-medium text-gray-900">Old: Continuous Spin</h3>
              <div className="w-12 h-12 animate-spin mx-auto">
                <Image
                  src="/assets/logos/paw-svgrepo-200x200-gold.svg"
                  alt="Continuous spin"
                  width={48}
                  height={48}
                  className="w-full h-full filter drop-shadow-sm"
                />
              </div>
              <p className="text-sm text-gray-600">
                Continuous rotation.<br/>
                Standard but less distinctive.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Speeds */}
      <Card>
        <CardHeader>
          <CardTitle>Animation Speeds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-8 items-center">
            <div className="text-center space-y-2">
              <PawSpinner size="lg" speed="slow" />
              <p className="text-sm text-gray-600">Slow (4s cycle: spin + 3s pause)</p>
            </div>
            <div className="text-center space-y-2">
              <PawSpinner size="lg" speed="normal" />
              <p className="text-sm text-gray-600">Normal (3s cycle: spin + 2.25s pause)</p>
            </div>
            <div className="text-center space-y-2">
              <PawSpinner size="lg" speed="fast" />
              <p className="text-sm text-gray-600">Fast (2s cycle: spin + 1.5s pause)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* With Text */}
      <Card>
        <CardHeader>
          <CardTitle>Spinner with Text</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-8">
            <div className="text-center">
              <PawSpinnerWithText 
                size="md" 
                text="Loading countries..." 
                speed="normal"
              />
            </div>
            <div className="text-center">
              <PawSpinnerWithText 
                size="lg" 
                text="Fetching Gelato pricing..." 
                speed="slow"
                textClassName="text-blue-600"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inline Usage Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Inline Usage Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded">
              <PawSpinner size="sm" />
              <span className="text-blue-800">Fetching Gelato pricing...</span>
            </div>
            
            <div className="flex items-center justify-center space-x-2 p-4 border-2 border-dashed border-gray-300 rounded">
              <PawSpinner size="md" speed="slow" />
              <span className="text-gray-600">Loading products...</span>
            </div>

            <Button disabled className="flex items-center space-x-2">
              <PawSpinner size="sm" speed="fast" />
              <span>Processing...</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Full Page Overlay */}
      <Card>
        <CardHeader>
          <CardTitle>Full Page Loading Overlay</CardTitle>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => {
              setShowOverlay(true);
              setTimeout(() => setShowOverlay(false), 3000);
            }}
            className="bg-gradient-to-r from-purple-600 to-blue-600"
          >
            Show Loading Overlay (3 seconds)
          </Button>
          <p className="text-sm text-gray-600 mt-2">
            This will show a full-screen loading overlay for 3 seconds
          </p>
        </CardContent>
      </Card>

      {/* Usage Code Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-gray-100 p-4 rounded font-mono text-sm">
              <div className="text-gray-800 mb-2">Basic spinner:</div>
              <code>{`<PawSpinner size="md" speed="normal" />`}</code>
            </div>
            
            <div className="bg-gray-100 p-4 rounded font-mono text-sm">
              <div className="text-gray-800 mb-2">Spinner with text:</div>
              <code>{`<PawSpinnerWithText text="Loading..." size="lg" />`}</code>
            </div>
            
            <div className="bg-gray-100 p-4 rounded font-mono text-sm">
              <div className="text-gray-800 mb-2">Inline with content:</div>
              <code>{`{loading && <PawSpinner size="sm" className="mr-2" />}`}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {showOverlay && (
        <PawLoadingOverlay text="Processing your request..." />
      )}
    </div>
  );
}