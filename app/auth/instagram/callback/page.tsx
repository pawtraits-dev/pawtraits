'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function InstagramCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          setStatus('error');
          setMessage(errorDescription || 'Instagram authorization failed');
          return;
        }

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing authorization code or state');
          return;
        }

        // Parse the state to get share information
        let shareData;
        try {
          shareData = JSON.parse(decodeURIComponent(state));
        } catch (e) {
          setStatus('error');
          setMessage('Invalid state parameter');
          return;
        }

        // Exchange code for access token
        const tokenResponse = await fetch('/api/auth/instagram/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({}));
          if (errorData.error === 'Instagram OAuth not configured') {
            // OAuth not configured, but still track as a basic share
            await fetch('/api/shares/track', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                imageId: shareData.imageId,
                platform: 'instagram',
                shareUrl: shareData.returnUrl,
                socialAccountData: null
              }),
            });
            
            setStatus('success');
            setMessage('Share tracked! Instagram OAuth is not configured, but your share has been recorded.');
            setTimeout(() => window.close(), 3000);
            return;
          }
          throw new Error('Failed to exchange code for token');
        }

        const { access_token } = await tokenResponse.json();

        // Get user info from Instagram
        const userResponse = await fetch(`https://graph.instagram.com/me?fields=id,username,media_count,account_type&access_token=${access_token}`);
        
        if (!userResponse.ok) {
          throw new Error('Failed to get user info from Instagram');
        }

        const userInfo = await userResponse.json();

        // Record the share with social account data
        await fetch('/api/shares/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageId: shareData.imageId,
            platform: 'instagram',
            shareUrl: shareData.returnUrl,
            socialAccountData: {
              platformUserId: userInfo.id,
              username: userInfo.username,
              displayName: userInfo.username,
              profileUrl: `https://instagram.com/${userInfo.username}`,
              followerCount: userInfo.media_count || 0, // Instagram Basic Display doesn't provide follower count
              verified: userInfo.account_type === 'BUSINESS'
            }
          }),
        });

        setStatus('success');
        setMessage('Successfully connected your Instagram account! You can now share content directly.');

        // Close the popup window after a delay
        setTimeout(() => {
          window.close();
        }, 3000);

      } catch (error) {
        console.error('Instagram callback error:', error);
        setStatus('error');
        setMessage('Failed to process Instagram authorization');
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-6 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting to Instagram...
              </h1>
              <p className="text-gray-600">
                Please wait while we set up your Instagram sharing.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Instagram Connected!
              </h1>
              <p className="text-gray-600 mb-4">
                {message}
              </p>
              <p className="text-sm text-gray-500">
                This window will close automatically...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h1>
              <p className="text-gray-600 mb-4">
                {message}
              </p>
              <Button 
                onClick={() => window.close()}
                variant="outline"
              >
                Close Window
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function InstagramCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Loading...
            </h1>
            <p className="text-gray-600">
              Processing Instagram callback
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <InstagramCallbackContent />
    </Suspense>
  );
}