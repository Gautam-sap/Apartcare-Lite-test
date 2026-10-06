/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
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
