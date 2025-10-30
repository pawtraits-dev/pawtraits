/**
 * Generate Branded QR Code for Partner Signup Page
 *
 * This script generates a QR code for https://www.pawtraits.pics/signup/partner
 * using the same branded style as pre-registration QR codes (purple + paw logo).
 *
 * Usage: npx tsx scripts/generate-partner-signup-qr.ts
 */

import QRCode from 'qrcode';
import { createCanvas, loadImage } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

const PARTNER_SIGNUP_URL = 'https://www.pawtraits.pics/signup/partner';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'qr-codes');
const OUTPUT_FILE = 'partner-signup-qr.png';

async function generatePartnerSignupQR() {
  console.log('🎨 Generating branded QR code for partner signup...');
  console.log(`📍 URL: ${PARTNER_SIGNUP_URL}`);

  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✅ Created directory: ${OUTPUT_DIR}`);
    }

    // QR code configuration
    const qrSize = 512;
    const logoSize = Math.round(qrSize * 0.15); // Logo is 15% of QR code size

    // Generate base QR code with high error correction
    console.log('🔨 Generating QR code...');
    const qrOptions = {
      errorCorrectionLevel: 'H' as const, // High error correction allows for logo overlay
      width: qrSize,
      margin: 4,
      color: {
        dark: '#9333ea', // Pawtraits purple-600
        light: '#00000000' // Transparent background
      }
    };

    // Create canvas for composition
    const canvas = createCanvas(qrSize, qrSize);
    const ctx = canvas.getContext('2d');

    // Generate QR code to canvas
    await QRCode.toCanvas(canvas, PARTNER_SIGNUP_URL, qrOptions);

    // Load and overlay paw logo
    console.log('🐾 Adding paw logo...');
    const logoUrl = 'data:image/svg+xml;base64,' + Buffer.from(`
      <svg fill="#9333ea" width="60" height="60" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(180 50 50)">
          <path d="M34.848,40.708c0-5.6-4.542-10.141-10.143-10.141c-5.601,0-10.141,4.541-10.141,10.141c0,5.604,4.539,10.143,10.141,10.143 C30.307,50.851,34.848,46.312,34.848,40.708z"/>
          <path d="M75.293,32.548c-5.6,0-10.141,4.541-10.141,10.141c0,5.604,4.541,10.141,10.141,10.141c5.601,0,10.142-4.537,10.142-10.141 C85.435,37.089,80.895,32.548,75.293,32.548z"/>
          <path d="M66.082,53.978c-0.705-0.869-1.703-1.875-2.849-2.93c-3.058-3.963-7.841-6.527-13.233-6.527 c-4.799,0-9.113,2.032-12.162,5.27c-1.732,1.507-3.272,2.978-4.252,4.188l-0.656,0.801c-3.06,3.731-6.869,8.373-6.841,16.25 c0.027,7.315,5.984,13.27,13.278,13.27c4.166,0,7.984-1.926,10.467-5.159c2.481,3.233,6.3,5.159,10.47,5.159 c7.291,0,13.247-5.954,13.275-13.27c0.028-7.877-3.782-12.519-6.841-16.25L66.082,53.978z"/>
          <circle cx="50.703" cy="26.877" r="11.175"/>
        </g>
      </svg>
    `).toString('base64');

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

    // Convert canvas to buffer
    const imageBuffer = canvas.toBuffer('image/png');

    // Write to file
    const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
    fs.writeFileSync(outputPath, imageBuffer);

    console.log('\n✅ SUCCESS!');
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`🌐 Web path: /qr-codes/${OUTPUT_FILE}`);
    console.log(`📏 Size: 512x512px (suitable for printing)`);
    console.log(`🎨 Style: Pawtraits purple with paw logo`);
    console.log(`\n💡 You can now use this QR code in marketing materials!`);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    throw error;
  }
}

// Run the script
generatePartnerSignupQR()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
