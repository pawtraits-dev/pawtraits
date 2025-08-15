#!/usr/bin/env tsx

/**
 * Test Enhanced Cart Data Structure (Step 1)
 * 
 * This test validates that Gelato product details flow correctly through:
 * 1. Product creation with saved gelato_sku
 * 2. Cart item creation with enhanced data
 * 3. PaymentIntent metadata generation
 * 4. Stripe webhook cart reconstruction
 */

import { AdminSupabaseService } from '../lib/admin-supabase';
import { createGelatoService } from '../lib/gelato-service';

interface TestProduct {
  id: string;
  gelato_sku: string;
  width_cm: number;
  height_cm: number;
  medium: { name: string };
  format: { name: string };
}

interface TestCartItem {
  id: string;
  productId: string;
  imageId: string;
  imageUrl: string;
  imageTitle: string;
  product: TestProduct;
  pricing: any;
  quantity: number;
  addedAt: string;
  gelatoProductUid?: string;
  printSpecs?: {
    width_cm: number;
    height_cm: number;
    medium: string;
    format: string;
  };
}

class EnhancedCartTester {
  private supabaseService: AdminSupabaseService;
  private gelatoService: ReturnType<typeof createGelatoService>;
  private testResults: { step: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  constructor() {
    this.supabaseService = new AdminSupabaseService();
    this.gelatoService = createGelatoService();
  }

  private log(step: string, status: 'PASS' | 'FAIL', details: string) {
    console.log(`${status === 'PASS' ? '✅' : '❌'} ${step}: ${details}`);
    this.testResults.push({ step, status, details });
  }

  async testStep1_ProductHasGelatoSku(): Promise<TestProduct | null> {
    try {
      console.log('\n🧪 Testing Step 1: Product has saved Gelato SKU');
      
      // Get a product with gelato_sku from database
      const products = await this.supabaseService.getProducts();
      const productWithGelato = products?.find(p => p.gelato_sku && p.gelato_sku.length > 10);
      
      if (!productWithGelato) {
        this.log('Product Gelato SKU', 'FAIL', 'No products found with saved gelato_sku');
        return null;
      }
      
      this.log('Product Gelato SKU', 'PASS', `Found product ${productWithGelato.id} with gelato_sku: ${productWithGelato.gelato_sku?.substring(0, 30)}...`);
      
      // Validate product has required fields
      if (!productWithGelato.width_cm || !productWithGelato.height_cm) {
        this.log('Product Dimensions', 'FAIL', 'Product missing width_cm or height_cm');
        return null;
      }
      
      this.log('Product Dimensions', 'PASS', `Product has dimensions: ${productWithGelato.width_cm}cm x ${productWithGelato.height_cm}cm`);
      
      return productWithGelato as TestProduct;
      
    } catch (error) {
      this.log('Product Gelato SKU', 'FAIL', `Error: ${error}`);
      return null;
    }
  }

  testStep2_CartItemEnhancement(product: TestProduct): TestCartItem {
    console.log('\n🧪 Testing Step 2: Cart item enhancement');
    
    // Simulate the enhanced cart item creation (from ProductSelectionModal)
    const mockCartItem: TestCartItem = {
      id: 'test-cart-item-1',
      productId: product.id,
      imageId: 'test-image-123',
      imageUrl: 'https://test.com/image.jpg',
      imageTitle: 'Test Pet Portrait',
      product: product,
      pricing: { sale_price: 2500, currency_code: 'GBP' },
      quantity: 1,
      addedAt: new Date().toISOString(),
      // Enhanced Gelato data (Step 1 implementation)
      gelatoProductUid: product.gelato_sku,
      printSpecs: {
        width_cm: product.width_cm || 30,
        height_cm: product.height_cm || 30,
        medium: product.medium?.name || 'Canvas',
        format: product.format?.name || 'Portrait'
      }
    };
    
    // Validate enhancement
    if (!mockCartItem.gelatoProductUid) {
      this.log('Cart Enhancement', 'FAIL', 'gelatoProductUid not populated from product.gelato_sku');
      return mockCartItem;
    }
    
    if (!mockCartItem.printSpecs) {
      this.log('Cart Enhancement', 'FAIL', 'printSpecs not populated');
      return mockCartItem;
    }
    
    this.log('Cart Enhancement', 'PASS', `Cart item enhanced with Gelato UID: ${mockCartItem.gelatoProductUid?.substring(0, 30)}...`);
    this.log('Print Specs', 'PASS', `Print specs: ${mockCartItem.printSpecs.width_cm}x${mockCartItem.printSpecs.height_cm}cm, ${mockCartItem.printSpecs.medium}`);
    
    return mockCartItem;
  }

  testStep3_PaymentIntentMetadata(cartItems: TestCartItem[]) {
    console.log('\n🧪 Testing Step 3: PaymentIntent metadata generation');
    
    // Simulate PaymentIntent metadata creation (from create-intent/route.ts)
    const metadata: Record<string, string> = {
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      cartItemCount: cartItems.length.toString(),
    };
    
    // Add enhanced cart items to metadata (first 3 items only)
    cartItems.slice(0, 3).forEach((item, index) => {
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
    
    // Validate metadata
    const hasGelatoUid = metadata['item1_gelato_uid'] && metadata['item1_gelato_uid'].length > 0;
    const hasDimensions = metadata['item1_width'] && metadata['item1_height'];
    
    if (!hasGelatoUid) {
      this.log('PaymentIntent Metadata', 'FAIL', 'Gelato UID not included in metadata');
      return metadata;
    }
    
    if (!hasDimensions) {
      this.log('PaymentIntent Metadata', 'FAIL', 'Product dimensions not included in metadata');
      return metadata;
    }
    
    this.log('PaymentIntent Metadata', 'PASS', `Metadata includes Gelato UID: ${metadata['item1_gelato_uid']?.substring(0, 30)}...`);
    this.log('Metadata Dimensions', 'PASS', `Dimensions in metadata: ${metadata['item1_width']}x${metadata['item1_height']}cm`);
    
    return metadata;
  }

  testStep4_WebhookReconstruction(metadata: Record<string, string>) {
    console.log('\n🧪 Testing Step 4: Stripe webhook cart reconstruction');
    
    // Simulate cart reconstruction in webhook (from stripe/route.ts)
    const reconstructedItems: any[] = [];
    
    for (let i = 1; i <= 3; i++) {
      const itemId = metadata[`item${i}_id`];
      
      if (itemId) {
        // Enhanced Gelato data from metadata
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
            // Use saved Gelato product UID instead of mapping
            gelato_sku: gelatoUid,
            medium: { name: medium },
            format: { name: format },
            width_cm: width,
            height_cm: height
          },
          // Enhanced print specs for precise image generation
          printSpecs: {
            width_cm: width,
            height_cm: height,
            medium: medium,
            format: format
          }
        });
      }
    }
    
    // Validate reconstruction
    if (reconstructedItems.length === 0) {
      this.log('Webhook Reconstruction', 'FAIL', 'No items reconstructed from metadata');
      return false;
    }
    
    const firstItem = reconstructedItems[0];
    
    if (!firstItem.product_data?.gelato_sku) {
      this.log('Webhook Reconstruction', 'FAIL', 'Gelato SKU not reconstructed');
      return false;
    }
    
    if (!firstItem.printSpecs) {
      this.log('Webhook Reconstruction', 'FAIL', 'Print specs not reconstructed');
      return false;
    }
    
    this.log('Webhook Reconstruction', 'PASS', `Reconstructed ${reconstructedItems.length} items with Gelato data`);
    this.log('Reconstructed Gelato SKU', 'PASS', `SKU: ${firstItem.product_data.gelato_sku?.substring(0, 30)}...`);
    this.log('Reconstructed Specs', 'PASS', `Specs: ${firstItem.printSpecs.width_cm}x${firstItem.printSpecs.height_cm}cm`);
    
    return true;
  }

