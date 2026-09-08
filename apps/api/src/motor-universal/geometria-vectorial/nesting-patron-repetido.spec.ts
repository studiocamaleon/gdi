import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizarFuenteVectorial } from './fuente-vectorial';
import { analizarSvgFabricacion } from './svg-parser';
import { nestearPatronRepetido } from './nesting-patron-repetido';
import { resolverNestingBaseSeguro } from '../../workers/geometria/nesting-base-seguro';
import { validarResultadoNestingOpenNest } from '../../workers/geometria/validar-nesting-opennest';
import type { NestingIrregularOpenNestData } from '../../workers/colas';
import { nestGrid2DMulti } from '../../productos-servicios/nesting/algorithms/grid-2d-multi';
import { runNestingForPaso } from '../nesting-dispatcher';
import type { JobContext, PasoCargado } from '../tipos';

const fuente = normalizarFuenteVectorial({
  contenido: readFileSync(
    join(__dirname, 'fixtures/exhibidor-capa-congelada.dxf'),
    'utf8',
  ),
  nombreArchivo: 'exhibidor.dxf',
});
const pieza = analizarSvgFabricacion({
  svg: fuente.svg,
  anchoFinalMm: (fuente.anchoSugeridoMm! * 25.4) / 72,
}).geometria.piezas[0];
const sustrato = {
  kind: 'sheet' as const,
  widthMm: 860,
  heightMm: 564,
  margins: { leftMm: 5, rightMm: 5, topMm: 5, bottomMm: 5 },
};

