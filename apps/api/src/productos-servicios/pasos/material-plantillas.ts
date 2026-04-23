/**
 * SM.4 — Plantillas de consumo de materiales por familia de paso.
 *
 * Cada familia declara cómo calcular sus materiales consumidos a partir
 * del contexto del paso (variante, cantidad, layout del nesting, config
 * del paso). El super motor invoca la plantilla correspondiente y suma
 * el costo al bucket `costoMateriasPrimas` del paso.
 *
 * No implementar plantilla = familia sin materias primas (solo tiempo).
 * Ej: `corte`, `corte_volumetrico`, `pre_prensa` no consumen materiales
 * más allá del tiempo del centro de costo.
 */
import type { NestingResultUnion } from '../engine/nesting-runner';

/** Consumo concreto de un material (lo que el super motor emite en trazabilidad). */
export type MaterialConsumido = {
  /** Nombre legible del material (ej. "Papel Opalina 250gr"). */
  nombre: string;
  /** Cantidad consumida. */
  cantidad: number;
  /** Unidad (pliego, m2, gramo, ml, bolsa, etc.). */
  unidad: string;
  /** Precio unitario usado para el cálculo. */
  precioUnitario: number;
  /** Costo total = cantidad × precioUnitario. */
  costo: number;
  /** De dónde salió el precio: papelVariante, config, default, etc. */
  fuente: string;
};

/**
 * Contexto que el super motor le pasa a una plantilla para calcular
 * sus materiales consumidos.
 */
export type MaterialPlantillaContext = {
  /** Cantidad total de piezas pedidas. */
  cantidadPedida: number;
  /** Layout del nesting aplicable al paso (propio o heredado). Null = sin nesting. */
  layout: NestingResultUnion | null;
  /** Config específica del paso (proceso_operacion.configNestingV2 u otras). */
  configPaso: Record<string, unknown> | null;
  /** Variante cotizada (para leer papelVariante, medidas, etc.). */
  variante: {
    anchoMm: unknown;
    altoMm: unknown;
    papelVariante: {
      id: string;
      sku: string;
      precioReferencia: unknown;
      atributosVarianteJson: unknown;
    } | null;
  };
  /** Config v2 del producto (tamanoPliegoImpresion, precios default, etc.). */
  configProducto: Record<string, unknown>;
  /** Selección técnica del usuario (ej. caras=doble_faz, tipo=cmyk). */
  selecciones: Map<string, string>;
};

/** Signatura de una plantilla de material. */
export type MaterialPlantilla = (ctx: MaterialPlantillaContext) => MaterialConsumido[];

// ──────────────── Plantillas por familia ────────────────

/**
 * impresion_por_hoja: consume PAPEL (pliegos del nesting × precioReferencia
 * de la variante) + CLICS (pliegos × clicsPorPliego × costoClic según tipo).
 * Doble faz multiplica clics por 2.
 */
