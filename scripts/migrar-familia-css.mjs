#!/usr/bin/env node
// Migra una familia de clases prefijadas de globals.css a un .module.css.
//
// Uso: node migrar-familia.mjs <prefijo> <lineaDesde> <lineaHasta> <rutaModulo> <tsx1> [tsx2...]
//
//  - Extrae globals.css líneas [desde..hasta] (1-based, inclusive) al módulo.
//  - Selectores: .<prefijo>-foo-bar  -> .fooBar (clase local camelCase)
//                cualquier otra .clase -> :global(.clase)  (tags quedan igual)
//  - Dedenta un nivel (2 espacios) porque el bloque vivía dentro de @layer.
//  - Borra el bloque de globals.css.
//  - En cada TSX: reescribe los tokens `<prefijo>-foo` dentro de className
//    (string literal o template) por ${s.foo}; el resto de los tokens queda
//    como string literal global.
//
// NO escribe nada con --dry: imprime el módulo generado y un diff resumido.
import { readFileSync, writeFileSync } from "node:fs";

const [prefijo, desdeS, hastaS, rutaModulo, ...tsxs] = process.argv.slice(2).filter((a) => a !== "--dry");
const dry = process.argv.includes("--dry");
const desde = Number(desdeS);
const hasta = Number(hastaS);
const GLOBALS = "src/app/globals.css";

const camel = (kebab) => kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

// ---------- 1. CSS ----------
const css = readFileSync(GLOBALS, "utf8");
const lineas = css.split("\n");
const bloque = lineas.slice(desde - 1, hasta); // 1-based inclusive

const locales = new Set(); // nombres camel generados

function transformarSelectorLinea(linea) {
  // 1) clases de la familia -> placeholder local
  let out = linea.replace(new RegExp(`\\.${prefijo}-([a-zA-Z0-9-]+)`, "g"), (_, resto) => {
    const nombre = camel(resto);
    locales.add(nombre);
    return `.__L_${nombre}__`;
  });
  // 2) el resto de las clases -> :global(.x)
  out = out.replace(/\.(?!__L_)([a-zA-Z][a-zA-Z0-9_-]*)/g, ":global(.$1)");
  // 3) placeholders -> clase local
  out = out.replace(/\.__L_([a-zA-Z0-9]+)__/g, ".$1");
  return out;
}

const salida = [];
let depth = 0; // fuera de llaves = contexto de selector (el bloque dedentado no tiene @media ni nesting)
let enComentario = false;
// dedentar sólo si el bloque vivía indentado (dentro de @layer): lo dice su primera regla
const primeraRegla = bloque.find((l) => /^\s*\./.test(l));
const dedentar = primeraRegla ? /^  \./.test(primeraRegla) : false;
for (const raw of bloque) {
  const l = dedentar && raw.startsWith("  ") ? raw.slice(2) : raw;
  const t = l.trim();
  const esSelector = depth === 0 && !enComentario && t !== "" && !t.startsWith("@") && !t.startsWith("/*");
  salida.push(esSelector ? transformarSelectorLinea(l) : l);
  // actualizar estado de comentario y llaves (aproximado por línea: alcanza para CSS prettier-formateado)
  if (!enComentario && t.includes("/*") && !t.includes("*/")) enComentario = true;
  else if (enComentario && t.includes("*/")) enComentario = false;
  if (!enComentario && !t.startsWith("/*")) {
    for (const ch of t) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  }
}
if (depth !== 0) throw new Error(`llaves desbalanceadas en el bloque: depth final ${depth}`);
const moduloCss = `${salida.join("\n").trim()}\n`;

// ---------- 2. globals.css sin el bloque ----------
// borra también la línea de comentario inmediatamente anterior si es un comentario suelto
let ini = desde - 1;
if (/^\s*\/\*.*\*\/\s*$/.test(lineas[ini - 1] ?? "")) ini -= 1;
// y una línea en blanco de sobra si quedan dos seguidas
const nuevasLineas = [...lineas.slice(0, ini), ...lineas.slice(hasta)];
if (nuevasLineas[ini - 1]?.trim() === "" && nuevasLineas[ini]?.trim() === "") nuevasLineas.splice(ini, 1);
const nuevoGlobals = nuevasLineas.join("\n");

// ---------- 3. TSX ----------
const importPath = `./${rutaModulo.split("/").pop()}`;
const resultTsx = [];
for (const tsx of tsxs) {
  let src = readFileSync(tsx, "utf8");
  let reemplazos = 0;
  const famToken = new RegExp(`^${prefijo}-([a-zA-Z0-9-]+)$`);

  // className="a b c"  (string literal)
  src = src.replace(/className="([^"]*)"/g, (m, contenido) => {
    if (!contenido.split(/\s+/).some((tok) => famToken.test(tok))) return m;
    const partes = contenido.split(/\s+/).filter(Boolean).map((tok) => {
      const mm = tok.match(famToken);
      if (!mm) return { tipo: "lit", v: tok };
      const nombre = camel(mm[1]);
      if (!locales.has(nombre)) {
        console.warn(`  ⚠ ${tsx}: ${tok} sin regla en el bloque; queda literal`);
        return { tipo: "lit", v: tok };
      }
      reemplazos++;
      return { tipo: "mod", v: `s.${nombre}` };
    });
    if (partes.length === 1 && partes[0].tipo === "mod") return `className={${partes[0].v}}`;
    const cuerpo = partes.map((p) => (p.tipo === "mod" ? `\${${p.v}}` : p.v)).join(" ");
    return `className={\`${cuerpo}\`}`;
  });

  // className={`...`} (template literal): sólo tokens de la familia
  src = src.replace(/className=\{`([^`]*)`\}/g, (m, contenido) => {
    if (!new RegExp(`(^|\\s)${prefijo}-`).test(contenido)) return m;
    const nuevo = contenido.replace(new RegExp(`(^|\\s)${prefijo}-([a-zA-Z0-9-]+)`, "g"), (todo, pre, resto) => {
      const nombre = camel(resto);
      if (!locales.has(nombre)) {
        console.warn(`  ⚠ ${tsx}: ${prefijo}-${resto} sin regla en el bloque; queda literal`);
        return todo;
      }
      reemplazos++;
      return `${pre}\${s.${nombre}}`;
    });
    return `className={\`${nuevo}\`}`;
  });

  // import
  if (!src.includes(importPath)) {
    const lineasTsx = src.split("\n");
    let ultimoImport = -1;
    for (let i = 0; i < lineasTsx.length; i++) if (/^import\b/.test(lineasTsx[i])) ultimoImport = i;
    lineasTsx.splice(ultimoImport + 1, 0, `import s from "${importPath}";`);
    src = lineasTsx.join("\n");
  }
  resultTsx.push({ tsx, src, reemplazos });
}

// ---------- salida ----------
console.log(`bloque: ${bloque.length} líneas · clases locales: ${locales.size}`);
for (const r of resultTsx) console.log(`${r.tsx}: ${r.reemplazos} tokens reemplazados`);
const restantes = nuevoGlobals.match(new RegExp(`\\.${prefijo}-`, "g"));
console.log(`.${prefijo}- restantes en globals.css: ${restantes ? restantes.length : 0}`);

if (dry) {
  console.log("\n--- módulo (primeras 60 líneas) ---");
  console.log(moduloCss.split("\n").slice(0, 60).join("\n"));
  process.exit(0);
}

writeFileSync(rutaModulo, moduloCss);
writeFileSync(GLOBALS, `${nuevoGlobals}`);
for (const r of resultTsx) writeFileSync(r.tsx, r.src);
console.log("escrito.");
