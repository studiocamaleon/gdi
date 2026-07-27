import { BadRequestException } from '@nestjs/common';
import {
  EstadoTarifaCentroCostoPeriodo,
  Prisma,
  SeccionCentroCostoLinea,
  TipoCentroCosto,
} from '@prisma/client';
import { CostosMapper } from '../costos.mapper';
import { CostosRepartoService } from '../costos-reparto.service';
import { CostosTarifasService } from '../costos-tarifas.service';
import { CostosValidacionesService } from '../costos-validaciones.service';
import { SeccionCentroCostoLineaDto } from '../dto/replace-centro-lineas.dto';

const auth = { tenantId: 'tenant-1', userId: 'user-1' };

const linea = (
  importeMensual: number,
  seccion: SeccionCentroCostoLinea = SeccionCentroCostoLinea.GASTO_GENERAL,
) => ({ seccion, importeMensual: new Prisma.Decimal(importeMensual) });

function createTarifasService(prisma: any, mapper = new CostosMapper()) {
  const reparto = new CostosRepartoService(prisma, mapper);
  const validaciones = new CostosValidacionesService(prisma);
  return {
    mapper,
    reparto,
    validaciones,
    tarifas: new CostosTarifasService(prisma, mapper, reparto, validaciones),
  };
}

describe('Costos services', () => {
  it('reparto no asigna costo al propio centro origen', async () => {
    const mapper = new CostosMapper();
    const prisma = {
      centroCosto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'source',
            codigo: 'SRC',
            nombre: 'Fuente productiva',
            tipoCentro: TipoCentroCosto.NO_PRODUCTIVO,
            lineas: [linea(1000)],
            capacidadesPeriodo: [
              { horasProductivas: new Prisma.Decimal(100) },
            ],
          },
          {
            id: 'target',
            codigo: 'TGT',
            nombre: 'Destino productivo',
            tipoCentro: TipoCentroCosto.PRODUCTIVO,
            lineas: [linea(400)],
            capacidadesPeriodo: [
              { horasProductivas: new Prisma.Decimal(50) },
            ],
          },
        ]),
      },
    };
    const service = new CostosRepartoService(prisma as any, mapper);

    const reparto = await service.computeRepartoPeriodo(auth, '2026-04');

    expect(reparto.absorbidoByCentroId.has('source')).toBe(false);
    expect(reparto.absorbidoByCentroId.get('target')?.toNumber()).toBe(1000);
    expect(reparto.desgloseByCentroId.get('target')).toEqual([
      {
        desdeCentroCostoId: 'source',
        desdeCentroCodigo: 'SRC',
        desdeCentroNombre: 'Fuente productiva',
        monto: 1000,
      },
    ]);
  });

  it('advertencias evalúan costo directo más reparto absorbido', () => {
    const prisma = {};
    const { tarifas } = createTarifasService(prisma);
    const advertencias = tarifas.buildAdvertencias(
      {
        tipoCentro: TipoCentroCosto.PRODUCTIVO,
        lineas: [],
        capacidadesPeriodo: [{ horasProductivas: new Prisma.Decimal(10) }],
      } as any,
      '2026-04',
      new Prisma.Decimal(100),
    );

    expect(advertencias.join(' ')).not.toContain(
      'El costo mensual total debe ser mayor a 0',
    );
  });

  it('mapper mantiene forma de resumen con borrador pendiente', () => {
    const mapper = new CostosMapper();
    const response = mapper.toCentroResponse({
      id: 'centro-1',
      plantaId: 'planta-1',
      planta: { nombre: 'Planta Norte' },
      codigo: 'IMP',
      nombre: 'Impresión',
      descripcion: null,
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      activo: true,
      capacidadesPeriodo: [{ horasProductivas: new Prisma.Decimal(160) }],
      tarifasPeriodo: [
        {
          periodo: '2026-03',
          estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
          tarifaCalculada: new Prisma.Decimal(10),
          resumenJson: { tarifaCalculada: 10, capacidadPractica: 100 },
          updatedAt: new Date('2026-03-15T00:00:00Z'),
        },
        {
          periodo: '2026-04',
          estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
          tarifaCalculada: new Prisma.Decimal(12),
          resumenJson: {
            tarifaCalculada: 12,
            tarifaDirectaSinReparto: 9,
            tarifaAbsorbidaReparto: 3,
            capacidadPractica: 160,
          },
          updatedAt: new Date('2026-04-15T00:00:00Z'),
        },
      ],
    } as any);

    expect(response).toMatchObject({
      id: 'centro-1',
      plantaNombre: 'Planta Norte',
      estadoConfiguracion: 'borrador_pendiente',
      ultimoPeriodoConfigurado: '2026-04',
      ultimaTarifaBase: 9,
      ultimaTarifaAbsorbida: 3,
      ultimaTarifaTotal: 12,
      ultimaCapacidadPractica: 160,
    });
  });

  it('tarifa publicada conserva total con reparto absorbido', async () => {
    const targetConfig = {
      id: 'target',
      codigo: 'TGT',
      nombre: 'Destino productivo',
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      lineas: [
        linea(60, SeccionCentroCostoLinea.EMPLEADO),
        linea(40, SeccionCentroCostoLinea.ACTIVO_FIJO),
      ],
      capacidadesPeriodo: [{ horasProductivas: new Prisma.Decimal(10) }],
      tarifasPeriodo: [],
      planta: {},
      areaCosto: {},
      responsableEmpleado: null,
    };
    const prisma = {
      centroCosto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'source',
            codigo: 'SRC',
            nombre: 'Fuente de reparto',
            tipoCentro: TipoCentroCosto.NO_PRODUCTIVO,
            lineas: [linea(50)],
            capacidadesPeriodo: [],
          },
          targetConfig,
        ]),
        findFirst: jest.fn().mockResolvedValue(targetConfig),
      },
    };
    const { tarifas } = createTarifasService(prisma);

    const snapshot = await tarifas.buildTarifaSnapshot(
      auth,
      'target',
      '2026-04',
    );

    expect(snapshot.costoMensualTotal.toNumber()).toBe(150);
    expect(snapshot.tarifaCalculada.toNumber()).toBe(15);
    expect(snapshot.resumenJson).toMatchObject({
      costoMensualSinReparto: 100,
      costoMensualAbsorbidoReparto: 50,
      costoMensualTotal: 150,
      tarifaCalculada: 15,
    });
    // La mano de obra sale de las líneas de empleado y NO absorbe el reparto:
    // lo que baja de la estructura no es mano de obra del centro, y sumarlo
    // haría que el setup pague dos veces la administración.
    expect(snapshot.costoMensualManoObra.toNumber()).toBe(60);
    expect(snapshot.tarifaManoObra.toNumber()).toBe(6);
  });

  it('el importe de cada sección replica la aritmética de la planilla', () => {
    const mapper = new CostosMapper();
    const importe = (linea: any) =>
      mapper.computeImporteLinea(linea).toNumber();

    // Los mismos números del modelo de referencia, que cierran al centavo.
    // Sin dedicación cargada se asume 100%: la fila cuesta lo que costaba.
    expect(
      importe({
        seccion: SeccionCentroCostoLineaDto.empleado,
        salarioMensual: 1900,
        cargasPct: 40,
      }),
    ).toBe(2660);

    // El centro absorbe la parte que le corresponde de la persona, no el
    // sueldo entero: alguien repartido entre cuatro centros se contaría cuatro
    // veces y todas las tarifas saldrían infladas.
    expect(
      importe({
        seccion: SeccionCentroCostoLineaDto.empleado,
        salarioMensual: 1900,
        cargasPct: 40,
        dedicacionPct: 25,
      }),
    ).toBe(665);

    // Y las partes de una misma persona suman su costo, ni más ni menos.
    const persona = (pct: number) =>
      importe({
        seccion: SeccionCentroCostoLineaDto.empleado,
        salarioMensual: 1625000,
        cargasPct: 50,
        dedicacionPct: pct,
      });
    expect(persona(90) + persona(10)).toBe(persona(100));
    expect(
      importe({
        seccion: SeccionCentroCostoLineaDto.activo_fijo,
        valorActual: 5000,
        valorFinalVida: 500,
        vidaUtilRestanteMeses: 60,
      }),
    ).toBe(75);
    expect(
      importe({
        seccion: SeccionCentroCostoLineaDto.gasto_general,
        valorMensual: 250,
      }),
    ).toBe(250);
  });

  it('las validaciones de la planilla atajan lo que el DTO no puede ver solo', () => {
    const validaciones = new CostosValidacionesService({} as any);
    const fija = (extra: any) => ({
      seccion: SeccionCentroCostoLineaDto.activo_fijo,
      nombre: 'Guillotina',
      vidaUtilRestanteMeses: 12,
      valorActual: 1000,
      ...extra,
    });

    // Amortizar hacia arriba daría una depreciación negativa que abarataría el
    // centro en vez de encarecerlo.
    expect(() =>
      validaciones.validateLineas([fija({ valorFinalVida: 2000 })] as any),
    ).toThrow(BadRequestException);
    expect(() =>
      validaciones.validateLineas([fija({ valorFinalVida: 200 })] as any),
    ).not.toThrow();

    // Dos veces el mismo nombre en una sección es casi siempre un doble click,
    // y duplica el costo del centro en silencio.
    expect(() =>
      validaciones.validateLineas([
        fija({ valorFinalVida: 0 }),
        fija({ valorFinalVida: 0 }),
      ] as any),
    ).toThrow(BadRequestException);
  });

  it('el reparto se distribuye en proporción al gasto propio, no a las horas', async () => {
    const mapper = new CostosMapper();
    const prisma = {
      centroCosto: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'estructura',
            codigo: 'ADM',
            nombre: 'Administración',
            tipoCentro: TipoCentroCosto.NO_PRODUCTIVO,
            lineas: [linea(900)],
            capacidadesPeriodo: [],
          },
          {
            // Gasta el triple que el otro, pero tiene la mitad de horas.
            id: 'caro',
            codigo: 'CAR',
            nombre: 'Centro caro',
            tipoCentro: TipoCentroCosto.PRODUCTIVO,
            lineas: [linea(300)],
            capacidadesPeriodo: [{ horasProductivas: new Prisma.Decimal(80) }],
          },
          {
            id: 'barato',
            codigo: 'BAR',
            nombre: 'Centro barato',
            tipoCentro: TipoCentroCosto.PRODUCTIVO,
            lineas: [linea(100)],
            capacidadesPeriodo: [{ horasProductivas: new Prisma.Decimal(160) }],
          },
        ]),
      },
    };
    const service = new CostosRepartoService(prisma as any, mapper);

    const reparto = await service.computeRepartoPeriodo(auth, '2026-04');

    // 300 y 100 de gasto propio sobre 400 → 3 a 1. Si se repartiera por horas
    // (80 contra 160) la relación sería la inversa.
    expect(reparto.absorbidoByCentroId.get('caro')?.toNumber()).toBe(675);
    expect(reparto.absorbidoByCentroId.get('barato')?.toNumber()).toBe(225);
  });
});
