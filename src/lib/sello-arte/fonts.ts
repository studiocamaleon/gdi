/**
 * Carga de fuentes para el configurador de sello (browser).
 *
 * opentype.js se importa dinámicamente (solo cuando se abre el editor, para no
 * pesar en el bundle principal) y parsea los TTF de `/fonts/sellos`. Devuelve un
 * `FontResolver` que el motor usa para convertir texto → contornos.
 *
 * Nota: hoy se carga UNA instancia por familia (peso default del variable font);
 * bold/italic reales por línea es un refinamiento pendiente (el resolver ya
 * recibe los flags). Ver docs/sellos-configurador-implementacion.md.
 */
import type { FontResolver, OpenTypeFont } from "./engine";

export type TipografiaSello = {
  key: string;
  /** Nombre visible en la card. */
  nombre: string;
  /** font-family CSS (para inputs y fallback). */
  cssFamily: string;
  /** Archivo TTF en /public/fonts/sellos. */
  archivo: string;
};

export const TIPOGRAFIAS_SELLO: TipografiaSello[] = [
  { key: "archivo", nombre: "Archivo", cssFamily: "'Archivo', sans-serif", archivo: "Archivo.ttf" },
  { key: "playfair", nombre: "Playfair", cssFamily: "'Playfair Display', serif", archivo: "PlayfairDisplay.ttf" },
  { key: "oswald", nombre: "Oswald", cssFamily: "'Oswald', sans-serif", archivo: "Oswald.ttf" },
  { key: "dancing", nombre: "Manuscrita", cssFamily: "'Dancing Script', cursive", archivo: "DancingScript.ttf" },
  { key: "slab", nombre: "Roboto Slab", cssFamily: "'Roboto Slab', serif", archivo: "RobotoSlab.ttf" },
];

const BASE_PATH = "/fonts/sellos/";

type OpentypeModule = {
  parse: (buffer: ArrayBuffer) => OpenTypeFont;
};

let opentypePromise: Promise<OpentypeModule> | null = null;
function loadOpentype(): Promise<OpentypeModule> {
  if (!opentypePromise) {
    opentypePromise = import("opentype.js").then((mod) => {
      const m = mod as unknown as { parse?: OpentypeModule["parse"]; default?: OpentypeModule };
      const parse = m.parse ?? m.default?.parse;
      if (!parse) throw new Error("opentype.js: parse no disponible");
      return { parse };
    });
  }
  return opentypePromise;
}

const fontCache = new Map<string, OpenTypeFont>();

/**
 * Precarga todas las tipografías del sello y devuelve un resolver listo para el
 * motor. Idempotente: reusa la cache entre aperturas del editor.
 */
export async function cargarTipografiasSello(): Promise<FontResolver> {
  const opentype = await loadOpentype();
  await Promise.all(
    TIPOGRAFIAS_SELLO.map(async (t) => {
      if (fontCache.has(t.key)) return;
      const res = await fetch(BASE_PATH + t.archivo);
      if (!res.ok) throw new Error(`No se pudo cargar la fuente ${t.nombre} (${res.status})`);
      const buf = await res.arrayBuffer();
      fontCache.set(t.key, opentype.parse(buf));
    }),
  );
  // Resolver: hoy una instancia por familia (bold/italic se ignoran a nivel de
  // archivo; el layout ya los diferencia en tamaño). Fallback a la primera.
  return (fontKey) => {
    return (
      fontCache.get(fontKey) ??
      fontCache.get(TIPOGRAFIAS_SELLO[0].key) ??
      (() => {
        throw new Error(`Fuente no cargada: ${fontKey}`);
      })()
    );
  };
}
