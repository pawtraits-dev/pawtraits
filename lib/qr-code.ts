import QRCode from 'qrcode';
import { createCanvas, loadImage } from 'canvas';
import { SupabaseService } from './supabase';

export interface QRCodeOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

export class QRCodeService {
  private supabaseService = new SupabaseService();

  /**
   * Generate QR code as data URL (base64)
   */
  async generateQRCode(
    text: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      errorCorrectionLevel: 'M' as const,
      width: 256,
      margin: 2,
      color: {
        dark: '#9333ea', // Pawtraits purple-600
        light: '#00000000' // Transparent background (RGBA format)
      }
    };

    const qrOptions = { ...defaultOptions, ...options };

    try {
      const dataURL = await QRCode.toDataURL(text, qrOptions);
      return dataURL;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate QR code as buffer
   */
  async generateQRCodeBuffer(
    text: string,
    options: QRCodeOptions = {}
  ): Promise<Buffer> {
    const defaultOptions = {
      errorCorrectionLevel: 'M' as const,
      width: 256,
      margin: 2,
      color: {
        dark: '#9333ea', // Pawtraits purple-600
        light: '#00000000' // Transparent background (RGBA format)
      }
    };

    const qrOptions = { ...defaultOptions, ...options };

    try {
      const buffer = await QRCode.toBuffer(text, qrOptions);
      return buffer;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate and upload QR code for a referral
   */
  async generateAndUploadReferralQR(
    referralCode: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ): Promise<{ success: boolean; qrCodeUrl?: string; error?: string }> {
    try {
      // Create the referral URL
      const referralUrl = `${baseUrl}/r/${referralCode}`;

      // Generate QR code with Pawtraits branding
      const qrBuffer = await this.generateQRCodeBuffer(referralUrl, {
        errorCorrectionLevel: 'H', // High error correction for reliability
        width: 512, // Higher resolution for printing
        margin: 4,
        color: {
          dark: '#9333ea', // Pawtraits purple-600
          light: '#00000000' // Transparent background
        }
      });

      // Create file object from buffer
      const qrFile = new File([qrBuffer], `qr-${referralCode}.png`, {
        type: 'image/png'
      });

      // Upload to Supabase Storage
      const uploadResult = await this.supabaseService.uploadImage(qrFile);

      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }

      return {
        success: true,
        qrCodeUrl: uploadResult.publicUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate QR code for immediate display (base64 data URL)
   */
  async generateReferralQRDataURL(
    referralCode: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ): Promise<string> {
    const referralUrl = `${baseUrl}/r/${referralCode}`;

    return this.generateQRCode(referralUrl, {
      errorCorrectionLevel: 'H',
      width: 256,
      margin: 3,
      color: {
        dark: '#9333ea', // Pawtraits purple-600
        light: '#00000000' // Transparent background
      }
    });
  }

  /**
   * Validate QR code readability
   */
  async validateQRCode(dataURL: string): Promise<boolean> {
    try {
      // This is a basic validation - in a real implementation,
      // you might want to use a QR code reader library to verify
      return dataURL.startsWith('data:image/png;base64,');
    } catch {
      return false;
    }
  }

  /**
   * Generate branded QR code with logo/styling for partner
   */
  async generateBrandedQRCode(
    referralCode: string,
    partnerName: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ): Promise<string> {
    const referralUrl = `${baseUrl}/r/${referralCode}`;

    // Generate branded QR code with consistent Pawtraits styling
    return this.generateQRCode(referralUrl, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 4,
      color: {
        dark: '#9333ea', // Pawtraits purple-600 (consistent with brand)
        light: '#00000000' // Transparent background
      }
    });
  }

  /**
   * Generate QR code with Pawtraits logo in center
   */
  async generatePawtraitsQRCode(
    referralCode: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    options: QRCodeOptions = {}
  ): Promise<string> {
    const referralUrl = `${baseUrl}/r/${referralCode}`;

    // Use the heart icon as our "logo" - you can replace this with actual logo URL
    const logoUrl = 'data:image/svg+xml;base64,' + Buffer.from(`
      <svg width="60" height="60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#9333ea"/>
      </svg>
    `).toString('base64');

    return this.generateQRCodeWithLogo(referralUrl, logoUrl, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 4,
      color: {
        dark: '#9333ea', // Pawtraits purple-600
        light: '#00000000' // Transparent background
      },
      ...options
    });
  }

  /**
   * Generate QR code with logo overlay using Canvas
   */
  async generateQRCodeWithLogo(
    text: string,
    logoUrl?: string,
    options: QRCodeOptions = {}
  ): Promise<string> {
    try {
      const qrSize = options.width || 400;
      const logoSize = Math.round(qrSize * 0.15); // Logo is 15% of QR code size

      // Generate base QR code with high error correction
      const qrOptions = {
        errorCorrectionLevel: 'H' as const, // High error correction allows for logo overlay
        width: qrSize,
        margin: options.margin || 4,
        color: {
          dark: '#9333ea', // Pawtraits purple-600
          light: '#00000000', // Transparent background
          ...options.color
        }
      };

      // Create canvas for composition
      const canvas = createCanvas(qrSize, qrSize);
      const ctx = canvas.getContext('2d');

      // Generate QR code to canvas
      await QRCode.toCanvas(canvas, text, qrOptions);

      // If logo URL provided, overlay it in center
      if (logoUrl) {
        try {
          const logoImage = await loadImage(logoUrl);

          // Calculate center position for logo
          const logoX = (qrSize - logoSize) / 2;
          const logoY = (qrSize - logoSize) / 2;

          // Draw white background circle for logo (for better visibility)
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(qrSize / 2, qrSize / 2, logoSize / 2 + 4, 0, 2 * Math.PI);
          ctx.fill();

          // Draw logo in center
          ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
        } catch (logoError) {
          console.warn('Failed to load logo, using QR code without logo:', logoError);
        }
      }

      // Convert canvas to data URL
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating QR code with logo:', error);
      // Fallback to basic QR code
      return this.generateQRCode(text, options);
    }
  }
}

// Utility functions for use in API routes and components
export const qrCodeService = new QRCodeService();

/**
 * Quick function to generate a referral QR code
 */
export async function generateReferralQR(
  referralCode: string,
  options: {
    upload?: boolean;
    branded?: boolean;
    withLogo?: boolean;
    partnerName?: string;
  } = {}
): Promise<{ qrCodeUrl?: string; qrDataURL?: string; error?: string }> {
  try {
    if (options.upload) {
      const uploadResult = await qrCodeService.generateAndUploadReferralQR(referralCode);
      if (!uploadResult.success) {
        return { error: uploadResult.error };
      }
      return { qrCodeUrl: uploadResult.qrCodeUrl };
    } else if (options.withLogo) {
      const qrDataURL = await qrCodeService.generatePawtraitsQRCode(referralCode);
      return { qrDataURL };
    } else if (options.branded && options.partnerName) {
      const qrDataURL = await qrCodeService.generateBrandedQRCode(
        referralCode,
        options.partnerName
      );
      return { qrDataURL };
    } else {
      const qrDataURL = await qrCodeService.generateReferralQRDataURL(referralCode);
      return { qrDataURL };
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to generate QR code'
    };
  }
}