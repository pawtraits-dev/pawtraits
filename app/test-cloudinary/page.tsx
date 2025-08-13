'use client';

import { useState } from 'react';

export default function TestCloudinaryPage() {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      console.log('🔍 Running Cloudinary diagnostics...');
      const response = await fetch('/api/test-cloudinary');
      const data = await response.json();
      
      console.log('Diagnostic results:', data);
      setResults(data);
      
    } catch (error) {
      console.error('Diagnostic test failed:', error);
      setResults({ error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown' });
    } finally {
      setLoading(false);
    }
  };

  const testSignature = async () => {
    setLoading(true);
    try {
      console.log('🔐 Testing signature generation...');
      const response = await fetch('/api/test-cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'pawtraits/originals' })
      });
      
      const signatureData = await response.json();
      console.log('Signature test results:', signatureData);
      
      // Now test the signature with a direct Cloudinary upload
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9RGG5VwAAAABJRU5ErkJggg==';
      const testFile = new File([
        Uint8Array.from(atob(testImageBase64), c => c.charCodeAt(0))
      ], 'test.png', { type: 'image/png' });
      
      console.log('🧪 Testing direct upload with generated signature...');
      
      const formData = new FormData();
      formData.append('file', testFile);
      formData.append('signature', signatureData.signature);
      formData.append('timestamp', signatureData.timestamp.toString());
      formData.append('api_key', signatureData.api_key);
      formData.append('folder', signatureData.folder);
      formData.append('resource_type', signatureData.resource_type);
      
      console.log('FormData contents:');
      for (const [key, value] of formData.entries()) {
        if (key === 'file') {
          console.log(`  ${key}: File(${(value as File).name}, ${(value as File).size} bytes)`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      }
      
      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloud_name}/image/upload`;
      console.log(`Uploading to: ${cloudinaryUrl}`);
      
      const uploadResponse = await fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData
      });
      
      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        console.log('✅ Direct upload successful!', uploadResult);
        
        setResults({
          signature_test: signatureData,
          upload_test: {
            success: true,
            result: uploadResult
          }
        });
      } else {
        const errorText = await uploadResponse.text();
        console.error('❌ Direct upload failed:', uploadResponse.status, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        setResults({
          signature_test: signatureData,
          upload_test: {
            success: false,
            status: uploadResponse.status,
            error: errorData,
            raw_error: errorText
          }
        });
      }
      
    } catch (error) {
      console.error('Signature test failed:', error);
      setResults({ error: 'Signature test failed', details: error instanceof Error ? error.message : 'Unknown' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Cloudinary Upload Diagnostics
          </h1>
          
          <div className="space-y-4 mb-8">
            <button
              onClick={runDiagnostics}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Running...' : 'Run Basic Diagnostics'}
            </button>
            
            <button
              onClick={testSignature}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 ml-4"
            >
              {loading ? 'Testing...' : 'Test Signature & Upload'}
            </button>
          </div>
          
          {results && (
            <div className="bg-gray-100 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Test Results:</h2>
              <pre className="text-sm overflow-auto bg-white p-4 rounded border">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="mt-8 text-sm text-gray-600">
            <h3 className="font-semibold mb-2">What this test does:</h3>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Basic Diagnostics:</strong> Checks environment variables, connection, and signature generation</li>
              <li><strong>Signature Test:</strong> Generates a signature and tests direct upload to Cloudinary</li>
              <li><strong>Error Analysis:</strong> Shows detailed error messages and signature comparison</li>
              <li><strong>Parameter Validation:</strong> Verifies exact parameters sent to Cloudinary API</li>
            </ul>
            
            <h3 className="font-semibold mt-4 mb-2">Check browser console for detailed logs!</h3>
          </div>
        </div>
      </div>
    </div>
  );
}