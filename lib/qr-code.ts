import QRCode from 'qrcode';
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
        dark: '#000000',
        light: '#FFFFFF'
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
        dark: '#000000',
        light: '#FFFFFF'
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

      // Generate QR code with custom styling
      const qrBuffer = await this.generateQRCodeBuffer(referralUrl, {
        errorCorrectionLevel: 'H', // High error correction for reliability
        width: 512, // Higher resolution for printing
        margin: 4,
        color: {
          dark: '#1f2937', // Dark gray
          light: '#ffffff'
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
        dark: '#1f2937',
        light: '#ffffff'
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

    // For now, we'll generate a standard QR code
    // In the future, you could add logo overlay, custom colors, etc.
    return this.generateQRCode(referralUrl, {
      errorCorrectionLevel: 'H',
      width: 400,
      margin: 4,
      color: {
        dark: '#7c3aed', // Purple brand color
        light: '#ffffff'
      }
    });
  }
}

// Utility functions for use in API routes and components
export const qrCodeService = new QRCodeService();

/**
 * Quick function to generate a referral QR code
 */
export async function generateReferralQR(
  referralCode: string,
  options: { upload?: boolean; branded?: boolean; partnerName?: string } = {}
): Promise<{ qrCodeUrl?: string; qrDataURL?: string; error?: string }> {
  try {
    if (options.upload) {
      const uploadResult = await qrCodeService.generateAndUploadReferralQR(referralCode);
      if (!uploadResult.success) {
        return { error: uploadResult.error };
      }
      return { qrCodeUrl: uploadResult.qrCodeUrl };
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