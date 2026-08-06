/**
 * Catálogo de PRIMITIVAS de familia — registros tipados por gancho.
 *
 * Los algoritmos se mudaron INTACTOS desde motor.service.ts (los goldens son
 * el juez); acá sólo ganaron nombre. La ficha declara cuál usa en
 * `primitivas` y el motor despacha por estos registros — cero `if` por
 * familia en el motor.
 */
import {
  calcularMetrosLinealesUnion,
  parsearParamsModificacionPre,
} from '../modificaciones-pre';
import { calculateSustratoToPliegoConversion } from '../../productos-servicios/nesting/helpers/sustrato-to-pliego';
import type {
  PrimitivaAviso,
  PrimitivaCantidadPropia,
  PrimitivaCompraSustrato,
  PrimitivaDesgaste,
  PrimitivaFactorVelocidad,
  PrimitivaSeleccionPerfil,
  PrimitivaTiempoRun,
} from './tipos';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ─── tiempoRun ──────────────────────────────────────────────────────

/** Cortes por tanda que publicó el plan de corte en el JobContext. */
function cortesPorTandaDelJobContext(jobContext: unknown): number {
  const cortes = (jobContext as Record<string, unknown>).cortes_calculados;
  if (typeof cortes === 'number') return cortes;
  if (cortes && typeof cortes === 'object' && !Array.isArray(cortes)) {
    return Number((cortes as Record<string, unknown>).cortesTotales ?? 0);
  }
  return 0;
}

/**
 * El oficio del guillotinero: el run NO sale de la productividad del perfil
 * sino del plan de corte — tandas de pliegos por bajada de cuchilla.
 * [P1: era `calcularRunMinGuillotina`, rama `corte_guillotina` del motor]
 */
const guillotina_por_cortes: PrimitivaTiempoRun = (paso, jobContext, deps) => {
  const detalle = asRecord(paso.perfil?.detalleJson);
  const pliegosMaxPorTanda = Number(detalle.pliegosMaxPorTanda ?? 0);
  // El tiempo por corte vive en el perfil (2026-07-28). El valor de la
  // máquina queda como respaldo de las guillotinas cargadas antes del
  // cambio: sin él, ese paso costearía 0 minutos en silencio.
  const tiempoPorCorteSeg = Number(
    detalle.tiempoPorCorteSeg ??
      paso.maquina?.parametrosTecnicosJson?.tiempoPorCorteSeg ??
      0,
  );
  const cortesPorTanda = cortesPorTandaDelJobContext(jobContext);
  const pliegos = deps.resolverCantidad(paso, jobContext);

  if (
    !Number.isFinite(pliegos) ||
    pliegos <= 0 ||
    !Number.isFinite(pliegosMaxPorTanda) ||
    pliegosMaxPorTanda <= 0 ||
    !Number.isFinite(tiempoPorCorteSeg) ||
    tiempoPorCorteSeg <= 0 ||
    !Number.isFinite(cortesPorTanda) ||
    cortesPorTanda <= 0
  ) {
    return 0;
  }

  const tandas = Math.ceil(pliegos / pliegosMaxPorTanda);
  const cortesMin = (tandas * cortesPorTanda * tiempoPorCorteSeg) / 60;
  const recargasMin =
    Math.max(0, tandas - 1) * Number(paso.perfil?.feedReloadMin ?? 0);
  return cortesMin + recargasMin;
};

// ─── cantidadPropia ─────────────────────────────────────────────────

/**
 * Metros lineales de unión sobre la medida VISIBLE: la costura corre por el
 * borde terminado, no crece con la demasía. Con params inválidos devuelve 0
 * (la pre-pasada ya corta la cotización con su propio diagnóstico).
 * [P1: era la rama `modificacion_pre` de resolverCantidad]
 */
