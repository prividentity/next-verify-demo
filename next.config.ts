import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_BASE_URL: process.env.BASE_URL,
  },
};

export default nextConfig;
