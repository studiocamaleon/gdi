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
import { LADOS_EJE_ALTO, largoDelLadoMm, parsearLados } from './lados-pieza';
import type { JobContext, LadoPieza, MutacionAplicada } from './tipos';
import type { EfectoDemasiaMedida } from './efectos-paso';

/**
 * Demasía acumulada por lado de los pasos PRE ya ejecutados.
 *
 * Con `soloQueRefuerzan` se acota a las demasías que dejan banda plana. Lo usa
 * `colocacion_ojales` para mirar SÓLO el refuerzo: al doblarse hacia atrás, un
 * refuerzo deja sobre la pieza terminada una banda plana de su mismo ancho, y
 * el ojal se centra ahí. Un BOLSILLO no sirve para eso — es un tubo para el
 * caño, no una zona reforzada donde perforar.
 */
export function demasiaAcumuladaPorLado(
  jobContext: JobContext,
  opciones?: { soloQueRefuerzan?: boolean },
): Record<LadoPieza, number> {
  const total: Record<LadoPieza, number> = {
    superior: 0,
    inferior: 0,
    izquierdo: 0,
    derecho: 0,
  };
  for (const mutacion of jobContext.mutacionesAplicadas ?? []) {
    // [F1 efectos] Se filtra por la CAPACIDAD declarada (¿deja banda plana
    // perforable?), no por el nombre del preset. Trazas históricas: si no
    // traen `refuerza`, se deriva del viejo subTipo.
    if (opciones?.soloQueRefuerzan) {
      const refuerza =
        typeof mutacion.refuerza === 'boolean'
          ? mutacion.refuerza
          : mutacion.subTipo === 'refuerzo';
      if (!refuerza) continue;
    }
    for (const lado of mutacion.lados) {
      total[lado] += mutacion.demasiaMm;
    }
  }
  return total;
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
  params: { lados: LadoPieza[] },
): number {
  const piezas = jobContext.piezasVisibles ?? jobContext.piezas;
  if (!piezas || piezas.length === 0) return 0;

  return piezas.reduce((acc, pieza) => {
    const anchoMm = Number(pieza.anchoMm ?? 0);
    const altoMm = Number(pieza.altoMm ?? 0);
    const cantidad = Number(pieza.cantidad ?? 0);
    if (anchoMm <= 0 || altoMm <= 0 || cantidad <= 0) return acc;

    const largoTotalMm = params.lados.reduce(
      (sum, lado) => sum + largoDelLadoMm(lado, anchoMm, altoMm),
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
  params: EfectoDemasiaMedida,
  paso: { rutaPasoId: string; nombrePaso: string },
): MutacionAplicada | null {
  if (!jobContext.piezas || jobContext.piezas.length === 0) return null;

  const ladosAlto = params.lados.filter((l) => LADOS_EJE_ALTO.includes(l));
  const deltaAltoMm = ladosAlto.length * params.mm;
  const deltaAnchoMm = (params.lados.length - ladosAlto.length) * params.mm;

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
    refuerza: params.refuerza,
    lados: params.lados,
    demasiaMm: params.mm,
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
