/**
 * Cálculos específicos del motor Talonario.
 *
 * Este módulo contiene las funciones de cálculo puro (sin acceso a DB)
 * que el servicio invoca durante quote y preview.
 */

// ─── Tipos internos ──────────────────────────────────────────────

export type TipoCopiaValor = 'COPIA_SIMPLE' | 'DUPLICADO' | 'TRIPLICADO' | 'CUADRUPLICADO';

export type PapelCapa = {
  capaIndex: number;
  capaLabel: string;
  papelVarianteId: string | null;
  colorPapel: string;
};

export type TipoCopiaDefinicion = {
  valor: TipoCopiaValor;
  capas: number;
  numerosXTalonarioSugerido: number;
  papeles: PapelCapa[];
};

export type EncuadernacionConfig = {
  tipo: 'abrochado' | 'emblocado';
  cantidadGrapas?: number | null;
  posicionGrapas?: string | null;
  bordeEncolar?: string | null;
};

export type PuntilladoConfig = {
  habilitado: boolean;
  tipo?: string | null;
  distanciaBordeMm?: number | null;
  borde?: string | null;
};

export type TalonarioMotorConfig = {
  tamanoPliegoImpresion: { codigo: string; nombre: string; anchoMm: number; altoMm: number };
  tipoCorte: string;
  demasiaCorteMm: number;
  lineaCorteMm: number;
  mermaAdicionalPct: number;
  numerosXTalonarioDefault: number;
  tipoCopiaDefiniciones: TipoCopiaDefinicion[];
  encuadernacion: EncuadernacionConfig;
  puntillado: PuntilladoConfig;
  modoTalonarioIncompleto: 'aprovechar_pliego' | 'pose_completa';
  materialesExtra: {
    cartonBase: { habilitado: boolean; materiaPrimaVarianteId?: string | null };
    hojaBlancaSuperior: { habilitado: boolean; materiaPrimaVarianteId?: string | null };
  };
  numeracion: { habilitado: boolean; posicion?: string | null };
};

export type ImposicionBase = {
  piezasPorPliego: number;
  orientacion: string;
  cols: number;
  rows: number;
  anchoImprimibleMm: number;
  altoImprimibleMm: number;
  anchoDisponibleMm: number;
  altoDisponibleMm: number;
  demasiaCorteMm: number;
  lineaCorteMm: number;
  piezaAnchoMm: number;
  piezaAltoMm: number;
  piezaAnchoEfectivoMm: number;
  piezaAltoEfectivoMm: number;
  sheetAnchoMm: number;
  sheetAltoMm: number;
  normal: number;
  rotada: number;
  tipoCorte: string;
  machineMargins: { leftMm: number; rightMm: number; topMm: number; bottomMm: number };
};

// ─── Imposición con restricciones de talonario ────────────────────

export type TalonarioImposicionResult = ImposicionBase & {
  /** true cuando las poses van enfrentadas (emblocado) */
  teteBeche: boolean;
  /** Posición de la línea de puntillado en mm desde el borde indicado */
  puntilladoLineMm: number | null;
  puntilladoBorde: string | null;
  /** Información de encuadernación usada */
  encuadernacionTipo: string;
};

/**
 * Envuelve el resultado de calculateImposicion base y agrega restricciones
 * de talonario: orientación por encuadernación y alineación de puntillado.
 *
 * Para **emblocado** (tête-bêche): las poses se enfrentan en pares.
 * Si el número de columnas o filas es impar, la última pose queda sin pareja
 * enfrentada, pero el cálculo de cantidad sigue siendo el mismo (el corte
 * separa las mitades).
 *
 * Para **abrochado**: todas las poses mantienen la misma orientación.
 * No hay restricción adicional sobre el layout.
 *
 * La restricción de **puntillado** se valida pero no reduce poses por ahora:
 * en la práctica, la perforadora pasa en línea recta por el pliego completo,
 * por lo que todas las poses quedan perforadas a la misma posición relativa
 * siempre que estén en la misma orientación (abrochado) o enfrentadas
 * simétricamente (emblocado).
 */
/**
 * 2026-04-23 — Fase 1.3: delega a
 * `nesting/helpers/talonario-imposicion-constraints.ts`. Mantiene
 * signature pública para no romper imports externos.
 */
export { applyTalonarioImposicionConstraints } from '../nesting/helpers/talonario-imposicion-constraints';

// ─── Agrupamiento de talonarios ───────────────────────────────────
// 2026-04-23 — Fase 1.3: extraído a nesting/helpers/talonario-grouping.ts.
// Re-exportamos tipo y función para no romper imports externos.

import type { TalonarioGroupingResult as TalonarioGroupingResultImported } from '../nesting/helpers/talonario-grouping';
export { calculateTalonarioGrouping } from '../nesting/helpers/talonario-grouping';
export type TalonarioGroupingResult = TalonarioGroupingResultImported;

// ─── Cálculo de costos de papel multicapa ─────────────────────────

export type PaperLayerCost = {
  capaIndex: number;
  capaLabel: string;
  colorPapel: string;
  papelVarianteId: string | null;
  pliegos: number;
  costoUnitario: number;
  costoTotal: number;
};

