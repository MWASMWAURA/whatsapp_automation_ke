import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove rewrites for production - API routes are handled by Next.js
  // In development, you can use rewrites if backend runs separately
  ...(process.env.NODE_ENV === 'development' && {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ];
    },
  }),

  // Vercel deployment optimizations
  serverExternalPackages: ['pg', '@wppconnect-team/wppconnect'],

  // Environment variables for build time
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  },
};

export default nextConfig;
