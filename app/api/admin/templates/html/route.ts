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

// PUT - Update HTML template directly in database
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateKey, content } = body;

    console.log('📝 Attempting to save HTML template:', { templateKey, contentLength: content?.length });

    if (!templateKey || !content) {
      console.error('❌ Missing required fields:', { hasTemplateKey: !!templateKey, hasContent: !!content });
      return NextResponse.json(
        { error: 'Template key and content are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Update template in database
    console.log('💾 Updating template in database:', templateKey);

    const { data, error } = await supabase
      .from('message_templates')
      .update({
        email_body_template: content,
        updated_at: new Date().toISOString()
      })
      .eq('template_key', templateKey)
      .select();

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update template in database', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.error('❌ Template not found:', templateKey);
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    console.log('✅ Template saved successfully in database:', templateKey);

    return NextResponse.json({ success: true, template: data[0] });

  } catch (error) {
    console.error('❌ Failed to update HTML template:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      {
        error: 'Failed to update template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
