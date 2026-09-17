import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoCambioService, factorCambioMaterial } from './tipo-cambio.service';
import {
  monedaCotizacionContext,
  precioMaterialEnMonedaCotizacion,
} from './material-moneda-context';
import { validarMonedaDocumento } from './validar-moneda-documento';
import type {
  CostoMaterialMoneda,
  TipoCambioSnapshot,
} from './tipo-cambio.types';
import type { DolarResponse } from './cotizaciones.types';
import { MotorUniversalService } from '../motor-universal/motor.service';

const cambio: TipoCambioSnapshot = {
  version: 1,
  id: 'fx-1',
  monedaOrigen: 'USD',
  monedaDestino: 'ARS',
  paisCodigo: 'AR',
  modo: 'manual',
  origen: 'documento',
  tasa: 1500,
  referencia: 'Manual',
  fuente: 'Manual',
  fechaFuente: null,
  capturadoEn: '2026-09-17T00:00:00.000Z',
  usuarioId: 'user-1',
  observacion: null,
};
const record = {
  id: 'var-1',
  sku: 'TEST',
  moneda: 'USD',
  precioReferencia: 100,
  unidadPrecio: 'CAJA',
  unidadCompra: 'CAJA',
  unidadStock: 'UNIDAD',
  equivalenciaCompra: 50,
  materiaPrima: {
    unidadCompra: 'CAJA',
    unidadStock: 'UNIDAD',
    templateId: 'ojal_v1',
  },
};

function setup(destino = 'ARS', config: unknown = null) {
  const datos = {
    monedaCodigo: destino,
    paisCodigo: 'AR',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    redondeoPrecio: 'moneda',
    tipoCambioConfig: config,
  };
  const prisma = {
    datosEmpresa: {
      findUnique: jest.fn().mockResolvedValue(datos),
      upsert: jest.fn(),
    },
    tipoCambioCotizacion: { create: jest.fn(), findFirst: jest.fn() },
  };
  const proveedor = {
    dolar: jest.fn<Promise<DolarResponse>, []>().mockResolvedValue({
      estado: 'disponible',
      monedaLocal: 'ARS',
      campoPrincipal: 'venta',
      principalId: 'oficial',
      paisCodigo: 'AR',
      consultadoEn: null,
      proximaConsultaEn: null,
      cotizaciones: [
        {
          id: 'oficial',
          nombre: 'Oficial',
          referencia: null,
          tipoReferencia: null,
          venta: 1535,
          compra: 1485,
          fechaActualizacion: new Date().toISOString(),
        },
      ],
    }),
  };
  return {
    datos,
    prisma,
    proveedor,
    service: new TipoCambioService(prisma as never, proveedor as never),
  };
}