const plantillaImpresionPorHoja: MaterialPlantilla = (ctx) => {
  const out: MaterialConsumido[] = [];
  const layoutHoja =
    ctx.layout?.algoritmo === 'nesting-hoja' ? ctx.layout.result : null;
  const pliegos = layoutHoja?.pliegosNecesarios ?? 0;
  if (pliegos === 0) return out;

  // Fase A — pliego de impresión: si el motor identificó un sustrato
  // distinto al pliego usado para el nesting (porque el sustrato se
  // subdivide en pliegos más pequeños para imprimir), el costeo del papel
  // es por sustrato, no por pliego de impresión. El proveedor vende el
  // sustrato comprado (p.ej. SRA3), no los pliegos chicos sueltos.
  const usaPliegoImpresion =
    layoutHoja?.sustratoElegido != null && layoutHoja?.sustratosNecesarios != null;
  const cantidadPapel = usaPliegoImpresion
    ? layoutHoja!.sustratosNecesarios!
    : pliegos;
  const formatoPapel = usaPliegoImpresion
    ? layoutHoja!.sustratoElegido!
    : layoutHoja!.pliegoElegido;
  const unidadPapel = usaPliegoImpresion ? 'sustrato' : 'pliego';

  // Papel.
  const papelPrecio =
    Number(ctx.variante.papelVariante?.precioReferencia ?? 0) > 0
      ? Number(ctx.variante.papelVariante!.precioReferencia)
      : Number(ctx.configProducto.papelPrecioPorPliego ?? 40);
  if (papelPrecio > 0) {
    const fuente =
      Number(ctx.variante.papelVariante?.precioReferencia ?? 0) > 0
        ? 'papelVariante.precioReferencia'
        : 'config.papelPrecioPorPliego';
    out.push({
      nombre: usaPliegoImpresion
        ? `Papel ${ctx.variante.papelVariante?.sku ?? 'default'} (${formatoPapel.codigo} → ${layoutHoja!.pliegoElegido.codigo} ×${layoutHoja!.pliegosPorSustrato})`
        : `Papel ${ctx.variante.papelVariante?.sku ?? 'default'}`,
      cantidad: cantidadPapel,
      unidad: unidadPapel,
      precioUnitario: papelPrecio,
      costo: cantidadPapel * papelPrecio,
      fuente,
    });
  }

  // Clics (tóner/tinta digital). El conteo de clics SIEMPRE va por pliego
  // de impresión (cada pliego pasa por la prensa una vez), no por sustrato.
  const caras = (ctx.selecciones.get('caras') ?? 'simple_faz').toLowerCase();
  const multCaras = caras === 'doble_faz' ? 2 : 1;
  const tipoImpresion = (
    ctx.selecciones.get('tipo_impresion') ??
    ctx.selecciones.get('tipoImpresion') ??
    'cmyk'
  ).toUpperCase();
  const clicsPorPliego = Number(ctx.configProducto.impresionClicsPorPliego ?? 1);
  const costoClic =
    tipoImpresion === 'BN'
      ? Number(ctx.configProducto.impresionCostoClicBN ?? 10)
      : Number(ctx.configProducto.impresionCostoClic ?? 30);
  const clicsTotales = pliegos * clicsPorPliego * multCaras;
  if (clicsTotales > 0 && costoClic > 0) {
    out.push({
      nombre: `Clics ${tipoImpresion}`,
      cantidad: clicsTotales,
      unidad: 'clic',
      precioUnitario: costoClic,
      costo: clicsTotales * costoClic,
      fuente: 'config.impresionCostoClic' + (tipoImpresion === 'BN' ? 'BN' : ''),
    });
  }
  return out;
};

/**
 * impresion_por_area: consume SUSTRATO (metros lineales del rollo) + TINTA
 * (area útil × tintaMlPorM2 × precio). Solo si hay layout de rollo.
 */
const plantillaImpresionPorArea: MaterialPlantilla = (ctx) => {
  const out: MaterialConsumido[] = [];
  if (ctx.layout?.algoritmo !== 'nesting-rollo') return out;
  const result = ctx.layout.result;
  const metrosLineales = result.consumedLengthMm / 1000;
  const areaUtilM2 = result.usefulAreaM2;

  const precioMl = Number(ctx.configProducto.sustratoPrecioPorMl ?? 0);
  if (precioMl > 0 && metrosLineales > 0) {
    out.push({
      nombre: 'Sustrato (rollo)',
      cantidad: metrosLineales,
      unidad: 'metro lineal',
      precioUnitario: precioMl,
      costo: metrosLineales * precioMl,
      fuente: 'config.sustratoPrecioPorMl',
    });
  }

  const tintaMlPorM2 = Number(ctx.configProducto.tintaMlPorM2 ?? 15);
  const tintaPrecioMl = Number(ctx.configProducto.tintaPrecioMl ?? 2.5);
  const tintaMl = areaUtilM2 * tintaMlPorM2;
  if (tintaMl > 0 && tintaPrecioMl > 0) {
    out.push({
      nombre: 'Tinta',
      cantidad: Math.round(tintaMl * 100) / 100,
      unidad: 'ml',
      precioUnitario: tintaPrecioMl,
      costo: tintaMl * tintaPrecioMl,
      fuente: 'config.tintaMlPorM2 × tintaPrecioMl',
    });
  }
  return out;
};

