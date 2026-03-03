import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/couple-points',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
