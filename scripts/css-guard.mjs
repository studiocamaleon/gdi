#!/usr/bin/env node
/**
 * Trinquete para globals.css.
 *
 * El problema que vigila: CSS no tiene módulos, así que toda clase que se
 * escribe sin ancestro es una variable global. Con 38k líneas ya no hay forma
 * de saber a mano quién pisa a quién, y el archivo sólo crece porque nadie
 * puede borrar con confianza.
 *
 * Este script NO arregla lo viejo. Impide que empeore:
 *   - clase global NUEVA que no estaba en la línea de base -> ERROR
 *   - globals.css que crece -> aviso (no corta: a veces hay que tocar tokens)
 *   - clase global que DESAPARECE -> felicita y pide actualizar la base
 *
 * Uso:
 *   node scripts/css-guard.mjs             # verifica
 *   node scripts/css-guard.mjs --update    # reescribe la línea de base
 *   node scripts/css-guard.mjs --list      # lista las globales de hoy
 *
 * Qué cuenta como "global de verdad": un selector que es UNA clase sola.
 *   .code {}            -> GLOBAL. Le pega a cualquier `code` de la app.
 *   .gf .wrap {}        -> no: la protege el ancestro .gf
 *   .maq-btn.activo {}  -> no: la protege la clase hermana
 *   button.foo {}       -> no: la acota el tag
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOJA = join(RAIZ, "src/app/globals.css");
const BASE = join(RAIZ, "scripts/css-guard-baseline.json");

/** Selectores que son una clase sola, con la línea donde aparecen. */
export function analizar(css) {
  const lineas = css.split("\n");
  const offsets = [];
  let acc = 0;
  for (const l of lineas) {
    offsets.push(acc);
    acc += l.length + 1;
  }
  const lineaDe = (off) => {
    let lo = 0;
    let hi = offsets.length - 1;
    let r = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] <= off) {
        r = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return r + 1;
  };
  // Los comentarios se blanquean en vez de borrarse para no correr los offsets.
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));

  const globales = new Map(); // clase -> Set<línea>
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(limpio))) {
    const crudo = m[1];
    const selector = crudo.trim();
    if (!selector || selector.startsWith("@")) continue;
    const linea = lineaDe(m.index + crudo.length);

    for (const parte of selector.split(",")) {
      const s = parte.trim();
      if (!s) continue;
      // Con combinador (descendiente, >, +, ~) hay ancestro: está protegida.
      const compuestos = s.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
      if (compuestos.length > 1) continue;

      const unico = compuestos[0];
      // Fuera pseudo-clases y pseudo-elementos: `.btn:hover` sigue siendo .btn.
      const base = unico.replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, "");
      // Fuera selectores de atributo: `.btn[aria-disabled="true"]`.
      const sinAttr = base.replace(/\[[^\]]*\]/g, "");
      const clases = (sinAttr.match(/\.[a-zA-Z0-9_-]+/g) || []).map((c) => c.slice(1));

      if (clases.length !== 1) continue; // 0 = tag puro; 2+ = compuesta
      if (!sinAttr.trim().startsWith(".")) continue; // cuelga de un tag

      const clase = clases[0];
      if (!globales.has(clase)) globales.set(clase, new Set());
      globales.get(clase).add(linea);
    }
  }
  return globales;
}

function contarModulos(dir, acc = { modulos: 0, vistas: 0 }) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) contarModulos(p, acc);
    else if (e.endsWith(".module.css")) acc.modulos++;
  }
  return acc;
}

// Todo lo de abajo corre SÓLO si se ejecuta el script directamente. Si no,
// importar `analizar` desde otro lado dispararía el chequeo entero y su
// process.exit().
if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // Importado como módulo: sólo se ofrece `analizar`.
} else {
  main();
}

function main() {
const css = readFileSync(HOJA, "utf8");
const globales = analizar(css);
const clases = [...globales.keys()].sort();
const totalLineas = css.split("\n").length;
const { modulos } = contarModulos(join(RAIZ, "src"));

const args = process.argv.slice(2);

if (args.includes("--list")) {
  for (const c of clases) {
    console.log(`.${c}  →  L${[...globales.get(c)].sort((a, b) => a - b).join(", L")}`);
  }
  process.exit(0);
}

const instantanea = {
  _comentario:
    "Línea de base de css-guard. NO editar a mano: correr `npm run css:guard -- --update`. " +
    "Los números sólo deberían bajar.",
  totalLineas,
  clasesGlobales: clases.length,
  globales: clases,
};

if (args.includes("--update")) {
  writeFileSync(BASE, `${JSON.stringify(instantanea, null, 2)}\n`);
  console.log(`Línea de base actualizada: ${clases.length} clases globales, ${totalLineas} líneas.`);
  process.exit(0);
}

if (!existsSync(BASE)) {
  console.error("No hay línea de base. Corré: npm run css:guard -- --update");
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASE, "utf8"));
const previas = new Set(base.globales);
const nuevas = clases.filter((c) => !previas.has(c));
const eliminadas = base.globales.filter((c) => !globales.has(c));

console.log("globals.css");
console.log(`  líneas:          ${totalLineas}  (base ${base.totalLineas})`);
console.log(`  clases globales: ${clases.length}  (base ${base.clasesGlobales})`);
console.log(`  módulos CSS:     ${modulos}`);

let falla = false;

if (nuevas.length) {
  falla = true;
  console.error(`\n✗ ${nuevas.length} clase(s) global(es) nueva(s) en globals.css:\n`);
  for (const c of nuevas) {
    const ls = [...globales.get(c)].sort((a, b) => a - b);
    console.error(`    .${c}  (L${ls.join(", L")})`);
  }
  console.error(`
  Una clase sin ancestro le pega a TODA la app. Opciones, en orden:

    1. Que la vista nueva nazca con su propio archivo:
         mi-vista.module.css  +  import s from "./mi-vista.module.css"
       Adentro el nombre puede ser tan corto como quieras: el compilador lo
       aísla solo. Es la salida recomendada.

    2. Si de verdad va en globals.css, colgala de un ancestro:
         .mi-vista .card { ... }     en vez de     .card { ... }

    3. Si es a propósito parte del sistema compartido (.btn, .tbl, .tag…),
       sumala a la base a conciencia:
         npm run css:guard -- --update
`);
}

if (totalLineas > base.totalLineas) {
  console.warn(
    `\n⚠ globals.css creció ${totalLineas - base.totalLineas} línea(s). ` +
      `Si era inevitable (tokens, reset), actualizá la base; si era una vista, va en su módulo.`,
  );
}

if (eliminadas.length) {
  console.log(`\n✓ ${eliminadas.length} clase(s) global(es) menos: ${eliminadas.slice(0, 12).join(", ")}${eliminadas.length > 12 ? "…" : ""}`);
  console.log("  Bajá el listón: npm run css:guard -- --update");
}

if (!falla && !eliminadas.length && totalLineas <= base.totalLineas) {
  console.log("\n✓ sin globales nuevas.");
}

process.exit(falla ? 1 : 0);
}
