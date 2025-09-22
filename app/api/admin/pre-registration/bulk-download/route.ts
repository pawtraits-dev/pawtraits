import { NextRequest, NextResponse } from 'next/server';
import { SupabaseService } from '@/lib/supabase';
import JSZip from 'jszip';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  try {
    const supabaseService = new SupabaseService();

    // Check admin authentication
    const admin = await supabaseService.getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const body = await request.json();
    const { code_ids } = body;

    if (!code_ids || !Array.isArray(code_ids) || code_ids.length === 0) {
      return NextResponse.json({ error: 'Code IDs are required' }, { status: 400 });
    }

    // Get the codes
    const { data: codes, error } = await supabaseService.getClient()
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

    // Create ZIP file with QR codes
    const zip = new JSZip();

    for (const code of codes) {
      try {
        // Generate QR code URL (assuming the pre-registration flow will be at /p/[code])
        const qrUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://pawtraits.com'}/p/${code.code}`;

        // Generate QR code as PNG buffer
        const qrCodeBuffer = await QRCode.toBuffer(qrUrl, {
          type: 'png',
          width: 512,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

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