/**
 * Cliente del TPV Centro de copiado.
 * Backend: apps/api/src/centro-copiado/ (controller + service).
 *  - POST /centro-copiado/cotizar          → preview en vivo (montos por doc/tomo).
 *  - POST /centro-copiado/construir-items   → payload para stagear PropuestaItem[].
 */
import { apiRequest } from "@/lib/api";
import type {
  PropuestaItem,
  CotizacionPropuestaSnapshot,
} from "@/lib/propuestas";
import { SUSTRATO_HOJA_FORMATOS_PRESET } from "@/lib/materia-prima-templates";

export type ColorDoc = "BN" | "COLOR";
export type FazDoc = 1 | 2;

export interface CentroCopiadoSegmentoMeta {
  nombre?: string | null;
  paginas: number;
  tamano: string;
  tamanoAnchoMm?: number;
  tamanoAltoMm?: number;
  papelMateriaPrimaId: string;
  gramaje?: number | null;
  color: ColorDoc;
  faz: FazDoc;
  cobertura?: string | null;
}

/** Contrato de rehidratación; `version` es opcional para cargas históricas. */
export interface CentroCopiadoMeta {
  version?: 1;
  grupoCargaId?: string | null;
  grupoTomoId?: string | null;
  esTomo?: boolean;
  esAnillado?: boolean;
  tomoNombre?: string | null;
  terminacion?: string;
  terminaciones?: string[];
  tipoAnillo?: string | null;
  nombre?: string | null;
  paginas?: number;
  copias?: number;
  tamano?: string;
  tamanoAnchoMm?: number;
  tamanoAltoMm?: number;
  papelMateriaPrimaId?: string;
  gramaje?: number | null;
  papelLabel?: string;
  color?: ColorDoc;
  faz?: FazDoc;
  cobertura?: string | null;
  carillas?: number;
  hojas?: number;
  juegos?: number;
  hojasPorLibro?: number;
  documentos?: number;
  segmentos?: CentroCopiadoSegmentoMeta[];
}

export function metaCentroCopiado(
  jobContext: Record<string, unknown> | null | undefined,
): CentroCopiadoMeta | null {
  const raw = jobContext?._centroCopiado;
  return raw && typeof raw === "object" ? (raw as CentroCopiadoMeta) : null;
}

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
  /** Cobertura de tóner: 'borrador' | 'normal' | 'alta'. Ausente = 'alta'. */
  cobertura?: string | null;
  /** Terminaciones (pasos opcionales) de un documento suelto. */
  terminaciones?: string[];
  /** Tipo de anillo elegido (ESPIRAL_PLASTICO | WIRE_O) para el anillado. */
  tipoAnillo?: string;
  grupoId?: string | null;
}

export interface GrupoCentroCopiado {
  id: string;
  nombre?: string;
  juegos: number;
  /** Terminaciones (pasos opcionales) del tomo entero. */
  terminaciones?: string[];
  /** Tipo de anillo elegido (ESPIRAL_PLASTICO | WIRE_O) para el anillado. */
  tipoAnillo?: string;
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
  /** Anillado del doc suelto (cada copia = 1 libro); null si no aplica. */
  anillado: AnilladoPreview | null;
  error: string | null;
}

/** Línea de anillado de un tomo (1 anillo × juegos + tiempo de anilladora). */
export interface AnilladoPreview {
  subtotal: number;
  iva: number;
  total: number;
  /** Tipo de anillo cotizado (ESPIRAL_PLASTICO | WIRE_O). */
  tipoAnillo: string;
  /** Ø del anillo elegido (menor capacidad que cubre las hojas); null si no. */
  diametroMm: number | null;
  /** Motivo cuando no se cotizó (sin anilladora, sin anillo que cubra, etc.). */
  error: string | null;
}

export interface GrupoPreview {
  id: string;
  juegos: number;
  hojasPorLibro: number;
  subtotal: number;
  iva: number;
  total: number;
  /** Anillado del tomo cuando la terminación está activa y hay anilladora. */
  anillado: AnilladoPreview | null;
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
  /** Unidad comercial: "libros" cuando anilla, "hojas" si no. */
  unidad?: string;
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
  /** Tipos de anillo instalados (para el selector cuando hay Anillado). */
  tiposAnillo: { value: string; label: string }[];
  /** Nombres de formato ofrecidos (config del tenant); null = todos los producibles. */
  tamanosOfrecidos: string[] | null;
  /** El tenant tiene el módulo activo. */
  activo: boolean;
}