export function calculateTalonarioPaperCosts(input: {
  pliegosXCapa: number;
  tipoCopiaDefinicion: TipoCopiaDefinicion;
  papelPrecioByVarianteId: Map<string, number>;
  pliegosPorSustratoByVarianteId: Map<string, number>;
}): { layers: PaperLayerCost[]; totalPapel: number } {
  const layers: PaperLayerCost[] = [];
  let totalPapel = 0;

  for (const papel of input.tipoCopiaDefinicion.papeles) {
    const precioBase = papel.papelVarianteId
      ? (input.papelPrecioByVarianteId.get(papel.papelVarianteId) ?? 0)
      : 0;
    const pliegosPorSustrato = papel.papelVarianteId
      ? (input.pliegosPorSustratoByVarianteId.get(papel.papelVarianteId) ?? 1)
      : 1;
    const costoUnitario = pliegosPorSustrato > 0 ? precioBase / pliegosPorSustrato : 0;
    const costoTotal = costoUnitario * input.pliegosXCapa;

    layers.push({
      capaIndex: papel.capaIndex,
      capaLabel: papel.capaLabel,
      colorPapel: papel.colorPapel,
      papelVarianteId: papel.papelVarianteId,
      pliegos: input.pliegosXCapa,
      costoUnitario: round6(costoUnitario),
      costoTotal: round6(costoTotal),
    });
    totalPapel += costoTotal;
  }

  return { layers, totalPapel: round6(totalPapel) };
}

// ─── Cálculo de materiales extra ──────────────────────────────────

export type ExtraMaterialCost = {
  tipo: string;
  nombre: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
};

export function calculateTalonarioExtraMaterials(input: {
  cantidadTalonarios: number;
  numerosXTalonario: number;
  grouping: TalonarioGroupingResult;
  config: TalonarioMotorConfig;
  materialPrecioByVarianteId: Map<string, number>;
}): { items: ExtraMaterialCost[]; total: number } {
  const items: ExtraMaterialCost[] = [];
  let total = 0;

  // Cartón base: va al tamaño del pliego, 1 por grupo de pliegos (no por talonario).
  // Un "grupo" imprime N talonarios en un pliego. El cartón se pone al final
  // de cada tanda de `numerosXTalonario` hojas y luego se guillotina con ellas.
  // Cantidad de cartones = gruposCompletos + (residuo > 0 ? 1 : 0)
  // Es decir, la misma cantidad de "tandas" de pliegos.
  if (input.config.materialesExtra.cartonBase.habilitado) {
    const varianteId = input.config.materialesExtra.cartonBase.materiaPrimaVarianteId;
    const precio = varianteId ? (input.materialPrecioByVarianteId.get(varianteId) ?? 0) : 0;
    const gruposTotales = input.grouping.gruposCompletos + (input.grouping.talonariosResiduo > 0 ? 1 : 0);
    const cant = gruposTotales;
    const costo = cant * precio;
    items.push({
      tipo: 'carton_base',
      nombre: 'Cartón base',
      cantidad: cant,
      costoUnitario: round6(precio),
      costoTotal: round6(costo),
    });
    total += costo;
  }

  // Hoja blanca superior: misma lógica que el cartón (1 por grupo, tamaño pliego)
  if (input.config.materialesExtra.hojaBlancaSuperior.habilitado) {
    const varianteId = input.config.materialesExtra.hojaBlancaSuperior.materiaPrimaVarianteId;
    const precio = varianteId ? (input.materialPrecioByVarianteId.get(varianteId) ?? 0) : 0;
    const gruposTotales = input.grouping.gruposCompletos + (input.grouping.talonariosResiduo > 0 ? 1 : 0);
    const cant = gruposTotales;
    const costo = cant * precio;
    items.push({
      tipo: 'hoja_blanca_superior',
      nombre: 'Hoja blanca superior',
      cantidad: cant,
      costoUnitario: round6(precio),
      costoTotal: round6(costo),
    });
    total += costo;
  }

  return { items, total: round6(total) };
}

// ─── Cálculo de guillotinado ──────────────────────────────────────

export type GuillotinadoResult = {
  espesorTalonarioHojas: number;
  talonariosXTanda: number;
  tandas: number;
};

export function calculateTalonarioGuillotinado(input: {
  cantidadTalonarios: number;
  numerosXTalonario: number;
  capas: number;
  tieneCarton: boolean;
  tieneHojaBlanca: boolean;
  capacidadMaxHojas: number;
}): GuillotinadoResult {
  const espesorTalonarioHojas =
    input.numerosXTalonario * input.capas +
    (input.tieneCarton ? 1 : 0) +
    (input.tieneHojaBlanca ? 1 : 0);

  if (input.capacidadMaxHojas <= 0 || espesorTalonarioHojas <= 0) {
    return { espesorTalonarioHojas, talonariosXTanda: 1, tandas: input.cantidadTalonarios };
  }

  const talonariosXTanda = Math.max(1, Math.floor(input.capacidadMaxHojas / espesorTalonarioHojas));
  const tandas = Math.ceil(input.cantidadTalonarios / talonariosXTanda);

  return { espesorTalonarioHojas, talonariosXTanda, tandas };
}

// ─── Helpers ──────────────────────────────────────────────────────

export function parseTalonarioMotorConfig(raw: Record<string, unknown>): TalonarioMotorConfig {
  return raw as unknown as TalonarioMotorConfig;
}

export function resolveTipoCopia(
  config: TalonarioMotorConfig,
  tipoCopiaSeleccionado: string | null | undefined,
): TipoCopiaDefinicion | null {
  if (!config.tipoCopiaDefiniciones?.length) return null;
  if (tipoCopiaSeleccionado) {
    const normalized = tipoCopiaSeleccionado.toUpperCase();
    const found = config.tipoCopiaDefiniciones.find(
      (d) => d.valor.toUpperCase() === normalized,
    );
    if (found) return found;
  }
  return config.tipoCopiaDefiniciones[0];
}

function round6(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}
