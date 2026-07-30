/**
 * E.1 — Aplicación de los defaults declarados del paso
 * (FamiliaPasoDefaults): la familia sugiere, el producto pisa, la
 * cotización ajusta. Ver docs/wizard-ruta-diseno.md §2.
 *
 * Funciones PURAS para que la precedencia quede testeada sin DB; el motor
 * las llama en sus sitios de cálculo. La precedencia es siempre la misma:
 * valor de la config del producto → default de familia → default duro.
 */
import type { DefaultsFamiliaPaso, PasoCargado } from './tipos';

/** T-1 sin máquina: override del producto → default de familia → 0. */
export function tiempoFijoEfectivoMin(paso: {
  tiempoFijoOverrideMin: number | null;
  defaultsFamilia?: DefaultsFamiliaPaso;
}): number {
  return (
    paso.tiempoFijoOverrideMin ?? paso.defaultsFamilia?.tiempoFijoMin ?? 0
  );
}

/** T-2 propia: productividad de la config → default de familia → 0. */
export function productividadPropiaEfectiva(
  params: Record<string, unknown>,
  paso: { defaultsFamilia?: DefaultsFamiliaPaso },
): number {
  const configurada = Number(params.productivityValue ?? NaN);
  if (Number.isFinite(configurada) && configurada > 0) return configurada;
  const defecto = paso.defaultsFamilia?.productividadHora;
  return typeof defecto === 'number' && defecto > 0 ? defecto : 0;
}

/**
 * Centro de costo efectivo de un paso SIN máquina: el de la config → el
 * default de familia. Con máquina devuelve null (lo trae la máquina).
 */
export function centroCostoEfectivo(paso: {
  maquinaM1Id: string | null;
  centroCostoId: string | null;
  centroCosto?: { id: string; codigo: string; nombre: string } | null;
  defaultsFamilia?: DefaultsFamiliaPaso;
}): { id: string; codigo: string; nombre: string } | null {
  if (paso.maquinaM1Id) return null;
  if (paso.centroCostoId && paso.centroCosto) return paso.centroCosto;
  const d = paso.defaultsFamilia;
  if (d?.centroCostoId) {
    return {
      id: d.centroCostoId,
      codigo: d.centroCostoCodigo ?? '',
      nombre: d.centroCostoNombre ?? '',
    };
  }
  return paso.centroCosto ?? null;
}

/** Aplica el centro efectivo SOBRE el paso cargado (mutación en la carga,
 *  así todo el motor aguas abajo ve un solo origen de centro). */
export function aplicarCentroDefault(paso: PasoCargado): PasoCargado {
  const centro = centroCostoEfectivo(paso);
  if (!centro || paso.centroCostoId) return paso;
  paso.centroCostoId = centro.id;
  paso.centroCosto = centro;
  return paso;
}