describe('Tipo de cambio de inventario', () => {
  it('normaliza caja a unidades antes de convertir, conservando el costo original', () => {
    const materiales = new Map<string, CostoMaterialMoneda>();
    const precio = monedaCotizacionContext.run(
      { tenantId: 'tenant', cambio, materiales },
      () => precioMaterialEnMonedaCotizacion(record),
    );
    expect(precio).toBe(3000);
    expect(materiales.get('var-1')).toMatchObject({
      precioOriginal: 100,
      precioPorUnidadUsoOrigen: 2,
      costoUnitarioDestino: 3000,
      monedaOrigen: 'USD',
      factorCambio: 1500,
    });
  });
  it('no convierte de nuevo los costos cargados en moneda local', () => {
    expect(
      monedaCotizacionContext.run(
        { tenantId: 'tenant', cambio, materiales: new Map() },
        () => precioMaterialEnMonedaCotizacion({ ...record, moneda: 'ARS' }),
      ),
    ).toBe(2);
  });
  it('convierte el precio de una placa en USD/m² a su unidad de uso', () => {
    const placa = {
      ...record,
      precioReferencia: 10,
      unidadPrecio: 'M2',
      unidadCompra: 'M2',
      unidadStock: 'HOJA',
      equivalenciaCompra: null,
      atributosVarianteJson: { anchoMm: 1220, altoMm: 2440 },
      materiaPrima: {
        unidadCompra: 'M2',
        unidadStock: 'HOJA',
        templateId: 'sustrato_rigido_v1',
      },
    };
    const resultado = monedaCotizacionContext.run(
      { tenantId: 'tenant', cambio, materiales: new Map() },
      () => precioMaterialEnMonedaCotizacion(placa),
    );
    expect(resultado).toBeCloseTo(10 * 1.22 * 2.44 * 1500, 6);
  });
  it('falla sin tasa sólo si necesita convertir, nunca usa paridad implícita', () => {
    expect(() =>
      factorCambioMaterial('USD', { ...cambio, tasa: null }),
    ).toThrow(BadRequestException);
    expect(factorCambioMaterial('ARS', { ...cambio, tasa: null })).toBe(1);
    expect(
      factorCambioMaterial('USD', {
        ...cambio,
        monedaDestino: 'USD',
        tasa: null,
      }),
    ).toBe(1);
    expect(() => factorCambioMaterial('EUR', cambio)).toThrow(
      BadRequestException,
    );
  });
  it('aísla cotizaciones concurrentes con tasas distintas', async () => {
    const resultados = await Promise.all(
      [1000, 2000].map((tasa) =>
        monedaCotizacionContext.run(
          {
            tenantId: 'tenant',
            cambio: { ...cambio, tasa },
            materiales: new Map(),
          },
          async () => {
            await Promise.resolve();
            return precioMaterialEnMonedaCotizacion(record);
          },
        ),
      ),
    );
    expect(resultados).toEqual([2000, 4000]);
  });
  it('usa Oficial venta y firma la fuente, fecha y autor en el servidor', async () => {
    const { service, prisma } = setup();
    const snapshot = await service.crear('tenant', 'actor');
    expect(snapshot).toMatchObject({
      tasa: 1535,
      referencia: 'Oficial · venta',
      fuente: 'DolarAPI',
      usuarioId: 'actor',
      monedaDestino: 'ARS',
    });
    expect(prisma.tipoCambioCotizacion.create).toHaveBeenCalledWith({
      data: { id: snapshot.id, tenantId: 'tenant', snapshotJson: snapshot },
    });
  });
  it('un cambio manual puntual no modifica la configuración de la empresa', async () => {
    const { service, prisma, proveedor } = setup();
    expect(
      await service.crear('tenant', 'actor', {
        modo: 'manual',
        tasa: 1499.12345678,
      }),
    ).toMatchObject({
      tasa: 1499.12345678,
      modo: 'manual',
      origen: 'documento',
    });
    expect(prisma.datosEmpresa.upsert).not.toHaveBeenCalled();
    expect(proveedor.dolar).not.toHaveBeenCalled();
  });
  it('reutiliza una captura histórica sin consultar DolarAPI', async () => {
    const { service, prisma, proveedor } = setup();
    prisma.tipoCambioCotizacion.findFirst.mockResolvedValue({
      snapshotJson: cambio,
    });
    expect(await service.obtener('tenant', cambio.id)).toEqual(cambio);
    expect(prisma.tipoCambioCotizacion.findFirst).toHaveBeenCalledWith({
      where: { id: cambio.id, tenantId: 'tenant' },
    });
    expect(proveedor.dolar).not.toHaveBeenCalled();
  });
  it('conserva la lectura histórica pero exige recotizar si cambió la moneda de la empresa', async () => {
    const { service, prisma } = setup('CLP');
    prisma.tipoCambioCotizacion.findFirst.mockResolvedValue({
      snapshotJson: cambio,
    });
    expect(await service.obtener('tenant', cambio.id)).toEqual(cambio);
    await expect(
      service.obtenerParaCotizar('tenant', cambio.id),
    ).rejects.toThrow('Cambió la moneda');
  });
  it('usa la tasa manual de empresa salvo que el documento elija automático', async () => {
    const { service, proveedor } = setup('ARS', {
      modo: 'manual',
      tasaManual: 1700,
      monedaDestino: 'ARS',
    });
    expect(await service.resolver('tenant')).toMatchObject({
      tasa: 1700,
      modo: 'manual',
      origen: 'empresa',
    });
    expect(proveedor.dolar).not.toHaveBeenCalled();
    expect(
      await service.resolver('tenant', 'actor', { modo: 'automatico' }),
    ).toMatchObject({ tasa: 1535, modo: 'automatico', origen: 'documento' });
  });
  it('guarda la preferencia de empresa vinculada a su moneda actual', async () => {
    const { service, prisma } = setup('CLP');
    const config = await service.guardarConfiguracion('tenant', {
      modo: 'manual',
      tasa: 920,
    });
    expect(config).toEqual({
      modo: 'manual',
      tasaManual: 920,
      monedaDestino: 'CLP',
      referencia: null,
    });
    expect(prisma.datosEmpresa.upsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant' },
      create: { tenantId: 'tenant', tipoCambioConfig: config },
      update: { tipoCambioConfig: config },
    });
    expect(prisma.tipoCambioCotizacion.create).not.toHaveBeenCalled();
  });
  it('no permite usar la captura de otro tenant', async () => {
    const { service, prisma } = setup();
    prisma.tipoCambioCotizacion.findFirst.mockResolvedValue(null);
    await expect(service.obtener('otro', cambio.id)).rejects.toThrow(
      NotFoundException,
    );
  });
  it.each([0, -1, NaN, Infinity, 1e10])(
    'rechaza tasa manual inválida %s',
    async (tasa) => {
      await expect(
        setup().service.crear('tenant', 'actor', { modo: 'manual', tasa }),
      ).rejects.toThrow(BadRequestException);
    },
  );
  it('no usa cotizaciones automáticas vencidas', async () => {
    const { service, proveedor } = setup();
    const respuesta = await proveedor.dolar();
    respuesta.cotizaciones[0].fechaActualizacion = '2000-01-01T00:00:00.000Z';
    expect(await service.resolver('tenant')).toMatchObject({ tasa: null });
  });
  it('no aplica un cambio ARS a una empresa configurada en otra moneda', async () => {
    expect(await setup('CLP').service.resolver('tenant')).toMatchObject({
      tasa: null,
      monedaDestino: 'CLP',
    });
  });
  it('una empresa USD cotiza USD sin consultar al proveedor', async () => {
    const { service, proveedor } = setup('USD');
    expect(await service.resolver('tenant')).toMatchObject({
      tasa: 1,
      modo: 'misma_moneda',
    });
    expect(proveedor.dolar).not.toHaveBeenCalled();
  });
  it('invalida el valor manual de la empresa al cambiar su moneda', async () => {
    expect(
      await setup('CLP', {
        modo: 'manual',
        tasaManual: 1500,
        monedaDestino: 'ARS',
      }).service.resolver('tenant'),
    ).toMatchObject({ tasa: null, monedaDestino: 'CLP' });
  });
  it('rechaza documentos con capturas mezcladas o recálculos parciales', () => {
    const item = { snapshotJson: { tipoCambio: cambio } };
    expect(() =>
      validarMonedaDocumento([
        item,
        { snapshotJson: { tipoCambio: { ...cambio, id: 'fx-2' } } },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validarMonedaDocumento([item, { snapshotJson: {} }], cambio.id),
    ).toThrow(BadRequestException);
    expect(() => validarMonedaDocumento([item, item], cambio.id)).not.toThrow();
    expect(() => validarMonedaDocumento([{ snapshotJson: {} }])).not.toThrow();
  });
  it('convierte sustratos, consumibles y componentes de desgaste en sus adaptadores reales', async () => {
    const motor = Object.create(MotorUniversalService.prototype) as {
      prisma: unknown;
      cargarVariantePorId: (
        tenant: string,
        id: string,
      ) => Promise<{ precioReferencia: number }>;
      toConsumibleCargado: (c: unknown) => {
        materialVariante: { precioReferencia: number };
      };
      toComponenteDesgasteCargado: (c: unknown) => {
        materiaPrimaVariante: { precioReferencia: number };
      };
    };
    const variante = {
      ...record,
      activo: true,
      atributosVarianteJson: {},
      materiaPrima: {
        ...record.materiaPrima,
        activo: true,
        id: 'material',
        nombre: 'Ojales',
      },
    };
    motor.prisma = {
      materiaPrimaVariante: {
        findFirst: jest.fn().mockResolvedValue(variante),
      },
    };
    await monedaCotizacionContext.run(
      { tenantId: 'tenant', cambio, materiales: new Map() },
      async () => {
        expect(
          (await motor.cargarVariantePorId('tenant', 'var-1')).precioReferencia,
        ).toBe(3000);
        expect(
          motor.toConsumibleCargado({
            tipo: 'TINTA',
            unidad: 'ML',
            materiaPrimaVariante: variante,
          }).materialVariante.precioReferencia,
        ).toBe(3000);
        expect(
          motor.toComponenteDesgasteCargado({
            tipo: 'FUSOR',
            unidadDesgaste: 'COPIAS_A4_EQUIV',
            materiaPrimaVariante: variante,
          }).materiaPrimaVariante.precioReferencia,
        ).toBe(3000);
      },
    );
  });
});
