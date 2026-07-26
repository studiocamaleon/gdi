/**
 * El diseño del sello: lo que el comercial cargó en el editor y viaja en el
 * `jobContext` del ítem.
 *
 * Vive acá y no en el componente del editor porque el arte ya no se genera
 * sólo mientras el editor está abierto: al guardar la orden se regenera desde
 * este dato para subirlo a los Archivos del ítem, y eso pasa lejos de la UI.
 *
 * Por eso el diseño incluye el MODELO (las medidas de la matriz): sin él, el
 * dato guardado no alcanza para redibujar el sello y habría que ir a buscar la
 * variante del cuerpo otra vez. Es opcional porque los diseños guardados antes
 * de esto no lo tienen.
 */

import type { Alineacion } from "./engine";

export type SelloLineaDiseno = { text: string; bold: boolean; italic: boolean };

/** Medidas de la matriz de polímero, copiadas de la variante del cuerpo. */
export type SelloModeloDiseno = {
  nombre: string;
  widthMm: number;
  heightMm: number;
  lineasMax: number;
};

export type DisenoSello = {
  lineas: SelloLineaDiseno[];
  align: Alineacion;
  fontKey: string;
  modelo?: SelloModeloDiseno;
};

/** Diseño que alcanza para dibujar: el que tiene medidas y al menos una línea. */
export type DisenoSelloCompleto = DisenoSello & { modelo: SelloModeloDiseno };

const ALINEACIONES: Alineacion[] = ["left", "center", "right"];

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function leerLineas(valor: unknown): SelloLineaDiseno[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((l) => {
    if (!esObjeto(l) || typeof l.text !== "string") return [];
    return [{ text: l.text, bold: l.bold === true, italic: l.italic === true }];
  });
}

function leerModelo(valor: unknown): SelloModeloDiseno | undefined {
  if (!esObjeto(valor)) return undefined;
  const { nombre, widthMm, heightMm, lineasMax } = valor;
  if (typeof widthMm !== "number" || typeof heightMm !== "number") return undefined;
  if (!(widthMm > 0) || !(heightMm > 0)) return undefined;
  return {
    nombre: typeof nombre === "string" ? nombre : "Sello",
    widthMm,
    heightMm,
    lineasMax:
      typeof lineasMax === "number" && lineasMax > 0 ? Math.floor(lineasMax) : 1,
  };
}

/**
 * Saca el diseño del `jobContext` del ítem. Devuelve null si no hay sello o si
 * lo guardado no alcanza para dibujarlo — el jobContext es JSON opaco que
 * nadie valida al persistir, así que acá se desconfía de todo.
 */
export function leerDisenoSello(jobContext: unknown): DisenoSello | null {
  if (!esObjeto(jobContext)) return null;
  const crudo = jobContext.disenoSello;
  if (!esObjeto(crudo)) return null;

  const lineas = leerLineas(crudo.lineas);
  if (lineas.every((l) => l.text.trim() === "")) return null;

  const align = ALINEACIONES.includes(crudo.align as Alineacion)
    ? (crudo.align as Alineacion)
    : "center";

  return {
    lineas,
    align,
    fontKey: typeof crudo.fontKey === "string" ? crudo.fontKey : "archivo",
    modelo: leerModelo(crudo.modelo),
  };
}

/** ¿Se puede dibujar? Sin medidas de la matriz, no. */
export function esDisenoCompleto(
  diseno: DisenoSello | null,
): diseno is DisenoSelloCompleto {
  return diseno?.modelo != null;
}

/** Un ítem de orden ya persistido que tiene un sello para publicar. */
export type ItemConSello = {
  /** Id del OrdenTrabajoItem — sin él no hay a qué colgar el archivo. */
  ordenItemId: string;
  /** Sólo para poder nombrar el ítem en un aviso de error. */
  productoNombre: string;
  diseno: DisenoSello;
};

/**
 * Los ítems con sello de una orden ya guardada.
 *
 * Se lee del detalle que devuelve el guardado y no de los ítems locales de la
 * ficha: ahí vienen juntos el id del ítem persistido y su `jobContext`, que es
 * donde vive el diseño. Cruzar dos listas a mano sería una fuente de errores
 * al pedo.
 */
export function itemsConSelloDe(
  productos: Array<{
    id?: string | null;
    nombre?: string;
    snapshot?: { jobContext?: unknown } | null;
  }>,
): ItemConSello[] {
  return productos.flatMap((p) => {
    if (!p.id) return [];
    const diseno = leerDisenoSello(p.snapshot?.jobContext);
    if (!diseno) return [];
    return [
      {
        ordenItemId: p.id,
        productoNombre: p.nombre ?? "Sello",
        diseno,
      },
    ];
  });
}

/**
 * Nombre del archivo de arte. Mismo formato que usaba la descarga manual del
 * editor —el taller ya reconoce estos nombres— y determinístico: el mismo
 * diseño da siempre el mismo nombre.
 */
export function nombreArteSello(
  diseno: DisenoSelloCompleto,
  negativo: boolean,
): string {
  const base =
    (diseno.lineas.find((l) => l.text.trim() !== "")?.text ?? "sello")
      .trim()
      .replace(/[^\w-]+/g, "-")
      .slice(0, 24) || "sello";
  const medida = `${diseno.modelo.widthMm}x${diseno.modelo.heightMm}mm`;
  return `${base}-${medida}${negativo ? "-negativo" : ""}.eps`;
}
