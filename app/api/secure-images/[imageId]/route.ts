import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import { cloudinaryService } from '@/lib/cloudinary';

const supabaseService = new SupabaseService();

interface RouteParams {
  params: Promise<{ imageId: string }>;
}

/**
 * Secure image proxy endpoint
 * This endpoint validates requests and serves images through our server
 * preventing direct access to Cloudinary URLs
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { imageId } = await params;
    const { searchParams } = new URL(request.url);
    
    const variant = searchParams.get('variant') || 'mid_size';
    const userId = searchParams.get('userId');
    const orderId = searchParams.get('orderId');
    const token = searchParams.get('token');

    // Security checks
    const security = await validateImageRequest(request, imageId, variant, userId, orderId, token);
    if (!security.allowed) {
      return NextResponse.json(
        { error: security.reason },
        { status: security.status }
      );
    }

    // Get image data from database
    const image = await supabaseService.getImage(imageId);
    if (!image) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Generate secure URL based on variant and access level
    let imageUrl: string;
    
    try {
      if (image.cloudinary_public_id) {
        // Use Cloudinary service for new images
        imageUrl = await getSecureVariantUrl(
          image.cloudinary_public_id, 
          variant, 
          userId, 
          orderId,
          security.accessLevel
        );
      } else {
        // Fallback to legacy URL for non-migrated images
        imageUrl = image.image_url || image.public_url;
        console.log(`🔄 Using legacy URL: ${imageUrl}`);
      }
    } catch (error) {
      console.error('Error generating secure URL:', error);
      // Fallback to legacy URL
      imageUrl = image.image_url || image.public_url;
      console.log(`🔄 Fallback to legacy URL due to error: ${imageUrl}`);
    }

    // Ensure we have a valid URL
    if (!imageUrl) {
      console.error('❌ No valid image URL found');
      return NextResponse.json(
        { error: 'No valid image URL found' },
        { status: 404 }
      );
    }

    // Fetch the image from Cloudinary/storage with enhanced error handling
    console.log(`🔄 Fetching image from URL: ${imageUrl}`);
    
    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'PawtraitsSecureProxy/1.0'
        },
        // Add timeout
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return NextResponse.json(
        { error: `Failed to fetch image: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` },
        { status: 502 }
      );
    }
    
    if (!imageResponse.ok) {
      console.error(`❌ Image fetch failed: ${imageResponse.status} ${imageResponse.statusText}`);
      console.error(`❌ Failed URL: ${imageUrl}`);
      
      // Try to get response text for debugging
      try {
        const errorText = await imageResponse.text();
        console.error(`❌ Error response: ${errorText}`);
      } catch (e) {
        console.error('❌ Could not read error response');
      }
      
      // Try fallback to legacy URLs if original fails
      const fallbackUrl = image.image_url || image.public_url;
      if (fallbackUrl && fallbackUrl !== imageUrl) {
        console.log(`🔄 Trying fallback URL: ${fallbackUrl}`);
        try {
          const fallbackResponse = await fetch(fallbackUrl, {
            headers: {
              'User-Agent': 'PawtraitsSecureProxy/1.0'
            },
            signal: AbortSignal.timeout(10000)
          });
          
          if (fallbackResponse.ok) {
            console.log('✅ Fallback URL succeeded');
            const fallbackBuffer = await fallbackResponse.arrayBuffer();
            const fallbackContentType = fallbackResponse.headers.get('content-type') || 'image/jpeg';
            
            return new NextResponse(fallbackBuffer, {
              status: 200,
              headers: {
                'Content-Type': fallbackContentType,
                'Cache-Control': 'private, max-age=300',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'Referrer-Policy': 'strict-origin',
                'X-Robots-Tag': 'noindex, nofollow',
              },
            });
          }
        } catch (fallbackError) {
          console.error('❌ Fallback URL also failed:', fallbackError);
        }
      }
      
      return NextResponse.json(
        { error: `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}` },
        { status: 502 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Return the image with security headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300', // 5 minutes cache
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin',
        // Prevent direct linking
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });

  } catch (error) {
    console.error('Error in secure image proxy:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Validate image request based on security requirements
 */
