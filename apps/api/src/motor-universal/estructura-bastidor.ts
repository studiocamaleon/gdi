/**
 * F1 Cartelería — Estructura de bastidor (docs/carteleria-configurador-diseno.md §4.1).
 *
 * La primitiva "estructura derivada de la medida": los metros de perfil, los
 * puntos de soldadura y la chapa de cenefa NO los carga nadie — salen del
 * ancho × alto × profundidad del cartel y de cada cuántos cm van los
 * refuerzos. Es como se calcula a mano en la herrería.
 *
 * Fórmulas validadas contra el prototipo del configurador 3D (signage/):
 *   simple (frontlight): un marco en un plano.
 *   doble  (backlight):  dos marcos (frente + contra) + 4 conectores de
 *                        profundidad + refuerzos duplicados y sus conectores.
 *
 * Misma regla de oro que ojales: se mide sobre la medida VISIBLE del cartel.
 */
import type { JobContext } from './tipos';

export const SOLAPA_CENEFA_CM_DEFAULT = 2;
/** Desperdicio de chapa por esquinas y solapes del plegado. */
export const DESPERDICIO_CENEFA = 0.08;
/** Margen de pintura sobre la superficie desarrollada del perfil. */
export const MARGEN_PINTURA = 0.1;
/**
 * Desarrollo de la sección del perfil (m² de superficie por metro lineal).
 * Un caño de 40×40 pinta 4 × 0,04 = 0,16 m² por metro. Se puede pisar desde
 * el atributo `desarrolloSeccionM` de la variante del perfil.
 */
export const DESARROLLO_PERFIL_M_DEFAULT = 0.16;

export interface ParamsEstructuraBastidor {
  /** simple = marco plano (frontlight) · doble = cajón (backlight). */
  tipoBastidor: 'simple' | 'doble';
  /** Separación máxima entre refuerzos verticales, en cm. 0 = sin refuerzos. */
  sepRefuerzoVcm: number;
  /** Ídem horizontales. */
  sepRefuerzoHcm: number;
  /** Cenefa: chapa plegada que envuelve el canto del cajón. */
  cenefa: boolean;
  solapaCenefaCm: number;
  /** Pintura del perfil (antióxido + esmalte). */
  pintura: boolean;
  /** Chapa trasera (panel posterior opaco, simple faz). */
  fondo: boolean;
  /** Profundidad del cajón si el paso la fija (el JobContext tiene prioridad). */
  profundidadMm?: number;
}

export interface ResultadoEstructuraBastidor {
  anchoM: number;
  altoM: number;
  profundidadM: number;
  refuerzosV: number;
  refuerzosH: number;
  mlPerimetro: number;
  mlRefuerzos: number;
  mlConectores: number;
  /** Total de perfil a comprar/cortar — la cantidad del paso. */
  mlTotal: number;
  /** Vértices + cruces: driver informativo del tiempo de herrería. */
  puntosSoldadura: number;
  /** m² de chapa de cenefa (0 si no lleva). */
  cenefaM2: number;
  /** Desarrollo del plegado de la cenefa, en cm (para la ficha técnica). */
  cenefaDesarrolloCm: number;
  /** m² de superficie del perfil a pintar (0 si no lleva). */
  pinturaM2: number;
  /** m² de chapa trasera (0 si no lleva). Incluye 10% de recorte. */
  fondoM2: number;
  /** Anclajes: pares de soportes cada ~80 cm de ancho (mínimo 2). */
  anclajes: number;
  /** Despiece: el largo de cada barra a cortar, en mm (para comprar barras
   *  ENTERAS con packing real, no ceil sobre los ml). */
  despieceMm: number[];
}

/**
 * Barras comerciales necesarias para un despiece (first-fit decreasing).
 * El redondeo ingenuo miente: 4 tramos de 1,8 m en barras de 3 m son 4
 * barras (una por tramo), no ceil(7,2/3)=3 — en cada barra entra un solo
 * tramo. `kerfMm` es lo que come cada corte de amoladora/sensitiva.
 */
export function calcularBarrasNecesarias(
  despieceMm: number[],
  largoBarraMm: number,
  kerfMm = 5,
): { barras: number; sobranteMm: number; aprovechamientoPct: number } | null {
  if (!Number.isFinite(largoBarraMm) || largoBarraMm <= 0) return null;
  const tramos = despieceMm
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => b - a);
  if (tramos.length === 0) return { barras: 0, sobranteMm: 0, aprovechamientoPct: 0 };
  // Un tramo más largo que la barra no se puede cortar de ninguna.
  if (tramos[0] > largoBarraMm) return null;

  const restos: number[] = [];
  for (const tramo of tramos) {
    const necesita = tramo + kerfMm;
    let colocado = false;
    for (let i = 0; i < restos.length; i++) {
      if (restos[i] >= necesita) {
        restos[i] -= necesita;
        colocado = true;
        break;
      }
    }
    if (!colocado) restos.push(largoBarraMm - necesita);
  }
  const barras = restos.length;
  const sobranteMm = restos.reduce((acc, r) => acc + Math.max(0, r), 0);
  const totalMm = barras * largoBarraMm;
  const utilMm = tramos.reduce((acc, t) => acc + t, 0);
  return {
    barras,
    sobranteMm,
    aprovechamientoPct: totalMm > 0 ? Math.round((utilMm / totalMm) * 10000) / 100 : 0,
  };
}

