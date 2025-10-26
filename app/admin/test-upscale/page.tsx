'use client';

import { useState } from 'react';

export default function TestUpscalePage() {
  const [imageId, setImageId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const testUpscale = async () => {
    if (!imageId.trim()) {
      setError('Please enter an image ID');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/admin/test-upscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: imageId.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Test failed');
        console.error('Test error:', data);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      console.error('Request error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Cloudinary Upscaling Test</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Image ID (from image_catalog or customer_generated_images)
          </label>
          <input
            type="text"
            value={imageId}
            onChange={(e) => setImageId(e.target.value)}
            placeholder="Enter image UUID"
            className="w-full px-4 py-2 border rounded-lg"
            disabled={loading}
          />
        </div>

        <button
          onClick={testUpscale}
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Upscale'}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6">
          {/* Image Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Image Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Image ID:</span> {result.imageId}
              </div>
              <div>
                <span className="font-semibold">Filename:</span> {result.filename}
              </div>
              <div>
                <span className="font-semibold">Cloudinary Public ID:</span> {result.publicId}
              </div>
              <div>
                <span className="font-semibold">Original Dimensions:</span>{' '}
                {result.originalDimensions.width} x {result.originalDimensions.height}
              </div>
              <div>
                <span className="font-semibold">Longest Side:</span> {result.longestSide}px
              </div>
              <div>
                <span className="font-semibold">Upscaling Threshold:</span> {result.upscalingThreshold}px
              </div>
              <div className="col-span-2">
                <span className="font-semibold">Needs Upscaling:</span>{' '}
                <span className={result.needsUpscaling ? 'text-orange-600 font-bold' : 'text-green-600'}>
                  {result.needsUpscaling ? 'YES - Will upscale to 8500px' : 'NO - Already high-res'}
                </span>
              </div>
            </div>
          </div>

          {/* Transformation Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Upscaling Transformation</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">Applied:</span>{' '}
                {result.transformation.applied ? 'YES' : 'NO'}
              </div>
              {result.transformation.applied && (
                <>
                  <div>
                    <span className="font-semibold">Parameters:</span>
                    <pre className="mt-2 p-3 bg-gray-50 rounded border overflow-x-auto">
{JSON.stringify(result.transformation.parameters, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <span className="font-semibold">Expected Upscaled Size:</span>
                    <div className="ml-4 mt-1">
                      <div>{result.expectedUpscaledSize.calculation}</div>
                      <div className="font-mono text-blue-600">
                        {result.expectedUpscaledSize.estimatedDimensions}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Image Comparison */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Image Comparison</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 text-center">Original (Stored)</h3>
                <p className="text-xs text-gray-600 text-center mb-3">
                  {result.originalDimensions.width} x {result.originalDimensions.height}
                </p>
                <div className="relative bg-gray-100 rounded overflow-hidden">
                  <img
                    src={result.urls.publicOriginal}
                    alt="Original"
                    className="w-full h-auto"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      console.log('Original loaded:', img.naturalWidth, 'x', img.naturalHeight);
                    }}
                  />
                </div>
                <div className="mt-2">
                  <a
                    href={result.urls.publicOriginal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline break-all"
                  >
                    Open original URL →
                  </a>
                </div>
              </div>

              {/* Upscaled */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-semibold mb-2 text-center">
                  {result.needsUpscaling ? 'Upscaled (Print Quality)' : 'High-Res (No Upscaling Needed)'}
                </h3>
                <p className="text-xs text-gray-600 text-center mb-3">
                  {result.needsUpscaling
                    ? result.expectedUpscaledSize.estimatedDimensions
                    : `${result.originalDimensions.width} x ${result.originalDimensions.height}`}
                </p>
                <div className="relative bg-gray-100 rounded overflow-hidden">
                  <img
                    src={result.urls.publicUpscaled}
                    alt="Upscaled"
                    className="w-full h-auto"
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      console.log('Upscaled loaded:', img.naturalWidth, 'x', img.naturalHeight);
                      // Show alert with actual dimensions
                      const info = `Upscaled image loaded!\n\nActual dimensions: ${img.naturalWidth} x ${img.naturalHeight}px\n\nExpected: ${result.expectedUpscaledSize.estimatedDimensions}`;
                      console.log(info);
                    }}
                  />
                </div>
                <div className="mt-2">
                  <a
                    href={result.urls.publicUpscaled}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline break-all"
                  >
                    Open upscaled URL →
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm">
                <strong>Tip:</strong> Right-click on the upscaled image and "Open in new tab" or download it
                to verify the actual dimensions. The browser may scale it for display, but the actual file
                should be {result.needsUpscaling ? 'upscaled' : 'at original resolution'}.
              </p>
            </div>
          </div>

          {/* Raw Response */}
          <details className="bg-white rounded-lg shadow p-6">
            <summary className="font-semibold cursor-pointer">View Raw API Response</summary>
            <pre className="mt-4 p-4 bg-gray-50 rounded border overflow-x-auto text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
