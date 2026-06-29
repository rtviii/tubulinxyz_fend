/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    // Dev only: `yarn dev` has no /api route, so proxy /api/* to the local
    // uvicorn (api/main.py) on :8000. In production the frontend container
    // sits behind nginx, which terminates /api/ before Next ever sees it.
    const target = process.env.API_PROXY_TARGET || 'http://localhost:8000';
    return [
      { source: '/api/:path*', destination: `${target}/:path*` },
    ];
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
