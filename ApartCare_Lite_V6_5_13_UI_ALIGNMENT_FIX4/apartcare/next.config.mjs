/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        { source: '/api', destination: 'http://127.0.0.1:8000/' },
        { source: '/api/:path*', destination: 'http://127.0.0.1:8000/:path*' },
      ];
    }
    return [];
  },
};

export default nextConfig;
