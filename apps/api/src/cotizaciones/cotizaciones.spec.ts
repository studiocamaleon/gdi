import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { PAISES_LATAM } from '../common/paises';
import { SOLO_AUTENTICADO_KEY } from '../auth/permiso.decorator';
import { CotizacionesController } from './cotizaciones.controller';
import { CotizacionesService } from './cotizaciones.service';
import { DOLAR_REFRESH_MS } from './cotizaciones.types';
import {
  DOLAR_COBERTURA,
  normalizarDolar,
  tieneCobertura,
  type PaisDolar,
} from './dolar-api';

const fecha = '2026-09-16T18:00:00.000Z';
const oficial = {
  moneda: 'USD',
  casa: 'oficial',
  compra: 1485,
  venta: 1535,
  fechaActualizacion: fecha,
};
// Contratos observados en los ocho endpoints públicos; no usan la red ni la DB.
const fixtures: Record<PaisDolar, unknown> = {
  AR: [{ ...oficial, casa: 'blue', venta: 1560 }, oficial],
  BO: { ...oficial, compra: 10.15, venta: 10.15 },
  BR: {
    moeda: 'USD',
    nome: 'Dólar',
    compra: 5.1439,
    venda: 5.1463,
    dataAtualizacao: fecha,
  },
  CL: {
    moneda: 'USD',
    compra: 953.92,
    venta: 956.97,
    fechaActualizacion: fecha,
  },
  CO: {
    unidad: 'COP',
    nombre: 'TRM',
    valor: 3100.45,
    fechaActualizacion: fecha,
  },
  MX: {
    moneda: 'USD',
    compra: 17.1415,
    venta: 17.145,
    fix: 17.1527,
    fechaActualizacion: fecha,
  },
  UY: { moneda: 'USD', compra: 39.05, venta: 41.45, fechaActualizacion: fecha },
  VE: [
    {
      moneda: 'USD',
      fuente: 'oficial',
      compra: null,
      venta: null,
      promedio: 846.5131,
      fechaActualizacion: '2026-09-16T00:00:00-04:00',
    },
    {
      moneda: 'USD',
      fuente: 'paralelo',
      promedio: 943.331726,
      fechaActualizacion: fecha,
    },
  ],
};

describe('Contratos de DolarAPI', () => {
  it.each(Object.keys(fixtures) as PaisDolar[])(
    'normaliza %s conservando precisión y moneda',
    (pais) => {
      const quotes = normalizarDolar(pais, fixtures[pais]);
      expect(quotes[0].id).toBe(DOLAR_COBERTURA[pais].principal);
      expect(quotes[0][DOLAR_COBERTURA[pais].campo]).toBeGreaterThan(0);
      expect(PAISES_LATAM).toContain(pais);
    },
  );

  it('respeta Oficial venta aunque Blue llegue primero', () => {
    const quotes = normalizarDolar('AR', fixtures.AR);
    expect(quotes[0]).toMatchObject({
      id: 'oficial',
      compra: 1485,
      venta: 1535,
      referencia: null,
    });
    expect(quotes[1].id).toBe('blue');
  });

  it('no etiqueta una tasa FIX, TRM o promedio venezolano como venta', () => {
    expect(normalizarDolar('MX', fixtures.MX)[0]).toMatchObject({
      referencia: 17.1527,
      tipoReferencia: 'FIX',
      venta: 17.145,
    });
    expect(normalizarDolar('CO', fixtures.CO)[0]).toMatchObject({
      referencia: 3100.45,
      tipoReferencia: 'TRM',
      venta: null,
    });
    expect(normalizarDolar('VE', fixtures.VE)[0]).toMatchObject({
      referencia: 846.5131,
      venta: null,
      compra: null,
      fechaActualizacion: '2026-09-16T04:00:00.000Z',
    });
  });

  it('soporta respuestas documentadas como array o como objeto', () => {
    expect(normalizarDolar('BR', [fixtures.BR])).toEqual(
      normalizarDolar('BR', fixtures.BR),
    );
    expect(normalizarDolar('CL', [fixtures.CL])).toEqual(
      normalizarDolar('CL', fixtures.CL),
    );
  });

  it.each([null, 0, -1, NaN, Infinity, '1535'])(
    'rechaza venta inválida %s',
    (venta) => {
      expect(() => normalizarDolar('AR', [{ ...oficial, venta }])).toThrow();
    },
  );

  it.each([
    null,
    {},
    [],
    { ...oficial, moneda: 'EUR' },
    { ...oficial, fechaActualizacion: 'ayer' },
    { ...oficial, casa: 'blue' },
  ])(
    'no inventa una cotización principal con un payload inválido',
    (payload) => {
      expect(() => normalizarDolar('AR', payload)).toThrow();
    },
  );

  it('descarta secundarias inválidas sin perder la oficial', () => {
    expect(
      normalizarDolar('AR', [oficial, { ...oficial, casa: 'blue', venta: 0 }]),
    ).toHaveLength(1);
  });

  it('los países fuera de cobertura no heredan el dólar argentino', () => {
    expect(PAISES_LATAM.filter(tieneCobertura)).toHaveLength(8);
    expect(tieneCobertura('PE')).toBe(false);
    expect(tieneCobertura('toString')).toBe(false);
  });
});

