'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Copy, Eye, Loader, ExternalLink } from 'lucide-react';

interface TestResult {
  variant: string;
  url: string;
  status: 'loading' | 'success' | 'error';
  loadTime?: number;
  errorMessage?: string;
}

interface CloudinaryVariantsTestProps {
  publicId: string;
  filename: string;
}

export default function CloudinaryVariantsTest({ publicId, filename }: CloudinaryVariantsTestProps) {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const variants = [
    { name: 'original', description: 'Original image (no transformations)', showInGrid: true },
    { name: 'full_size', description: 'Full size with watermark (1200px)', showInGrid: true },
    { name: 'mid_size', description: 'Mid size (400px, no watermark)', showInGrid: true },
    { name: 'thumbnail', description: 'Thumbnail (150x150px)', showInGrid: true }
  ];

  const testVariant = async (variant: string, publicId: string): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      let url: string;
      
      if (variant === 'original') {
        // Original image URL without transformations
        url = `https://res.cloudinary.com/dnhzfz8xv/image/upload/${publicId}`;
      } else {
        // Get variant URL from our API
        const response = await fetch('/api/cloudinary/test-variant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId, variant })
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        url = data.url;
      }
      
      // Test if image loads
      const img = new Image();
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            variant,
            url,
            status: 'error',
            loadTime: Date.now() - startTime,
            errorMessage: 'Image load timeout (10s)'
          });
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          const loadTime = Date.now() - startTime;
          resolve({
            variant,
            url,
            status: 'success',
            loadTime
          });
        };
        
        img.onerror = () => {
          clearTimeout(timeout);
          const loadTime = Date.now() - startTime;
          resolve({
            variant,
            url,
            status: 'error',
            loadTime,
            errorMessage: 'Image failed to load (404 or network error)'
          });
        };
        
        img.src = url;
      });
      
    } catch (error) {
      const loadTime = Date.now() - startTime;
      return {
        variant,
        url: '',
        status: 'error',
        loadTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  const runTests = async () => {
    setTesting(true);
    setTestResults([]);
    
    console.log(`🧪 Testing Cloudinary variants for: ${publicId}`);
    
    const results: TestResult[] = [];
    
    // Test each variant
    for (const variant of variants) {
      console.log(`🔍 Testing variant: ${variant.name}`);
      
      // Update results with loading state
      const loadingResult: TestResult = {
        variant: variant.name,
        url: '',
        status: 'loading'
      };
      results.push(loadingResult);
      setTestResults([...results]);
      
      // Test the variant
      const result = await testVariant(variant.name, publicId);
      
      // Update result
      results[results.length - 1] = result;
      setTestResults([...results]);
      
      console.log(`${result.status === 'success' ? '✅' : '❌'} ${variant.name}: ${result.status} (${result.loadTime}ms)`);
    }
    
    setTesting(false);
    console.log('🏁 Variant testing complete');
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const openInNewTab = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => setIsOpen(true)}
        >
          <Eye className="w-4 h-4 mr-2" />
          View Variants
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Eye className="w-5 h-5" />
            <span>Cloudinary Variants Test</span>
          </DialogTitle>
          <div className="text-sm text-gray-600">
            <div className="font-mono bg-gray-100 p-2 rounded text-xs mb-2">
              {publicId}
            </div>
            <div>Testing all variants for: <strong>{filename}</strong></div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Test Controls */}
          <div className="flex items-center justify-between">
            <Button
              onClick={runTests}
              disabled={testing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {testing ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Test All Variants
                </>
              )}
            </Button>
            
            {testResults.length > 0 && (
              <div className="text-sm text-gray-600">
                {testResults.filter(r => r.status === 'success').length} / {testResults.length} variants working
              </div>
            )}
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {variants.map((variant) => {
                const result = testResults.find(r => r.variant === variant.name);
                
                return (
                  <div key={variant.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{variant.name}</h3>
                        <p className="text-sm text-gray-600">{variant.description}</p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {result?.status === 'loading' && (
                          <Loader className="w-4 h-4 text-blue-500 animate-spin" />
                        )}
                        {result?.status === 'success' && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {result?.status === 'error' && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        
                        {result?.loadTime && (
                          <Badge variant="outline" className="text-xs">
                            {result.loadTime}ms
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {result?.url && (
                      <div className="space-y-3">
                        {result.status === 'success' ? (
                          <div className="relative">
                            <img
                              src={result.url}
                              alt={`${variant.name} variant`}
                              className="w-full max-h-48 object-contain rounded border"
                              loading="lazy"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="absolute top-2 right-2 opacity-80 hover:opacity-100"
                              onClick={() => openInNewTab(result.url)}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                            <div className="text-center text-gray-500">
                              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                              <div className="text-sm">Failed to load</div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={result.url}
                            readOnly
                            className="flex-1 text-xs font-mono bg-gray-50 border rounded px-2 py-1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyUrl(result.url)}
                            title="Copy URL"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        {result.errorMessage && (
                          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            {result.errorMessage}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Expected Behavior:</h4>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• <strong>Original:</strong> Unmodified image from Cloudinary</li>
              <li>• <strong>Full Size:</strong> 1200px max width, watermarked, for detail pages</li>
              <li>• <strong>Mid Size:</strong> 400px max width, no watermark, for catalog cards</li>
              <li>• <strong>Thumbnail:</strong> 150x150px cropped, for lists and grids</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}