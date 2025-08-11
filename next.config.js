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
  }
  
  module.exports = nextConfig