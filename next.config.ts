import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Do not fail production builds on ESLint errors; surface them in CI/editor instead
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Improve external resource handling
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
