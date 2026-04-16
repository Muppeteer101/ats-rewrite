import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Server-only packages that must NOT be bundled for the edge / client.
  // pdf-parse-style packages and jsdom rely on Node APIs.
  serverExternalPackages: ['unpdf', 'mammoth', 'jsdom', '@mozilla/readability', 'jspdf'],
};

export default nextConfig;
