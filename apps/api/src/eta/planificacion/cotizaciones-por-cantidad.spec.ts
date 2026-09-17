import {
  cantidadesParaPlanificar,
  contextoParaCantidad,
  obtenerCotizacionesF6,
} from './cotizaciones-por-cantidad';
import { cotizacionesExhibidor } from '../../../test/fixtures/f6-planificacion/cotizaciones-exhibidor';
import type { CotizarInput, CotizarOutput } from '../../motor-universal/tipos';

it('recalcula piezas y métricas para 100 de 500 tarjetas sin alterar medidas ni el contexto original', () => {
  const contexto = {
    cantidad: 500,
    piezas: [{ cantidad: 500, anchoMm: 90, altoMm: 50 }],
    piezasVisibles: [{ cantidad: 500, anchoMm: 85, altoMm: 45 }],
    piezaAreaTotalM2: 2.25,
    piezaPerimetroTotalM: 140,
    piezaAnchoMaxMm: 90,
    piezaAltoMaxMm: 50,
    modoColor: 'CMYK',
  };
  const antes = structuredClone(contexto);
  const lote = contextoParaCantidad(contexto, 100);
  expect(lote).toMatchObject({
    cantidad: 100,
    piezas: [{ cantidad: 100, anchoMm: 90, altoMm: 50 }],
    piezasVisibles: [{ cantidad: 100, anchoMm: 85, altoMm: 45 }],
    piezaAreaTotalM2: 0.45,
    piezaPerimetroTotalM: 28,
    piezaAnchoMaxMm: 90,
    piezaAltoMaxMm: 50,
    modoColor: 'CMYK',
  });
  expect(contexto).toEqual(antes);
});

it('conserva las piezas por unidad de una colección al calcular otro lote', () => {
  expect(
    contextoParaCantidad(
      {
        cantidad: 500,
        piezas: [
          { cantidad: 1000, cantidadPorUnidad: 2, anchoMm: 90, altoMm: 50 },
          { cantidad: 500, cantidadPorUnidad: 1, anchoMm: 45, altoMm: 50 },
        ],
      },
      100,
    ).piezas?.map((p) => p.cantidad),
  ).toEqual([200, 100]);
});

it('no distribuye silenciosamente diseños que no representan unidades completas', () => {
  expect(() =>
    contextoParaCantidad(
      {
        cantidad: 500,
        piezas: [
          { cantidad: 250, anchoMm: 90, altoMm: 50 },
          { cantidad: 250, anchoMm: 90, altoMm: 50 },
        ],
      },
      100,
    ),
  ).toThrow('unidades completas');
  expect(() => contextoParaCantidad({ cantidad: 0 }, 100)).toThrow('positivas');
});

const entregas = [1, 2, 3, 4].map((i) => ({ id: `e${i}`, cantidad: 50 }));
it('en comercial sólo cotiza el total y las cantidades de cada entrega una vez', () => {
  expect(cantidadesParaPlanificar(200, entregas, true)).toEqual([200, 50]);
  expect(
    cantidadesParaPlanificar(
      200,
      [
        { id: 'a', cantidad: 60 },
        { id: 'b', cantidad: 140 },
      ],
      true,
    ),
  ).toEqual([200, 60, 140]);
});
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
