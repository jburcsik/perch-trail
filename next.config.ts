import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// The Next image optimizer only proxies hosts listed here. The Supabase host
// comes from the same env var the clients use, so one project setting covers
// both. The placeholder keeps `next build` working with no env at all.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Next 16.4 defaults to type-checking the whole tsconfig project with the tsc
  // CLI, which pulls in *.test.ts(x). Keep the pre-16.4 build check (app code
  // only, test files ignored).
  experimental: {
    useTypeScriptCli: false,
  },
  // sharp's native library is found by the dynamic linker, not by the file
  // tracer, so it is included explicitly for the two routes that use it.
  outputFileTracingIncludes: {
    '/api/admin/requests/*': ['node_modules/sharp/**/*', 'node_modules/@img/**/*'],
    '/api/health': ['node_modules/sharp/**/*', 'node_modules/@img/**/*'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      new URL(`${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/**`),
    ],
    minimumCacheTTL: 2678400,
    qualities: [75],
  },
};

export default withNextIntl(nextConfig);
