import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // El editor usa Tailwind vía Vite y no debe heredar el PostCSS del SaaS.
  css: { postcss: { plugins: [] } },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  worker: { format: "es" },
  build: { target: "es2022" },
});
