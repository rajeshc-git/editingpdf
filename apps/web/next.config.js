const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Hide the Next.js dev tools / build-activity floating indicator button
  devIndicators: false,
  // In a monorepo, pin the file-tracing root to the repo root so the
  // standalone bundle mirrors the workspace layout (apps/web/server.js).
  // Without this, Next may infer the wrong root and emit server.js at the
  // standalone root, breaking `CMD ["node", "apps/web/server.js"]`.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  transpilePackages: ['@open-pdf/ui', '@open-pdf/editor-core', '@open-pdf/types'],
}

module.exports = nextConfig
