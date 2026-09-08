import {
  generarCarteraPatrones,
  materializarPatrones,
} from './cartera-patrones';
import { validarResultadoNestingOpenNest } from './validar-nesting-opennest';
import type { NestingIrregularOpenNestData } from '../colas';

const input: NestingIrregularOpenNestData = {
  schemaVersion: 1,
  tenantId: 'prueba',
  correlationId: 'prueba',
  solicitadoEl: new Date().toISOString(),
  motor: 'nfp',
  timeoutMs: 1000,
  semilla: 1,
  placa: { anchoMm: 100, altoMm: 100, margenMm: 2, maxPlacas: 10 },
  separacionMm: 1,
  piezas: [
    {
      id: 'panel',
      cantidad: 2,
      rotaciones: 1,
      contorno: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 60, y: 20 },
        { x: 0, y: 20 },
      ],
    },
    {
      id: 'base',
      cantidad: 3,
      rotaciones: 1,
      contorno: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    },
  ],
};
describe('cartera general de patrones', () => {
  it('encuentra un patrón mixto con demanda distinta al benchmark y conserva la restricción de giro', async () => {
    const cartera = await generarCarteraPatrones(input, { plazo: Date.now() });
    const index = cartera.findIndex(
      (p) => p.counts[0] === 2 && p.counts[1] === 3,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const plan = {
      seleccion: [{ patron: index, repeticiones: 1 }],
      optimoPlacasDentroCartera: false,
      optimoPatronesDentroCartera: false,
    };
    const result = materializarPatrones(input, cartera, plan);
    expect(
      validarResultadoNestingOpenNest(input, result).validacion
        .sinSolapamientos,
    ).toBe(true);
    expect(result.cantidadColocada).toBe(5);
    expect(result.placements.every((p) => p.rotacionGrados === 0)).toBe(true);
    expect(
      new Set(result.placements.map((p) => p.piezaId + ':' + p.copia)).size,
    ).toBe(5);
    expect(() =>
      materializarPatrones(input, cartera, {
        ...plan,
        seleccion: [{ patron: index, repeticiones: 2 }],
      }),
    ).toThrow();
  });
  it('respeta la cancelación antes de generar candidatos', async () => {
    const c = new AbortController();
    c.abort();
    await expect(
      generarCarteraPatrones(input, {
        plazo: Date.now() + 1000,
        signal: c.signal,
      }),
    ).rejects.toThrow();
  });
});
