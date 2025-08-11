/** @type {import('next').NextConfig} */
const nextConfig = {
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