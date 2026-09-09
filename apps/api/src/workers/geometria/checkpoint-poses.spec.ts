import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  NestingIrregularOpenNestData,
  NestingIrregularOpenNestResult,
} from '../colas';
import { compactarCheckpoint, restaurarCheckpoint } from './checkpoint-poses';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import { resolverNestingBaseSeguro } from './nesting-base-seguro';
import { optimizarCommonLines } from './common-line';

describe('checkpoints sin repetir contornos', () => {
  it('reconstruye el Puma con huecos y mantiene independientes las coordenadas originales', () => {
    const { entrada, solucionDosPlacas } = JSON.parse(
      readFileSync(join(__dirname, 'fixtures/puma-200cm.json'), 'utf8'),
    ) as {
      entrada: NestingIrregularOpenNestData;
      solucionDosPlacas: NestingIrregularOpenNestResult;
    };
    const fuente = JSON.stringify(entrada);
    const compacto = compactarCheckpoint(solucionDosPlacas);
    expect(Buffer.byteLength(JSON.stringify(compacto))).toBeLessThan(
      Buffer.byteLength(JSON.stringify(solucionDosPlacas)) * 0.25,
    );
    const restaurado = validarResultadoNestingOpenNest(
      entrada,
      restaurarCheckpoint(entrada, JSON.parse(JSON.stringify(compacto))),
    );
    expect(restaurado.placasUsadas).toBe(2);
    expect(restaurado.placements.map((p) => p.huecos.length)).toEqual(
      solucionDosPlacas.placements.map((p) => p.huecos.length),
    );
    restaurado.placements[0].contorno[0].x += 100;
    expect(JSON.stringify(entrada)).toBe(fuente);
    expect(restaurarCheckpoint(entrada, solucionDosPlacas)).toEqual(
      solucionDosPlacas,
    );
    compacto.poses.pop();
    expect(() => restaurarCheckpoint(entrada, compacto)).toThrow(
      'demanda completa',
    );
  });

  it('conserva poses y referencias de corte compartido', () => {
    const a: NestingIrregularOpenNestData = {
      schemaVersion: 1,
      tenantId: 'test',
      correlationId: 'test',
      solicitadoEl: '2026-09-09',
      motor: 'collision',
      semilla: 7,
      timeoutMs: 1000,
      placa: { anchoMm: 100, altoMm: 60, margenMm: 0, maxPlacas: 2 },
      separacionMm: 5,
      piezas: [
        {
          id: 'panel',
          cantidad: 4,
          rotaciones: 1,
          contorno: [
            { x: 0, y: 0 },
            { x: 45, y: 0 },
            { x: 45, y: 50 },
            { x: 0, y: 50 },
          ],
        },
      ],
      commonLine: {
        habilitado: true,
        anchoCorteMm: 1,
        longitudMinimaMm: 10,
        toleranciaMm: 0.01,
      },
    };
    const r = validarResultadoNestingOpenNest(
      a,
      optimizarCommonLines(a, resolverNestingBaseSeguro(a)),
    );
    expect(r.commonLine?.tramos.length).toBeGreaterThan(0);
    const otro = validarResultadoNestingOpenNest(
      a,
      restaurarCheckpoint(a, compactarCheckpoint(r)),
    );
    expect(otro.commonLine).toEqual(r.commonLine);
    expect(otro.placements).toEqual(r.placements);
  });
});
