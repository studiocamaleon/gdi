import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests unitarios del frontend. Los módulos bajo test son lógica pura
 * (motores de cálculo en src/lib), así que alcanza con el entorno node y
 * el alias "@/" que replica el de tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
