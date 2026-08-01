/**
 * Cliente del TPV Centro de copiado.
 * Backend: apps/api/src/centro-copiado/ (controller + service).
 *  - POST /centro-copiado/cotizar          → preview en vivo (montos por doc/tomo).
 *  - POST /centro-copiado/construir-items   → payload para stagear PropuestaItem[].
 */
import { apiRequest } from "@/lib/api";
import type { PropuestaItem, CotizacionPropuestaSnapshot } from "@/lib/propuestas";
import { SUSTRATO_HOJA_FORMATOS_PRESET } from "@/lib/materia-prima-templates";

export type ColorDoc = "BN" | "COLOR";
export type FazDoc = 1 | 2;

export interface DocumentoCentroCopiado {
  id: string;
  nombre?: string;
  paginas: number;
  copias: number;
  /** Nombre del formato (etiqueta), ej. "A4", "SRA3". */
  tamano: string;
  /** Medidas del pliego (del catálogo de formatos del sistema). */
  tamanoAnchoMm: number;
  tamanoAltoMm: number;
  /** TIPO de papel (materia prima); el tamaño define el formato. */
  papelMateriaPrimaId: string;
  /** Gramaje elegido (si el tipo tiene más de uno). */
  gramaje?: number | null;
  color: ColorDoc;
  faz: FazDoc;
  /** Terminaciones (pasos opcionales) de un documento suelto. */
  terminaciones?: string[];
  grupoId?: string | null;
}

export interface GrupoCentroCopiado {
  id: string;
  nombre?: string;
  juegos: number;
  /** Terminaciones (pasos opcionales) del tomo entero. */
  terminaciones?: string[];
}

export interface CotizarCentroCopiadoRequest {
  documentos: DocumentoCentroCopiado[];
  grupos?: GrupoCentroCopiado[];
}

export interface DocumentoPreview {
  id: string;
  grupoId: string | null;
  carillas: number;
  hojas: number;
  pliegos: number;
  subtotal: number;
  iva: number;
  total: number;
  error: string | null;
}

export interface GrupoPreview {
  id: string;
  juegos: number;
  hojasPorLibro: number;
  subtotal: number;
  iva: number;
  total: number;
  error: string | null;
}

export interface CotizarCentroCopiadoResponse {
  documentos: DocumentoPreview[];
  grupos: GrupoPreview[];
  totales: {
    documentos: number;
    tomos: number;
    carillas: number;
    hojasFisicas: number;
    subtotal: number;
    iva: number;
    total: number;
  };
}

export interface ItemConstruido {
  documentoId: string;
  grupoTomoId: string | null;
  nombre: string;
  productoId: string;
  jobContext: Record<string, unknown>;
  especificaciones: Record<string, string>;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  impuestoPorcentaje: number;
  impuestoMonto: number;
  total: number;
  cotizacion: CotizacionPropuestaSnapshot | null;
  error: string | null;
}

export interface ConstruirItemsResponse {
  grupoCargaId: string;
  items: ItemConstruido[];
}

/** Una variante de un tipo de papel: su formato comercial, medidas y gramaje. */
export interface VariantePapelOpcion {
  formatoComercial: string | null;
  anchoMm: number | null;
  altoMm: number | null;
  gramajeGr: number | null;
}

export interface PapelOpcion {
  materiaPrimaId: string;
  nombre: string;
  gramajes: number[];
  variantes: VariantePapelOpcion[];
}

export interface OpcionesCentroCopiado {
  papeles: PapelOpcion[];
  papelDefaultId: string | null;
  /** Terminaciones disponibles (pasos opcionales) que puede elegir el usuario. */
  terminaciones: string[];
}

export async function opcionesCentroCopiado(): Promise<OpcionesCentroCopiado> {
  return apiRequest<OpcionesCentroCopiado>("/centro-copiado/opciones");
}

/** Un formato del catálogo del sistema, con sus medidas en milímetros. */
export interface FormatoTamano {
  nombre: string;
  anchoMm: number;
  altoMm: number;
}

/**
 * Menú de tamaños que ofrece el centro de copiado (los de los servicios de
 * impresión express), tomado del catálogo de formatos del sistema — así las
 * medidas son la única fuente de verdad. El orden es de menor a mayor uso.
 */
const CC_MENU_NOMBRES = ["A4", "A3", "Oficio", "SRA3", "SRA3+", "SRA3++"];
export const CC_FORMATOS_MENU: FormatoTamano[] = CC_MENU_NOMBRES.map((nombre) =>
  SUSTRATO_HOJA_FORMATOS_PRESET.find((f) => f.nombre === nombre),
)
  .filter((f): f is (typeof SUSTRATO_HOJA_FORMATOS_PRESET)[number] => !!f)
  .map((f) => ({
    nombre: f.nombre,
    anchoMm: Math.round(f.ancho * 10),
    altoMm: Math.round(f.alto * 10),
  }));

/** Medidas de un formato por su nombre (fallback A4 si no está en el menú). */
export function dimsDeFormato(nombre: string): { anchoMm: number; altoMm: number } {
  const f = CC_FORMATOS_MENU.find((x) => x.nombre === nombre);
  return f ? { anchoMm: f.anchoMm, altoMm: f.altoMm } : { anchoMm: 210, altoMm: 297 };
}

