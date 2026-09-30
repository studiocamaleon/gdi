import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseSvg } from "../index.js";
const path = '<path d="M0 0 L10 0 L10 10 Z" />';
// Un proceso separado permite cortar un parser bloqueado sin trabar el runner.
for (const [nombre, atributo] of [
    ["atributo sin signo igual", "x".repeat(100_000)],
    ["longitud con unidad inválida", `width="${"1".repeat(100_000)}X"`],
]) {
    test(`termina ante ${nombre}`, () => {
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import { readFileSync } from 'node:fs';
      import { parseSvg } from ${JSON.stringify(new URL("../index.js", import.meta.url).href)};
      try { parseSvg(readFileSync(0, 'utf8')); } catch { /* Rechazo permitido. */ }
    `], {
            input: `<svg viewBox="0 0 10 10" ${atributo}>${path}</svg>`,
            encoding: "utf8",
            timeout: 1500,
            maxBuffer: 16_384,
        });
        assert.ifError(result.error);
        assert.equal(result.status, 0, result.stderr);
    });
}
test("conserva longitudes decimales, exponentes y atributos entre comillas", () => {
    for (const medida of ["12.5mm", ".125e2mm", "+1.25cm"]) {
        const parsed = parseSvg(`<svg viewBox='0 0 10 10' width='${medida}' height="${medida}">${path}</svg>`);
        assert.equal(parsed.widthMm, 12.5);
        assert.equal(parsed.heightMm, 12.5);
        assert.equal(parsed.contours.length, 1);
    }
});
//# sourceMappingURL=parser-limits.test.js.map