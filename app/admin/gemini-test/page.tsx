'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Play, AlertCircle, CheckCircle, Copy } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';
import type { ImageCatalogWithDetails } from '@/lib/types';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'success' | 'warning';
  message: string;
  data?: any;
}

export default function GeminiTestPage() {
  const [selectedImage, setSelectedImage] = useState<ImageCatalogWithDetails | null>(null);
  const [images, setImages] = useState<ImageCatalogWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');

  const supabaseService = new SupabaseService();

  const addLog = (level: LogEntry['level'], message: string, data?: any) => {
    const logEntry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    };
    setLogs(prev => [...prev, logEntry]);
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
  };

  useEffect(() => {
    loadRecentImages();
  }, []);

  const loadRecentImages = async () => {
    try {
      setLoading(true);
      addLog('info', 'Loading recent images from catalog...');
      
      const imageData = await supabaseService.getImages({
        page: 1,
        limit: 10,
        publicOnly: false
      });
      
      setImages(imageData);
      addLog('success', `Loaded ${imageData.length} images`);
      
      // Find the most recent corgi image
      const corgiImage = imageData.find(img => 
        img.breed_name?.toLowerCase().includes('corgi') ||
        img.description?.toLowerCase().includes('corgi')
      );
      
      if (corgiImage) {
        setSelectedImage(corgiImage);
        addLog('success', `Found corgi image: ${corgiImage.description}`, corgiImage);
      } else {
        // Use the most recent image
        setSelectedImage(imageData[0] || null);
        addLog('info', `Using most recent image: ${imageData[0]?.description}`, imageData[0]);
      }
      
    } catch (error) {
      addLog('error', 'Failed to load images', error);
    } finally {
      setLoading(false);
    }
  };

  const testGeminiCall = async () => {
    if (!selectedImage) {
      addLog('error', 'No image selected');
      return;
    }

    setIsGenerating(true);
    setResult(null);
    addLog('info', '🚀 Starting Gemini API test...');
    
    try {
      // Step 1: Get image data
      addLog('info', 'Step 1: Fetching image data from URL', { url: selectedImage.public_url });
      const imageResponse = await fetch(selectedImage.public_url || '');
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      
      const imageBlob = await imageResponse.blob();
      const imageSize = Math.round(imageBlob.size / 1024);
      addLog('success', `Image fetched successfully: ${imageSize}KB`);
      
      // Step 2: Convert to base64
      addLog('info', 'Step 2: Converting image to base64...');
      const imageData64 = await blobToBase64(imageBlob);
      const base64Size = Math.round((imageData64.length * 3) / 4 / 1024);
      addLog('success', `Base64 conversion complete: ${base64Size}KB`);

      // Step 3: Prepare test request
      addLog('info', 'Step 3: Preparing Gemini test request', {
        originalPrompt: selectedImage.prompt_text,
        testType: 'border_collie_coats'
      });

      // Step 4: Make API call to dedicated test endpoint
      addLog('info', 'Step 4: Calling Gemini test API...');
      const requestBody = {
        originalImageData: imageData64,
        originalPrompt: selectedImage.prompt_text,
        testType: 'border_collie_coats'
      };
      
      const response = await fetch('/api/admin/gemini-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      addLog('info', `API response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        addLog('error', `API call failed: ${response.status}`, errorData);
        throw new Error(`API call failed: ${response.status} - ${errorData.error || errorText}`);
      }
      
      // Step 5: Process response
      const testResults = await response.json();
      
      if (testResults.success) {
        const { summary, results, metadata } = testResults;
        addLog('success', `✅ Test completed! ${summary.successCount}/${summary.totalAttempts} variations generated`, summary);
        addLog('info', 'Available coat colors for Border Collie', summary.availableCoats);
        
        // Process results for display
        const displayResults = results.filter((r: any) => !r.error);
        const errors = results.filter((r: any) => r.error);
        
        if (errors.length > 0) {
          errors.forEach((error: any) => {
            addLog('error', `Failed: ${error.breed} with ${error.coat}`, error.errorMessage);
          });
        }
        
        setResult({
          summary,
          variations: displayResults,
          metadata,
          errors
        });
      } else {
        addLog('error', 'Test failed', testResults);
        setResult({ error: testResults.error, details: testResults.details });
      }
      
    } catch (error) {
      addLog('error', `❌ Gemini test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
    } finally {
      setIsGenerating(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const clearLogs = () => {
    setLogs([]);
    setResult(null);
  };

  const copyLogs = () => {
    const logsText = logs.map(log => 
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n\n');
    
    navigator.clipboard.writeText(logsText);
    addLog('info', 'Logs copied to clipboard');
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'success': return 'text-green-600 bg-green-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'success': return <CheckCircle className="w-4 h-4" />;
      default: return <RefreshCw className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">🧪 Gemini API Test Lab</h1>
            <p className="text-lg text-gray-600 mt-2">
              Debug Gemini variant generation with comprehensive logging
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={clearLogs} variant="outline" size="sm">
              Clear Logs
            </Button>
            <Button onClick={copyLogs} variant="outline" size="sm">
              <Copy className="w-4 h-4 mr-2" />
              Copy Logs
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Image Selection & Test Controls */}
          <div className="space-y-6">
            {/* Selected Image */}
            <Card>
              <CardHeader>
                <CardTitle>Selected Test Image</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-48">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : selectedImage ? (
                  <div className="space-y-4">
                    <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: selectedImage.format_aspect_ratio || '1:1' }}>
                      <img
                        src={selectedImage.public_url}
                        alt={selectedImage.description || 'Test image'}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {selectedImage.breed_name && (
                          <Badge variant="outline">
                            🐕 {selectedImage.breed_name}
                          </Badge>
                        )}
                        {selectedImage.theme_name && (
                          <Badge variant="outline">
                            🎨 {selectedImage.theme_name}
                          </Badge>
                        )}
                        {selectedImage.style_name && (
                          <Badge variant="outline">
                            ✨ {selectedImage.style_name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {selectedImage.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No image selected</p>
                )}
              </CardContent>
            </Card>

            {/* Test Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Test Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Test Scenario</label>
                  <p className="text-sm text-gray-600 mb-4">
                    Generate Border Collie coat variations from the selected image
                  </p>
                  <div className="bg-blue-50 p-3 rounded-lg text-sm">
                    <p className="font-medium text-blue-800">Will generate:</p>
                    <ul className="mt-1 text-blue-700">
                      <li>• Border Collie with Black & White coat</li>
                      <li>• Border Collie with Blue Merle coat</li>
                      <li>• Border Collie with Red coat</li>
                    </ul>
                  </div>
                </div>

                <Button 
                  onClick={testGeminiCall}
                  disabled={!selectedImage || isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Testing Gemini API...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Gemini Test
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Summary */}
                    {result.summary && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="font-medium text-blue-800">
                          {result.summary.successCount}/{result.summary.totalAttempts} variations generated successfully
                        </p>
                        <p className="text-sm text-blue-600 mt-1">
                          Breed: {result.summary.breed}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Available coats: {result.summary.availableCoats?.join(', ')}
                        </p>
                      </div>
                    )}
                    
                    {/* Error Display */}
                    {result.error && (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="font-medium text-red-800">Test Failed</p>
                        <p className="text-sm text-red-600">{result.error}</p>
                        {result.details && (
                          <p className="text-xs text-red-500 mt-2">{result.details}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Variations */}
                    {result.variations && result.variations.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium">
                          Generated Variations:
                        </p>
                        {result.variations.map((variation: any, index: number) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex gap-3">
                              <div className="w-16 h-16 bg-gray-200 rounded flex-shrink-0">
                                {variation.imageData && (
                                  <img
                                    src={`data:image/png;base64,${variation.imageData}`}
                                    alt={`Variation ${index + 1}`}
                                    className="w-full h-full object-contain rounded"
                                  />
                                )}
                              </div>
                              <div className="flex-1 text-sm space-y-1">
                                <p className="font-medium">{variation.variation_type || 'Breed Variation'}</p>
                                {variation.metadata?.breed?.name && <p>Breed: {variation.metadata.breed.name}</p>}
                                {variation.metadata?.coat?.coat_name && <p>Coat: {variation.metadata.coat.coat_name}</p>}
                                {variation.testInfo && (
                                  <p className="text-xs text-gray-500">
                                    Test {variation.testInfo.coatIndex}/{variation.testInfo.totalCoats} - {new Date(variation.testInfo.timestamp).toLocaleTimeString()}
                                  </p>
                                )}
                                {variation.metadata && (
                                  <details className="mt-2">
                                    <summary className="cursor-pointer text-xs text-gray-500">
                                      Show metadata
                                    </summary>
                                    <pre className="text-xs bg-gray-50 p-2 mt-1 rounded overflow-auto max-h-32">
                                      {JSON.stringify(variation.metadata, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Errors */}
                    {result.errors && result.errors.length > 0 && (
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="font-medium text-red-800 mb-2">Errors ({result.errors.length}):</p>
                        {result.errors.map((error: any, index: number) => (
                          <div key={index} className="text-sm text-red-600 mb-1">
                            • {error.breed} with {error.coat}: {error.errorMessage}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Logs */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Execution Logs
                  <Badge variant="outline">{logs.length} entries</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      No logs yet. Run a test to see detailed execution logs.
                    </p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className={`p-3 rounded-lg text-sm ${getLevelColor(log.level)}`}>
                        <div className="flex items-start gap-2">
                          {getLevelIcon(log.level)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs opacity-75">
                                {log.timestamp}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {log.level}
                              </Badge>
                            </div>
                            <p className="font-medium">{log.message}</p>
                            {log.data && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs opacity-75">
                                  Show data
                                </summary>
                                <pre className="text-xs mt-1 p-2 bg-black bg-opacity-10 rounded overflow-auto">
                                  {JSON.stringify(log.data, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Environment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-700">API Endpoints</p>
                <p className="text-gray-600">/api/admin/generate-variations</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Gemini Model</p>
                <p className="text-gray-600">gemini-2.5-flash-image-preview</p>
              </div>
              <div>
                <p className="font-medium text-gray-700">Environment</p>
                <p className="text-gray-600">{process.env.NODE_ENV || 'development'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}