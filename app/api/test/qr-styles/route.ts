import { NextResponse } from 'next/server';
import { qrCodeService } from '@/lib/qr-code';

export async function GET() {
  try {
    const testCode = 'TEST123';

    // Generate different QR code styles for comparison
    const standardQR = await qrCodeService.generateReferralQRDataURL(testCode);
    const brandedQR = await qrCodeService.generateBrandedQRCode(testCode, 'Test Partner');
    const logoQR = await qrCodeService.generatePawtraitsQRCode(testCode);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code Style Comparison</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 1200px;
              margin: 0 auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .qr-container {
              display: flex;
              gap: 40px;
              flex-wrap: wrap;
              justify-content: center;
            }
            .qr-item {
              text-align: center;
              background: white;
              padding: 20px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .qr-item h3 {
              margin-bottom: 15px;
              color: #333;
            }
            .qr-item img {
              border: 1px solid #ddd;
              border-radius: 8px;
              background: white;
            }
            .description {
              margin-top: 10px;
              font-size: 14px;
              color: #666;
              max-width: 200px;
            }
            h1 {
              text-align: center;
              color: #9333ea;
              margin-bottom: 30px;
            }
          </style>
        </head>
        <body>
          <h1>🎨 Pawtraits QR Code Style Comparison</h1>
          <div class="qr-container">
            <div class="qr-item">
              <h3>Standard QR (Purple + Transparent)</h3>
              <img src="${standardQR}" alt="Standard QR Code" width="200" height="200" />
              <div class="description">Basic purple QR code with transparent background</div>
            </div>
            <div class="qr-item">
              <h3>Branded QR (Same Style)</h3>
              <img src="${brandedQR}" alt="Branded QR Code" width="200" height="200" />
              <div class="description">Partner branded version (currently same as standard)</div>
            </div>
            <div class="qr-item">
              <h3>Logo QR (Heart Center)</h3>
              <img src="${logoQR}" alt="Logo QR Code" width="200" height="200" />
              <div class="description">QR code with purple heart logo in the center</div>
            </div>
          </div>
          <div style="text-align: center; margin-top: 40px; color: #666;">
            <p><strong>URL:</strong> ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/r/${testCode}</p>
            <p>All QR codes use Pawtraits purple (#9333ea) with transparent backgrounds</p>
          </div>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('Error generating QR test page:', error);
    return NextResponse.json(
      { error: 'Failed to generate QR codes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}