export async function opcionesCentroCopiado(): Promise<OpcionesCentroCopiado> {
  return apiRequest<OpcionesCentroCopiado>("/centro-copiado/opciones");
}

/** Si el módulo está activo (para esconder el botón/atajo cuando está pausado). */
export async function estadoCentroCopiado(): Promise<{
  activo: boolean;
  configurado: boolean;
}> {
  return apiRequest<{ activo: boolean; configurado: boolean }>(
    "/centro-copiado/estado",
  );
}

// ── Configuración del módulo (Configuración › Centro de copiado) ──────────────

/** Un papel ofrecido: el tipo y, opcional, los gramajes de ese tipo que se ofrecen. */
export interface PapelConfigItem {
  materiaPrimaId: string;
  gramajes?: number[];
}

export interface MaquinaOpcion {
  id: string;
  nombre: string;
  esColor: boolean;
}

export interface CentroCopiadoConfig {
  /** Versión optimista: evita pisar cambios realizados desde otra sesión. */
  version: number;
  actualizadoEl: string | null;
  activo: boolean;
  /** Cobrar preparación/limpieza de máquina en cada documento (default false). */
  cobraSetup: boolean;
  /** Margen % del producto plantilla (precio = costo × margen). */
  margenPct: number;
  /** Margen mínimo % (piso de rentabilidad). */
  margenMinimoPct: number;
  politicaPrecio: "MARGEN_FIJO" | "MARGEN_POR_VOLUMEN";
  tramosMargen: { desdeCantidad: number; margenPct: number }[];
  /** Mínimo de pliegos/hojas físicas facturables por documento; 0 = desactivado. */
  minimoHojasFacturables: number;
  /** Minutos de setup por documento (override propio de CC). */
  setupMin: number;
  /** Minutos de cleanup por documento (override propio de CC). */
  cleanupMin: number;
  /** Selección del tenant; null = todos / default. */
  papeles: PapelConfigItem[] | null;
  tamanos: string[] | null;
  terminaciones: string[] | null;
  tiposAnillo: string[] | null;
  /** Máquinas elegidas; null = auto-resolver por rol. */
  maquinaColorId: string | null;
  maquinaBnId: string | null;
  /** Anilladora para el "Anillado"; null = la única activa (o sin anillado). */
  maquinaAnilladoraId: string | null;
  /** Tapa frontal (transparente) y contratapa (plástica de color) del anillado. */
  tapaFrontalMateriaPrimaId: string | null;
  tapaContratapaMateriaPrimaId: string | null;
  /** Universo para elegir (el menú de tamaños está en CC_FORMATOS_MENU). */
  disponibles: {
    papeles: {
      materiaPrimaId: string;
      nombre: string;
      gramajes: number[];
      formatosProducibles: string[];
    }[];
    terminaciones: string[];
    terminacionesCatalogo: {
      codigo: string;
      etiqueta: string;
      familiaCodigo: string;
      requiereMaquina: boolean;
    }[];
    formatos: FormatoTamano[];
    maquinas: MaquinaOpcion[];
    anilladoras: { id: string; nombre: string }[];
    tiposAnillo: {
      value: "ESPIRAL_PLASTICO" | "WIRE_O";
      label: string;
      instalado: boolean;
    }[];
    tapas: { materiaPrimaId: string; nombre: string; esFrontal: boolean }[];
  };
}