const ml_union_visible: PrimitivaCantidadPropia = (paso, jobContext, deps) => {
  const params = parsearParamsModificacionPre(
    deps.paramsEfectivos(paso, jobContext),
  );
  if (params) return calcularMetrosLinealesUnion(jobContext, params);
  return 0;
};

// ─── factorVelocidad ────────────────────────────────────────────────

/**
 * Factor A4 equivalente: área del pliego ÷ área A4, mínimo 1 — una SRA3
 * cuenta ~2 páginas A4 de PPM. El gate por familia murió: el motor sólo
 * llama a este gancho si la ficha lo declara.
 * [P2: era `factorA4EquivalenteParaImpresionPorHoja` en el motor]
 */
const a4_equivalente: PrimitivaFactorVelocidad = (
  paso,
  jobContext,
  nestingDispatch,
) => {
  const sheet = nestingDispatch?.substrates.find(
    (
      substrate,
    ): substrate is Extract<
      (typeof nestingDispatch.substrates)[number],
      { kind: 'sheet' }
    > => substrate.kind === 'sheet',
  );
  const ctx = jobContext as Record<string, unknown>;
  const anchoMm = Number(sheet?.widthMm ?? ctx.pliego_impresion_ancho_mm ?? 0);
  const altoMm = Number(sheet?.heightMm ?? ctx.pliego_impresion_alto_mm ?? 0);
  if (
    !Number.isFinite(anchoMm) ||
    anchoMm <= 0 ||
    !Number.isFinite(altoMm) ||
    altoMm <= 0
  ) {
    return 1;
  }

  const areaA4Mm2 = 210 * 297;
  return Math.max(1, (anchoMm * altoMm) / areaA4Mm2);
};

// ─── desgaste ───────────────────────────────────────────────────────

/**
 * Clicks A4: ⌈pliegos⌉ × caras × ⌈factor A4⌉.
 * [P2: era `clicksA4DelPaso` en el motor]
 */
const clicks_a4: PrimitivaDesgaste = (
  paso,
  jobContext,
  nestingDispatch,
  deps,
) => {
  // El acomodo va SÍ o SÍ: los clicks son pliegos que pasan por la máquina,
  // y sin él la cantidad cae a las piezas del trabajo — 500 tarjetas
  // contarían 500 clicks cuando la máquina sólo vio 50 pliegos. Mientras la
  // imposición la hacía pre-prensa, este paso heredaba pliegos y el error
  // no se veía.
  const pliegos = deps.resolverCantidad(paso, jobContext, nestingDispatch);
  if (!Number.isFinite(pliegos) || pliegos <= 0) return 0;
  const caras = deps.carasConsumible(paso, jobContext);
  const factorA4 = Math.ceil(
    deps.factorVelocidad(paso, jobContext, nestingDispatch),
  );
  return Math.ceil(pliegos) * caras * Math.max(1, factorA4);
};

// ─── seleccionPerfil ────────────────────────────────────────────────

/**
 * Cadena de impresión por hoja: caras → escalón de gramaje, sobre los
 * candidatos ya filtrados por modo de color. Los tres discriminantes se
 * ENCADENAN como filtros en vez de competir: antes ganaba el primer perfil
 * que matcheara el color y el gramaje no se miraba nunca. Siempre decide
 * si hay candidatos (el fallback es el primero).
 * [P3: era el bloque 1 de resolverPerfilAutomatico]
 */
