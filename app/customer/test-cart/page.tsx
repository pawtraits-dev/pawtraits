'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useServerCart } from '@/lib/server-cart-context';
import { getSupabaseClient } from '@/lib/supabase-client';
import { CheckCircle, XCircle, AlertCircle, Package, Settings, Zap } from 'lucide-react';
import Link from 'next/link';

export default function TestCartPage() {
  const { cart, refreshCart } = useServerCart();
  const [paymentIntentSimulation, setPaymentIntentSimulation] = useState<any>(null);
  const [validationTest, setValidationTest] = useState<any>(null);
  const supabase = getSupabaseClient();

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const simulatePaymentIntentMetadata = () => {
    if (cart.items.length === 0) return null;

    const metadata: Record<string, string> = {
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      cartItemCount: cart.items.length.toString(),
    };

    // Add enhanced cart items to metadata (first 3 items only)
    cart.items.slice(0, 3).forEach((item, index) => {
      metadata[`item${index + 1}_id`] = item.imageId;
      metadata[`item${index + 1}_title`] = item.imageTitle.substring(0, 50);
      metadata[`item${index + 1}_qty`] = item.quantity.toString();
      
      // Enhanced Gelato data
      if (item.gelatoProductUid) {
        metadata[`item${index + 1}_gelato_uid`] = item.gelatoProductUid.substring(0, 100);
      }
      if (item.printSpecs) {
        metadata[`item${index + 1}_width`] = item.printSpecs.width_cm.toString();
        metadata[`item${index + 1}_height`] = item.printSpecs.height_cm.toString();
        metadata[`item${index + 1}_medium`] = item.printSpecs.medium.substring(0, 30);
        metadata[`item${index + 1}_format`] = item.printSpecs.format.substring(0, 30);
      }
    });

    return metadata;
  };

  const simulateWebhookReconstruction = (metadata: Record<string, string>) => {
    const reconstructedItems: any[] = [];
    
    for (let i = 1; i <= 3; i++) {
      const itemId = metadata[`item${i}_id`];
      
      if (itemId) {
        const gelatoUid = metadata[`item${i}_gelato_uid`];
        const width = parseFloat(metadata[`item${i}_width`]) || 30;
        const height = parseFloat(metadata[`item${i}_height`]) || 30;
        const medium = metadata[`item${i}_medium`] || 'Canvas';
        const format = metadata[`item${i}_format`] || 'Portrait';
        
        reconstructedItems.push({
          image_id: itemId,
          image_title: metadata[`item${i}_title`],
          quantity: parseInt(metadata[`item${i}_qty`]) || 1,
          product_data: {
            gelato_sku: gelatoUid,
            medium: { name: medium },
            format: { name: format },
            width_cm: width,
            height_cm: height
          },
          printSpecs: {
            width_cm: width,
            height_cm: height,
            medium: medium,
            format: format
          }
        });
      }
    }
    
    return reconstructedItems;
  };

  const runSimulation = () => {
    const metadata = simulatePaymentIntentMetadata();
    if (!metadata) return;

    const reconstructed = simulateWebhookReconstruction(metadata);
    
    setPaymentIntentSimulation({
      originalCart: cart.items,
      paymentIntentMetadata: metadata,
      webhookReconstructed: reconstructed,
      testResults: {
        hasGelatoUids: cart.items.some(item => item.gelatoProductUid),
        hasPrintSpecs: cart.items.some(item => item.printSpecs),
        metadataComplete: Object.keys(metadata).filter(key => key.includes('gelato_uid')).length > 0,
        reconstructionComplete: reconstructed.length > 0 && reconstructed.every(item => item.product_data?.gelato_sku)
      }
    });
  };

  const runValidationTest = async () => {
    console.log('🔍 Running Step 2 validation test...');
    
    try {
      // Get auth session for API calls using the same pattern as checkout pages
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setValidationTest({
          success: false,
          error: 'Authentication required - please login first',
          modes: {}
        });
        return;
      }

      const modes = ['quick', 'full', 'health'];
      const results: Record<string, any> = {};

      // Test each validation mode
      for (const mode of modes) {
        console.log(`Testing validation mode: ${mode}`);
        
        try {
          const response = await fetch('/api/cart/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ mode })
          });

          if (response.ok) {
            const data = await response.json();
            results[mode] = {
              success: true,
              data,
              status: response.status
            };
          } else {
            const errorData = await response.json();
            results[mode] = {
              success: false,
              error: errorData.error || `HTTP ${response.status}`,
              status: response.status
            };
          }
        } catch (error) {
          results[mode] = {
            success: false,
            error: error instanceof Error ? error.message : 'Network error',
            status: 0
          };
        }
      }

      // Test GET endpoint as well
      try {
        const response = await fetch('/api/cart/validate', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          results['status'] = {
            success: true,
            data,
            status: response.status
          };
        }
      } catch (error) {
        results['status'] = {
          success: false,
          error: 'Failed to get validation status'
        };
      }

      setValidationTest({
        success: true,
        modes: results,
        cartItemCount: cart.items.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Validation test error:', error);
      setValidationTest({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        modes: {}
      });
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );
  };

  const formatGuid = (guid: string | undefined, maxLength: number = 40) => {
    if (!guid) return 'Not available';
    return guid.length > maxLength ? `${guid.substring(0, maxLength)}...` : guid;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cart Enhancement Test</h1>
          <p className="text-gray-600">Step 1: Verify Gelato product data flows through cart system</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={refreshCart} variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Refresh Cart
          </Button>
          <Link href="/customer/shop">
            <Button>
              <Package className="w-4 h-4 mr-2" />
              Go to Shop
            </Button>
          </Link>
        </div>
      </div>

      {/* Current Cart Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Current Cart ({cart.items.length} items)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cart.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No items in cart. <Link href="/customer/shop" className="text-blue-600 hover:underline">Add some products</Link> to test.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item, index) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.imageTitle}</h4>
                      <p className="text-sm text-gray-600">
                        Product: {item.product.medium?.name} - {item.product.format?.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        Quantity: {item.quantity} × {item.pricing.currency_symbol}{(item.pricing.sale_price / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      {getStatusIcon(!!item.gelatoProductUid)}
                      {getStatusIcon(!!item.printSpecs)}
                    </div>
                  </div>

                  <Separator />

                  {/* Enhanced Data Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h5 className="font-semibold text-gray-700 mb-2">🎯 Gelato Integration Data</h5>
                      <div className="space-y-1 bg-gray-50 p-3 rounded">
                        <div>
                          <span className="font-medium">Gelato Product UID:</span>
                          <div className="font-mono text-xs mt-1 break-all">
                            {item.gelatoProductUid ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">
                                {formatGuid(item.gelatoProductUid)}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-red-100 text-red-800">
                                ❌ Missing
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-semibold text-gray-700 mb-2">📐 Print Specifications</h5>
                      <div className="space-y-1 bg-gray-50 p-3 rounded">
                        {item.printSpecs ? (
                          <div className="space-y-1">
                            <div><span className="font-medium">Dimensions:</span> {item.printSpecs.width_cm} × {item.printSpecs.height_cm} cm</div>
                            <div><span className="font-medium">Medium:</span> {item.printSpecs.medium}</div>
                            <div><span className="font-medium">Format:</span> {item.printSpecs.format}</div>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">
                            ❌ Print specs missing
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Original Product Data */}
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium text-gray-600 hover:text-gray-800">
                      View Original Product Data
                    </summary>
                    <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify({
                        product_id: item.productId,
                        gelato_sku: item.product.gelato_sku,
                        dimensions: {
                          width_cm: item.product.width_cm,
                          height_cm: item.product.height_cm
                        },
                        medium: item.product.medium,
                        format: item.product.format
                      }, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Simulation */}
      {cart.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="w-5 h-5 mr-2" />
              Payment Flow Simulation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Button onClick={runSimulation} className="bg-blue-600 hover:bg-blue-700">
                  <Zap className="w-4 h-4 mr-2" />
                  Step 1: Simulate PaymentIntent + Webhook
                </Button>
                <Button onClick={runValidationTest} className="bg-green-600 hover:bg-green-700">
                  <Settings className="w-4 h-4 mr-2" />
                  Step 2: Test Gelato Validation
                </Button>
              </div>

              {paymentIntentSimulation && (
                <div className="space-y-4 mt-4">
                  {/* Test Results Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                      {getStatusIcon(paymentIntentSimulation.testResults.hasGelatoUids)}
                      <span className="text-sm font-medium">Gelato UIDs</span>
                    </div>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                      {getStatusIcon(paymentIntentSimulation.testResults.hasPrintSpecs)}
                      <span className="text-sm font-medium">Print Specs</span>
                    </div>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                      {getStatusIcon(paymentIntentSimulation.testResults.metadataComplete)}
                      <span className="text-sm font-medium">Metadata</span>
                    </div>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded">
                      {getStatusIcon(paymentIntentSimulation.testResults.reconstructionComplete)}
                      <span className="text-sm font-medium">Webhook</span>
                    </div>
                  </div>

                  {/* PaymentIntent Metadata */}
                  <details>
                    <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900 mb-2">
                      📤 PaymentIntent Metadata (Stripe)
                    </summary>
                    <pre className="bg-yellow-50 p-4 rounded text-xs overflow-x-auto border">
                      {JSON.stringify(paymentIntentSimulation.paymentIntentMetadata, null, 2)}
                    </pre>
                  </details>

                  {/* Webhook Reconstructed Data */}
                  <details>
                    <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900 mb-2">
                      📥 Webhook Reconstructed Cart Items
                    </summary>
                    <pre className="bg-green-50 p-4 rounded text-xs overflow-x-auto border">
                      {JSON.stringify(paymentIntentSimulation.webhookReconstructed, null, 2)}
                    </pre>
                  </details>

                  {/* Status Analysis */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">🔍 Analysis</h4>
                    <div className="space-y-2 text-sm text-blue-700">
                      {paymentIntentSimulation.testResults.hasGelatoUids && 
                       paymentIntentSimulation.testResults.hasPrintSpecs &&
                       paymentIntentSimulation.testResults.metadataComplete &&
                       paymentIntentSimulation.testResults.reconstructionComplete ? (
                        <div className="flex items-center space-x-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span><strong>✅ Step 1 WORKING:</strong> Enhanced cart data flows correctly through the entire system!</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-red-700">
                          <XCircle className="w-4 h-4" />
                          <span><strong>❌ Issues found:</strong> Some enhanced cart data is missing or incomplete.</span>
                        </div>
                      )}
                      
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>Cart has Gelato product UIDs: {paymentIntentSimulation.testResults.hasGelatoUids ? '✅' : '❌'}</li>
                        <li>Cart has print specifications: {paymentIntentSimulation.testResults.hasPrintSpecs ? '✅' : '❌'}</li>
                        <li>PaymentIntent metadata complete: {paymentIntentSimulation.testResults.metadataComplete ? '✅' : '❌'}</li>
                        <li>Webhook reconstruction works: {paymentIntentSimulation.testResults.reconstructionComplete ? '✅' : '❌'}</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 Validation Test Results */}
              {validationTest && (
                <div className="space-y-4 mt-4">
                  <h4 className="font-semibold text-green-800 flex items-center">
                    <Settings className="w-5 h-5 mr-2" />
                    Step 2: Gelato Validation Test Results
                  </h4>

                  {!validationTest.success ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-red-800 font-medium">❌ Validation Test Failed</div>
                      <div className="text-red-700 text-sm mt-1">{validationTest.error}</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Quick Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-blue-50 p-3 rounded text-center">
                          <div className="text-sm font-medium text-blue-800">Cart Items</div>
                          <div className="text-lg font-bold text-blue-900">{validationTest.cartItemCount}</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded text-center">
                          <div className="text-sm font-medium text-green-800">Quick Mode</div>
                          <div className="text-lg font-bold text-green-900">{validationTest.modes.quick?.success ? '✅' : '❌'}</div>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded text-center">
                          <div className="text-sm font-medium text-yellow-800">Full Mode</div>
                          <div className="text-lg font-bold text-yellow-900">{validationTest.modes.full?.success ? '✅' : '❌'}</div>
                        </div>
                        <div className="bg-purple-50 p-3 rounded text-center">
                          <div className="text-sm font-medium text-purple-800">Health Check</div>
                          <div className="text-lg font-bold text-purple-900">{validationTest.modes.health?.success ? '✅' : '❌'}</div>
                        </div>
                      </div>

                      {/* Detailed Results */}
                      {Object.entries(validationTest.modes).map(([mode, result]: [string, any]) => (
                        <details key={mode} className="border rounded">
                          <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900 p-3 bg-gray-50 rounded">
                            📋 {mode.charAt(0).toUpperCase() + mode.slice(1)} Validation Results
                            {result.success ? ' ✅' : ' ❌'}
                          </summary>
                          <div className="p-4">
                            {result.success ? (
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-green-800">
                                  Status: {result.data?.isValid ? 'Valid' : 'Invalid'} | 
                                  Mode: {result.data?.mode} | 
                                  HTTP {result.status}
                                </div>
                                
                                {result.data?.errors && result.data.errors.length > 0 && (
                                  <div className="text-sm text-red-700">
                                    <strong>Errors:</strong> {result.data.errors.length}
                                    <ul className="list-disc ml-4 mt-1">
                                      {result.data.errors.map((error: any, idx: number) => (
                                        <li key={idx}>{error.error} ({error.code})</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {result.data?.warnings && result.data.warnings.length > 0 && (
                                  <div className="text-sm text-yellow-700">
                                    <strong>Warnings:</strong> {result.data.warnings.length}
                                  </div>
                                )}

                                {result.data?.serviceHealth && (
                                  <div className="text-sm">
                                    <strong>Service Health:</strong> {result.data.serviceHealth.isHealthy ? '✅ Healthy' : '❌ Issues'}
                                    <ul className="ml-4 mt-1">
                                      <li>Pricing API: {result.data.serviceHealth.services.pricing ? '✅' : '❌'}</li>
                                      <li>Orders API: {result.data.serviceHealth.services.orders ? '✅' : '❌'}</li>
                                    </ul>
                                  </div>
                                )}

                                <details className="text-xs mt-2">
                                  <summary className="cursor-pointer text-gray-600">Raw Response</summary>
                                  <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mt-1">
                                    {JSON.stringify(result.data, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            ) : (
                              <div className="text-red-700">
                                <div className="font-medium">❌ Failed</div>
                                <div className="text-sm">Error: {result.error}</div>
                                {result.status && <div className="text-sm">HTTP Status: {result.status}</div>}
                              </div>
                            )}
                          </div>
                        </details>
                      ))}

                      {/* Overall Assessment */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h5 className="font-semibold text-blue-800 mb-2">🎯 Step 2 Assessment</h5>
                        <div className="text-sm text-blue-700">
                          {validationTest.modes.quick?.success && 
                           validationTest.modes.full?.success &&
                           validationTest.modes.health?.success ? (
                            <div className="text-green-700">
                              <strong>✅ Step 2 WORKING:</strong> All validation modes are functioning correctly! 
                              Pre-checkout validation is ready for production use.
                            </div>
                          ) : (
                            <div className="text-red-700">
                              <strong>❌ Step 2 Issues:</strong> Some validation modes are not working properly. 
                              Check the detailed results above.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            How to Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>1. Add items to cart:</strong>
              <p className="text-gray-600 ml-4">Go to <Link href="/customer/shop" className="text-blue-600 hover:underline">Customer Shop</Link> and add some products to your cart</p>
            </div>
            <div>
              <strong>2. Check cart enhancement:</strong>
              <p className="text-gray-600 ml-4">Return here and verify items show Gelato Product UIDs and Print Specifications</p>
            </div>
            <div>
              <strong>3. Test Step 1 (Enhanced Cart):</strong>
              <p className="text-gray-600 ml-4">Click "Step 1: Simulate PaymentIntent + Webhook" to test enhanced cart data flow</p>
            </div>
            <div>
              <strong>4. Test Step 2 (Validation):</strong>
              <p className="text-gray-600 ml-4">Click "Step 2: Test Gelato Validation" to test pre-checkout validation system</p>
            </div>
            <div>
              <strong>5. Verify results:</strong>
              <p className="text-gray-600 ml-4">Both Step 1 and Step 2 should show green checkmarks for successful integration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}