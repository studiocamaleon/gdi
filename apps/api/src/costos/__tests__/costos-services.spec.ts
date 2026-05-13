import { BadRequestException } from '@nestjs/common';
import {
  EstadoTarifaCentroCostoPeriodo,
  ImputacionPreferidaCentroCosto,
  Prisma,
  TipoCentroCosto,
  TipoRecursoCentroCosto,
  UnidadBaseCentroCosto,
} from '@prisma/client';
import { CostosMapper } from '../costos.mapper';
import { CostosRepartoService } from '../costos-reparto.service';
import { CostosTarifasService } from '../costos-tarifas.service';
import { CostosValidacionesService } from '../costos-validaciones.service';
import { TipoRecursoCentroCostoDto } from '../dto/replace-centro-recursos.dto';

const auth = { tenantId: 'tenant-1', userId: 'user-1' };

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
            tipoCentro: TipoCentroCosto.PRODUCTIVO,
            imputacionPreferida: ImputacionPreferidaCentroCosto.REPARTO,
            recursos: [],
            componentesCostoPeriodo: [
              { importeMensual: new Prisma.Decimal(1000) },
            ],
            capacidadesPeriodo: [
              { capacidadPractica: new Prisma.Decimal(100) },
            ],
          },
          {
            id: 'target',
            codigo: 'TGT',
            nombre: 'Destino productivo',
            tipoCentro: TipoCentroCosto.PRODUCTIVO,
            imputacionPreferida: ImputacionPreferidaCentroCosto.DIRECTA,
            recursos: [],
            componentesCostoPeriodo: [],
            capacidadesPeriodo: [{ capacidadPractica: new Prisma.Decimal(50) }],
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
        imputacionPreferida: ImputacionPreferidaCentroCosto.DIRECTA,
        unidadBaseFutura: UnidadBaseCentroCosto.HORA_HOMBRE,
        recursos: [
          {
            activo: true,
            tipoRecurso: TipoRecursoCentroCosto.EMPLEADO,
            maquinariaPeriodo: [],
          },
        ],
        componentesCostoPeriodo: [],
        capacidadesPeriodo: [{ capacidadPractica: new Prisma.Decimal(10) }],
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
      areaCostoId: 'area-1',
      areaCosto: { nombre: 'Impresión' },
      codigo: 'IMP',
      nombre: 'Impresión',
      descripcion: null,
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      categoriaGrafica: 'IMPRESION',
      imputacionPreferida: ImputacionPreferidaCentroCosto.DIRECTA,
      unidadBaseFutura: UnidadBaseCentroCosto.HORA_MAQUINA,
      responsableEmpleadoId: null,
      responsableEmpleado: null,
      activo: true,
      capacidadesPeriodo: [{ capacidadPractica: new Prisma.Decimal(160) }],
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
      areaCostoNombre: 'Impresión',
      estadoConfiguracion: 'borrador_pendiente',
      ultimoPeriodoConfigurado: '2026-04',
      ultimaTarifaBase: 9,
      ultimaTarifaAbsorbida: 3,
      ultimaTarifaTotal: 12,
      ultimaCapacidadPractica: 160,
    });
  });

  it('validaciones rechazan recursos inválidos antes de persistir', async () => {
    const prisma = {
      centroCosto: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'centro-1',
          plantaId: 'planta-1',
        }),
      },
    };
    const service = new CostosValidacionesService(prisma as any);

    await expect(
      service.validateRecursos(auth, 'centro-1', '2026-04', [
        {
          tipoRecurso: TipoRecursoCentroCostoDto.maquinaria,
          activo: true,
        } as any,
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('tarifa publicada conserva total con reparto absorbido', async () => {
    const targetConfig = {
      id: 'target',
      codigo: 'TGT',
      nombre: 'Destino productivo',
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      imputacionPreferida: ImputacionPreferidaCentroCosto.DIRECTA,
      unidadBaseFutura: UnidadBaseCentroCosto.HORA_MAQUINA,
      recursos: [],
      componentesCostoPeriodo: [{ importeMensual: new Prisma.Decimal(100) }],
      capacidadesPeriodo: [{ capacidadPractica: new Prisma.Decimal(10) }],
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
            tipoCentro: TipoCentroCosto.APOYO,
            imputacionPreferida: ImputacionPreferidaCentroCosto.REPARTO,
            recursos: [],
            componentesCostoPeriodo: [
              { importeMensual: new Prisma.Decimal(50) },
            ],
            capacidadesPeriodo: [],
          },
          {
            ...targetConfig,
            capacidadesPeriodo: [{ capacidadPractica: new Prisma.Decimal(10) }],
          },
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
  });
});
