import {
  cantidadesParaPlanificar,
  obtenerCotizacionesF6,
} from './cotizaciones-por-cantidad';
import { cotizacionesExhibidor } from '../../../test/fixtures/f6-planificacion/cotizaciones-exhibidor';
import type { CotizarInput, CotizarOutput } from '../../motor-universal/tipos';

const entregas = [1, 2, 3, 4].map((i) => ({ id: `e${i}`, cantidad: 50 }));
it('solicita sólo 200/50/100/150 una vez, sin cambiar opciones ni cantidad original', async () => {
  const fuentes = cotizacionesExhibidor();
  const input: CotizarInput = {
    tenantId: fuentes[0].tenantId,
    productoId: fuentes[0].cotizacion.productoId,
    rutaAlternativaId: fuentes[0].cotizacion.rutaAlternativaId,
    jobContext: { cantidad: 200 },
  };
  const cotizar = jest.fn(
    (i: CotizarInput): Promise<CotizarOutput> =>
      Promise.resolve({
        exitoso: true,
        errores: [],
        cotizacion: fuentes.find(
          (f) => f.cotizacion.cantidadPedida === i.jobContext.cantidad,
        )!.cotizacion,
      }),
  );
  const r = await obtenerCotizacionesF6({ input, entregas, cotizar });
  expect(cotizar.mock.calls.map(([i]) => i.jobContext.cantidad)).toEqual([
    200, 50, 100, 150,
  ]);
  expect(input.jobContext.cantidad).toBe(200);
  expect(new Set(r.map((f) => f.configuracionId)).size).toBe(1);
  expect(new Set(r.map((f) => f.id)).size).toBe(4);
});
it('rechaza el exceso de presupuesto antes de encolar cálculos', async () => {
  const cotizar = jest.fn();
  await expect(
    obtenerCotizacionesF6({
      input: { tenantId: 't', productoId: 'p', jobContext: { cantidad: 200 } },
      entregas,
      cotizar,
      maxCotizaciones: 3,
    }),
  ).rejects.toThrow('presupuesto');
  expect(cotizar).not.toHaveBeenCalled();
});
it('cancela la secuencia y no encola las cantidades restantes', async () => {
  const fuente = cotizacionesExhibidor()[3],
    controller = new AbortController();
  const cotizar = jest.fn(() => {
    controller.abort();
    return Promise.resolve({
      exitoso: true,
      errores: [],
      cotizacion: fuente.cotizacion,
    });
  });
  await expect(
    obtenerCotizacionesF6({
      input: {
        tenantId: fuente.tenantId,
        productoId: fuente.cotizacion.productoId,
        jobContext: { cantidad: 200 },
      },
      entregas,
      cotizar,
      signal: controller.signal,
    }),
  ).rejects.toThrow();
  expect(cotizar).toHaveBeenCalledTimes(1);
});
it('no usa una respuesta correspondiente a otro producto', async () => {
  const cotizar = jest.fn(() =>
    Promise.resolve({
      exitoso: true,
      errores: [],
      cotizacion: cotizacionesExhibidor()[3].cotizacion,
    }),
  );
  await expect(
    obtenerCotizacionesF6({
      input: {
        tenantId: 't',
        productoId: 'otro',
        jobContext: { cantidad: 200 },
      },
      entregas,
      cotizar,
    }),
  ).rejects.toThrow('no corresponde');
});
it('entrega única pide sólo la cantidad completa; una suma errónea se rechaza', () => {
  expect(cantidadesParaPlanificar(200, [{ id: 'e', cantidad: 200 }])).toEqual([
    200,
  ]);
  expect(() =>
    cantidadesParaPlanificar(200, [{ id: 'e', cantidad: 100 }]),
  ).toThrow('sumar');
});
