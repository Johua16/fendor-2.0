import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const cloudflarePackaging = process.env.NEXT_PRIVATE_STANDALONE === 'true';

const config: NextConfig = {
  // OpenNext packages the traced server files from this standard Next output.
  // Netlify ignores it, so this remains compatible with the current host.
  output: 'standalone',
  poweredByHeader: false,
  // OpenNext supplies its own app-root tracing mode.  Keeping the historical
  // repository root for normal Next/Netlify builds preserves shared server
  // module tracing without triggering the adapter's monorepo packaging bug.
  ...(cloudflarePackaging ? {} : {
    outputFileTracingRoot: repositoryRoot,
    turbopack: { root: repositoryRoot },
  }),
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : [])
    ] }];
  }
};
export default config;