/** Una hoja (variante) "cubre" un formato si puede producirlo (cortándolo). */
function varianteCubre(v: VariantePapelOpcion, f: FormatoTamano): boolean {
  const vw = v.anchoMm ?? 0;
  const vh = v.altoMm ?? 0;
  if (vw <= 0 || vh <= 0) return false;
  return (
    Math.max(vw, vh) >= Math.max(f.anchoMm, f.altoMm) &&
    Math.min(vw, vh) >= Math.min(f.anchoMm, f.altoMm)
  );
}

/**
 * Tamaños del menú que un papel (tipo + gramaje) realmente puede producir: los
 * que tienen una variante exacta o una mayor que los cubre. Espeja el
 * `resolverVariantePapel` del backend (misma matemática de cobertura).
 */
export function tamanosProducibles(
  papel: PapelOpcion | undefined,
  gramaje: number | null,
): FormatoTamano[] {
  if (!papel) return [];
  let variantes = papel.variantes;
  if (gramaje != null) {
    const conGramaje = variantes.filter((v) => v.gramajeGr === gramaje);
    if (conGramaje.length) variantes = conGramaje;
  }
  return CC_FORMATOS_MENU.filter((f) => variantes.some((v) => varianteCubre(v, f)));
}

export async function cotizarCentroCopiado(
  req: CotizarCentroCopiadoRequest,
): Promise<CotizarCentroCopiadoResponse> {
  return apiRequest<CotizarCentroCopiadoResponse>("/centro-copiado/cotizar", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function construirItemsCentroCopiado(
  req: CotizarCentroCopiadoRequest & { grupoCargaId?: string },
): Promise<ConstruirItemsResponse> {
  return apiRequest<ConstruirItemsResponse>("/centro-copiado/construir-items", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export interface GuardarTomoResponse {
  cotizacionId: string | null;
  cotizacionItemId: string | null;
  subtotal: number;
  iva: number;
  total: number;
  error: string | null;
}

/** Persiste un tomo compuesto (un CotizacionItem). Lo usa el guardado de la ficha. */
export async function guardarTomoCentroCopiado(
  req: CotizarCentroCopiadoRequest & {
    grupoCargaId?: string;
    cotizacionId?: string;
    clienteId?: string | null;
  },
): Promise<GuardarTomoResponse> {
  return apiRequest<GuardarTomoResponse>("/centro-copiado/guardar-tomo", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/**
 * Mapea un ItemConstruido (backend) a un PropuestaItem stageable en la ficha.
 * El guardado real lo hace `persistirSnapshotsItems` con `motorCodigo`+`jobContext`.
 */
/**
 * Nombre de producto ÚNICO para todo el centro de copiado (sueltos y tomos): así
 * las métricas agrupan por un solo producto, no por cada archivo/tomo. Lo que
 * distingue el renglón (archivo o tomo) va en `varianteNombre`, y el anillado
 * como adicional — no en el nombre del producto.
 */
export const CC_NOMBRE_PRODUCTO = "Impresión por hoja";

export function itemConstruidoAPropuestaItem(ic: ItemConstruido): PropuestaItem {
  const meta = (
    ic.jobContext as {
      _centroCopiado?: { esTomo?: boolean; terminaciones?: string[] };
    }
  )._centroCopiado;
  const esTomo = Boolean(meta?.esTomo);
  // Terminaciones elegidas (chips en la ficha). Fallback: un tomo siempre lleva
  // Anillado aunque la metadata vieja no traiga la lista.
  const terminaciones =
    meta?.terminaciones ?? (esTomo ? ["Anillado"] : []);
  const refDocumento =
    ic.nombre && ic.nombre !== "Impresión de documento"
      ? ic.nombre
      : esTomo
        ? "Tomo anillado"
        : undefined;
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cc-${ic.documentoId}-${Date.now()}`,
    productoNombre: CC_NOMBRE_PRODUCTO,
    // Referencia visual para diferenciar el renglón (archivo suelto o tomo).
    varianteNombre: refDocumento,
    productoCodigo: "SYS-IMPRESION-DOC",
    motorCodigo: ic.productoId,
    categoriaComercialCodigo: "impresion_hoja",
    categoriaComercialNombre: "Impresión por hoja",
    subcategoriaComercialCodigo: "papeleria_comercial",
    subcategoriaComercialNombre: "Centro de copiado",
    unidadMedida: "unidad",
    cantidad: ic.cantidad,
    precioUnitario: ic.precioUnitario,
    subtotal: ic.subtotal,
    impuestoPorcentaje: ic.impuestoPorcentaje,
    impuestoMonto: ic.impuestoMonto,
    total: ic.total,
    especificaciones: ic.especificaciones,
    cotizacion: ic.cotizacion as CotizacionPropuestaSnapshot,
    // Los pasos de producción se materializan al guardar (recotización); en el
    // staging del centro de copiado no se muestran por documento.
    pasos: [],
    // Las terminaciones se muestran como adicionales/chips (no como producto aparte).
    adicionales: terminaciones,
    jobContext: ic.jobContext,
    // El schema declara qué especificaciones mostrar (buildOrdenItemSpecs las lee
    // de acá): sin esto la ficha no renderiza ninguna. La key = la etiqueta.
    atributosSchema: Object.keys(ic.especificaciones).map((key, orden) => ({
      key,
      label: key,
      tipo: "text",
      visible: true,
      orden,
    })),
  };
}
