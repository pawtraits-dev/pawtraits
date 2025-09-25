import { NextRequest, NextResponse } from 'next/server';
import { SocialMediaFetcher } from '@/lib/social-media-fetcher';

export async function POST(request: NextRequest) {
  try {
    const { platform, username } = await request.json();

    if (!platform || !username) {
      return NextResponse.json(
        { error: 'Platform and username are required' },
        { status: 400 }
      );
    }

    // First validate username format
    const validation = SocialMediaFetcher.validateUsername(platform, username);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Fetch social media data
    const data = await SocialMediaFetcher.fetchSocialData(platform, username);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching social media data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social media data' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to fetch social media data.' },
    { status: 405 }
  );
}