const cadena_caras_gramaje: PrimitivaSeleccionPerfil = (
  paso,
  jobContext,
  candidatos,
  deps,
) => {
  if (candidatos.length === 0) return null;
  const ctx = jobContext as Record<string, unknown>;
  const tieneSenalCaras =
    typeof jobContext.caras === 'number' ||
    ctx[`caras_${paso.configPasoId}`] !== undefined;
  const buscarDoble =
    tieneSenalCaras && deps.carasEfectivas(paso, jobContext) === 2;

  // Filtro caras. Si ningún perfil cubre las caras pedidas se sigue sin
  // filtrar (el aviso lo emite el gancho de avisos).
  let cands = candidatos;
  if (tieneSenalCaras) {
    const porCaras = cands.filter(
      (perfil) => deps.perfilEsDobleFaz(perfil) === buscarDoble,
    );
    if (porCaras.length > 0) cands = porCaras;
  }

  // Filtro gramaje: gana el "hasta" más chico que todavía cubre el papel.
  // Sin gramaje en el contexto o sin escalones, queda el orden anterior.
  const gramaje = deps.numeroPositivo(
    ctx.gramajeMaterialGr ?? ctx.gramajeGr ?? ctx.gramaje,
  );
  const candidato = gramaje
    ? (deps.elegirPorEscalonDeGramaje(cands, gramaje) ?? cands[0])
    : cands[0];
  return candidato ?? null;
};

/**
 * Escalón de gramaje de guillotina: decide sólo con gramaje en el contexto
 * y un perfil distinto del actual; si no, deja seguir el pipeline (las
 * reglas declarativas por perfil siguen corriendo, como siempre).
 * [P3: era el bloque 2 de resolverPerfilAutomatico]
 */
const escalon_gramaje: PrimitivaSeleccionPerfil = (
  paso,
  jobContext,
  candidatos,
  deps,
) => {
  const ctx = jobContext as Record<string, unknown>;
  const gramaje = deps.numeroPositivo(
    ctx.gramajeMaterialGr ?? ctx.gramajeGr ?? ctx.gramaje,
  );
  if (!gramaje) return null;
  const candidato = deps.elegirPorEscalonDeGramaje(candidatos, gramaje);
  if (!candidato || candidato.id === paso.perfilM1Id) return null;
  return candidato;
};

// ─── compraSustrato ─────────────────────────────────────────────────

/**
 * Pliegos de impresión → hojas de compra: cuando el pliego que imprime la
 * máquina se DERIVA cortando la hoja comercial (SRA3 de una A3+), la compra
 * se cuenta en hojas enteras.
 * [P2: era `ajustarCantidadSustratoComprado` en el motor]
 */
const pliegos_a_hojas: PrimitivaCompraSustrato = (
  cantidadConsumo,
  slotCodigo,
  paso,
  jobContext,
  nestingDispatch,
  materialResuelto,
) => {
  if (slotCodigo !== 'sustrato_principal') {
    return cantidadConsumo;
  }
  if (!Number.isFinite(cantidadConsumo) || cantidadConsumo <= 0) {
    return cantidadConsumo;
  }

  const printSheet = nestingDispatch?.substrates.find(
    (
      sub,
    ): sub is Extract<
      (typeof nestingDispatch.substrates)[number],
      { kind: 'sheet' }
    > => sub.kind === 'sheet',
  );
  const ctx = jobContext as Record<string, unknown>;
  const printSheetWidthMm = Number(
    printSheet?.widthMm ?? ctx.pliego_impresion_ancho_mm ?? 0,
  );
  const printSheetHeightMm = Number(
    printSheet?.heightMm ?? ctx.pliego_impresion_alto_mm ?? 0,
  );
  if (
    !Number.isFinite(printSheetWidthMm) ||
    printSheetWidthMm <= 0 ||
    !Number.isFinite(printSheetHeightMm) ||
    printSheetHeightMm <= 0
  ) {
    return cantidadConsumo;
  }

  const attrs = materialResuelto.atributosVarianteJson ?? {};
  const anchoSustratoMm = Number(attrs.anchoMm ?? attrs.widthMm ?? 0);
  const altoSustratoMm = Number(
    attrs.largoMm ?? attrs.altoMm ?? attrs.heightMm ?? 0,
  );
  if (
    !Number.isFinite(anchoSustratoMm) ||
    anchoSustratoMm <= 0 ||
    !Number.isFinite(altoSustratoMm) ||
    altoSustratoMm <= 0
  ) {
    return cantidadConsumo;
  }

  const conversion = calculateSustratoToPliegoConversion({
    sustrato: { anchoMm: anchoSustratoMm, altoMm: altoSustratoMm },
    pliegoImpresion: {
      anchoMm: printSheetWidthMm,
      altoMm: printSheetHeightMm,
    },
  });

  if (!conversion.esDerivado || conversion.pliegosPorSustrato <= 1) {
    return cantidadConsumo;
  }
  return Math.ceil(cantidadConsumo / conversion.pliegosPorSustrato);
};

