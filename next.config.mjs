/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ Allow Cloudflare + custom domain for dev access
  experimental: {
    allowedDevOrigins: [
      "https://www.askgobi.net",
      "https://askgobi.net"
    ],
  },
};

export default nextConfig;
