import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { QRCodeService } from '@/lib/qr-code';

export async function POST(request: NextRequest) {
  try {
    // TODO: Add admin authentication check

    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await request.json();
    const { code_ids } = body;

    if (!code_ids || !Array.isArray(code_ids) || code_ids.length === 0) {
      return NextResponse.json({ error: 'Code IDs are required' }, { status: 400 });
    }

    // Get the codes
    const { data: codes, error } = await supabase
      .from('pre_registration_codes')
      .select('*')
      .in('id', code_ids);

    if (error) {
      console.error('Failed to fetch codes for bulk download:', error);
      return NextResponse.json({ error: 'Failed to fetch codes' }, { status: 500 });
    }

    if (!codes || codes.length === 0) {
      return NextResponse.json({ error: 'No codes found' }, { status: 404 });
    }

    // Create ZIP file with branded QR codes
    const zip = new JSZip();
    const qrCodeService = new QRCodeService();

    for (const code of codes) {
      try {
        // Generate QR code URL (assuming the pre-registration flow will be at /p/[code])
        const qrUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pawtraits.pics'}/p/${code.code}`;

        // Create the paw logo SVG (rotated to fix upside-down issue)
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

        // Generate branded QR code with Pawtraits logo and purple theme
        const qrDataURL = await qrCodeService.generateQRCodeWithLogo(qrUrl, logoUrl, {
          width: 512,
          margin: 4,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#9333ea', // Pawtraits purple-600
            light: '#00000000' // Transparent background
          }
        });

        // Convert data URL to buffer
        const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
        const qrCodeBuffer = Buffer.from(base64Data, 'base64');

        // Add to ZIP with filename including code and category
        const filename = `${code.code}${code.business_category ? `_${code.business_category.replace(/[^a-zA-Z0-9]/g, '_')}` : ''}.png`;
        zip.file(filename, qrCodeBuffer);
      } catch (qrError) {
        console.error(`Failed to generate QR code for ${code.code}:`, qrError);
        // Continue with other codes even if one fails
      }
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="pre-registration-qr-codes.zip"`,
        'Content-Length': zipBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Bulk download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}