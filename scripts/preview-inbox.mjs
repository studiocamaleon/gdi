/** Preview aislada de diseño: sólo loopback, sin .env, sesiones, API ni Meta. */
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const preview = mkdtempSync(join(tmpdir(), "grafo-inbox-preview-"));
const port = process.env.INBOX_PREVIEW_PORT || "3015";
if (!/^\d{4,5}$/.test(port) || Number(port) > 65535)
  throw new Error("Puerto de preview inválido");
mkdirSync(join(preview, "app"));
mkdirSync(join(preview, "app/abrir"));
symlinkSync(
  realpathSync(join(root, "node_modules")),
  join(preview, "node_modules"),
  "dir",
);
symlinkSync(join(root, "scripts"), join(preview, "scripts"), "dir");
writeFileSync(
  join(preview, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
);
writeFileSync(
  join(preview, "next.config.mjs"),
  `export default {devIndicators:false,experimental:{externalDir:true},webpack(config){config.resolve.alias['@']=${JSON.stringify(join(root, "src"))};return config;}};`,
);
writeFileSync(
  join(preview, "postcss.config.mjs"),
  `export {default} from ${JSON.stringify(join(root, "postcss.config.mjs"))};`,
);
writeFileSync(
  join(preview, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "esnext"],
      jsx: "react-jsx",
      module: "esnext",
      moduleResolution: "bundler",
      esModuleInterop: true,
      skipLibCheck: true,
      paths: { "@/*": [join(root, "src/*")] },
    },
  }),
);
writeFileSync(
  join(preview, "app/page.tsx"),
  'import {InboxPreview} from "@/components/inbox/preview/inbox-preview"; export default function Page(){return <InboxPreview/>;}',
);
writeFileSync(
  join(preview, "app/abrir/page.tsx"),
  'import {InboxLaunchPreview} from "@/components/inbox/preview/inbox-launch-preview"; export default function Page(){return <InboxLaunchPreview href="/"/>;}',
);
writeFileSync(
  join(preview, "app/layout.tsx"),
  `import {Geist,Geist_Mono} from 'next/font/google';import {TooltipProvider} from '@/components/ui/tooltip';import ${JSON.stringify(join(root, "src/app/globals.css"))};const sans=Geist({subsets:['latin'],variable:'--font-sans'});const mono=Geist_Mono({subsets:['latin'],variable:'--font-geist-mono'});export const metadata={title:'Grafo · Inbox · Prototipo'};export default function Layout({children}:{children:React.ReactNode}){return <html lang="es" className={sans.variable}><body className={mono.variable}><TooltipProvider>{children}</TooltipProvider></body></html>;}`,
);
console.log(
  `Inbox de diseño: http://127.0.0.1:${port} · Ctrl+C para detener. No usa conexiones reales.`,
);
const child = spawn(
  process.execPath,
  [
    join(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--webpack",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    cwd: preview,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      NODE_OPTIONS: "--max-old-space-size=2048",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
