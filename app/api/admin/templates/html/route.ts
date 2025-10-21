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

    if (!fileName || !content) {
      return NextResponse.json(
        { error: 'File name and content are required' },
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
    await writeFile(filePath, content, 'utf-8');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Failed to update HTML template:', error);
    return NextResponse.json(
      { error: 'Failed to update template file' },
      { status: 500 }
    );
  }
}
