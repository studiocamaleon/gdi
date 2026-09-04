import { createHash } from 'node:crypto';
import type { ConfiguracionEncastresVectoriales } from './segmentacion-encastres';
import type {
  ContornoVectorial,
  GeometriaVectorialCanonica,
  NestingIrregularResult,
  PiezaVectorial,
} from './tipos';
import { nestearGeometriaIrregular } from './nesting-irregular';

export interface PropietarioDemandaNesting {
  productoId?: string;
  componenteCodigo?: string;
  ocurrenciaId?: string;
  pasoClave?: string;
  archivoFuente?: string;
}

export type GeometriaDemandaNesting =
  | {
      tipo: 'RECTANGULO';
      anchoMm: number;
      altoMm: number;
    }
  | {
      tipo: 'POLIGONO';
      anchoMm: number;
      altoMm: number;
      areaMm2: number;
      perimetroMm: number;
      origenXmm?: number;
      origenYmm?: number;
      contornos: ContornoVectorial[];
      cortesInternos?: ContornoVectorial[];
      segmentacion?: PiezaVectorial['segmentacion'];
    };

/**
 * Demanda geométrica neutral. No conoce productos ni familias productivas:
 * sólo conserva identidad, propietario y la cantidad física solicitada.
 */
export interface DemandaNesting {
  schemaVersion: 1;
  id: string;
  cantidad: number;
  geometria: GeometriaDemandaNesting;
  propietario?: PropietarioDemandaNesting;
}

export interface ProblemaNesting {
  schemaVersion: 1;
  superficie:
    | {
        tipo: 'PLACA';
        anchoMm: number;
        altoMm: number;
      }
    | {
        tipo: 'ROLLO';
        anchoMm: number;
      };
  demandas: DemandaNesting[];
  configuracion: {
    margenMm: number;
    separacionMm: number;
    permitirRotacion: boolean;
    permitirSegmentacion: boolean;
    preservarComposicionOriginalSiEntra: boolean;
    configuracionEncastres?: ConfiguracionEncastresVectoriales;
  };
}

export interface SolucionNesting {
  schemaVersion: 1;
  algoritmo: 'irregular-2d-bottom-left';
  versionAlgoritmo: 1;
  problemaHash: string;
  problema: ProblemaNesting;
  resultado: NestingIrregularResult;
  diagnosticos: Array<{
    codigo: string;
    severidad: 'WARNING' | 'ERROR';
    mensaje: string;
  }>;
}