// ─── avisos ─────────────────────────────────────────────────────────

/**
 * El trabajo pide doble faz y la máquina no tiene ningún perfil de doble
 * faz: el motor cae en un perfil de simple faz y el tiempo sale a la mitad
 * del real. Antes pasaba en silencio; ahora la cotización lo dice.
 *
 * Es WARNING y no ERROR a propósito: la cotización sale igual —la imprenta
 * puede querer cotizar mientras termina de cargar la máquina—, pero queda
 * escrito que ese tiempo está subestimado.
 * [P4: era `avisarFaltaPerfilDobleFaz` en el motor]
 */
const perfil_doble_faz: PrimitivaAviso = (
  paso,
  jobContext,
  perfilResuelto,
  errores,
  deps,
) => {
  const ctx = jobContext as Record<string, unknown>;
  const tieneSenalCaras =
    typeof jobContext.caras === 'number' ||
    ctx[`caras_${paso.configPasoId}`] !== undefined;
  if (!tieneSenalCaras) return;
  if (deps.carasEfectivas(paso, jobContext) !== 2) return;

  const perfilEnUso =
    perfilResuelto ??
    paso.perfilesDisponibles?.find((p) => p.id === paso.perfilM1Id) ??
    paso.perfil;
  if (perfilEnUso && deps.perfilEsDobleFaz(perfilEnUso)) return;

  const hayAlguno = deps
    .perfilesCompatibles(paso)
    .some((perfil) => deps.perfilEsDobleFaz(perfil));
  if (hayAlguno) return;

  errores.push({
    codigo: 'perfil_doble_faz_faltante',
    severidad: 'WARNING',
    mensaje: `El paso ${paso.rutaPasoOrden} se cotiza a doble faz, pero ${paso.maquina?.nombre ?? 'la máquina'} no tiene ningún perfil de doble faz: el tiempo sale calculado con uno de simple faz y queda subestimado.`,
    rutaPasoId: paso.rutaPasoId,
    rutaPasoOrden: paso.rutaPasoOrden,
    familiaCodigo: paso.familiaCodigo,
    sugerencia:
      'Agregar un perfil de doble faz a la máquina con su productividad real.',
    contexto: {
      maquinaId: paso.maquina?.id,
      perfilId: perfilEnUso?.id ?? null,
    },
  });
};

// ─── Registros ──────────────────────────────────────────────────────

export const REGISTRO_TIEMPO_RUN: Record<string, PrimitivaTiempoRun> = {
  guillotina_por_cortes,
};

export const REGISTRO_CANTIDAD_PROPIA: Record<string, PrimitivaCantidadPropia> =
  {
    ml_union_visible,
  };

export const REGISTRO_FACTOR_VELOCIDAD: Record<
  string,
  PrimitivaFactorVelocidad
> = {
  a4_equivalente,
};

export const REGISTRO_DESGASTE: Record<string, PrimitivaDesgaste> = {
  clicks_a4,
};

export const REGISTRO_COMPRA_SUSTRATO: Record<
  string,
  PrimitivaCompraSustrato
> = {
  pliegos_a_hojas,
};

export const REGISTRO_SELECCION_PERFIL: Record<
  string,
  PrimitivaSeleccionPerfil
> = {
  cadena_caras_gramaje,
  escalon_gramaje,
};

export const REGISTRO_AVISOS: Record<string, PrimitivaAviso> = {
  perfil_doble_faz,
};
