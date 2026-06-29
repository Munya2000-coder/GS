/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ICMS handles compliance evidence files; allow generous body size for uploads (PRD: 25 MB max).
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
