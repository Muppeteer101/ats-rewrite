import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // Server-only packages that must NOT be bundled for the edge / client.
  // pdf-parse-style packages and jsdom rely on Node APIs.
  serverExternalPackages: ['unpdf', 'mammoth', 'jsdom', '@mozilla/readability', 'jspdf'],
};

export default withNextIntl(nextConfig);
