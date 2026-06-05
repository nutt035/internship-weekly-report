/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase the body size limit for the API routes that handle image uploads.
  // Vercel's default is 4.5 MB which is too small when users upload 3 photos + a signature.
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
};

export default nextConfig;
