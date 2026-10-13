import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Permite los visores internos del mismo origen. La política de scripts
          // con nonces necesita validar por separado Meta, PDFs y el editor.
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
  // Ensayo Docker local con tipos previamente comprobados en el host.
  typescript: {
    ignoreBuildErrors: process.env.GRAFOPRINT_BUILD_SKIP_TYPECHECK === "true",
  },
};

export default async function configurarNext(phase: string) {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...nextConfig,
      // Liberar rutas inactivas antes de que la compilación local alcance 2 GB.
      onDemandEntries: { maxInactiveAge: 15_000, pagesBufferLength: 2 },
      experimental: {
        webpackMemoryOptimizations: true,
        turbopackMemoryEviction: "full",
        optimizePackageImports: ["@heroui/react", "react-aria-components"],
      },
    } satisfies NextConfig;
  }

  // La instrumentación automática de cada módulo se usa en las imágenes
  // publicadas. En desarrollo conservamos los errores de Next y el SDK manual.
  const { withSentryConfig } = await import("@sentry/nextjs/config");
  return withSentryConfig(nextConfig, {
    org: "grafoprint",
    project: "grafoprint-web",
    telemetry: false,
    silent: true,
    // Primera etapa: sin publicar mapas ni código fuente a un tercero.
    sourcemaps: { disable: true },
  });
}
