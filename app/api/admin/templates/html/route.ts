import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

// GET - Read HTML template file
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    // Security: Only allow files in the templates directory
    if (fileName.includes('..') || !fileName.endsWith('.html')) {
      return NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), 'lib', 'messaging', 'templates', fileName);
    const content = await readFile(filePath, 'utf-8');

    return NextResponse.json({ content });

  } catch (error) {
    console.error('Failed to read HTML template:', error);
    return NextResponse.json(
      { error: 'Failed to read template file' },
      { status: 500 }
    );
  }
}

// PUT - Update HTML template file
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, content } = body;

    console.log('📝 Attempting to save HTML template:', { fileName, contentLength: content?.length });

    if (!fileName || !content) {
      console.error('❌ Missing required fields:', { hasFileName: !!fileName, hasContent: !!content });
      return NextResponse.json(
        { error: 'File name and content are required' },
        { status: 400 }
      );
    }

    // Security: Only allow files in the templates directory
    if (fileName.includes('..') || !fileName.endsWith('.html')) {
      console.error('❌ Invalid file name:', fileName);
      return NextResponse.json(
        { error: 'Invalid file name' },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), 'lib', 'messaging', 'templates', fileName);
    console.log('📁 File path:', filePath);

    // Check if running in production/serverless environment
    if (process.env.VERCEL) {
      console.warn('⚠️  Running on Vercel - file system is read-only. Templates should be stored in database instead.');
      return NextResponse.json(
        { error: 'File system updates not supported in production. Please use database-backed templates.' },
        { status: 501 }
      );
    }

    await writeFile(filePath, content, 'utf-8');
    console.log('✅ Template saved successfully:', fileName);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ Failed to update HTML template:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      {
        error: 'Failed to update template file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