describe('patrones de siluetas repetidas', () => {
  it.each([0, 2])(
    'valida lados inclinados alternados con separación %i mm',
    (separacionMm) => {
      const triangulo = {
        ...pieza,
        id: 'triangulo',
        anchoMm: 60,
        altoMm: 60,
        areaMm2: 1800,
        contornos: [
          {
            esHueco: false,
            puntos: [
              { x: 0, y: 0 },
              { x: 60, y: 0 },
              { x: 0, y: 60 },
            ],
          },
        ],
      };
      const input: NestingIrregularOpenNestData = {
        schemaVersion: 1,
        tenantId: 'test',
        correlationId: 'diagonales',
        solicitadoEl: '',
        motor: 'collision',
        timeoutMs: 1000,
        semilla: 1,
        placa: { anchoMm: 140, altoMm: 140, margenMm: 5, maxPlacas: 10 },
        separacionMm,
        piezas: [
          {
            id: triangulo.id,
            cantidad: 12,
            rotaciones: 2,
            contorno: triangulo.contornos[0].puntos,
          },
        ],
      };
      const result = nestearPatronRepetido({
        pieza: triangulo,
        cantidad: 12,
        sustrato: { ...sustrato, widthMm: 140, heightMm: 140 },
        angulosPermitidos: [0, 180],
        separacionMm,
      })!;
      expect(
        new Set(result.placements.map((p) => p.meta!.rotacionGrados)).size,
      ).toBe(2);
      expect(() =>
        validarResultadoNestingOpenNest(input, {
          schemaVersion: 1,
          algoritmo: 'grafonest-baseline-v1',
          motor: 'collision',
          versionMotor: 'test',
          cantidadSolicitada: 12,
          cantidadColocada: 12,
          placasUsadas: result.substrates.length,
          duracionMs: 1,
          placements: result.placements.map((p) => ({
            piezaId: p.pieceId,
            copia: p.meta!.copyIndex,
            placa: p.substrateIndex!,
            rotacionGrados: p.meta!.rotacionGrados,
            traslacion: p.meta!.traslacion,
            contorno: p.meta!.contornos[0].puntos,
            huecos: [],
          })),
        }),
      ).not.toThrow();
    },
  );

  it('usa el patrón en impresión y mantiene exactamente el giro de cada contorno en el láser', async () => {
    const geometriaVectorial = analizarSvgFabricacion({
      svg: fuente.svg,
      anchoFinalMm: (fuente.anchoSugeridoMm! * 25.4) / 72,
    }).geometria;
    const job: JobContext = {
      cantidad: 25,
      geometriaVectorial,
      piezas: [
        {
          sourcePieceId: pieza.id,
          cantidad: 25,
          anchoMm: pieza.anchoMm,
          altoMm: pieza.altoMm,
        },
      ],
    };
    const paso = {
      rutaPasoId: 'impresion',
      configPasoId: 'cp-impresion',
      familiaCodigo: 'impresion_por_area',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      paramsPasoJson: {
        nestingConfig: {
          algorithm: 'grid-2d-multi',
          allowRotation: true,
          separationHMm: 0,
          separationVMm: 0,
        },
      },
      maquina: {
        plantilla: 'IMPRESORA_GRAN_FORMATO_POR_AREA',
        parametrosTecnicosJson: {
          geometria: 'MESA_EXTENSORA',
          anchoMesaMm: 1000,
          largoMesaMm: 1300,
          margenesNoImprimiblesMm: { izq: 5, der: 5, sup: 5, inf: 5 },
        },
      },
      slots: [],
    } as unknown as PasoCargado;
    const material = {
      id: 'corrugado',
      atributosVarianteJson: { anchoMm: 860, altoMm: 564 },
    };
    const impreso = (await runNestingForPaso(paso, job, material))!;
    expect(impreso.algorithm).toBe('irregular-2d-bottom-left-v1');
    expect(impreso.cantidadCalculada).toBe(1);
    const corte = (await runNestingForPaso(
      {
        ...paso,
        familiaCodigo: 'corte_laser',
        paramsPasoJson: null,
        maquina: null,
      },
      {
        ...job,
        layout_produccion: {
          schemaVersion: 1,
          sourceRutaPasoId: 'impresion',
          sourceConfigPasoId: 'cp-impresion',
          sourceFamiliaCodigo: 'impresion_por_area',
          materialVarianteId: 'corrugado',
          algorithm: impreso.algorithm,
          substrates: impreso.substrates,
          placements: impreso.placements,
          visualConfig: impreso.visualConfig,
        },
      },
      material,
    ))!;
    expect(corte.cantidadCalculada).toBe(1);
    let diferenciaMaximaMm = 0;
    corte.placements.forEach((p, i) => {
      const original = impreso.placements[i];
      const meta = p.meta as {
        rotacionGrados: number;
        contornos: typeof pieza.contornos;
      };
      const metaOriginal = original.meta as typeof meta;
      expect(meta.rotacionGrados).toBe(metaOriginal.rotacionGrados);
      expect(p.xMm).toBeCloseTo(original.xMm, 3);
      expect(p.yMm).toBeCloseTo(original.yMm, 3);
      meta.contornos.forEach((c, j) =>
        c.puntos.forEach((punto, k) => {
          diferenciaMaximaMm = Math.max(
            diferenciaMaximaMm,
            Math.abs(punto.x - metaOriginal.contornos[j].puntos[k].x),
            Math.abs(punto.y - metaOriginal.contornos[j].puntos[k].y),
          );
        }),
      );
    });
    expect(diferenciaMaximaMm).toBeLessThan(0.001);
  });

  it.each([25, 200])(
    'acomoda %i exhibidores con 25 por placa conservando sus medidas',
    (cantidad) => {
      const result = nestearPatronRepetido({
        pieza,
        cantidad,
        sustrato,
        angulosPermitidos: [0, 90, 180, 270],
      })!;
      expect(result.placements).toHaveLength(cantidad);
      expect(result.substrates).toHaveLength(cantidad / 25);
      expect(result.metrics.piezasPorSustrato).toBe(25);
      expect(
        new Set(result.placements.map((p) => p.meta!.rotacionGrados)).size,
      ).toBe(2);
      for (const p of result.placements) {
        expect(p.xMm).toBeGreaterThanOrEqual(5);
        expect(p.yMm).toBeGreaterThanOrEqual(5);
        expect(p.xMm + p.widthMm).toBeLessThanOrEqual(855.000001);
        expect(p.yMm + p.heightMm).toBeLessThanOrEqual(559.000001);
        expect([p.widthMm, p.heightMm].sort()).toEqual(
          [pieza.anchoMm, pieza.altoMm].sort(),
        );
      }
      const grid = nestGrid2DMulti(
        [
          {
            id: pieza.id,
            quantity: cantidad,
            widthMm: pieza.anchoMm,
            heightMm: pieza.altoMm,
          },
        ],
        sustrato,
        { allowRotation: true },
      );
      expect(grid.substrates.length).toBeGreaterThan(result.substrates.length);
    },
  );

  it('ofrece el patrón al worker aun si el límite no permite las placas del grid y valida los contornos originales', () => {
    const input: NestingIrregularOpenNestData = {
      schemaVersion: 1,
      tenantId: 'prueba',
      correlationId: 'exhibidor-25',
      solicitadoEl: new Date(0).toISOString(),
      motor: 'collision',
      timeoutMs: 1000,
      semilla: 30,
      placa: { anchoMm: 860, altoMm: 564, margenMm: 5, maxPlacas: 1 },
      separacionMm: 0,
      piezas: [
        {
          id: pieza.id,
          cantidad: 25,
          rotaciones: 4,
          contorno: pieza.contornos[0].puntos,
        },
      ],
    };
    const result = resolverNestingBaseSeguro(input);
    expect(result.placasUsadas).toBe(1);
    expect(() => validarResultadoNestingOpenNest(input, result)).not.toThrow();
  }, 60000);

  it('respeta la prohibición de rotar, los márgenes y la separación positiva', () => {
    const bloque = {
      ...pieza,
      id: 'bloque',
      anchoMm: 20,
      altoMm: 30,
      areaMm2: 600,
      contornos: [
        {
          esHueco: false,
          puntos: [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 20, y: 30 },
            { x: 0, y: 30 },
          ],
        },
      ],
    };
    const result = nestearPatronRepetido({
      pieza: bloque,
      cantidad: 12,
      sustrato: { ...sustrato, widthMm: 100, heightMm: 110 },
      angulosPermitidos: [0],
      separacionMm: 3,
    })!;
    const input: NestingIrregularOpenNestData = {
      schemaVersion: 1,
      tenantId: 'test',
      correlationId: 'gap',
      solicitadoEl: '',
      motor: 'collision',
      timeoutMs: 1000,
      semilla: 1,
      placa: { anchoMm: 100, altoMm: 110, margenMm: 5, maxPlacas: 10 },
      separacionMm: 3,
      piezas: [
        {
          id: 'bloque',
          cantidad: 12,
          rotaciones: 1,
          contorno: bloque.contornos[0].puntos,
        },
      ],
    };
    expect(result.placements.every((p) => p.meta!.rotacionGrados === 0)).toBe(
      true,
    );
    expect(() =>
      validarResultadoNestingOpenNest(input, {
        schemaVersion: 1,
        algoritmo: 'grafonest-baseline-v1',
        motor: 'collision',
        versionMotor: 'test',
        cantidadSolicitada: 12,
        cantidadColocada: 12,
        placasUsadas: result.substrates.length,
        duracionMs: 1,
        placements: result.placements.map((p) => ({
          piezaId: p.pieceId,
          copia: p.meta!.copyIndex,
          placa: p.substrateIndex!,
          rotacionGrados: 0,
          traslacion: p.meta!.traslacion,
          contorno: p.meta!.contornos[0].puntos,
          huecos: [],
        })),
      }),
    ).not.toThrow();
  });
});
