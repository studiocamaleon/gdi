// Personalizaciones (áreas de decoración) de un producto: cada una tiene su
// propia medida, que maneja el costo del material de decoración (film DTF) y del
// paso de impresión, aparte de la medida del producto base.
// Ver docs/personalizaciones-diseno.md

export type PersonalizacionModoMedida = "FIJA" | "CLIENTE";

export type PersonalizacionProducto = {
  id: string;
  /** Código estable, referenciado por el paso vía paramsPasoJson.fuenteMedida. */
  codigo: string;
  nombre: string;
  /** FIJA = medida predefinida; CLIENTE = la ingresa el comercial al cotizar. */
  modoMedida: PersonalizacionModoMedida;
  /** Para FIJA es la medida; para CLIENTE es la sugerencia/placeholder. */
  anchoMm: number;
  altoMm: number;
  /** true = siempre presente; false = opcional (se activa en el sheet). */
  obligatoria: boolean;
};

/** Prefijo del ref en paramsPasoJson.fuenteMedida → 'personalizacion:<codigo>'. */
export const FUENTE_MEDIDA_PERSONALIZACION_PREFIX = "personalizacion:";

function numberFromMaybe(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function slugCodigo(value: string, fallback: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || fallback;
}

/** Parsea el JSON crudo del producto a la lista tipada de personalizaciones. */
export function getPersonalizaciones(
  personalizacionesJson: unknown,
): PersonalizacionProducto[] {
  if (!Array.isArray(personalizacionesJson)) return [];
  return personalizacionesJson
    .map((raw, index) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const nombre =
        typeof item.nombre === "string" && item.nombre.trim()
          ? item.nombre.trim()
          : `Personalización ${index + 1}`;
      const codigo =
        typeof item.codigo === "string" && item.codigo.trim()
          ? item.codigo.trim()
          : slugCodigo(nombre, `pers_${index + 1}`);
      return {
        id: typeof item.id === "string" && item.id ? item.id : `pers-${index + 1}`,
        codigo,
        nombre,
        modoMedida: item.modoMedida === "CLIENTE" ? "CLIENTE" : "FIJA",
        anchoMm: numberFromMaybe(item.anchoMm),
        altoMm: numberFromMaybe(item.altoMm),
        obligatoria: item.obligatoria !== false,
      } satisfies PersonalizacionProducto;
    });
}

export function nuevaPersonalizacion(index: number): PersonalizacionProducto {
  const n = index + 1;
  return {
    id: `pers-${Date.now()}-${n}`,
    codigo: `pers_${n}`,
    nombre: "",
    modoMedida: "CLIENTE",
    anchoMm: 0,
    altoMm: 0,
    obligatoria: true,
  };
}

/** Normaliza para guardar: nombres/códigos válidos y únicos. */
export function normalizePersonalizaciones(
  personalizaciones: PersonalizacionProducto[],
): PersonalizacionProducto[] {
  const usados = new Set<string>();
  return personalizaciones.map((p, index) => {
    const nombre = p.nombre?.trim() || `Personalización ${index + 1}`;
    let codigo = p.codigo?.trim() || slugCodigo(nombre, `pers_${index + 1}`);
    while (usados.has(codigo)) codigo = `${codigo}_${index + 1}`;
    usados.add(codigo);
    return {
      id: p.id || `pers-${index + 1}`,
      codigo,
      nombre,
      modoMedida: p.modoMedida === "CLIENTE" ? "CLIENTE" : "FIJA",
      anchoMm: numberFromMaybe(p.anchoMm),
      altoMm: numberFromMaybe(p.altoMm),
      obligatoria: p.obligatoria !== false,
    } satisfies PersonalizacionProducto;
  });
}

/** Clave que publica el sheet en el jobContext con el área de la personalización. */
export function personalizacionAreaKey(codigo: string) {
  return `personalizacion_${codigo}_areaM2`;
}

/** Área en m² de una personalización para una cantidad dada. */
export function personalizacionAreaM2(
  personalizacion: Pick<PersonalizacionProducto, "anchoMm" | "altoMm">,
  cantidad: number,
) {
  const area = (personalizacion.anchoMm * personalizacion.altoMm) / 1_000_000;
  return area * Math.max(0, cantidad);
}

/**
 * Extrae el código de personalización que alimenta a un paso desde
 * paramsPasoJson.fuenteMedida ('personalizacion:<codigo>'). Devuelve null si el
 * paso usa la medida global del producto (comportamiento por defecto).
 */
export function fuenteMedidaPersonalizacionCodigo(
  paramsPasoJson: unknown,
): string | null {
  if (!paramsPasoJson || typeof paramsPasoJson !== "object") return null;
  const fuente = (paramsPasoJson as Record<string, unknown>).fuenteMedida;
  if (typeof fuente !== "string") return null;
  if (!fuente.startsWith(FUENTE_MEDIDA_PERSONALIZACION_PREFIX)) return null;
  const codigo = fuente.slice(FUENTE_MEDIDA_PERSONALIZACION_PREFIX.length).trim();
  return codigo || null;
}
