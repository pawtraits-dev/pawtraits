import { NextRequest, NextResponse } from 'next/server';
import { loadDesignPageData } from '@/lib/catalog/design-page-data';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Catalog image ID is required' },
        { status: 400 }
      );
    }

    // The loading itself is shared with the server-rendered design page (lib/catalog/design-page-data.ts)
    const result = await loadDesignPageData(id);
    if (result.status === 'not_found') {
      return NextResponse.json(
        { error: 'Catalog image not found or not public' },
        { status: 404 }
      );
    }
    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('❌ [CATALOG API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch catalog image', details: error.message },
      { status: 500 }
    );
  }
}