async function validateImageRequest(
  request: NextRequest,
  imageId: string,
  variant: string,
  userId: string | null,
  orderId: string | null,
  token: string | null
): Promise<{
  allowed: boolean;
  reason?: string;
  status?: number;
  accessLevel: 'public' | 'authenticated' | 'purchased';
}> {
  
  // Check referer to ensure request comes from our domain
  const referer = request.headers.get('referer');
  
  // Allow localhost/127.0.0.1 on any port for development
  const isLocalhost = referer && (
    referer.includes('localhost') || 
    referer.includes('127.0.0.1')
  );
  
  const allowedDomains = [
    process.env.NEXT_PUBLIC_SITE_URL,
    'pawtraits-nu.vercel.app',  // Production domain
    'vercel.app'                // All Vercel domains
  ].filter(Boolean);

  if (referer && !isLocalhost) {
    const refererUrl = new URL(referer);
    const isAllowedDomain = allowedDomains.some(domain => {
      const cleanDomain = domain.replace('https://', '').replace('http://', '');
      return refererUrl.hostname === cleanDomain || 
             refererUrl.hostname.endsWith('.' + cleanDomain) ||
             refererUrl.hostname.includes('pawtraits') ||
             refererUrl.hostname.endsWith('.vercel.app');
    });
    
    if (!isAllowedDomain) {
      console.log(`🚫 Referer validation failed. Referer: ${referer}, Hostname: ${refererUrl.hostname}`);
      return {
        allowed: false,
        reason: 'Invalid referer',
        status: 403,
        accessLevel: 'public'
      };
    }
  }

  // Rate limiting check (simple implementation)
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  
  // TODO: Implement proper rate limiting with Redis or similar
  
  // Validate based on variant access requirements
  switch (variant) {
    case 'original':
      // Original quality - requires order verification
      if (!orderId) {
        return {
          allowed: false,
          reason: 'Order ID required for original quality',
          status: 401,
          accessLevel: 'purchased'
        };
      }
      // TODO: Verify order exists and contains this image
      return { allowed: true, accessLevel: 'purchased' };
      
    case 'download':
      // Download quality - requires user and order verification
      if (!userId || !orderId) {
        return {
          allowed: false,
          reason: 'Authentication required for download',
          status: 401,
          accessLevel: 'purchased'
        };
      }
      // TODO: Verify user has purchased this image
      return { allowed: true, accessLevel: 'purchased' };
      
    case 'social_media_post':
      // Social media - requires purchase verification
      if (!userId || !orderId) {
        return {
          allowed: false,
          reason: 'Purchase verification required',
          status: 401,
          accessLevel: 'purchased'
        };
      }
      return { allowed: true, accessLevel: 'purchased' };
      
    case 'full_size':
    case 'thumbnail':
    case 'mid_size':
      // Public variants - watermarked, limited access
      return { allowed: true, accessLevel: 'public' };
      
    default:
      return {
        allowed: false,
        reason: 'Invalid variant',
        status: 400,
        accessLevel: 'public'
      };
  }
}

/**
 * Generate secure variant URL with appropriate access controls
 */
async function getSecureVariantUrl(
  publicId: string,
  variant: string,
  userId: string | null,
  orderId: string | null,
  accessLevel: 'public' | 'authenticated' | 'purchased'
): Promise<string> {
  
  console.log(`🔄 Generating secure URL for publicId: ${publicId}, variant: ${variant}, accessLevel: ${accessLevel}`);
  
  switch (variant) {
    case 'original':
      if (accessLevel !== 'purchased' || !orderId) {
        throw new Error('Insufficient access for original variant');
      }
      return await cloudinaryService.getOriginalPrintUrl(publicId, orderId);
      
    case 'download':
      if (accessLevel !== 'purchased' || !userId || !orderId) {
        throw new Error('Insufficient access for download variant');
      }
      return await cloudinaryService.getDownloadUrl(publicId, userId, orderId);
      
    case 'social_media_post':
      if (accessLevel !== 'purchased' || !userId || !orderId) {
        throw new Error('Insufficient access for social media variant');
      }
      const socialUrls = await cloudinaryService.getSocialMediaUrls(publicId, userId, orderId);
      return socialUrls.instagram_post; // Default to Instagram post
      
    case 'full_size':
    case 'thumbnail':
    case 'mid_size':
      // Use public variant URL generation with short expiration for security
      const url = cloudinaryService.getPublicVariantUrl(publicId, variant as any);
      console.log(`✅ Generated URL: ${url}`);
      return url;
      
    default:
      throw new Error(`Unknown variant: ${variant}`);
  }
}