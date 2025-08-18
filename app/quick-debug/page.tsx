'use client';

import { useState, useEffect } from 'react';
import { SupabaseService } from '@/lib/supabase';

export default function QuickDebugPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const testDatabase = async () => {
      try {
        const supabaseService = new SupabaseService();
        
        // Test 1: Direct database query for all images
        const { data: allImages, error: allError } = await supabaseService.getClient()
          .from('image_catalog')
          .select('id, filename, is_public, is_featured, created_at, breed_id, theme_id')
          .order('created_at', { ascending: false })
          .limit(10);

        // Test 2: Public images only
        const { data: publicImages, error: publicError } = await supabaseService.getClient()
          .from('image_catalog')
          .select('id, filename, is_public, is_featured, created_at')
          .eq('is_public', true)
          .limit(10);

        // Test 3: Use service method
        let serviceImages = [];
        let serviceError = null;
        try {
          const result = await supabaseService.getImages({
            limit: 5,
            publicOnly: true
          });
          serviceImages = result.images || result || [];
        } catch (err: any) {
          serviceError = err.message;
        }

        // Test 4: Check specific beagle image if it exists
        const { data: beagleImages, error: beagleError } = await supabaseService.getClient()
          .from('image_catalog')
          .select('id, filename, is_public, tags, breed_id')
          .or('tags.cs.{beagle},filename.ilike.%beagle%')
          .limit(5);

        setResults({
          allImages: { data: allImages, error: allError?.message },
          publicImages: { data: publicImages, error: publicError?.message },
          serviceImages: { data: serviceImages, error: serviceError },
          beagleImages: { data: beagleImages, error: beagleError?.message },
          counts: {
            total: allImages?.length || 0,
            public: publicImages?.length || 0,
            service: Array.isArray(serviceImages) ? serviceImages.length : 0,
            beagle: beagleImages?.length || 0
          }
        });
      } catch (error: any) {
        setResults({ error: error.message });
      } finally {
        setLoading(false);
      }
    };

    testDatabase();
  }, []);

  if (loading) {
    return <div className="p-8">Loading database test...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Quick Database Debug</h1>
      
      {results.error ? (
        <div className="bg-red-100 p-4 rounded text-red-800">
          <h2 className="font-semibold">Error:</h2>
          <pre>{results.error}</pre>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-blue-100 p-4 rounded">
            <h2 className="font-semibold mb-2">Counts Summary:</h2>
            <ul className="list-disc ml-6">
              <li>Total Images: {results.counts.total}</li>
              <li>Public Images: {results.counts.public}</li>
              <li>Service Method Images: {results.counts.service}</li>
              <li>Beagle Images: {results.counts.beagle}</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-100 p-4 rounded">
              <h3 className="font-semibold mb-2">All Images (Direct Query):</h3>
              {results.allImages.error ? (
                <p className="text-red-600">Error: {results.allImages.error}</p>
              ) : (
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify(results.allImages.data, null, 2)}
                </pre>
              )}
            </div>

            <div className="bg-gray-100 p-4 rounded">
              <h3 className="font-semibold mb-2">Public Images Only:</h3>
              {results.publicImages.error ? (
                <p className="text-red-600">Error: {results.publicImages.error}</p>
              ) : (
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify(results.publicImages.data, null, 2)}
                </pre>
              )}
            </div>

            <div className="bg-gray-100 p-4 rounded">
              <h3 className="font-semibold mb-2">Service Method Result:</h3>
              {results.serviceImages.error ? (
                <p className="text-red-600">Error: {results.serviceImages.error}</p>
              ) : (
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify(results.serviceImages.data, null, 2)}
                </pre>
              )}
            </div>

            <div className="bg-gray-100 p-4 rounded">
              <h3 className="font-semibold mb-2">Beagle Images:</h3>
              {results.beagleImages.error ? (
                <p className="text-red-600">Error: {results.beagleImages.error}</p>
              ) : (
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify(results.beagleImages.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}