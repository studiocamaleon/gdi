import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests unitarios del frontend. Casi todo lo que está bajo test es lógica
 * pura (motores de cálculo en src/lib), así que alcanza con el entorno
 * node y el alias "@/" que replica el de tsconfig.json.
 *
 * Los .tsx entran para poder renderizar componentes a markup estático con
 * renderToStaticMarkup — sin DOM, sólo para verificar el armado y que un
 * crash en el render rompa la suite.
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
