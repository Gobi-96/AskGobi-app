/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Separate local preview output from release builds.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
};

export default nextConfig;
