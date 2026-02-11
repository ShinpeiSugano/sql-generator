import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // API routesの静的最適化を無効化
  skipTrailingSlashRedirect: true,
  skipProxyUrlNormalize: true,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