export function parsearParamsEstructuraBastidor(
  params: Record<string, unknown>,
): ParamsEstructuraBastidor {
  const tipo = String(params.tipoBastidor ?? 'doble').toLowerCase();
  const num = (v: unknown, def: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : def;
  };
  return {
    tipoBastidor: tipo === 'simple' ? 'simple' : 'doble',
    sepRefuerzoVcm: num(params.sepRefuerzoVcm, 100),
    sepRefuerzoHcm: num(params.sepRefuerzoHcm, 0),
    cenefa: params.cenefa === true || params.cenefa === 'true',
    solapaCenefaCm: num(params.solapaCenefaCm, SOLAPA_CENEFA_CM_DEFAULT),
    pintura: params.pintura !== false && params.pintura !== 'false',
    fondo: params.fondo === true || params.fondo === 'true',
    profundidadMm: num(params.profundidadMm, 0) || undefined,
  };
}

/**
 * Medida VISIBLE del cartel en metros. Regla de oro de las modificaciones
 * físicas (docs/modificaciones-fisicas-lona-diseno.md §3): la demasía de
 * tensado de la lona muta `piezas` (el MATERIAL crece), pero el bastidor se
 * suelda a la medida terminada — por eso se mide sobre `piezasVisibles` /
 * `medidaVisibleMm` cuando existen.
 */
function medidaCartelM(
  jobContext: JobContext,
): { anchoM: number; altoM: number } | null {
  const pieza =
    jobContext.medidaVisibleMm ??
    jobContext.piezasVisibles?.[0] ??
    jobContext.medidaCustomMm ??
    jobContext.piezas?.[0] ??
    null;
  const anchoM = Number(pieza?.anchoMm ?? 0) / 1000;
  const altoM = Number(pieza?.altoMm ?? 0) / 1000;
  if (anchoM <= 0 || altoM <= 0) return null;
  return { anchoM, altoM };
}

export function calcularEstructuraBastidor(
  jobContext: JobContext,
  params: ParamsEstructuraBastidor,
): ResultadoEstructuraBastidor | null {
  const medida = medidaCartelM(jobContext);
  if (!medida) return null;
  const { anchoM: W, altoM: H } = medida;

  const profundidadM =
    (Number(jobContext.profundidadMm ?? 0) || params.profundidadMm || 0) / 1000;
  const esDoble = params.tipoBastidor === 'doble';
  // El cajón sin profundidad no se puede armar: que el guard lo diagnostique.
  if (esDoble && profundidadM <= 0) return null;
  const D = esDoble ? profundidadM : 0;

  // Refuerzos: cuántas barras entran respetando la separación MÁXIMA.
  const refuerzosV =
    params.sepRefuerzoVcm > 0
      ? Math.max(0, Math.floor((W * 100 - 1) / params.sepRefuerzoVcm))
      : 0;
  const refuerzosH =
    params.sepRefuerzoHcm > 0
      ? Math.max(0, Math.floor((H * 100 - 1) / params.sepRefuerzoHcm))
      : 0;

  const mlPerimetro = esDoble ? 2 * (2 * (W + H)) + 4 * D : 2 * (W + H);
  const mlRefuerzos =
    (refuerzosV * H + refuerzosH * W) * (esDoble ? 2 : 1);
  const mlConectores = esDoble ? (refuerzosV + refuerzosH) * D : 0;
  const mlTotal = mlPerimetro + mlRefuerzos + mlConectores;

  const puntosSoldadura =
    (esDoble ? 8 : 4) +
    refuerzosV * 2 +
    refuerzosH * 2 +
    (esDoble ? (refuerzosV + refuerzosH) * 2 : 0);

  // §15: la geometría se deriva SIEMPRE; si el cartel lleva cenefa/pintura/
  // fondo lo decide la activación del paso OPCIONAL correspondiente, que
  // hereda estos outputs. (Los params booleanos viejos quedan ignorados.)
  let cenefaM2 = 0;
  let cenefaDesarrolloCm = 0;
  if (D > 0) {
    const desarrolloM = D + (2 * params.solapaCenefaCm) / 100;
    cenefaDesarrolloCm = desarrolloM * 100;
    cenefaM2 = 2 * (W + H) * desarrolloM * (1 + DESPERDICIO_CENEFA);
  }

  // Despiece: cada barra que la herrería corta, con su largo real.
  const despieceMm: number[] = [];
  const push = (largoM: number, veces: number) => {
    for (let i = 0; i < veces; i++) despieceMm.push(Math.round(largoM * 1000));
  };
  if (esDoble) {
    push(W, 4); // largueros de frente y contra
    push(H, 4); // parantes de frente y contra
    push(D, 4); // conectores de esquina
    push(H, refuerzosV * 2);
    push(W, refuerzosH * 2);
    push(D, refuerzosV + refuerzosH);
  } else {
    push(W, 2);
    push(H, 2);
    push(H, refuerzosV);
    push(W, refuerzosH);
  }

  return {
    anchoM: W,
    altoM: H,
    profundidadM: D,
    refuerzosV,
    refuerzosH,
    mlPerimetro,
    mlRefuerzos,
    mlConectores,
    mlTotal,
    puntosSoldadura,
    cenefaM2,
    cenefaDesarrolloCm,
    pinturaM2: mlTotal * DESARROLLO_PERFIL_M_DEFAULT * (1 + MARGEN_PINTURA),
    fondoM2: W * H * 1.1,
    anclajes: Math.max(2, Math.ceil(W / 0.8)) * 2,
    despieceMm,
  };
}
