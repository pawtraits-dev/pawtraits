// Client-side Cloudinary upload utilities
// Direct upload to preserve print quality without API size limits

export interface DirectUploadOptions {
  breed?: string;
  theme?: string;
  style?: string;
  folder?: string;
  tags?: string[];
}

export interface UploadResult {
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
 * Get signed upload parameters from our API
 * This generates a signature that allows direct client upload
 */
async function getSignedUploadParams(options: DirectUploadOptions = {}): Promise<{
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  folder: string;
}> {
  const response = await fetch('/api/cloudinary/signed-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });

  if (!response.ok) {
    throw new Error('Failed to get signed upload parameters');
  }

  return response.json();
}

/**
 * Upload image directly to Cloudinary (bypasses Vercel size limits)
 * Preserves full print quality for Gelato fulfillment
 */
export async function uploadImageDirect(
  file: File, 
  options: DirectUploadOptions = {}
): Promise<UploadResult> {
  
  console.log(`🔄 Starting direct Cloudinary upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  
  // Get signed upload parameters from our API
  const uploadParams = await getSignedUploadParams(options);
  
  // Prepare form data for Cloudinary
  const formData = new FormData();
  formData.append('file', file);
  formData.append('signature', uploadParams.signature);
  formData.append('timestamp', uploadParams.timestamp.toString());
  formData.append('api_key', uploadParams.api_key);
  formData.append('folder', uploadParams.folder);
  
  // Add tags if provided
  if (options.tags && options.tags.length > 0) {
    formData.append('tags', options.tags.join(','));
  }
  
  // Upload directly to Cloudinary (no size limits)
  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${uploadParams.cloud_name}/image/upload`;
  
  const response = await fetch(cloudinaryUrl, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Cloudinary direct upload failed:', errorText);
    throw new Error(`Cloudinary upload failed: ${response.status} ${response.statusText}`);
  }

  const result: UploadResult = await response.json();
  
  console.log(`✅ Direct upload successful: ${result.public_id} (${(result.bytes / 1024 / 1024).toFixed(2)}MB)`);
  console.log(`   Dimensions: ${result.width}x${result.height}px`);
  
  // Validate print quality requirements
  const minPixelsFor40cm = 4724; // 40×40 cm at 300 DPI
  const hasMinimumPrintQuality = result.width >= minPixelsFor40cm && result.height >= minPixelsFor40cm;
  
  if (hasMinimumPrintQuality) {
    console.log('✅ Image meets Gelato print quality requirements (300 DPI for 40×40 cm)');
  } else {
    console.warn(`⚠️ Image may not meet optimal print quality. Current: ${result.width}x${result.height}px, Recommended for 40×40 cm: ${minPixelsFor40cm}x${minPixelsFor40cm}px`);
  }
  
  return result;
}

/**
 * Upload multiple images with progress tracking
 */
export async function uploadImagesDirectBatch(
  files: File[],
  options: DirectUploadOptions = {},
  onProgress?: (uploaded: number, total: number, current: string) => void
): Promise<UploadResult[]> {
  
  const results: UploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i, files.length, file.name);
    
    try {
      const result = await uploadImageDirect(file, {
        ...options,
        tags: [...(options.tags || []), `batch-${Date.now()}`]
      });
      results.push(result);
    } catch (error) {
      console.error(`❌ Failed to upload ${file.name}:`, error);
      throw error;
    }
  }
  
  onProgress?.(files.length, files.length, 'Complete');
  return results;
}