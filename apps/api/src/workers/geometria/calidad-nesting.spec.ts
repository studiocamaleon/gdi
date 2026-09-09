import {
  contarPatronesResultado,
  esMejorResultado,
  minimoTeoricoPatrones,
} from './calidad-nesting';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
  TramoCommonLineTrabajo,
} from '../colas';

function layout(paso = 25): NestingIrregularOpenNestResult {
  return {
    schemaVersion: 1,
    algoritmo: 'opennest-v1',
    motor: 'collision',
    versionMotor: 'test',
    calidadSolucion: 'OPTIMIZADA',
    cantidadSolicitada: 4,
    cantidadColocada: 4,
    placasUsadas: 2,
    duracionMs: 1,
    placements: Array.from({ length: 4 }, (_, copia) => {
      const y = (copia % 2) * paso;
      return {
        piezaId: 'panel',
        copia,
        placa: Math.floor(copia / 2),
        rotacionGrados: 0,
        traslacion: { x: 0, y },
        contorno: [
          { x: 0, y },
          { x: 20, y },
          { x: 20, y: y + 20 },
          { x: 0, y: y + 20 },
        ],
        huecos: [],
      };
    }),
    validacion: {
      completa: true,
      dentroDePlaca: true,
      sinSolapamientos: true,
      separacionRespetada: true,
    },
  };
}

describe('calidad productiva del nesting', () => {
  it('cuenta la distribución real e ignora orden y número de copia', () => {
    const a = layout();
    expect(contarPatronesResultado(a)).toBe(1);
    a.placements.reverse();
    expect(contarPatronesResultado(a)).toBe(1);
    a.placements[0].traslacion.x = 1;
    a.placements[0].contorno.forEach((p) => p.x++);
    expect(contarPatronesResultado(a)).toBe(2);
    a.planPatrones = {
      version: 1,
      patronesElegidos: 1,
      patronesEvaluados: 1,
      minimoPlacasEnCartera: true,
      minimoPatronesEnCartera: true,
      minimoGeometricoDemostrado: false,
    };
    expect(contarPatronesResultado(a)).toBe(2); // No confía en un resumen desactualizado.
  });

  it('prefiere menos patrones aunque el otro layout tenga menor envolvente o más corte compartido', () => {
    const repetido = layout(),
      distinto = layout();
    distinto.placements[3].traslacion.y = 21;
    distinto.placements[3].contorno.forEach((p) => (p.y -= 4));
    distinto.commonLine = {
      habilitado: true,
      aplicado: true,
      anchoCorteMm: 1,
      longitudMinimaMm: 10,
      toleranciaMm: 0.01,
      longitudCompartidaMm: 20,
      ahorroRecorridoMm: 20,
      tramos: [
        {
          id: 'cl-1',
          placa: 1,
          inicio: { x: 0, y: 20.5 },
          fin: { x: 20, y: 20.5 },
          longitudMm: 20,
          segmentosOrigen: [
            { piezaId: 'panel', copia: 2, indiceSegmento: 2 },
            { piezaId: 'panel', copia: 3, indiceSegmento: 0 },
          ],
        },
      ],
    };
    expect(esMejorResultado(repetido, distinto)).toBe(true);
    expect(esMejorResultado(distinto, repetido)).toBe(false);
  });

  it('mantiene material como primer objetivo y no inventa una penalización monetaria', () => {
    const menosPlacas = layout();
    menosPlacas.placasUsadas = 1;
    menosPlacas.placements.forEach((p) => {
      const desplazamiento = p.placa * 50;
      p.placa = 0;
      p.traslacion.y += desplazamiento;
      p.contorno.forEach((v) => (v.y += desplazamiento));
    });
    expect(esMejorResultado(menosPlacas, layout())).toBe(true);
  });

  it('distingue operaciones Common Line y sus referencias por pose, no por copia', () => {
    const r = layout(21);
    const tramo = (placa: number): TramoCommonLineTrabajo => ({
      id: `cl-${placa}`,
      placa,
      inicio: { x: 0, y: 20.5 },
      fin: { x: 20, y: 20.5 },
      longitudMm: 20,
      segmentosOrigen: [
        { piezaId: 'panel', copia: placa * 2, indiceSegmento: 2 },
        { piezaId: 'panel', copia: placa * 2 + 1, indiceSegmento: 0 },
      ],
    });
    r.commonLine = {
      habilitado: true,
      aplicado: true,
      anchoCorteMm: 1,
      longitudMinimaMm: 10,
      toleranciaMm: 0.01,
      longitudCompartidaMm: 40,
      ahorroRecorridoMm: 40,
      tramos: [tramo(0), tramo(1)],
    };
    expect(contarPatronesResultado(r)).toBe(1);
    r.commonLine.tramos.pop();
    r.commonLine.longitudCompartidaMm = 20;
    r.commonLine.ahorroRecorridoMm = 20;
    expect(contarPatronesResultado(r)).toBe(2);
  });

  it('sólo admite la cota de un patrón cuando todas las cantidades son divisibles por las placas', () => {
    const input: NestingIrregularOpenNestData = {
      schemaVersion: 1,
      tenantId: 'test',
      solicitadoEl: new Date().toISOString(),
      correlationId: 'test',
      motor: 'collision',
      semilla: 1,
      timeoutMs: 1000,
      placa: { anchoMm: 100, altoMm: 100, margenMm: 0, maxPlacas: 10 },
      separacionMm: 5,
      piezas: [
        {
          id: 'panel',
          cantidad: 4,
          rotaciones: 1,
          contorno: layout().placements[0].contorno,
        },
      ],
    };
    expect(minimoTeoricoPatrones(input, 2)).toBe(1);
    input.piezas[0].cantidad = 5;
    expect(minimoTeoricoPatrones(input, 2)).toBe(2);
  });
});
