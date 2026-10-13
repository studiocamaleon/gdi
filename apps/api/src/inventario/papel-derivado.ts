import { calculateSustratoToPliegoConversion } from '../productos-servicios/nesting/helpers/sustrato-to-pliego';

/** Plan físico congelado: el precio usa hojas/rendimiento; el taller corta
 * pliegos enteros y devuelve al stock las hojas completas que no utiliza. */
export interface PapelDerivado {
  version: 1;
  anchoOrigenMm: number;
  altoOrigenMm: number;
  anchoMm: number;
  altoMm: number;
  rendimiento: number;
  hojasNecesarias: number;
}

export const enteroPapel = (n: number) => Math.ceil(Math.round(n * 1e8) / 1e8);
export function cantidadPapelCortado(
  cantidad: number,
  attrs: Record<string, unknown> | null | undefined,
): number | undefined {
  const meta = attrs?._papelDerivado as { version?: number } | undefined;
  return meta?.version === 1 ? enteroPapel(cantidad) : undefined;
}
export const pliegosPapel = (p: PapelDerivado) =>
  enteroPapel(p.hojasNecesarias / p.rendimiento);
export const sobrantePapel = (p: PapelDerivado) =>
  pliegosPapel(p) * p.rendimiento - p.hojasNecesarias;
export const clavePapel = (p: PapelDerivado) =>
  `${Math.min(p.anchoMm, p.altoMm)}x${Math.max(p.anchoMm, p.altoMm)}:${p.rendimiento}`;

export function planPapelDerivado(
  cantidadOrigen: number,
  attrs: Record<string, unknown> | null | undefined,
  anchoMm: number,
  altoMm: number,
): PapelDerivado | undefined {
  const anchoOrigenMm = Number(attrs?.anchoMm ?? attrs?.widthMm);
  const altoOrigenMm = Number(
    attrs?.largoMm ?? attrs?.altoMm ?? attrs?.heightMm,
  );
  if (
    ![cantidadOrigen, anchoOrigenMm, altoOrigenMm, anchoMm, altoMm].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return;
  const { pliegosPorSustrato: rendimiento, esDerivado } =
    calculateSustratoToPliegoConversion({
      sustrato: { anchoMm: anchoOrigenMm, altoMm: altoOrigenMm },
      pliegoImpresion: { anchoMm, altoMm },
    });
  if (!esDerivado || rendimiento <= 1) return;
  return {
    version: 1,
    anchoOrigenMm,
    altoOrigenMm,
    anchoMm,
    altoMm,
    rendimiento,
    hojasNecesarias: enteroPapel(cantidadOrigen * rendimiento),
  };
}

export function leerPapelDerivado(value: unknown): PapelDerivado | undefined {
  if (!value || typeof value !== 'object') return;
  const p = value as PapelDerivado;
  if (
    p.version !== 1 ||
    !Number.isSafeInteger(p.hojasNecesarias) ||
    p.hojasNecesarias <= 0
  )
    return;
  const esperado = planPapelDerivado(
    p.hojasNecesarias / p.rendimiento,
    { anchoMm: p.anchoOrigenMm, altoMm: p.altoOrigenMm },
    p.anchoMm,
    p.altoMm,
  );
  return esperado?.rendimiento === p.rendimiento ? esperado : undefined;
}

/** Sólo devuelve el sobrante cuando se consume el último pliego del plan.
 * Permite consumos parciales sin devolver dos veces las mismas hojas. */
export function sobrantesDelConsumo(
  planes: PapelDerivado[],
  antes: number,
  cantidad: number,
): Array<{ plan: PapelDerivado; hojas: number }> {
  let fin = 0;
  return planes.flatMap((plan) => {
    fin += pliegosPapel(plan);
    const hojas = sobrantePapel(plan);
    return hojas > 0 && antes < fin && antes + cantidad >= fin
      ? [{ plan, hojas }]
      : [];
  });
}
