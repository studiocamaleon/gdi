import { geometriaDeColeccion } from './geometria-coleccion';
import type { JobContext } from '../tipos';

it('conserva un SVG histórico al incorporar otro diseño, sin exigir operaciones guardadas', () => {
  const fuente = {
    schemaVersion: 1 as const,
    nombreArchivo: 'anterior.svg',
    anchoFinalMm: 100,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><path d="M0 0H100V60H0Z"/></svg>',
  };
  const ctx: JobContext = {
    cantidad: 5,
    disenosVectoriales: [
      { id: 'frente', nombre: 'Frente', cantidadPorUnidad: 1, fuente },
      {
        id: 'soporte',
        nombre: 'Soporte',
        cantidadPorUnidad: 2,
        fuente: { ...fuente, nombreArchivo: 'soporte.svg', anchoFinalMm: 50 },
      },
    ],
  };
  const g = geometriaDeColeccion(ctx);
  expect(g.piezas.map((p) => p.cantidadPorUnidad)).toEqual([1, 2]);
  expect(new Set(g.piezas.map((p) => p.id)).size).toBe(2);
  expect(g.areaTotalMm2).toBeCloseTo(9000);
  expect(g.perimetroTotalMm).toBeCloseTo(640);
  expect(ctx.piezaHendidoTotalM).toBe(0);
  expect(ctx.disenosVectoriales![0].fuente).toBe(fuente);
});