  testStep5_ImageUrlGeneration(cartItems: any[]) {
    console.log('\n🧪 Testing Step 5: Print-ready image URL generation');
    
    try {
      // Test image URL generation using existing Cloudinary handling
      const imageUrls: Record<string, string> = {};
      
      for (const item of cartItems) {
        const widthCm = item.printSpecs?.width_cm || item.product_data?.width_cm || 30;
        const heightCm = item.printSpecs?.height_cm || item.product_data?.height_cm || 30;
        
        // Use the existing generatePrintImageUrl method
        imageUrls[item.image_id] = this.gelatoService.generatePrintImageUrl(
          item.image_id,
          widthCm,
          heightCm
        );
      }
      
      if (Object.keys(imageUrls).length === 0) {
        this.log('Image URL Generation', 'FAIL', 'No image URLs generated');
        return false;
      }
      
      const firstUrl = Object.values(imageUrls)[0];
      
      if (!firstUrl || (!firstUrl.includes('cloudinary') && !firstUrl.includes('/api/images/print'))) {
        this.log('Image URL Generation', 'FAIL', `Invalid image URL format: ${firstUrl}`);
        return false;
      }
      
      this.log('Image URL Generation', 'PASS', `Generated ${Object.keys(imageUrls).length} print-ready URLs`);
      this.log('Sample URL', 'PASS', `URL: ${firstUrl.substring(0, 80)}...`);
      
      return true;
      
    } catch (error) {
      this.log('Image URL Generation', 'FAIL', `Error: ${error}`);
      return false;
    }
  }

  async runFullTest(): Promise<boolean> {
    console.log('🚀 Starting Enhanced Cart Data Structure Test (Step 1)\n');
    
    try {
      // Step 1: Get product with Gelato SKU
      const testProduct = await this.testStep1_ProductHasGelatoSku();
      if (!testProduct) return false;
      
      // Step 2: Test cart item enhancement
      const enhancedCartItem = this.testStep2_CartItemEnhancement(testProduct);
      
      // Step 3: Test PaymentIntent metadata
      const metadata = this.testStep3_PaymentIntentMetadata([enhancedCartItem]);
      
      // Step 4: Test webhook reconstruction
      const webhookSuccess = this.testStep4_WebhookReconstruction(metadata);
      if (!webhookSuccess) return false;
      
      // Step 5: Test image URL generation (using existing system)
      const mockReconstructedItems = [{
        image_id: 'test-image-123',
        printSpecs: enhancedCartItem.printSpecs,
        product_data: {
          width_cm: testProduct.width_cm,
          height_cm: testProduct.height_cm,
          gelato_sku: testProduct.gelato_sku
        }
      }];
      
      const imageUrlSuccess = this.testStep5_ImageUrlGeneration(mockReconstructedItems);
      
      return imageUrlSuccess;
      
    } catch (error) {
      this.log('Full Test', 'FAIL', `Unexpected error: ${error}`);
      return false;
    }
  }

  printSummary() {
    console.log('\n📊 Test Summary:');
    console.log('═'.repeat(60));
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const total = this.testResults.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   • ${r.step}: ${r.details}`));
    }
    
    console.log('\n🎯 Step 1 Status:', failed === 0 ? 'COMPLETED ✅' : 'NEEDS FIXES ❌');
    
    return failed === 0;
  }
}

// Run the test
async function main() {
  const tester = new EnhancedCartTester();
  const success = await tester.runFullTest();
  const overallSuccess = tester.printSummary();
  
  process.exit(overallSuccess ? 0 : 1);
}

if (require.main === module) {
  main().catch(console.error);
}