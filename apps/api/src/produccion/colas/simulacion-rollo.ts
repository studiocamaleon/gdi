import { evaluateRollLayoutForConfiguredAlgorithm } from '../../motor-universal/nesting-dispatcher';
import { evaluateGranFormatoSequentialRollLayout } from '../../productos-servicios/nesting/algorithms/secuencial-rollo';
import type { NestingAlgorithmPolicy } from '../../motor-universal/nesting-config';

import type {
  PiezaSimulacion,
  MargenesSimulacionRollo,
  UbicacionSimulacion,
  AlternativaRollo,
  ResultadoSimulacionRollo,
} from './simulacion-nesting.types';
export type {
  PiezaSimulacion,
  SimulacionNestingCola,
  ResultadoSimulacionRollo,
} from './simulacion-nesting.types';
export type EntradaSimulacionRollo = {
  piezas: PiezaSimulacion[];
  anchos: number[];
  margenes: MargenesSimulacionRollo;
  separacionMm: number;
  separacionVerticalMm?: number;
  anchoMaximoMm?: number;
  algoritmo?: NestingAlgorithmPolicy | 'secuencial-rollo';
};
/** Adaptador de Colas al cálculo compartido de las OT. No genera paneles. */
export function simularRollo(
  entrada: EntradaSimulacionRollo,
): ResultadoSimulacionRollo {
  const { piezas, margenes, separacionMm: gap } = entrada;
  const gapVertical = entrada.separacionVerticalMm ?? gap;
  if (
    !piezas.length ||
    piezas.length > 1000 ||
    new Set(piezas.map((p) => p.id)).size !== piezas.length ||
    piezas.some(
      (p) =>
        !Number.isFinite(p.anchoMm) ||
        !Number.isFinite(p.altoMm) ||
        p.anchoMm <= 0 ||
        p.altoMm <= 0 ||
        p.anchoMm > 1_000_000 ||
        p.altoMm > 1_000_000,
    ) ||
    [...Object.values(margenes), gap, gapVertical].some(
      (n) => !Number.isFinite(n) || n < 0 || n > 100_000,
    ) ||
    !entrada.anchos.length ||
    entrada.anchos.length > 30 ||
    entrada.anchos.some((n) => !Number.isFinite(n) || n <= 0 || n > 100_000)
  )
    throw new Error(
      'La selección debe contener entre 1 y 1000 piezas con medidas válidas y hasta 30 anchos de rollo.',
    );
  const area = piezas.reduce((a, p) => a + p.anchoMm * p.altoMm, 0);
  const alternativas: AlternativaRollo[] = [],
    descartados: ResultadoSimulacionRollo['descartados'] = [];
  for (const anchoMm of [...new Set(entrada.anchos)].sort((a, b) => a - b)) {
    if (entrada.anchoMaximoMm != null && anchoMm > entrada.anchoMaximoMm) {
      descartados.push({
        anchoMm,
        motivo: `Supera el ancho máximo de la máquina (${entrada.anchoMaximoMm} mm).`,
      });
      continue;
    }
    const util = anchoMm - margenes.izquierda - margenes.derecha;
    const noEntra = piezas.find(
      (p) =>
        (p.permiteRotar ? Math.min(p.anchoMm, p.altoMm) : p.anchoMm) > util,
    );
    if (util <= 0 || noEntra) {
      descartados.push({
        anchoMm,
        motivo: noEntra
          ? `${noEntra.etiqueta} no cabe con su orientación y los márgenes previstos.`
          : 'El ancho no alcanza para los márgenes previstos.',
      });
      continue;
    }
    // El mismo selector de motores que usa la OT. Cada panel existente es
    // una pieza física: no se vuelve a subdividir ni se duplican sus solapes.
    const input = {
      printableWidthMm: util,
      marginLeftMm: margenes.izquierda,
      marginStartMm: margenes.inicio,
      marginEndMm: margenes.fin,
      separacionHorizontalMm: gap,
      separacionVerticalMm: gapVertical,
      permitirRotacion: true,
      medidas: piezas.map((p) => ({
        anchoMm: p.anchoMm,
        altoMm: p.altoMm,
        cantidad: 1,
        allowRotation: p.permiteRotar,
      })),
    };
    const resultado =
      entrada.algoritmo === 'secuencial-rollo'
        ? evaluateGranFormatoSequentialRollLayout(input)
        : evaluateRollLayoutForConfiguredAlgorithm(
            input,
            entrada.algoritmo ?? 'auto',
          )?.result;
    if (!resultado || resultado.placements.length !== piezas.length) {
      descartados.push({
        anchoMm,
        motivo: 'No se encontró un acomodo completo para este ancho.',
      });
      continue;
    }
    const porId = new Map(piezas.map((p, i) => [`piece-${i}-0`, p]));
    const mejor: UbicacionSimulacion[] = resultado.placements.map((p) => ({
      piezaId: porId.get(p.id)!.id,
      xMm: p.centerXMm - p.widthMm / 2,
      yMm: p.centerYMm - p.heightMm / 2,
      anchoMm: p.widthMm,
      altoMm: p.heightMm,
      rotada: p.rotated,
    }));
    const largoMejor = resultado.consumedLengthMm;
    alternativas.push({
      anchoMm,
      largoMm: largoMejor,
      superficieM2: (anchoMm * largoMejor) / 1_000_000,
      aprovechamientoPct: (area / (anchoMm * largoMejor)) * 100,
      ubicaciones: mejor,
    });
  }
  alternativas.sort(
    (a, b) =>
      a.superficieM2 - b.superficieM2 ||
      a.largoMm - b.largoMm ||
      a.anchoMm - b.anchoMm,
  );
  return { alternativas, descartados };
}