/** Campos a actualizar. Omitir = no tocar; enviar null = limpiar (default). */
export interface ActualizarConfigRequest {
  version?: number;
  activo?: boolean;
  cobraSetup?: boolean;
  margenPct?: number;
  margenMinimoPct?: number;
  politicaPrecio?: "MARGEN_FIJO" | "MARGEN_POR_VOLUMEN";
  tramosMargen?: { desdeCantidad: number; margenPct: number }[];
  minimoHojasFacturables?: number;
  setupMin?: number;
  cleanupMin?: number;
  papeles?: PapelConfigItem[] | null;
  tamanos?: string[] | null;
  terminaciones?: string[] | null;
  tiposAnillo?: string[] | null;
  maquinaColorId?: string | null;
  maquinaBnId?: string | null;
  maquinaAnilladoraId?: string | null;
  tapaFrontalMateriaPrimaId?: string | null;
  tapaContratapaMateriaPrimaId?: string | null;
}

export async function getConfigCentroCopiado(): Promise<CentroCopiadoConfig> {
  return apiRequest<CentroCopiadoConfig>("/centro-copiado/config");
}

export async function actualizarConfigCentroCopiado(
  req: ActualizarConfigRequest,
): Promise<CentroCopiadoConfig> {
  return apiRequest<CentroCopiadoConfig>("/centro-copiado/config", {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export async function inicializarCentroCopiado(): Promise<CentroCopiadoConfig> {
  return apiRequest<CentroCopiadoConfig>("/centro-copiado/inicializar", {
    method: "POST",
  });
}

export type NivelSaludCentroCopiado = "OK" | "ADVERTENCIA" | "ERROR";

export interface SaludCentroCopiado {
  estado: "OPERATIVO" | "ADVERTENCIA" | "ERROR";
  generadoEl: string;
  inicializado: boolean;
  activo: boolean;
  puedeReparar: boolean;
  resumen: {
    impresoras: number;
    papeles: number;
    variantesPapel: number;
    variantesCosteadas: number;
    anilladoras: number;
    tiposAnillo: number;
    tapas: number;
  };
  chequeos: {
    codigo: string;
    etiqueta: string;
    nivel: NivelSaludCentroCopiado;
    detalle: string;
    reparable: boolean;
  }[];
}

export interface EventoCentroCopiado {
  id: string;
  tipo: string;
  actorNombre: string;
  descripcion: string;
  datosJson: unknown;
  createdAt: string;
}

export async function saludCentroCopiado(): Promise<SaludCentroCopiado> {
  return apiRequest<SaludCentroCopiado>("/centro-copiado/salud");
}

export async function repararCentroCopiado(): Promise<SaludCentroCopiado> {
  return apiRequest<SaludCentroCopiado>("/centro-copiado/reparar", {
    method: "POST",
  });
}

export async function historialCentroCopiado(): Promise<EventoCentroCopiado[]> {
  return apiRequest<EventoCentroCopiado[]>("/centro-copiado/historial");
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
export function dimsDeFormato(nombre: string): {
  anchoMm: number;
  altoMm: number;
} {
  const f = CC_FORMATOS_MENU.find((x) => x.nombre === nombre);
  return f
    ? { anchoMm: f.anchoMm, altoMm: f.altoMm }
    : { anchoMm: 210, altoMm: 297 };
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
  /** Restringe al subconjunto ofrecido por la config (null/undefined = todos). */
  ofrecidos?: string[] | null,
): FormatoTamano[] {
  if (!papel) return [];
  let variantes = papel.variantes;
  if (gramaje != null) {
    const conGramaje = variantes.filter((v) => v.gramajeGr === gramaje);
    if (conGramaje.length) variantes = conGramaje;
  }
  const menu =
    ofrecidos && ofrecidos.length
      ? CC_FORMATOS_MENU.filter((f) => ofrecidos.includes(f.nombre))
      : CC_FORMATOS_MENU;
  return menu.filter((f) => variantes.some((v) => varianteCubre(v, f)));
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
    idempotencyKey?: string;
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

export function itemConstruidoAPropuestaItem(
  ic: ItemConstruido,
): PropuestaItem {
  const meta = metaCentroCopiado(ic.jobContext);
  const esTomo = Boolean(meta?.esTomo);
  // Terminaciones elegidas (chips en la ficha). Fallback: un tomo siempre lleva
  // Anillado aunque la metadata vieja no traiga la lista.
  const terminaciones = meta?.terminaciones ?? (esTomo ? ["Anillado"] : []);
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
    unidadMedida: (ic.unidad as PropuestaItem["unidadMedida"]) ?? "unidad",
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