describe('CotizacionesService', () => {
  let service: CotizacionesService;
  let findUnique: jest.Mock;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-17T00:00:00Z') });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    findUnique = jest.fn().mockResolvedValue({ paisCodigo: 'AR' });
    service = new CotizacionesService({
      datosEmpresa: { findUnique },
    } as unknown as PrismaService);
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(fixtures.AR)));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('usa el tenant autenticado y comparte sólo datos públicos por país', async () => {
    const first = await service.dolar('tenant-1');
    const second = await service.dolar('tenant-2');
    expect(first).toEqual(second);
    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: { tenantId: 'tenant-2' },
      select: { paisCodigo: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      DOLAR_COBERTURA.AR.url,
      expect.objectContaining({ signal: expect.any(AbortSignal) as unknown }),
    );
    expect(first.estado).toBe('disponible');
    expect(first.cotizaciones[0].fechaActualizacion).toBe(fecha);
    expect(
      Reflect.getMetadata(
        SOLO_AUTENTICADO_KEY,
        // Leemos los metadatos sin invocar el método fuera de su instancia.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        CotizacionesController.prototype.dolar,
      ),
    ).toBe(true);
  });

  it('deduplica consultas concurrentes', async () => {
    await Promise.all([
      service.dolar('1'),
      service.dolar('2'),
      service.dolar('3'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refresca al vencer los cinco minutos', async () => {
    await service.dolar('1');
    jest.advanceTimersByTime(DOLAR_REFRESH_MS);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ ...oficial, venta: 1600 }])),
    );
    const result = await service.dolar('1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.cotizaciones[0].venta).toBe(1600);
  });

  it('conserva la última cotización ante fallos, indica antigüedad y limita reintentos', async () => {
    const first = await service.dolar('1');
    jest.advanceTimersByTime(DOLAR_REFRESH_MS);
    fetchMock.mockRejectedValue(new Error('network'));
    const result = await service.dolar('1');
    expect(result.estado).toBe('sin_actualizar');
    expect(result.cotizaciones).toEqual(first.cotizaciones);
    expect(result.consultadoEn).toBe(first.consultadoEn);
    await service.dolar('2');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(60_000);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(fixtures.AR)));
    expect((await service.dolar('1')).estado).toBe('disponible');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(['http', 'json', 'schema', 'timeout'])(
    'sin un dato previo devuelve no disponible ante %s, nunca cero',
    async (fallo) => {
      if (fallo === 'timeout')
        fetchMock.mockRejectedValue(
          new DOMException('timeout', 'TimeoutError'),
        );
      else
        fetchMock.mockResolvedValue(
          new Response(fallo === 'schema' ? '{}' : 'error', {
            status: fallo === 'http' ? 503 : 200,
          }),
        );
      const result = await service.dolar('1');
      expect(result).toMatchObject({
        estado: 'no_disponible',
        cotizaciones: [],
        consultadoEn: null,
      });
      await service.dolar('1');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('marca fechas antiguas aunque la consulta haya sido exitosa', async () => {
    jest.setSystemTime(new Date('2026-09-22T00:00:00Z'));
    expect((await service.dolar('1')).estado).toBe('sin_actualizar');
  });

  it('no consulta la red para países sin cobertura', async () => {
    findUnique.mockResolvedValue({ paisCodigo: 'PE' });
    expect(await service.dolar('1')).toMatchObject({
      paisCodigo: 'PE',
      estado: 'sin_cobertura',
      cotizaciones: [],
      principalId: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('separa países y usa su moneda local independientemente de la moneda de la empresa', async () => {
    await service.dolar('1');
    findUnique.mockResolvedValue({ paisCodigo: 'VE' });
    fetchMock.mockResolvedValue(new Response(JSON.stringify(fixtures.VE)));
    expect(await service.dolar('2')).toMatchObject({
      paisCodigo: 'VE',
      monedaLocal: 'VES',
      campoPrincipal: 'referencia',
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      DOLAR_COBERTURA.VE.url,
      expect.any(Object),
    );
  });

  it('conserva el país predeterminado de Grafo si aún no se cargaron los datos de empresa', async () => {
    findUnique.mockResolvedValue(null);
    expect((await service.dolar('1')).paisCodigo).toBe('AR');
  });
});
