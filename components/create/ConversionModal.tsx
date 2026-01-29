'use client';

import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';

interface ConversionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: 'download' | 'print';
  variationData?: {
    catalogImageId: string;
    watermarkedUrl: string;
    metadata: {
      breedName: string;
      themeName: string;
      styleName: string;
    };
  };
}

export function ConversionModal({
  open,
  onOpenChange,
  action,
  variationData
}: ConversionModalProps) {
  const router = useRouter();

  const handleCreateAccount = () => {
    // Save generation context to sessionStorage
    if (variationData) {
      sessionStorage.setItem('pendingVariation', JSON.stringify({
        ...variationData,
        generatedAt: Date.now(),
        intendedAction: action
      }));
    }

    // Redirect to signup with return path
    const returnPath = action === 'download' ? '/create/complete?action=download' : '/create/complete?action=print';
    router.push(`/signup/user?redirect=${encodeURIComponent(returnPath)}`);
  };

  const handleLogin = () => {
    // Save generation context to sessionStorage
    if (variationData) {
      sessionStorage.setItem('pendingVariation', JSON.stringify({
        ...variationData,
        generatedAt: Date.now(),
        intendedAction: action
      }));
    }

    // Redirect to login with return path
    const returnPath = action === 'download' ? '/create/complete?action=download' : '/create/complete?action=print';
    router.push(`/auth/login?redirect=${encodeURIComponent(returnPath)}`);
  };

  const benefits = [
    'Download HD version without watermark',
    'Order professional prints on canvas, paper, and more',
    'Save portraits to your personal gallery',
    'Generate unlimited custom portraits',
    'Access to exclusive themes and styles'
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Love Your Dog&apos;s Portrait?
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Create a free account to {action === 'download' ? 'download the HD version' : 'order prints'} and unlock more amazing features!
          </DialogDescription>
        </DialogHeader>

        {/* Benefits list */}
        <div className="space-y-3 py-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-gray-700">{benefit}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={handleCreateAccount}
            className="w-full h-12 text-base font-semibold touch-target"
            size="lg"
          >
            Create Free Account
          </Button>

          <Button
            onClick={handleLogin}
            variant="outline"
            className="w-full h-12 text-base font-semibold touch-target"
            size="lg"
          >
            Login
          </Button>

          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            className="w-full touch-target"
            size="sm"
          >
            Maybe Later
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="pt-4 border-t">
          <p className="text-xs text-center text-gray-500">
            Join thousands of happy pet parents • No credit card required
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
