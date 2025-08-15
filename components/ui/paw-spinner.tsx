import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PawSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const speedMap = {
  slow: 'animate-paw-spin-slow',
  normal: 'animate-paw-spin-normal',
  fast: 'animate-paw-spin-fast'
};

export function PawSpinner({ size = 'md', className, speed = 'normal' }: PawSpinnerProps) {
  const sizeClass = sizeMap[size];
  const speedClass = speedMap[speed];

  return (
    <div className={cn('inline-flex items-center justify-center', className)}>
      <div className={cn(sizeClass, speedClass)}>
        <Image
          src="/assets/logos/paw-svgrepo-200x200-gold.svg"
          alt="Loading..."
          width={48}
          height={48}
          className="w-full h-full filter drop-shadow-sm"
          priority
        />
      </div>
    </div>
  );
}

// Alternative version with CSS animation for better control
export function PawSpinnerCSS({ size = 'md', className, speed = 'normal' }: PawSpinnerProps) {
  const sizeClass = sizeMap[size];
  
  const spinDuration = {
    slow: '4s',
    normal: '3s', 
    fast: '2s'
  };

  const pawSpinKeyframes = `
    @keyframes pawSpin {
      0% { transform: rotate(0deg); }
      25% { transform: rotate(360deg); }
      50% { transform: rotate(360deg); }
      75% { transform: rotate(360deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  return (
    <div className={cn('inline-flex items-center justify-center', className)}>
      <style>{pawSpinKeyframes}</style>
      <div 
        className={cn(sizeClass)}
        style={{
          animation: `pawSpin ${spinDuration[speed]} ease-in-out infinite`,
        }}
      >
        <Image
          src="/assets/logos/paw-svgrepo-200x200-gold.svg"
          alt="Loading..."
          width={48}
          height={48}
          className="w-full h-full filter drop-shadow-sm"
          priority
        />
      </div>
    </div>
  );
}

// Spinner with text
export function PawSpinnerWithText({ 
  size = 'md', 
  className, 
  speed = 'normal',
  text = 'Loading...',
  textClassName 
}: PawSpinnerProps & { 
  text?: string;
  textClassName?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center space-y-2', className)}>
      <PawSpinner size={size} speed={speed} />
      {text && (
        <p className={cn('text-sm text-gray-600', textClassName)}>
          {text}
        </p>
      )}
    </div>
  );
}

// Full page loading overlay
export function PawLoadingOverlay({ 
  text = 'Loading...',
  className 
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn(
      'fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center',
      className
    )}>
      <PawSpinnerWithText 
        size="xl" 
        text={text}
        textClassName="text-lg font-medium text-gray-700"
      />
    </div>
  );
}