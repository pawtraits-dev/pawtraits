// Server-side Cloudinary upload utilities
// For use in API routes and server-side services

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
if (!cloudinary.config().cloud_name) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export interface ServerUploadOptions {
  folder?: string;
  tags?: string[];
  breed?: string;
  theme?: string;
  style?: string;
}

export interface ServerUploadResult {
  public_id: string;
  secure_url: string;
  version: number;
  width: number;
  height: number;
  format: string;
  bytes: number;
  signature: string;
}

/**
 * Upload image buffer to Cloudinary from server-side
 * Used by batch processing service and other server-side operations
 */
export async function uploadImageBufferToCloudinary(
  buffer: Buffer,
  filename: string,
  options: ServerUploadOptions = {}
): Promise<ServerUploadResult> {
  try {
    console.log(`🔄 Server-side Cloudinary upload: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    
    // Set default folder for batch uploads
    const folder = options.folder || 'pawtraits/batch-generated';
    
    // Prepare tags
    const tags = [
      ...(options.tags || []),
      'server-upload',
      'batch-generated'
    ];
    
    // Add metadata tags if provided
    if (options.breed) tags.push(`breed-${options.breed.toLowerCase().replace(/\s+/g, '-')}`);
    if (options.theme) tags.push(`theme-${options.theme.toLowerCase().replace(/\s+/g, '-')}`);
    if (options.style) tags.push(`style-${options.style.toLowerCase().replace(/\s+/g, '-')}`);
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(
      `data:image/png;base64,${buffer.toString('base64')}`,
      {
        folder,
        tags,
        resource_type: 'image',
        public_id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        overwrite: false,
        invalidate: true,
        use_filename: false,
        unique_filename: true
      }
    );
    
    console.log(`✅ Server upload successful: ${result.public_id} (${(result.bytes / 1024 / 1024).toFixed(2)}MB)`);
    console.log(`   Dimensions: ${result.width}x${result.height}px`);
    console.log(`   Secure URL: ${result.secure_url}`);
    
    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      version: result.version,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      signature: result.signature
    };
    
  } catch (error) {
    console.error('❌ Server-side Cloudinary upload failed:', error);
    throw new Error(`Server Cloudinary upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload multiple image buffers to Cloudinary from server-side
 * Used by batch processing for multiple variations
 */
export async function uploadImageBuffersToCloudinary(
  buffers: { buffer: Buffer; filename: string }[],
  options: ServerUploadOptions = {}
): Promise<ServerUploadResult[]> {
  const results: ServerUploadResult[] = [];
  
  for (let i = 0; i < buffers.length; i++) {
    const { buffer, filename } = buffers[i];
    console.log(`📤 Uploading ${i + 1}/${buffers.length}: ${filename}`);
    
    try {
      const result = await uploadImageBufferToCloudinary(buffer, filename, {
        ...options,
        tags: [...(options.tags || []), `batch-${Date.now()}`, `item-${i + 1}`]
      });
      results.push(result);
    } catch (error) {
      console.error(`❌ Failed to upload ${filename}:`, error);
      throw error;
    }
  }
  
  return results;
}

/**
 * Test Cloudinary configuration
 */
export async function testCloudinaryConfig(): Promise<boolean> {
  try {
    const config = cloudinary.config();
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      console.error('❌ Missing Cloudinary configuration');
      return false;
    }
    
    console.log('✅ Cloudinary configuration loaded');
    console.log(`   Cloud Name: ${config.cloud_name}`);
    console.log(`   API Key: ${config.api_key?.substring(0, 6)}...`);
    
    return true;
  } catch (error) {
    console.error('❌ Cloudinary configuration test failed:', error);
    return false;
  }
}