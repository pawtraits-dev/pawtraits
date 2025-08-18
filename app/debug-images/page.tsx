'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DebugImagesPage() {
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState('/api/images?public=true');

  const testApiCall = async (url: string) => {
    setLoading(true);
    setError(null);
    setApiResponse(null);
    
    try {
      console.log('Testing API endpoint:', url);
      const response = await fetch(url);
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        setApiResponse(data);
      } else {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        setError(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`Network Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testApiCall(endpoint);
  }, []);

  const endpoints = [
    '/api/images?public=true',
    '/api/images?public=true&limit=5',
    '/api/images',
    '/api/images?limit=10',
    '/api/debug/images'
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Debug Images API</h1>
        <p className="text-gray-600 mb-4">Testing different API endpoints to debug image loading issues.</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {endpoints.map((ep) => (
            <Button
              key={ep}
              variant={endpoint === ep ? "default" : "outline"}
              onClick={() => {
                setEndpoint(ep);
                testApiCall(ep);
              }}
              size="sm"
            >
              {ep}
            </Button>
          ))}
        </div>
        
        <Button 
          onClick={() => testApiCall(endpoint)} 
          disabled={loading}
          className="mb-4"
        >
          {loading ? 'Testing...' : 'Test Current Endpoint'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request Info */}
        <Card>
          <CardHeader>
            <CardTitle>Request Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>Endpoint:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{endpoint}</code>
              </div>
              <div>
                <strong>Status:</strong> 
                <Badge className="ml-2" variant={loading ? "secondary" : error ? "destructive" : "default"}>
                  {loading ? 'Loading...' : error ? 'Error' : 'Success'}
                </Badge>
              </div>
              <div>
                <strong>Timestamp:</strong> {new Date().toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Response Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-red-600">
                <strong>Error:</strong>
                <pre className="bg-red-50 p-3 rounded mt-2 text-sm overflow-auto">{error}</pre>
              </div>
            ) : apiResponse ? (
              <div className="space-y-2">
                <div>
                  <strong>Images Count:</strong> {apiResponse.images?.length || 0}
                </div>
                <div>
                  <strong>Total Pages:</strong> {apiResponse.total_pages || 'N/A'}
                </div>
                <div>
                  <strong>Current Page:</strong> {apiResponse.current_page || 'N/A'}
                </div>
                <div>
                  <strong>Total Count:</strong> {apiResponse.total_count || 'N/A'}
                </div>
                {apiResponse.images?.length > 0 && (
                  <div>
                    <strong>Sample Image ID:</strong> 
                    <code className="bg-gray-100 px-2 py-1 rounded ml-2">
                      {apiResponse.images[0].id}
                    </code>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">No response data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Raw Response */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Raw API Response</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <pre className="bg-red-50 p-4 rounded text-sm overflow-auto max-h-96 text-red-600">{error}</pre>
          ) : apiResponse ? (
            <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(apiResponse, null, 2)}
            </pre>
          ) : (
            <div className="text-gray-500">No response data</div>
          )}
        </CardContent>
      </Card>

      {/* Images Preview */}
      {apiResponse?.images?.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Images Preview ({apiResponse.images.length} images)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apiResponse.images.slice(0, 6).map((image: any, index: number) => (
                <div key={image.id || index} className="border rounded-lg p-3 space-y-2">
                  <div className="text-sm space-y-1">
                    <div><strong>ID:</strong> {image.id}</div>
                    <div><strong>Filename:</strong> {image.filename}</div>
                    <div><strong>Public:</strong> {image.is_public ? 'Yes' : 'No'}</div>
                    <div><strong>Featured:</strong> {image.is_featured ? 'Yes' : 'No'}</div>
                    {image.breed_name && <div><strong>Breed:</strong> {image.breed_name}</div>}
                    {image.theme_name && <div><strong>Theme:</strong> {image.theme_name}</div>}
                  </div>
                  {image.public_url && (
                    <div>
                      <strong>Image URL:</strong>
                      <div className="text-xs text-gray-600 break-all">{image.public_url}</div>
                      <img 
                        src={image.public_url} 
                        alt={image.prompt_text || 'Image'} 
                        className="w-full h-32 object-cover rounded mt-2"
                        onError={(e) => {
                          console.error('Image failed to load:', image.public_url);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}