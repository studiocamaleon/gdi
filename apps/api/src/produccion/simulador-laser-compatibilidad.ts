/**
 * Regla compartida del simulador láser.
 *
 * La UI puede ordenar y presentar las tandas, pero la compatibilidad física no
 * puede depender del navegador: esta extracción también se usa al completar un
 * lote para volver a validar el snapshot vigente antes de avanzar las OTs.
 */

type JsonRecord = Record<string, unknown>;

type MaterialLaserSnapshot = {
  tipoLineaCosto?: unknown;
  materialVarianteId?: unknown;
  materiaPrimaId?: unknown;
  materiaPrimaNombre?: unknown;
  atributosVarianteJson?: unknown;
};

type PasoLaserSnapshot = {
  rutaPasoId?: unknown;
  configPasoId?: unknown;
  materiales?: unknown;
  outputsCanonicos?: unknown;
};

export type CompatibilidadLaser = {
  configPasoId: string | null;
  maquinaId: string | null;
  varianteId: string | null;
  materiaPrimaId: string | null;
  papelNombre: string | null;
  gramaje: number | null;
  pliegoAnchoMm: number | null;
  pliegoAltoMm: number | null;
  pliegoPreset: string | null;
  modoColor: string | null;
  caras: 1 | 2 | null;
  pliegos: number | null;
};

export type ConfigLaserFallback = {
  maquinaM1Id?: string | null;
  paramsPasoJson?: unknown;
};

function comoRecord(valor: unknown): JsonRecord | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as JsonRecord)
    : null;
}

function numeroONull(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function textoONull(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

export function normalizarModoColorLaser(valor: string | null): string | null {
  if (!valor) return null;
  const normalizado = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (['BN', 'B&N', 'BYN', 'BLANCO Y NEGRO'].includes(normalizado)) return 'BN';
  return normalizado || null;
}

export function extraerCompatibilidadLaser(
  jobContextJson: unknown,
  trazabilidadJson: unknown,
  rutaPasoId: string | null,
): CompatibilidadLaser {
  const jobContext = comoRecord(jobContextJson);
  const trazabilidad = comoRecord(trazabilidadJson);
  const pasos = Array.isArray(trazabilidad?.pasos)
    ? (trazabilidad.pasos as PasoLaserSnapshot[])
    : [];
  const paso =
    pasos.find(
      (item) =>
        textoONull(item.rutaPasoId) !== null &&
        textoONull(item.rutaPasoId) === rutaPasoId,
    ) ?? null;
  const materiales = Array.isArray(paso?.materiales)
    ? (paso.materiales as MaterialLaserSnapshot[])
    : [];
  const sustrato =
    materiales.find((item) => item.tipoLineaCosto === 'MATERIAL') ?? null;
  const atributos = comoRecord(sustrato?.atributosVarianteJson);
  const outputs = comoRecord(paso?.outputsCanonicos);
  const configPasoId = textoONull(paso?.configPasoId);
  const modosPorPaso = comoRecord(jobContext?.modoColorPorPaso);
  const modoColor = normalizarModoColorLaser(
    textoONull(configPasoId ? modosPorPaso?.[configPasoId] : null) ??
      textoONull(jobContext?.modoColor),
  );
  const carasCrudo = numeroONull(jobContext?.caras);
  const caras = carasCrudo === 1 || carasCrudo === 2 ? carasCrudo : null;

  return {
    configPasoId,
    maquinaId: textoONull(
      configPasoId ? jobContext?.[`maquinaSeleccionada_${configPasoId}`] : null,
    ),
    varianteId: textoONull(sustrato?.materialVarianteId),
    materiaPrimaId: textoONull(sustrato?.materiaPrimaId),
    papelNombre: textoONull(sustrato?.materiaPrimaNombre),
    gramaje:
      numeroONull(atributos?.gramaje) ?? numeroONull(atributos?.gramajeGr),
    pliegoAnchoMm: numeroONull(outputs?.pliego_impresion_ancho_mm),
    pliegoAltoMm: numeroONull(outputs?.pliego_impresion_alto_mm),
    pliegoPreset: null,
    modoColor,
    caras,
    pliegos: numeroONull(outputs?.pliegos_impresos),
  };
}

export function aplicarFallbackConfigLaser(
  base: CompatibilidadLaser,
  config?: ConfigLaserFallback,
): CompatibilidadLaser {
  const params = comoRecord(config?.paramsPasoJson);
  const nesting = comoRecord(params?.nestingConfig);
  const pliego = comoRecord(nesting?.pliegoImpresion);
  return {
    ...base,
    maquinaId: base.maquinaId ?? textoONull(config?.maquinaM1Id),
    pliegoAnchoMm: base.pliegoAnchoMm ?? numeroONull(pliego?.anchoMm),
    pliegoAltoMm: base.pliegoAltoMm ?? numeroONull(pliego?.altoMm),
    pliegoPreset: base.pliegoPreset ?? textoONull(pliego?.preset),
  };
}

export function faltantesCompatibilidadLaser(
  datos: CompatibilidadLaser,
): string[] {
  const faltantes: string[] = [];
  if (!datos.maquinaId) faltantes.push('máquina');
  if (!datos.varianteId) faltantes.push('variante de papel');
  if (datos.gramaje === null) faltantes.push('gramaje');
  if (datos.pliegoAnchoMm === null || datos.pliegoAltoMm === null)
    faltantes.push('tamaño de pliego');
  if (!datos.modoColor) faltantes.push('modo de color');
  if (datos.caras === null) faltantes.push('caras');
  return faltantes;
}

/** Null significa que la compatibilidad física no está demostrada. */
export function claveCompatibilidadLoteLaser(
  datos: CompatibilidadLaser,
): string | null {
  if (faltantesCompatibilidadLaser(datos).length > 0) return null;
  return JSON.stringify([
    datos.maquinaId,
    datos.varianteId,
    datos.gramaje,
    datos.pliegoAnchoMm,
    datos.pliegoAltoMm,
    normalizarModoColorLaser(datos.modoColor),
    datos.caras,
  ]);
}
