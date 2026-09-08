import { mkdir, copyFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
await mkdir(new URL("vendor/", root), { recursive: true });
for (const name of ["wppconnect-wa.js", "wppconnect-wa.js.LICENSE.txt"]) {
  await copyFile(
    new URL(`node_modules/@wppconnect/wa-js/dist/${name}`, root),
    new URL(`vendor/${name}`, root),
  );
}
await copyFile(
  new URL("node_modules/@wppconnect/wa-js/LICENSE", root),
  new URL("vendor/WA-JS-LICENSE", root),
);
