/**
 * Adaptador del TPV Centro de copiado.
 * Traduce un DOCUMENTO (N páginas, tamaño, papel, color, faz) al `jobContext`
 * de un SEGMENTO de impresión que consume el motor (`impresion_por_hoja`).
 *
 * carillas = páginas × copias; hojas = faz doble ? ceil(carillas/2) : carillas.
 * Pasa `cantidad = hojas` + pieza ~tamaño-pliego ⇒ pliegos = hojas, clicks =
 * hojas × caras × factorA4(tamaño). El papel se cuenta por hoja (no por carilla).
 * El TAMAÑO viene con sus medidas reales (del catálogo de formatos del sistema).
 */
import { PliegoDim, piezaDocumento, runtimePliegoImpresion } from './pliegos';

export type ColorDocumento = 'BN' | 'COLOR';
export type FazDocumento = 1 | 2;

export interface DocumentoInput {
  id: string;
  nombre?: string;
  paginas: number;
  copias: number;
  /** Nombre del formato (etiqueta), ej. "A4", "SRA3". */
  tamano: string;
  /** Medidas del pliego (del catálogo de formatos del sistema). */
  tamanoAnchoMm: number;
  tamanoAltoMm: number;
  /** TIPO de papel (materia prima); el TAMAÑO define el formato. */
  papelMateriaPrimaId: string;
  /** Gramaje elegido (si el tipo tiene más de uno). */
  gramaje?: number | null;
  color: ColorDocumento;
  faz: FazDocumento;
  /** Terminaciones (pasos opcionales) de un documento suelto. */
  terminaciones?: string[];
  /** null/undefined = suelto; mismo id = anillar juntos (tomo). */
  grupoId?: string | null;
}

export interface PlantillaContexto {
  productoId: string;
  rutaAlternativaId: string;
  configPasoId: string;
  /** Láser de color; null si el tenant no tiene. */
  maquinaColorId: string | null;
  /** Láser B/N (mono); null si el tenant no tiene. */
  maquinaBnId: string | null;
}

export interface SegmentoCalculado {
  carillas: number;
  hojas: number;
  jobContext: Record<string, unknown>;
}

export const pliegoDeDoc = (doc: DocumentoInput): PliegoDim => ({
  preset: doc.tamano,
  anchoMm: doc.tamanoAnchoMm,
  altoMm: doc.tamanoAltoMm,
});

/** Máquina que rutea un documento según su color (con fallback a la única láser). */
export const maquinaParaColor = (
  ctx: PlantillaContexto,
  color: ColorDocumento,
): string | null =>
  color === 'COLOR'
    ? (ctx.maquinaColorId ?? ctx.maquinaBnId)
    : (ctx.maquinaBnId ?? ctx.maquinaColorId);

export function calcularHojas(
  paginas: number,
  copias: number,
  faz: FazDocumento,
): { carillas: number; hojas: number } {
  const carillas = paginas * copias;
  const hojas = faz === 2 ? Math.ceil(carillas / 2) : carillas;
  return { carillas, hojas };
}

/**
 * Construye el jobContext de un segmento. `copias` es efectiva: para un
 * documento suelto es `doc.copias`; para uno agrupado, los `juegos` del tomo.
 * `papelVarianteId` = la variante ya resuelta por (tipo de papel × tamaño).
 */
export function construirSegmento(
  doc: DocumentoInput,
  ctx: PlantillaContexto,
  copias: number,
  papelVarianteId: string,
): SegmentoCalculado {
  const { carillas, hojas } = calcularHojas(doc.paginas, copias, doc.faz);
  const modoColor = doc.color === 'COLOR' ? 'CMYK' : 'BN';
  // Ruteo de máquina por color (con fallback si el tenant tiene una sola láser).
  const maquinaId = maquinaParaColor(ctx, doc.color);
  const pliego = pliegoDeDoc(doc);

  const jobContext: Record<string, unknown> = {
    cantidad: hojas,
    caras: doc.faz,
    piezas: [piezaDocumento(pliego, hojas)],
    modoColor,
    slotMateriales: {
      [`${ctx.configPasoId}_sustrato_principal`]: papelVarianteId,
    },
    [`maquinaSeleccionada_${ctx.configPasoId}`]: maquinaId,
    ...runtimePliegoImpresion(ctx.configPasoId, pliego),
    // Centro de copiado NO cobra setup de máquina (decisión de negocio: volumen +
    // precio por hoja claro). Vale para todos los documentos de la carga.
    omitirSetupCleanup: true,
  };

  return { carillas, hojas, jobContext };
}

export interface VariantePapel {
  id: string;
  formatoComercial: string | null;
  anchoMm: number | null;
  altoMm: number | null;
  gramajeGr: number | null;
}

/** Una hoja (variante) "cubre" un pliego si puede producirlo (cortándolo). */
export function variantesCubre(v: VariantePapel, pliego: PliegoDim): boolean {
  const vw = v.anchoMm ?? 0;
  const vh = v.altoMm ?? 0;
  if (vw <= 0 || vh <= 0) return false;
  // Orientación-agnóstico: el lado largo cubre al largo y el corto al corto.
  return (
    Math.max(vw, vh) >= Math.max(pliego.anchoMm, pliego.altoMm) &&
    Math.min(vw, vh) >= Math.min(pliego.anchoMm, pliego.altoMm)
  );
}

/**
 * Resuelve la variante de papel para un (tipo, gramaje, tamaño):
 *  1) filtra por gramaje,
 *  2) coincidencia EXACTA de formato (1:1, sin desperdicio),
 *  3) si no, la de MENOR área que CUBRA el pliego (se corta, costo derivado),
 *  4) si NINGUNA cubre → null (no se puede producir; NO hay fallback).
 */
export function resolverVariantePapel(
  variantes: VariantePapel[],
  pliego: PliegoDim,
  gramaje?: number | null,
): string | null {
  if (variantes.length === 0) return null;
  let pool = variantes;
  if (gramaje != null) {
    const conGramaje = variantes.filter((v) => v.gramajeGr === gramaje);
    if (conGramaje.length) pool = conGramaje;
  }
  const objetivo = pliego.preset.toLowerCase();
  const exacta = pool.find(
    (v) => (v.formatoComercial ?? '').toLowerCase() === objetivo,
  );
  if (exacta) return exacta.id;

  const area = (v: VariantePapel) => (v.anchoMm ?? 0) * (v.altoMm ?? 0);
  const cubren = pool
    .filter((v) => variantesCubre(v, pliego))
    .sort((a, b) => area(a) - area(b));
  return cubren[0]?.id ?? null;
}
