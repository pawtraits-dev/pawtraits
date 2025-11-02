'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, Facebook, Instagram, MessageCircle, Share2 } from 'lucide-react';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: {
    id: string;
    public_url: string;
    prompt_text: string;
    description: string;
  };
  onShare?: (platform: string) => void;
}

export default function ShareModal({ isOpen, onClose, image, onShare }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [includeDescription, setIncludeDescription] = useState(true);
  const [includeHashtag, setIncludeHashtag] = useState(true);
  const [customMessage, setCustomMessage] = useState<string>('');

  // Generate share URL (you might want to create a dedicated share page)
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/shop/${image.id}`;

  // Build share message based on user options
  const buildShareMessage = () => {
    if (customMessage.trim()) {
      return customMessage;
    }

    const parts: string[] = [];
    const breedName = (image as any)?.breed_name || 'Pet';

    // Add description if enabled
    if (includeDescription && image.description) {
      // Clean up the description - take first sentence or first 100 chars
      let cleanDesc = image.description
        .split(/[.!?]\s/)[0] // Get first sentence
        .trim();

      if (cleanDesc.length > 100) {
        cleanDesc = cleanDesc.substring(0, 100) + '...';
      }

      parts.push(cleanDesc);
    } else {
      // Simple fallback message
      parts.push(`Check out this amazing ${breedName} portrait!`);
    }

    // Add breed hashtag if enabled
    if (includeHashtag && breedName) {
      const hashtag = `#${breedName.replace(/\s+/g, '')}`;
      parts.push(hashtag);
    }

    return parts.join(' ');
  };

  const shareText = buildShareMessage();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      // Track the copy action
      trackShare('copy');
      onShare?.('copy');
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const trackShare = async (platform: string, socialAccountData?: any) => {
    try {
      await fetch('/api/shares/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId: image.id,
          platform,
          shareUrl,
          socialAccountData
        }),
      });
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const isIOS = () => {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  };

  const isAndroid = () => {
    return /Android/i.test(navigator.userAgent);
  };

  const handleSocialShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    
    let shareLink = '';
    let useWindow = true;
    
    switch (platform) {
      case 'facebook':
        if (isMobile()) {
          shareLink = `fb://facewebmodal/f?href=${encodedUrl}`;
          // Fallback to web if app not installed
          setTimeout(() => {
            window.location.href = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
          }, 1000);
          useWindow = false;
        } else {
          shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        }
        break;
      case 'instagram':
        if (isMobile()) {
          // For mobile, use device-specific deep linking
          const tryInstagramApp = () => {
            let appOpened = false;
            
            // Strategy 1: Try different deep links based on platform
            const instagramLinks = [
              'instagram://camera', // General camera
              'instagram://story-camera', // Story camera (iOS)
              'instagram://library?AssetPath=', // Library (Android)
            ];
            
            // Try each deep link
            instagramLinks.forEach((link, index) => {
              setTimeout(() => {
                if (!appOpened) {
                  try {
                    if (isIOS()) {
                      // iOS: Use window.open for better reliability
                      const popup = window.open(link, '_blank');
                      if (popup) {
                        setTimeout(() => popup.close(), 1000);
                        appOpened = true;
                      }
                    } else if (isAndroid()) {
                      // Android: Use location.href
                      window.location.href = link;
                      appOpened = true;
                    }
                  } catch (e) {
                    // Silent fail and try next link
                  }
                }
              }, index * 500);
            });
            
            // Strategy 2: Fallback with improved UX
            setTimeout(() => {
              navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
                alert('📋 Copied! Open Instagram and paste in your story.');
              }).catch(() => {
                alert('📱 Opening Instagram app...');
              });
            }, 1500);
          };
          
          tryInstagramApp();
          trackShare(platform);
          onShare?.(platform);
          return;
        } else {
          // For desktop, provide mobile-friendly QR code suggestion
          navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
            alert('📋 Link copied! Open Instagram on your phone and paste.');
          }).catch(() => {
            alert('📱 Copy this link to share on Instagram: ' + shareUrl);
          });
          trackShare(platform);
          onShare?.(platform);
          return;
        }
        break;
      case 'whatsapp':
        if (isMobile()) {
          shareLink = `whatsapp://send?text=${encodedText}%20${encodedUrl}`;
          useWindow = false;
        } else {
          shareLink = `https://web.whatsapp.com/send?text=${encodedText}%20${encodedUrl}`;
        }
        break;
      case 'messenger':
        if (isMobile()) {
          shareLink = `fb-messenger://share?link=${encodedUrl}`;
          useWindow = false;
        } else {
          shareLink = `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=your_app_id`;
        }
        break;
      case 'twitter':
        if (isMobile()) {
          shareLink = `twitter://post?message=${encodedText}%20${encodedUrl}`;
          // Fallback to web if app not installed
          setTimeout(() => {
            window.location.href = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
          }, 1000);
          useWindow = false;
        } else {
          shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        }
        break;
      default:
        return;
    }
    
    if (shareLink) {
      // Track the share event
      trackShare(platform);
      
      if (useWindow) {
        // Open share window for desktop
        const shareWindow = window.open(shareLink, '_blank', 'width=600,height=400');
        
        // Listen for window close to potentially get user data (for platforms that support it)
        if (shareWindow && ['facebook', 'twitter'].includes(platform)) {
          const checkClosed = setInterval(() => {
            if (shareWindow.closed) {
              clearInterval(checkClosed);
              onShare?.(platform);
            }
          }, 1000);
        } else {
          onShare?.(platform);
        }
      } else {
        // For mobile deep links, redirect directly
        window.location.href = shareLink;
        onShare?.(platform);
      }
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: image.prompt_text,
          text: shareText,
          url: shareUrl
        });
        
        // Track the native share
        trackShare('native');
        onShare?.('native');
      } catch (error) {
        console.log('Share cancelled');
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-w-[90vw] w-full max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Share2 className="w-5 h-5" />
            <span>Share Portrait</span>
          </DialogTitle>
          <DialogDescription>
            Share this amazing pet portrait with friends and family
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 w-full max-w-full overflow-hidden">
          {/* Image Preview */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <CatalogImage
              imageId={image.id}
              alt={image.prompt_text}
              className="w-[60px] h-[60px] rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {image.prompt_text}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {image.description}
              </p>
            </div>
          </div>

          {/* Share Message Options */}
          <div className="space-y-3 w-full">
            <Label className="text-sm font-medium">Share Message Options</Label>

            {/* Toggle Options */}
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeDescription"
                  checked={includeDescription}
                  onChange={(e) => setIncludeDescription(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="includeDescription" className="text-sm text-gray-700 cursor-pointer">
                  Include AI description
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeHashtag"
                  checked={includeHashtag}
                  onChange={(e) => setIncludeHashtag(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="includeHashtag" className="text-sm text-gray-700 cursor-pointer">
                  Include breed hashtag
                </label>
              </div>
            </div>

            {/* Message Preview */}
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Preview:</p>
              <div className="p-3 bg-white border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{shareText}</p>
                <p className="text-xs text-purple-600 mt-2">{shareUrl}</p>
              </div>
            </div>

            {/* Custom Message Override */}
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Or write your own message:</p>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="text-sm min-h-[60px]"
                placeholder="Custom message (optional)..."
              />
              {customMessage && (
                <button
                  onClick={() => setCustomMessage('')}
                  className="text-xs text-purple-600 hover:text-purple-700"
                >
                  Clear custom message
                </button>
              )}
            </div>
          </div>

          {/* Native Share (if available) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <Button onClick={handleNativeShare} className="w-full" variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Share via Device
            </Button>
          )}

          {/* Social Media Options */}
          <div className="space-y-2 w-full">
            <Label className="text-sm font-medium">Share on Social Media</Label>
            <div className="grid grid-cols-2 gap-2 w-full max-w-full">
              <Button
                variant="outline"
                onClick={() => handleSocialShare('facebook')}
                className="flex items-center justify-center space-x-1 w-full min-w-0 h-10 text-sm"
              >
                <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">f</span>
                </div>
                <span className="truncate">Facebook</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleSocialShare('twitter')}
                className="flex items-center justify-center space-x-1 w-full min-w-0 h-10 text-sm"
              >
                <div className="w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">𝕏</span>
                </div>
                <span className="truncate">Twitter</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleSocialShare('instagram')}
                className="flex items-center justify-center space-x-1 w-full min-w-0 h-10 text-sm"
              >
                <div className="w-4 h-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Instagram className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="truncate">Instagram</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleSocialShare('whatsapp')}
                className="flex items-center justify-center space-x-1 w-full min-w-0 h-10 text-sm"
              >
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="truncate">WhatsApp</span>
              </Button>
            </div>
          </div>

          {/* Copy Link */}
          <div className="space-y-2 w-full">
            <Label className="text-sm font-medium">Or copy link</Label>
            <div className="flex space-x-2 w-full">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 text-sm min-w-0 max-w-[calc(100%-80px)]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="flex items-center space-x-1 shrink-0 w-14 h-10"
              >
                <Copy className="w-3 h-3" />
                <span className="text-xs">{copied ? '✓' : 'Copy'}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}