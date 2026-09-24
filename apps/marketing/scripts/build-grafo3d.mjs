import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";

const marketing = fileURLToPath(new URL("../", import.meta.url));
const studio = path.resolve(marketing, "../forma-studio");
const destination = path.join(marketing, "public/grafo3d");
const development = process.argv.includes("--development");
nextEnv.loadEnvConfig(marketing, development);

// Se compila el editor por separado: sus estilos, React, Three y WASM no
// forman parte del bundle ni del renderizado de la portada de Next.
execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", [
  "run", "build", "--", "--base=/3d/", "--outDir=dist-web",
], { cwd: studio, stdio: "inherit" });

const site = new URL(process.env.MARKETING_SITE_URL ||
  (development ? "http://localhost:3002" : "https://grafoprint.com.ar"));
if (!["https:", "http:"].includes(site.protocol)) {
  throw new Error("MARKETING_SITE_URL debe ser una dirección http o https.");
}
const canonical = new URL("/3d", site).href;
const escape = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
let html = await readFile(path.join(studio, "dist-web/index.html"), "utf8");
const schema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Grafo3D",
  url: canonical,
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  isAccessibleForFree: true,
  publisher: { "@type": "Organization", name: "Grafoprint", url: site.origin },
};
html = html.replace("</head>", `
    <link rel="canonical" href="${escape(canonical)}" />
    <meta property="og:url" content="${escape(canonical)}" />
    <meta property="og:image" content="${escape(new URL("/3d/brand/grafo3d-logo.png", site).href)}" />
    <script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>
  </head>`);
// Esta carpeta contiene exclusivamente el compilado generado, ignorado en Git.
// No se modifica dist/, que sigue disponible para usar el editor por separado.
await mkdir(path.dirname(destination), { recursive: true });
await rm(destination, { recursive: true, force: true });
await cp(path.join(studio, "dist-web"), destination, { recursive: true });
await writeFile(path.join(destination, "index.html"), html);
console.log("Grafo3D preparado para /3d.");
