'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';

interface HeroImage {
  public_id: string;
  url: string;
  thumbnail: string;
  alt: string;
  created_at: string;
}

interface APIResponse {
  images: HeroImage[];
  total: number;
  error?: string;
}

export default function TestHeroAPIPage() {
  const [apiResponse, setApiResponse] = useState<APIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [cloudinaryConfig, setCloudinaryConfig] = useState<any>(null);

  const fetchHeroImages = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/hero-images');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      setApiResponse(data);
    } catch (err) {
      console.error('API Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const checkCloudinaryConfig = async () => {
    try {
      const response = await fetch('/api/debug/cloudinary-config');
      if (response.ok) {
        const data = await response.json();
        setCloudinaryConfig(data);
      }
    } catch (err) {
      console.error('Config check failed:', err);
    }
  };

  useEffect(() => {
    fetchHeroImages();
    checkCloudinaryConfig();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Hero Images API Test
          </h1>
          <p className="text-gray-600 mb-4">
            Testing the /api/hero-images endpoint to fetch images from Cloudinary /pawtraits/heros folder
          </p>
          
          <Button 
            onClick={fetchHeroImages} 
            disabled={loading}
            className="mb-6"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh API Call
          </Button>
        </div>

        {/* Cloudinary Configuration Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Cloudinary Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cloudinaryConfig ? (
              <div className="space-y-2">
                <p><strong>Cloud Name:</strong> {cloudinaryConfig.cloud_name ? '✅ Configured' : '❌ Missing'}</p>
                <p><strong>API Key:</strong> {cloudinaryConfig.api_key ? '✅ Configured' : '❌ Missing'}</p>
                <p><strong>API Secret:</strong> {cloudinaryConfig.api_secret ? '✅ Configured' : '❌ Missing'}</p>
              </div>
            ) : (
              <p className="text-gray-500">Loading configuration status...</p>
            )}
          </CardContent>
        </Card>

        {/* API Response Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {error ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              API Response Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <div className="flex items-center gap-2 text-blue-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-red-800 font-semibold mb-2">Error</h3>
                <p className="text-red-700">{error}</p>
              </div>
            )}
            
            {apiResponse && !error && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-green-800 font-semibold mb-2">Success</h3>
                <p className="text-green-700">
                  Found {apiResponse.total} hero images
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Raw API Response */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Raw API Response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-sm">
              {apiResponse ? JSON.stringify(apiResponse, null, 2) : 'No response yet'}
            </pre>
          </CardContent>
        </Card>

        {/* Image Gallery */}
        {apiResponse && apiResponse.images && apiResponse.images.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Hero Images ({apiResponse.images.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apiResponse.images.map((image, index) => (
                  <div key={image.public_id} className="border rounded-lg overflow-hidden">
                    <div className="aspect-video bg-gray-200 relative">
                      <img
                        src={image.thumbnail}
                        alt={image.alt}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Failed to load thumbnail:', image.thumbnail);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                        {index + 1}
                      </div>
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-sm mb-1">{image.alt}</h3>
                      <p className="text-xs text-gray-600 mb-2">ID: {image.public_id}</p>
                      <p className="text-xs text-gray-500">
                        Created: {new Date(image.created_at).toLocaleDateString()}
                      </p>
                      <div className="mt-2 space-y-1">
                        <a 
                          href={image.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline block"
                        >
                          Full Image →
                        </a>
                        <a 
                          href={image.thumbnail} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline block"
                        >
                          Thumbnail →
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Debug Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Check Cloudinary Setup</h3>
              <p className="text-sm text-gray-600 mb-2">
                Make sure you have the following environment variables set:
              </p>
              <ul className="text-xs text-gray-500 space-y-1 ml-4">
                <li>• CLOUDINARY_CLOUD_NAME</li>
                <li>• CLOUDINARY_API_KEY</li>
                <li>• CLOUDINARY_API_SECRET</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">2. Upload Hero Images</h3>
              <p className="text-sm text-gray-600">
                Upload images to your Cloudinary account in the folder: <code className="bg-gray-100 px-1 rounded">pawtraits/heros/</code>
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">3. API Endpoint</h3>
              <p className="text-sm text-gray-600">
                Direct API URL: <code className="bg-gray-100 px-1 rounded">/api/hero-images</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}