function numeroPositivo(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser mayor que cero.`);
  }
  return value;
}

function rectanguloComoContorno(anchoMm: number, altoMm: number) {
  return [
    {
      esHueco: false,
      puntos: [
        { x: 0, y: 0 },
        { x: anchoMm, y: 0 },
        { x: anchoMm, y: altoMm },
        { x: 0, y: altoMm },
      ],
    },
  ] satisfies ContornoVectorial[];
}

export function piezaDesdeDemanda(demanda: DemandaNesting): PiezaVectorial {
  const geometria = demanda.geometria;
  if (geometria.tipo === 'RECTANGULO') {
    const anchoMm = numeroPositivo(geometria.anchoMm, 'El ancho de la pieza');
    const altoMm = numeroPositivo(geometria.altoMm, 'El alto de la pieza');
    return {
      id: demanda.id,
      anchoMm,
      altoMm,
      areaMm2: anchoMm * altoMm,
      perimetroMm: 2 * (anchoMm + altoMm),
      contornos: rectanguloComoContorno(anchoMm, altoMm),
    };
  }
  numeroPositivo(geometria.anchoMm, 'El ancho de la pieza');
  numeroPositivo(geometria.altoMm, 'El alto de la pieza');
  numeroPositivo(geometria.areaMm2, 'El área de la pieza');
  numeroPositivo(geometria.perimetroMm, 'El perímetro de la pieza');
  if (geometria.contornos.length === 0) {
    throw new Error(`La demanda "${demanda.id}" no contiene contornos.`);
  }
  return {
    id: demanda.id,
    anchoMm: geometria.anchoMm,
    altoMm: geometria.altoMm,
    areaMm2: geometria.areaMm2,
    perimetroMm: geometria.perimetroMm,
    origenXmm: geometria.origenXmm,
    origenYmm: geometria.origenYmm,
    contornos: geometria.contornos,
    cortesInternos: geometria.cortesInternos,
    segmentacion: geometria.segmentacion,
  };
}

export function crearDemandasDesdeGeometriaVectorial(input: {
  geometria: GeometriaVectorialCanonica;
  cantidad: number;
  propietario?: PropietarioDemandaNesting;
}): DemandaNesting[] {
  const cantidad = Math.ceil(numeroPositivo(input.cantidad, 'La cantidad'));
  return input.geometria.piezas.map((pieza) => ({
    schemaVersion: 1,
    id: pieza.id,
    cantidad,
    propietario: input.propietario,
    geometria: {
      tipo: 'POLIGONO',
      anchoMm: pieza.anchoMm,
      altoMm: pieza.altoMm,
      areaMm2: pieza.areaMm2,
      perimetroMm: pieza.perimetroMm,
      origenXmm: pieza.origenXmm,
      origenYmm: pieza.origenYmm,
      contornos: pieza.contornos,
      cortesInternos: pieza.cortesInternos,
      segmentacion: pieza.segmentacion,
    },
  }));
}

export function crearProblemaNestingIrregular(input: {
  demandas: DemandaNesting[];
  anchoPlacaMm: number;
  altoPlacaMm: number;
  margenMm?: number;
  separacionMm?: number;
  permitirRotacion?: boolean;
  permitirSegmentacion?: boolean;
  preservarComposicionOriginalSiEntra?: boolean;
  configuracionEncastres?: ConfiguracionEncastresVectoriales;
}): ProblemaNesting {
  return {
    schemaVersion: 1,
    superficie: {
      tipo: 'PLACA',
      anchoMm: input.anchoPlacaMm,
      altoMm: input.altoPlacaMm,
    },
    demandas: input.demandas,
    configuracion: {
      margenMm: input.margenMm ?? 0,
      separacionMm: input.separacionMm ?? 0,
      permitirRotacion: input.permitirRotacion !== false,
      permitirSegmentacion: input.permitirSegmentacion !== false,
      preservarComposicionOriginalSiEntra:
        input.preservarComposicionOriginalSiEntra === true,
      configuracionEncastres: input.configuracionEncastres,
    },
  };
}

export function crearSolucionNestingIrregular(
  problema: ProblemaNesting,
  resultado: NestingIrregularResult,
): SolucionNesting {
  return {
    schemaVersion: 1,
    algoritmo: 'irregular-2d-bottom-left',
    versionAlgoritmo: 1,
    problemaHash: createHash('sha256')
      .update(JSON.stringify(problema))
      .digest('hex'),
    problema,
    resultado,
    diagnosticos: [],
  };
}

/**
 * Adaptador público del motor irregular. Acepta rectángulos y polígonos con
 * cantidades heterogéneas y devuelve una solución reproducible/versionada.
 */
export function resolverProblemaNestingIrregular(
  problema: ProblemaNesting,
): SolucionNesting {
  if (problema.superficie.tipo !== 'PLACA') {
    throw new Error('El motor irregular actual requiere una placa finita.');
  }
  if (problema.demandas.length === 0) {
    throw new Error('El problema de nesting no contiene demandas.');
  }
  const ids = new Set<string>();
  const cantidadesPorPieza: Record<string, number> = {};
  const piezas = problema.demandas.map((demanda) => {
    if (!demanda.id.trim() || ids.has(demanda.id)) {
      throw new Error(
        `La demanda de nesting "${demanda.id}" está duplicada o no tiene identidad.`,
      );
    }
    ids.add(demanda.id);
    cantidadesPorPieza[demanda.id] = Math.ceil(
      numeroPositivo(demanda.cantidad, `La cantidad de "${demanda.id}"`),
    );
    return piezaDesdeDemanda(demanda);
  });
  const geometria: GeometriaVectorialCanonica = {
    schemaVersion: 1,
    anchoMm: Math.max(
      ...piezas.map((pieza) => (pieza.origenXmm ?? 0) + pieza.anchoMm),
    ),
    altoMm: Math.max(
      ...piezas.map((pieza) => (pieza.origenYmm ?? 0) + pieza.altoMm),
    ),
    piezas,
    areaTotalMm2: piezas.reduce((total, pieza) => total + pieza.areaMm2, 0),
    perimetroTotalMm: piezas.reduce(
      (total, pieza) => total + pieza.perimetroMm,
      0,
    ),
    hashFuente: createHash('sha256')
      .update(JSON.stringify(problema.demandas))
      .digest('hex'),
  };
  const resultado = nestearGeometriaIrregular({
    geometria,
    cantidad: 1,
    cantidadesPorPieza,
    anchoPlacaMm: problema.superficie.anchoMm,
    altoPlacaMm: problema.superficie.altoMm,
    margenMm: problema.configuracion.margenMm,
    separacionMm: problema.configuracion.separacionMm,
    permitirRotacion: problema.configuracion.permitirRotacion,
    permitirSegmentacion: problema.configuracion.permitirSegmentacion,
    preservarComposicionOriginalSiEntra:
      problema.configuracion.preservarComposicionOriginalSiEntra,
    configuracionEncastres: problema.configuracion.configuracionEncastres,
  });
  return crearSolucionNestingIrregular(problema, resultado);
}
