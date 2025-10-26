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
            <h2 className="text-xl font-bold mb-4">Upscaling Transformation Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold">Needs Upscaling:</span>{' '}
                <span className={result.transformation.needsUpscaling ? 'text-orange-600' : 'text-green-600'}>
                  {result.transformation.needsUpscaling ? 'YES' : 'NO'}
                </span>
              </div>
              <div>
                <span className="font-semibold">Original Size:</span> {result.transformation.originalSize}
              </div>
              <div>
                <span className="font-semibold">Target Size:</span> {result.transformation.targetSize}
              </div>
              <div>
                <span className="font-semibold">Upscaling Ratio:</span> {result.transformation.upscalingRatio}x
              </div>
              <div className="col-span-2">
                <span className="font-semibold">Estimated Result:</span>{' '}
                <span className="font-mono text-blue-600">{result.transformation.estimatedResult}</span>
              </div>
            </div>

            {result.testing && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-semibold mb-2">{result.testing.instructions}</p>
                <div className="text-xs space-y-1">
                  <div><strong>fit:</strong> {result.testing.cropModes.fit}</div>
                  <div><strong>scale:</strong> {result.testing.cropModes.scale}</div>
                  <div><strong>limit:</strong> {result.testing.cropModes.limit}</div>
                </div>
                <p className="text-xs mt-2 text-blue-700">{result.testing.expectedBehavior}</p>
              </div>
            )}
          </div>

          {/* URL Testing */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">URL Testing Results</h2>

            {/* Original Image */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Original Image (No Transformation)</h3>
              <div className="border rounded p-3 bg-gray-50">
                <img src={result.urls.original} alt="Original" className="max-w-xs mb-2" />
                <a
                  href={result.urls.original}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline break-all block"
                >
                  {result.urls.original}
                </a>
              </div>
            </div>

            {/* Service Print URL */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Current Service Implementation</h3>
              <div className="border rounded p-3 bg-purple-50">
                <a
                  href={result.urls.servicePrintUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline break-all block"
                >
                  {result.urls.servicePrintUrl}
                </a>
                <p className="text-xs text-gray-600 mt-1">
                  Uses: cloudinaryService.getOriginalPrintUrl()
                </p>
              </div>
            </div>

            {/* Upscaled with 'fit' */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Test URLs: crop=&apos;fit&apos; (maintains aspect ratio, allows upscaling)</h3>
              <div className="space-y-3">
                {result.urls.upscaledWithFit?.map((item: any, index: number) => (
                  <div key={index} className="border rounded p-3 bg-green-50">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-mono text-sm font-semibold">{item.size}</span>
                        <span className="text-xs text-gray-600 ml-2">
                          {item.dimensions} ({item.upscaleRatio})
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                      >
                        Test URL →
                      </a>
                    </div>
                    <div className="text-xs text-gray-700 mb-1">{item.printSize}</div>
                    <code className="text-xs break-all block text-gray-500">{item.url}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Upscaled with 'scale' */}
            <div className="mb-6">
              <h3 className="font-semibold mb-2">Test URLs: crop=&apos;scale&apos; (scales to exact size, may distort)</h3>
              <div className="space-y-3">
                {result.urls.upscaledWithScale?.map((item: any, index: number) => (
                  <div key={index} className="border rounded p-3 bg-blue-50">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="font-mono text-sm font-semibold">{item.size}</span>
                        <span className="text-xs text-gray-600 ml-2">
                          {item.dimensions} ({item.upscaleRatio})
                        </span>
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                      >
                        Test URL →
                      </a>
                    </div>
                    <div className="text-xs text-gray-700 mb-1">{item.printSize}</div>
                    <code className="text-xs break-all block text-gray-500">{item.url}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm">
                <strong>Testing Instructions:</strong> Click each "Test this URL" link to open in a new tab.
                If you get a 400 error, that transformation is not supported.
                Right-click working images and select "Open image in new tab" to verify actual dimensions.
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
