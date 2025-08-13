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

export interface PrintQualityResult {
  meetsRequirements: boolean;
  qualityLevel: 'Optimal' | 'Acceptable' | 'Below Minimum';
  dpi: 300 | 150;
  recommendedSize: string;
  maxSizeRecommendation: string;
  maxRequiredPixels: string;
}

/**
 * Validate image dimensions against Gelato print requirements
 * Based on updated gelato.md specifications
 */
function validateGelatoPrintQuality(width: number, height: number): PrintQualityResult {
  // Gelato print format requirements (300 DPI optimal)
  const formats300DPI = {
    // Square formats (1:1)
    square_20: { width: 2362, height: 2362, size: '20×20 cm' },
    square_30: { width: 3543, height: 3543, size: '30×30 cm' },
    square_40: { width: 4724, height: 4724, size: '40×40 cm' },
    
    // Rectangular formats (3:2 landscape)
    landscape_20x30: { width: 2362, height: 3543, size: '20×30 cm' },
    landscape_30x45: { width: 3543, height: 5315, size: '30×45 cm' },
    landscape_40x60: { width: 4724, height: 7087, size: '40×60 cm' },
    
    // Rectangular formats (2:3 portrait) 
    portrait_30x20: { width: 3543, height: 2362, size: '30×20 cm' },
    portrait_45x30: { width: 5315, height: 3543, size: '45×30 cm' },
    portrait_60x40: { width: 7087, height: 4724, size: '60×40 cm' }, // Largest format
  };

  // 150 DPI acceptable alternatives
  const formats150DPI = {
    square_20: { width: 1181, height: 1181, size: '20×20 cm' },
    square_30: { width: 1772, height: 1772, size: '30×30 cm' },
    square_40: { width: 2362, height: 2362, size: '40×40 cm' },
    landscape_20x30: { width: 1181, height: 1772, size: '20×30 cm' },
    landscape_30x45: { width: 1772, height: 2657, size: '30×45 cm' },
    landscape_40x60: { width: 2362, height: 3543, size: '40×60 cm' },
    portrait_30x20: { width: 1772, height: 1181, size: '30×20 cm' },
    portrait_45x30: { width: 2657, height: 1772, size: '45×30 cm' },
    portrait_60x40: { width: 3543, height: 2362, size: '60×40 cm' },
  };

  // Find the largest format this image can support at 300 DPI
  let bestFormat300 = null;
  let bestFormat150 = null;

  for (const [key, format] of Object.entries(formats300DPI)) {
    // Check if image meets minimum requirements (accounting for aspect ratio flexibility)
    const meetsWidth = width >= format.width || height >= format.width;
    const meetsHeight = height >= format.height || width >= format.height;
    
    if (meetsWidth && meetsHeight) {
      bestFormat300 = format;
    }
  }

  for (const [key, format] of Object.entries(formats150DPI)) {
    const meetsWidth = width >= format.width || height >= format.width;
    const meetsHeight = height >= format.height || width >= format.height;
    
    if (meetsWidth && meetsHeight) {
      bestFormat150 = format;
    }
  }

  // Determine result based on what format can be supported
  if (bestFormat300) {
    return {
      meetsRequirements: true,
      qualityLevel: 'Optimal',
      dpi: 300,
      recommendedSize: bestFormat300.size,
      maxSizeRecommendation: bestFormat300.size,
      maxRequiredPixels: `${formats300DPI.portrait_60x40.width}×${formats300DPI.portrait_60x40.height}px (60×40 cm max)`
    };
  } else if (bestFormat150) {
    return {
      meetsRequirements: true,
      qualityLevel: 'Acceptable',
      dpi: 150,
      recommendedSize: bestFormat150.size,
      maxSizeRecommendation: bestFormat150.size,
      maxRequiredPixels: `${formats300DPI.portrait_60x40.width}×${formats300DPI.portrait_60x40.height}px (60×40 cm optimal)`
    };
  } else {
    return {
      meetsRequirements: false,
      qualityLevel: 'Below Minimum',
      dpi: 150,
      recommendedSize: 'Not suitable for printing',
      maxSizeRecommendation: 'Up to 20×20 cm with quality loss',
      maxRequiredPixels: `${formats300DPI.portrait_60x40.width}×${formats300DPI.portrait_60x40.height}px (60×40 cm optimal)`
    };
  }
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
  
  // Validate print quality requirements based on updated gelato.md
  const printQuality = validateGelatoPrintQuality(result.width, result.height);
  
  if (printQuality.meetsRequirements) {
    console.log(`✅ Image meets Gelato print quality requirements (${printQuality.recommendedSize})`);
    console.log(`   Quality level: ${printQuality.qualityLevel} (${printQuality.dpi} DPI)`);
  } else {
    console.warn(`⚠️ Image may not meet optimal print quality`);
    console.warn(`   Current: ${result.width}×${result.height}px`);
    console.warn(`   Recommended for largest format: ${printQuality.maxRequiredPixels}`);
    console.warn(`   Suitable for: ${printQuality.maxSizeRecommendation}`);
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