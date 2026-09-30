import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        // Permite los visores internos del mismo origen. La política de scripts
        // con nonces necesita validar por separado Meta, PDFs y el editor.
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'" },
      ],
    }];
  },
  // Ensayo Docker local con tipos previamente comprobados en el host.
  typescript: { ignoreBuildErrors: process.env.GRAFOPRINT_BUILD_SKIP_TYPECHECK === "true" },
};

export default nextConfig;
