'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import Image from 'next/image'

const brandedButtonVariants = cva(
  // Base styles following Pawtraits brand guidelines
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-medium font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        // Primary button using brand purple (#6B46C1)
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-treat active:bg-primary/95 focus:ring-primary/50",
        
        // Secondary button using brand orange
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:shadow-treat active:bg-secondary/95 focus:ring-secondary/50",
        
        // Tertiary button using brand green
        tertiary: "bg-tertiary text-tertiary-foreground hover:bg-tertiary/90 hover:shadow-treat active:bg-tertiary/95 focus:ring-tertiary/50",
        
        // Outline variant with primary brand color
        outline: "border border-primary text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-paw focus:ring-primary/50",
        
        // Ghost variant for subtle interactions
        ghost: "text-primary hover:bg-primary/10 hover:text-primary focus:ring-primary/50",
        
        // Link variant
        link: "text-primary underline-offset-4 hover:underline focus:ring-primary/50",
      },
      size: {
        // Using pet-themed spacing tokens with increased padding for better text spacing
        sm: "h-9 px-collar text-sm min-w-[44px]", // Mobile-friendly touch target
        default: "h-10 px-leash py-treat min-w-[44px]", // Standard mobile-friendly size
        lg: "h-11 px-yard py-toy text-lg min-w-[48px]", // Large touch target
        xl: "h-12 px-field py-collar text-xl min-w-[48px]", // Extra large for heroes
        icon: "h-10 w-10 min-w-[44px] min-h-[44px]", // Perfect square for icons
      },
      animation: {
        none: "",
        gentle: "hover:animate-gentle-bounce",
        wiggle: "hover:animate-wiggle",
        treat: "active:animate-treat-drop",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      animation: "none",
    },
  }
)

export interface BrandedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof brandedButtonVariants> {
  asChild?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const BrandedButton = React.forwardRef<HTMLButtonElement, BrandedButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    animation,
    loading = false,
    leftIcon,
    rightIcon,
    children, 
    disabled,
    ...props 
  }, ref) => {
    return (
      <button
        className={cn(brandedButtonVariants({ variant, size, animation, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <div className="mr-toy">
            <Image
              src="/assets/logos/paw-svgrepo-200x200-gold.svg"
              alt="Loading..."
              width={16}
              height={16}
              className="animate-paw-spin-fast filter drop-shadow-sm"
            />
          </div>
        )}
        {!loading && leftIcon && <span className="mr-toy">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="ml-toy">{rightIcon}</span>}
      </button>
    )
  }
)

BrandedButton.displayName = "BrandedButton"

export { BrandedButton, brandedButtonVariants }