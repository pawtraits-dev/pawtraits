/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Pet-friendly color system with brand colors (HSL CSS variables)
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        // Pawtraits brand colors
        primary: {
          DEFAULT: "hsl(var(--primary))",           // #6B46C1 - Rich purple (trust, premium)
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",         // #F69E0B - Vibrant orange (energy, warmth)
          foreground: "hsl(var(--secondary-foreground))",
        },
        tertiary: {
          DEFAULT: "hsl(var(--tertiary))",          // #94CA42 - Fresh green (nature, health)
          foreground: "hsl(var(--tertiary-foreground))",
        },
        
        // UI system colors
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",            // Maps to secondary for consistency
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        // Semantic colors using brand palette
        success: {
          DEFAULT: "hsl(var(--tertiary))",          // Use brand green for success
          foreground: "hsl(var(--tertiary-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--secondary))",         // Use brand orange for warnings
          foreground: "hsl(var(--secondary-foreground))",
        },
        
        // User type specific themes (variations of brand colors)
        partner: {
          DEFAULT: "hsl(262 52% 45%)",              // Deeper purple for professional context
          foreground: "hsl(262 20% 97%)",
        },
        customer: {
          DEFAULT: "hsl(262 52% 65%)",              // Lighter purple for emotional context
          foreground: "hsl(262 20% 97%)",
        },
        admin: {
          DEFAULT: "hsl(262 52% 35%)",              // Darkest purple for admin authority
          foreground: "hsl(262 20% 97%)",
        },
      },
      
      // Pet-friendly font system
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'], // For headers and emotional content
      },
      
      // Complete typography scale optimized for readability
      fontSize: {
        xs: ['12px', { lineHeight: '16px', letterSpacing: '0.025em' }],    // Captions, metadata
        sm: ['14px', { lineHeight: '20px', letterSpacing: '0.025em' }],    // Small text, labels  
        base: ['16px', { lineHeight: '24px', letterSpacing: '0.016em' }],  // Body text default
        lg: ['18px', { lineHeight: '28px', letterSpacing: '0.016em' }],    // Large body, component titles
        xl: ['20px', { lineHeight: '28px', letterSpacing: '0.009em' }],    // Subsection headers
        '2xl': ['24px', { lineHeight: '32px', letterSpacing: '0.009em' }], // Section headers
        '3xl': ['32px', { lineHeight: '40px', letterSpacing: '-0.016em' }], // Page titles
        '4xl': ['40px', { lineHeight: '48px', letterSpacing: '-0.025em' }], // Hero titles
        '5xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.025em' }], // Landing page heroes
      },
      
      // Strategic font weight system
      fontWeight: {
        normal: '400',    // Regular body text
        medium: '500',    // Emphasized text, labels, button text
        semibold: '600',  // Subheadings, important UI text
        bold: '700',      // Headers, primary CTAs
        extrabold: '800', // Hero text and major headers
      },
      
      // 8px grid spacing system with pet-friendly names
      spacing: {
        'paw': '4px',     // 0.5 * base - minimal spacing
        'treat': '8px',   // 1 * base - small spacing  
        'toy': '12px',    // 1.5 * base - medium-small spacing
        'collar': '16px', // 2 * base - standard spacing
        'leash': '24px',  // 3 * base - large spacing
        'yard': '32px',   // 4 * base - extra large spacing
        'park': '48px',   // 6 * base - section spacing
        'field': '64px',  // 8 * base - page-level spacing
        'horizon': '96px', // 12 * base - major section breaks
      },
      
      // Consistent border radius system
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Pet-specific radius options
        'paw': '4px',     // Small elements, badges
        'treat': '8px',   // Buttons, form inputs
        'toy': '12px',    // Cards, modals
        'collar': '16px', // Large cards, hero sections
      },
      
      // Pet-themed animation system
      animation: {
        // Existing paw animations (enhanced)
        'paw-spin-slow': 'pawSpin 4s ease-in-out infinite',
        'paw-spin-normal': 'pawSpin 3s ease-in-out infinite', 
        'paw-spin-fast': 'pawSpin 2s ease-in-out infinite',
        
        // New pet-themed animations
        'tail-wag': 'tailWag 1.5s ease-in-out infinite',
        'gentle-bounce': 'gentleBounce 2s ease-in-out infinite',
        'treat-drop': 'treatDrop 0.6s ease-out',
        'paw-print': 'pawPrint 0.8s ease-out',
        
        // UI-specific animations
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        
        // Loading states for different contexts
        'ai-generation': 'aiGeneration 3s ease-in-out infinite',
        'photo-upload': 'photoUpload 2s ease-in-out infinite',
      },
      
      // Enhanced keyframes for pet-themed animations
      keyframes: {
        // Existing paw spin (enhanced)
        pawSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(360deg)' },
          '50%': { transform: 'rotate(360deg)' },
          '75%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        
        // New pet animations
        tailWag: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        gentleBounce: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        treatDrop: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' },
        },
        pawPrint: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        
        // UI animations
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0px)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        },
        
        // Context-specific loading animations
        aiGeneration: {
          '0%': { transform: 'rotate(0deg) scale(1)' },
          '33%': { transform: 'rotate(120deg) scale(1.1)' },
          '66%': { transform: 'rotate(240deg) scale(1)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
        photoUpload: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
      },
      
      // Enhanced box shadow system for depth and emotion
      boxShadow: {
        'paw': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'treat': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'toy': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'collar': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        'warm': '0 4px 14px 0 rgb(251 113 133 / 0.15)', // Warm shadow for emotional elements
        'cool': '0 4px 14px 0 rgb(59 130 246 / 0.15)',  // Cool shadow for professional elements
      },
      
      // Accessibility-focused utilities
      screens: {
        'xs': '375px',      // Mobile small
        'sm': '640px',      // Mobile large
        'md': '768px',      // Tablet
        'lg': '1024px',     // Desktop small
        'xl': '1280px',     // Desktop large
        '2xl': '1536px',    // Desktop extra large
      },
      
      // Z-index scale for layering
      zIndex: {
        'hide': '-1',
        'auto': 'auto',
        'base': '0',
        'docked': '10',
        'dropdown': '1000',
        'sticky': '1100',
        'banner': '1200',
        'overlay': '1300',
        'modal': '1400',
        'popover': '1500',
        'skipLink': '1600',
        'toast': '1700',
        'tooltip': '1800',
      },
    },
  },
  plugins: [
    // Consider adding these plugins for enhanced functionality:
    // require('@tailwindcss/forms'),
    // require('@tailwindcss/typography'),
    // require('@tailwindcss/aspect-ratio'),
    // require('tailwindcss-animate'),
  ],
}