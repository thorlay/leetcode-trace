import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lint runs as an explicit CI step; this avoids Next 15 invoking an
  // incompatible legacy ESLint adapter during production builds.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
