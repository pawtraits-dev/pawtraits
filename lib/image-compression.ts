/**
 * Client-side image compression utility
 * Compresses images to reduce file size before upload
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

export async function compressImage(
  file: File, 
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1200,
    maxHeight = 800,
    quality = 0.8,
    maxSizeKB = 4096 // 4MB max after compression
  } = options;

  return new Promise((resolve, reject) => {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Create an image element
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress the image
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          
          // Check if we need further compression
          if (blob.size > maxSizeKB * 1024 && quality > 0.1) {
            // Recursively compress with lower quality
            const lowerQuality = Math.max(0.1, quality - 0.1);
            const newFile = new File([blob], file.name, { 
              type: file.type,
              lastModified: Date.now()
            });
            
            compressImage(newFile, { 
              ...options, 
              quality: lowerQuality 
            }).then(resolve).catch(reject);
          } else {
            // Create compressed file
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            
            resolve(compressedFile);
          }
        },
        file.type,
        quality
      );
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    // Load the image
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Validate image file type
 */
export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type);
}