import { NextRequest, NextResponse } from 'next/server';

const INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
const INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const INSTAGRAM_REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    if (!INSTAGRAM_CLIENT_ID || !INSTAGRAM_CLIENT_SECRET || !INSTAGRAM_REDIRECT_URI) {
      console.error('Missing Instagram OAuth configuration');
      return NextResponse.json(
        { error: 'Instagram OAuth not configured' },
        { status: 500 }
      );
    }

    // Exchange authorization code for access token
    const tokenUrl = 'https://api.instagram.com/oauth/access_token';
    
    const formData = new FormData();
    formData.append('client_id', INSTAGRAM_CLIENT_ID);
    formData.append('client_secret', INSTAGRAM_CLIENT_SECRET);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', INSTAGRAM_REDIRECT_URI);
    formData.append('code', code);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      body: formData
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Instagram token exchange failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to exchange code for token' },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();

    // Exchange short-lived token for long-lived token
    if (tokenData.access_token) {
      const longLivedTokenUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_CLIENT_SECRET}&access_token=${tokenData.access_token}`;
      
      const longLivedResponse = await fetch(longLivedTokenUrl, {
        method: 'GET'
      });

      if (longLivedResponse.ok) {
        const longLivedData = await longLivedResponse.json();
        return NextResponse.json({
          access_token: longLivedData.access_token || tokenData.access_token,
          token_type: tokenData.token_type || 'bearer',
          expires_in: longLivedData.expires_in || tokenData.expires_in
        });
      }
    }

    return NextResponse.json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || 'bearer',
      expires_in: tokenData.expires_in
    });

  } catch (error) {
    console.error('Error in Instagram token exchange:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}