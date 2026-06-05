/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Raises the body-size limit for *Server Actions* (RSC form actions).
    // Note: this does NOT apply to App-Router API Route Handlers (route.ts).
    // For route handlers, use `export const maxDuration` / `export const dynamic`
    // segment config exports, which is done in app/api/weekly-report/route.ts.
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
