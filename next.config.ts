import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  // Ensayo Docker local con tipos previamente comprobados en el host.
  typescript: { ignoreBuildErrors: process.env.GRAFOPRINT_BUILD_SKIP_TYPECHECK === "true" },
};

export default nextConfig;
