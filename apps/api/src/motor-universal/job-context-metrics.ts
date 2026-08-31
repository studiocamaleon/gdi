import type { JobContext } from './tipos';

export function calcularPerimetroPiezasM(
  jobContext: Pick<JobContext, 'piezas'>,
) {
  if (!jobContext.piezas || jobContext.piezas.length === 0) return 0;
  return jobContext.piezas.reduce((acc, p) => {
    const perimetroMm =
      Number.isFinite(Number(p.perimetroMm)) && Number(p.perimetroMm) > 0
        ? Number(p.perimetroMm)
        : 2 * (Number(p.anchoMm ?? 0) + Number(p.altoMm ?? 0));
    if (!Number.isFinite(perimetroMm) || perimetroMm <= 0) return acc;
    return acc + (perimetroMm / 1000) * p.cantidad;
  }, 0);
}

export function calcularAreaPiezasM2(jobContext: Pick<JobContext, 'piezas'>) {
  if (!jobContext.piezas || jobContext.piezas.length === 0) return 0;
  return jobContext.piezas.reduce((acc, p) => {
    const anchoMm = Number(p.anchoMm ?? 0);
    const altoMm = Number(p.altoMm ?? 0);
    if (!Number.isFinite(anchoMm) || !Number.isFinite(altoMm)) return acc;
    if (anchoMm <= 0 || altoMm <= 0) return acc;
    return acc + ((anchoMm * altoMm) / 1_000_000) * p.cantidad;
  }, 0);
}

/**
 * Congela la medida que pidió el cliente ANTES de que ningún paso PRE la mute.
 *
 * Ver `docs/modificaciones-fisicas-lona-diseno.md` §3 (regla de oro): la
 * demasía de un `modificacion_pre` muta la medida de MATERIAL, pero las
 * operaciones que corren por el borde terminado (soldadura del bolsillo,
 * colocación de ojales) se miden sobre la medida VISIBLE — la costura y el
 * ojal van al borde final, no crecen con la demasía.
 *
 * La medida visible además tiene que sobrevivir hasta la OT y el seguimiento
 * público: el operario corta 1580×1080 pero el cliente pidió 1500×1000, y los
 * dos números importan.
 *
 * Autoritativa: siempre deriva de `piezas[]`/`medidaCustomMm` y pisa lo que
 * hubiera. Se llama una sola vez, al inicio del loop, de modo que un valor
 * llegado desde el cliente nunca puede sustituir la medida real pedida.
 */
export function congelarMedidaVisible(jobContext: JobContext): void {
  delete jobContext.piezasVisibles;
  delete jobContext.medidaVisibleMm;

  if (jobContext.piezas && jobContext.piezas.length > 0) {
    jobContext.piezasVisibles = jobContext.piezas.map((p) => ({
      cantidad: p.cantidad,
      anchoMm: p.anchoMm,
      altoMm: p.altoMm,
    }));
  }
  // Simétrico a la síntesis de `piezas[]` desde `medidaCustomMm` que hace el
  // motor: si el comercial cargó una sola pieza y no medida custom, esa pieza
  // ES la medida visible.
  const fuenteMedida =
    jobContext.medidaCustomMm ??
    (jobContext.piezas?.length === 1 ? jobContext.piezas[0] : null);
  if (fuenteMedida) {
    jobContext.medidaVisibleMm = {
      anchoMm: fuenteMedida.anchoMm,
      altoMm: fuenteMedida.altoMm,
      ...(jobContext.profundidadMm
        ? { profundidadMm: jobContext.profundidadMm }
        : {}),
    };
  }
}

/**
 * Recalcula las métricas derivadas de `piezas[]` tras una mutación de un paso
 * PRE. SOBRESCRIBE los valores existentes a propósito.
 *
 * Motivo (auditoría 2026-07-20): `piezaAreaTotalM2` y `piezaPerimetroTotalM`
 * los calcula el FRONTEND una sola vez (`agregar-producto-sheet.tsx`) sobre la
 * medida pre-mutación, y el motor los prefiere por sobre el cálculo local
 * (`motor.service.ts`: `numeroPositivo(jobContext.piezaPerimetroTotalM) ??
 * numeroPositivo(calcularPerimetroPiezasM(...))`). Si no los pisamos acá, todo
 * paso posterior que los lea (refilado, corte manual, tercerizado por m²/ml,
 * cargos por área) trabaja con la medida vieja.
 *
 * OJO: estas métricas describen el MATERIAL consumido, por eso se recalculan
 * sobre las piezas mutadas. Lo que se mide sobre el borde terminado (ojales,
 * soldadura) NO debe leerlas — tiene que leer `piezasVisibles`.
 */
export function recalcularMetricasDerivadasPiezas(
  jobContext: JobContext,
): void {
  if (!jobContext.piezas || jobContext.piezas.length === 0) return;

  jobContext.piezaAreaTotalM2 = calcularAreaPiezasM2(jobContext);
  jobContext.piezaPerimetroTotalM = calcularPerimetroPiezasM(jobContext);

  const anchos = jobContext.piezas
    .map((p) => Number(p.anchoMm ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0);
  const altos = jobContext.piezas
    .map((p) => Number(p.altoMm ?? 0))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (anchos.length > 0) jobContext.piezaAnchoMaxMm = Math.max(...anchos);
  if (altos.length > 0) jobContext.piezaAltoMaxMm = Math.max(...altos);

  if (jobContext.medidaCustomMm && jobContext.piezas.length === 1) {
    jobContext.medidaCustomMm = {
      anchoMm: jobContext.piezas[0].anchoMm,
      altoMm: jobContext.piezas[0].altoMm,
    };
  }
}
