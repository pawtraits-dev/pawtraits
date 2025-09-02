/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
      // !! WARN !!
      // Dangerously allow production builds to successfully complete even if
      // your project has type errors.
      ignoreBuildErrors: true,
    },
    transpilePackages: [],
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'hmqlxpgqzknqrnomophg.supabase.co',
          port: '',
          pathname: '/storage/v1/object/public/**',
        },
        {
          protocol: 'https',
          hostname: 'res.cloudinary.com',
          port: '',
          pathname: '/**',
        },
      ],
    },
    webpack: (config) => {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
      return config;
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: blob: https: https://hmqlxpgqzknqrnomophg.supabase.co https://res.cloudinary.com",
                "connect-src 'self' https://hmqlxpgqzknqrnomophg.supabase.co https://res.cloudinary.com https://api.stripe.com wss://realtime.supabase.co",
                "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
                "media-src 'self' https://res.cloudinary.com",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "upgrade-insecure-requests"
              ].join('; ')
            }
          ]
        }
      ];
    }
  }
  
  module.exports = nextConfig