/**
 * laminado: consume film por m² del área trabajada, con merma opcional.
 * Deduce el área del nesting (propio o heredado).
 */
const plantillaLaminado: MaterialPlantilla = (ctx) => {
  if (!ctx.layout) return [];
  let areaM2 = 0;
  if (ctx.layout.algoritmo === 'nesting-hoja') {
    const r = ctx.layout.result;
    areaM2 =
      (r.pliegoElegido.anchoMm * r.pliegoElegido.altoMm * r.pliegosNecesarios) / 1_000_000;
  } else if (ctx.layout.algoritmo === 'nesting-rollo') {
    areaM2 = ctx.layout.result.usefulAreaM2;
  }
  if (areaM2 === 0) return [];
  const mermaPct = Number(ctx.configProducto.laminadoMermaPct ?? 0.05);
  const precioM2 = Number(ctx.configProducto.laminadoFilmPrecioM2 ?? 1800);
  const filmM2 = areaM2 * (1 + mermaPct);
  return [
    {
      nombre: 'Film laminado BOPP',
      cantidad: Math.round(filmM2 * 100) / 100,
      unidad: 'm²',
      precioUnitario: precioM2,
      costo: filmM2 * precioM2,
      fuente: 'config.laminadoFilmPrecioM2 (+merma)',
    },
  ];
};

/**
 * operacion_manual: típicamente embalaje (bolsas/cajas por pieza).
 * Lee del configProducto el precio de la bolsa.
 */
const plantillaOperacionManual: MaterialPlantilla = (ctx) => {
  const precioBolsa = Number(ctx.configProducto.embalajePrecioBolsa ?? 0);
  if (precioBolsa === 0) return [];
  return [
    {
      nombre: 'Bolsa / packaging',
      cantidad: ctx.cantidadPedida,
      unidad: 'bolsa',
      precioUnitario: precioBolsa,
      costo: ctx.cantidadPedida * precioBolsa,
      fuente: 'config.embalajePrecioBolsa',
    },
  ];
};

/**
 * encuadernado: insumos por talonario (tapa, engomado, grapa).
 * El número de talonarios lo leemos del layout si aplica, si no de cantidad.
 */
const plantillaEncuadernado: MaterialPlantilla = (ctx) => {
  const insumosPorTalonario = Number(ctx.configProducto.encuadernacionInsumosPorTalonario ?? 30);
  if (insumosPorTalonario === 0) return [];
  return [
    {
      nombre: 'Insumos encuadernación',
      cantidad: ctx.cantidadPedida,
      unidad: 'unidad',
      precioUnitario: insumosPorTalonario,
      costo: ctx.cantidadPedida * insumosPorTalonario,
      fuente: 'config.encuadernacionInsumosPorTalonario',
    },
  ];
};

// ──────────────── Registro ────────────────

/**
 * Plantillas registradas por código de familia. Las familias NO registradas
 * asumen consumo de materiales = 0 (solo tiempo del centro de costo).
 */
export const MATERIAL_PLANTILLAS: Record<string, MaterialPlantilla> = {
  impresion_por_hoja: plantillaImpresionPorHoja,
  impresion_por_area: plantillaImpresionPorArea,
  laminado: plantillaLaminado,
  operacion_manual: plantillaOperacionManual,
  encuadernado: plantillaEncuadernado,
};

/**
 * API de consulta: devuelve los materiales consumidos por un paso según su familia.
 * Si la familia no tiene plantilla registrada, retorna [].
 */
export function calcularMaterialesDelPaso(
  familiaCodigo: string,
  ctx: MaterialPlantillaContext,
): MaterialConsumido[] {
  const plantilla = MATERIAL_PLANTILLAS[familiaCodigo];
  if (!plantilla) return [];
  return plantilla(ctx);
}
