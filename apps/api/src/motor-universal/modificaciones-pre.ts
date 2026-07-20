/**
 * Etapa B — Modificaciones físicas PRE (bolsillos y refuerzos en lona).
 *
 * Implementa la sub-tarea (i) del bucle del motor
 * (`docs/motor-por-pasos-analisis/04-modelo-conceptual-motor.md` §2):
 * *"(Solo pasos PRE) MUTAR valores MUTABLES del JobContext"*. Estaba declarada
 * desde la Fase E y nunca se había implementado.
 *
 * Bolsillo y refuerzo NO son dos lógicas: son la misma primitiva —demasía
 * perimetral selectiva— con parámetros distintos. El `subTipo` es un preset
 * (precarga valores y nombra el paso en la OT), no una rama de código.
 *
 * REGLA DE ORO (docs/modificaciones-fisicas-lona-diseno.md §3):
 *
 *   La demasía muta la medida de MATERIAL.
 *   La unión (soldadura/pegado) se mide sobre la medida VISIBLE.
 *
 * Porque la costura corre por el borde terminado: no crece con la demasía.
 * El material sí.
 */
import {
  recalcularMetricasDerivadasPiezas,
} from './job-context-metrics';
import type { JobContext, LadoPieza, MutacionAplicada } from './tipos';

export const LADOS_PIEZA: LadoPieza[] = [
  'superior',
  'inferior',
  'izquierdo',
  'derecho',
];

/** Lados que agrandan el ALTO al recibir demasía. */
const LADOS_EJE_ALTO: LadoPieza[] = ['superior', 'inferior'];

export interface ParamsModificacionPre {
  /** Preset: `bolsillo` (lados horizontales, demasía grande) o `refuerzo`. */
  subTipo: string;
  lados: LadoPieza[];
  demasiaMm: number;
}

/**
 * Lee y valida `paramsPasoJson` de un paso `modificacion_pre`.
 * Devuelve null si el paso está mal configurado (sin lados o sin demasía útil),
 * de modo que el motor pueda avisar en vez de mutar con basura.
 */
export function parsearParamsModificacionPre(
  paramsPasoJson: unknown,
): ParamsModificacionPre | null {
  const params = (paramsPasoJson ?? {}) as Record<string, unknown>;

  const ladosRaw = Array.isArray(params.lados) ? params.lados : [];
  const lados = LADOS_PIEZA.filter((lado) => ladosRaw.includes(lado));
  if (lados.length === 0) return null;

  const demasiaMm = Number(params.demasiaMm ?? NaN);
  if (!Number.isFinite(demasiaMm) || demasiaMm <= 0) return null;

  const subTipo =
    typeof params.subTipo === 'string' && params.subTipo.trim()
      ? params.subTipo.trim()
      : 'refuerzo';

  return { subTipo, lados, demasiaMm };
}

/**
 * Metros lineales de unión del paso — el driver del tiempo (T-2 en ml/h).
 *
 * Se mide sobre `piezasVisibles` (la medida que pidió el cliente), NO sobre
 * `piezas[]`, que ya puede venir agrandada por un paso PRE anterior.
 *
 * Cada lado aporta el largo del lado OPUESTO al eje que agranda: un bolsillo
 * superior corre a lo largo del ancho.
 */
export function calcularMetrosLinealesUnion(
  jobContext: JobContext,
  params: ParamsModificacionPre,
): number {
  const piezas = jobContext.piezasVisibles ?? jobContext.piezas;
  if (!piezas || piezas.length === 0) return 0;

  return piezas.reduce((acc, pieza) => {
    const anchoMm = Number(pieza.anchoMm ?? 0);
    const altoMm = Number(pieza.altoMm ?? 0);
    const cantidad = Number(pieza.cantidad ?? 0);
    if (anchoMm <= 0 || altoMm <= 0 || cantidad <= 0) return acc;

    const largoTotalMm = params.lados.reduce(
      (sum, lado) => sum + (LADOS_EJE_ALTO.includes(lado) ? anchoMm : altoMm),
      0,
    );
    return acc + (largoTotalMm / 1000) * cantidad;
  }, 0);
}

/**
 * Aplica la mutación al JobContext: agranda `piezas[]`, recalcula las métricas
 * derivadas y appendea la traza.
 *
 * La traza se appendea a `jobContext.mutacionesAplicadas` y NO viaja como
 * output canónico: el merge del loop hace `jobContext[key] = value`, así que un
 * segundo paso PRE pisaría la traza del primero (caso real: refuerzo + ojales).
 *
 * Devuelve la traza generada, o null si no había piezas que mutar.
 */
export function aplicarMutacionPre(
  jobContext: JobContext,
  params: ParamsModificacionPre,
  paso: { rutaPasoId: string; nombrePaso: string },
): MutacionAplicada | null {
  if (!jobContext.piezas || jobContext.piezas.length === 0) return null;

  const ladosAlto = params.lados.filter((l) => LADOS_EJE_ALTO.includes(l));
  const deltaAltoMm = ladosAlto.length * params.demasiaMm;
  const deltaAnchoMm = (params.lados.length - ladosAlto.length) * params.demasiaMm;

  const metrosLinealesUnion = calcularMetrosLinealesUnion(jobContext, params);

  const piezasTraza = jobContext.piezas.map((pieza) => {
    const antes = { anchoMm: pieza.anchoMm, altoMm: pieza.altoMm };
    pieza.anchoMm = antes.anchoMm + deltaAnchoMm;
    pieza.altoMm = antes.altoMm + deltaAltoMm;
    // Un perímetro explícito quedó viejo tras agrandar la pieza. Lo borramos
    // para que `calcularPerimetroPiezasM` vuelva al cálculo rectangular en vez
    // de arrastrar un valor que ya no describe nada.
    delete pieza.perimetroMm;
    return {
      antes,
      despues: { anchoMm: pieza.anchoMm, altoMm: pieza.altoMm },
    };
  });

  recalcularMetricasDerivadasPiezas(jobContext);

  const traza: MutacionAplicada = {
    rutaPasoId: paso.rutaPasoId,
    nombrePaso: paso.nombrePaso,
    subTipo: params.subTipo,
    lados: params.lados,
    demasiaMm: params.demasiaMm,
    deltaAnchoMm,
    deltaAltoMm,
    metrosLinealesUnion,
    piezas: piezasTraza,
  };

  jobContext.mutacionesAplicadas = [
    ...(jobContext.mutacionesAplicadas ?? []),
    traza,
  ];

  return traza;
}
