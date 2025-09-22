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

      // Generate QR code with Pawtraits paw logo for upload
      const qrDataURL = await this.generatePawtraitsQRCode(referralCode, baseUrl, {
        width: 512, // Higher resolution for printing
        margin: 4
      });

      // Convert data URL to buffer
      const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
      const qrBuffer = Buffer.from(base64Data, 'base64');

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
   * Generate QR code for immediate display (base64 data URL) with paw logo
   */
  async generateReferralQRDataURL(
    referralCode: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ): Promise<string> {
    // Use the Pawtraits QR code with paw logo for all referral codes
    return this.generatePawtraitsQRCode(referralCode, baseUrl, {
      width: 256,
      margin: 3
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
   * Generate branded QR code with paw logo for partner
   */
  async generateBrandedQRCode(
    referralCode: string,
    partnerName: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ): Promise<string> {
    // Use the Pawtraits QR code with paw logo for all partner codes
    return this.generatePawtraitsQRCode(referralCode, baseUrl, {
      width: 400,
      margin: 4
    });
  }

  /**
   * Generate QR code with Pawtraits paw logo in center
   */
  async generatePawtraitsQRCode(
    referralCode: string,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    options: QRCodeOptions = {}
  ): Promise<string> {
    const referralUrl = `${baseUrl}/r/${referralCode}`;

    // Use the Pawtraits paw logo
    const logoUrl = 'data:image/svg+xml;base64,' + Buffer.from(`
      <svg fill="#9333ea" width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g>
          <path d="M34.848,40.708c0-5.6-4.542-10.141-10.143-10.141c-5.601,0-10.141,4.541-10.141,10.141c0,5.604,4.539,10.143,10.141,10.143 C30.307,50.851,34.848,46.312,34.848,40.708z"/>
          <path d="M75.293,32.548c-5.6,0-10.141,4.541-10.141,10.141c0,5.604,4.541,10.141,10.141,10.141c5.601,0,10.142-4.537,10.142-10.141 C85.435,37.089,80.895,32.548,75.293,32.548z"/>
          <path d="M66.082,53.978c-0.705-0.869-1.703-1.875-2.849-2.93c-3.058-3.963-7.841-6.527-13.233-6.527 c-4.799,0-9.113,2.032-12.162,5.27c-1.732,1.507-3.272,2.978-4.252,4.188l-0.656,0.801c-3.06,3.731-6.869,8.373-6.841,16.25 c0.027,7.315,5.984,13.27,13.278,13.27c4.166,0,7.984-1.926,10.467-5.159c2.481,3.233,6.3,5.159,10.47,5.159 c7.291,0,13.247-5.954,13.275-13.27c0.028-7.877-3.782-12.519-6.841-16.25L66.082,53.978z"/>
          <circle cx="50.703" cy="26.877" r="11.175"/>
        </g>
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