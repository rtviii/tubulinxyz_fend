/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable to prevent double Molstar initialization in development
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Handle Molstar's large bundle size
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
